// Session timing: reward trades taken during defined high-probability windows
function scoreTiming(trades) {
  if (!trades.length) return 20;
  const GOOD_HOURS = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]); // UTC session overlap
  const inSession = trades.filter((t) => {
    if (!t.open_date) return false;
    return GOOD_HOURS.has(t.open_date.getUTCHours());
  });
  return Math.round((inSession.length / trades.length) * 20);
}

// Trade frequency: penalise overtrading (>10 trades/day is suspect)
function scoreFrequency(trades) {
  if (!trades.length) return 20;
  const byDay = {};
  for (const t of trades) {
    if (!t.open_date) continue;
    const day = t.open_date.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const days = Object.values(byDay);
  const avgPerDay = days.reduce((s, n) => s + n, 0) / days.length;
  if (avgPerDay <= 5) return 20;
  if (avgPerDay <= 10) return 14;
  if (avgPerDay <= 20) return 8;
  return 2;
}

// Emotional control: penalise clusters of losses (3+ consecutive = tilt risk)
function scoreEmotion(trades) {
  if (!trades.length) return 20;
  let maxStreak = 0;
  let streak = 0;
  for (const t of trades) {
    if ((t.profit ?? 0) < 0) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  if (maxStreak <= 2) return 20;
  if (maxStreak <= 4) return 14;
  if (maxStreak <= 6) return 8;
  return 3;
}

// Risk discipline: SL usage and consistent lot sizing
function scoreRisk(trades) {
  if (!trades.length) return 20;
  const withSL = trades.filter((t) => t.sl && t.sl !== 0).length;
  const slRatio = withSL / trades.length;

  const lots = trades.map((t) => t.volume).filter(Boolean);
  const mean = lots.reduce((s, v) => s + v, 0) / lots.length;
  const stdDev = Math.sqrt(lots.reduce((s, v) => s + (v - mean) ** 2, 0) / lots.length);
  const cv = mean > 0 ? stdDev / mean : 1; // coefficient of variation

  const slScore = slRatio * 12;
  const consistencyScore = cv < 0.2 ? 8 : cv < 0.5 ? 5 : 2;
  return Math.round(Math.min(20, slScore + consistencyScore));
}

// Outcome quality: win rate weighted by R:R proxy
function scoreQuality(trades) {
  if (!trades.length) return 20;
  const winners = trades.filter((t) => (t.profit ?? 0) > 0);
  const winRate = winners.length / trades.length;

  const avgWin = winners.length
    ? winners.reduce((s, t) => s + t.profit, 0) / winners.length
    : 0;
  const losers = trades.filter((t) => (t.profit ?? 0) <= 0);
  const avgLoss = losers.length
    ? Math.abs(losers.reduce((s, t) => s + t.profit, 0) / losers.length)
    : 1;
  const rr = avgLoss > 0 ? avgWin / avgLoss : 1;

  const winScore = winRate >= 0.6 ? 12 : winRate >= 0.45 ? 8 : 4;
  const rrScore = rr >= 1.5 ? 8 : rr >= 1 ? 5 : 2;
  return Math.min(20, winScore + rrScore);
}

function getGrade(total) {
  if (total >= 90) return 'S';
  if (total >= 80) return 'A';
  if (total >= 65) return 'B';
  if (total >= 50) return 'C';
  if (total >= 35) return 'D';
  return 'F';
}

export function calcDisciplineScore(trades) {
  const timing = scoreTiming(trades);
  const frequency = scoreFrequency(trades);
  const emotion = scoreEmotion(trades);
  const risk = scoreRisk(trades);
  const quality = scoreQuality(trades);
  const total = timing + frequency + emotion + risk + quality;
  return { timing, frequency, emotion, risk, quality, total, grade: getGrade(total) };
}
