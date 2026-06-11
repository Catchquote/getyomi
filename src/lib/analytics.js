// PnL grouped by hour of day (0–23)
export function getHourlyPnl(trades) {
  const map = {};
  for (const t of trades) {
    if (!t.open_date) continue;
    const h = t.open_date.getHours();
    map[h] = (map[h] || 0) + (t.profit ?? 0);
  }
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, pnl: map[h] ?? 0 }));
}

// Trade count bucketed by lot size
export function getLotBuckets(trades) {
  const buckets = { '0.01': 0, '0.02–0.05': 0, '0.06–0.10': 0, '0.11–0.50': 0, '0.51+': 0 };
  for (const t of trades) {
    const v = t.volume ?? 0;
    if (v <= 0.01) buckets['0.01']++;
    else if (v <= 0.05) buckets['0.02–0.05']++;
    else if (v <= 0.10) buckets['0.06–0.10']++;
    else if (v <= 0.50) buckets['0.11–0.50']++;
    else buckets['0.51+']++;
  }
  return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}

// Running cumulative PnL over trades sorted by close time
export function getEquityCurve(trades) {
  const sorted = [...trades].sort((a, b) => (a.close_date ?? 0) - (b.close_date ?? 0));
  let running = 0;
  return sorted.map((t, i) => {
    running += t.profit ?? 0;
    return { index: i + 1, equity: parseFloat(running.toFixed(2)), trade: t };
  });
}

// Max drawdown from peak at each trade
export function getDrawdownMap(trades) {
  const curve = getEquityCurve(trades);
  let peak = 0;
  return curve.map((point) => {
    peak = Math.max(peak, point.equity);
    const dd = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    return { index: point.index, drawdown: parseFloat(dd.toFixed(2)) };
  });
}

// Indices of trades that may be revenge trades:
// a loss followed within 5 minutes by another trade
export function getRevengeTradeIndices(trades) {
  const sorted = [...trades]
    .map((t, i) => ({ ...t, _orig: i }))
    .sort((a, b) => (a.open_date ?? 0) - (b.open_date ?? 0));

  const indices = new Set();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if ((prev.profit ?? 0) < 0 && curr.open_date && prev.close_date) {
      const gap = (curr.open_date - prev.close_date) / 60000;
      if (gap >= 0 && gap <= 5) indices.add(curr._orig);
    }
  }
  return [...indices];
}

// Rolling win rate over a sliding window of N trades
export function getRollingWinRate(trades, window = 10) {
  const sorted = [...trades].sort((a, b) => (a.close_date ?? 0) - (b.close_date ?? 0));
  return sorted.map((_, i) => {
    if (i < window - 1) return { index: i + 1, winRate: null };
    const slice = sorted.slice(i - window + 1, i + 1);
    const wins = slice.filter((t) => (t.profit ?? 0) > 0).length;
    return { index: i + 1, winRate: parseFloat(((wins / window) * 100).toFixed(1)) };
  });
}

// Per-trade quality score (0–100) based on SL usage, duration, and profit sign
export function getQualityScores(trades) {
  return trades.map((t, i) => {
    let score = 0;
    if (t.sl && t.sl !== 0) score += 40;
    if ((t.duration_mins ?? 0) > 1) score += 20;
    if ((t.profit ?? 0) > 0) score += 40;
    return { index: i + 1, ticket: t.ticket, score };
  });
}
