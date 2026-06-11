import { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '../lib/supabase';
import { calcDisciplineScore } from '../lib/scoreEngine';
import { useTheme } from '../contexts/ThemeContext';
import { getChartTheme } from '../lib/chartTheme';

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

const GRADE_COLOR = { S: '#F59E0B', A: '#1D9E75', B: '#6366F1', C: '#F97316', D: '#E24B4A', F: '#E24B4A' };
const GRADE_INFO  = [
  { grade: 'S', range: '90–100', label: 'Elite',      desc: 'Exceptional discipline across all areas' },
  { grade: 'A', range: '80–89',  label: 'Strong',     desc: 'Consistently following the rules' },
  { grade: 'B', range: '65–79',  label: 'Good',       desc: 'Mostly disciplined with minor lapses' },
  { grade: 'C', range: '50–64',  label: 'Average',    desc: 'Some discipline but notable gaps' },
  { grade: 'D', range: '35–49',  label: 'Weak',       desc: 'Frequent rule breaks, needs work' },
  { grade: 'F', range: '0–34',   label: 'Poor',       desc: 'Significant discipline issues' },
];

function Card({ children, style }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '20px 22px', ...style }}>{children}</div>;
}

function SectionTitle({ children }) {
  return <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</p>;
}

export default function Scorecard() {
  const { theme } = useTheme();
  const ct = getChartTheme(theme);

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from('trades').select('*').then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      const hydrated = (data ?? []).map((t) => ({
        ...t,
        profit: toNum(t.profit), volume: toNum(t.volume), sl: toNum(t.sl), duration_mins: toNum(t.duration_mins),
        open_date:  t.open_time  ? new Date(t.open_time)  : null,
        close_date: t.close_time ? new Date(t.close_time) : null,
      }));
      setTrades(hydrated);
      setLoading(false);
    });
  }, []);

  // Group trades by day
  const dailyData = useMemo(() => {
    if (!trades.length) return [];
    const byDay = {};
    for (const t of trades) {
      if (!t.open_date) continue;
      const d = t.open_date.toISOString().slice(0, 10);
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(t);
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayTrades]) => {
        const s = calcDisciplineScore(dayTrades);
        const pnl = dayTrades.reduce((sum, t) => sum + t.profit, 0);
        const wins = dayTrades.filter((t) => t.profit > 0).length;
        return { date, score: s.total, grade: s.grade, pnl, trades: dayTrades.length, winRate: dayTrades.length ? Math.round((wins / dayTrades.length) * 100) : 0, breakdown: s };
      });
  }, [trades]);

  const overallScore = useMemo(() => calcDisciplineScore(trades), [trades]);

  const mostRecent = dailyData[dailyData.length - 1];

  const TIP = {
    contentStyle: { background: ct.tooltip.background, border: `1px solid ${ct.tooltip.border}`, borderRadius: 8, fontSize: 11, color: ct.tooltip.color, padding: '6px 10px' },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: 'var(--t3)' }}>Loading…</p></div>;
  if (error)   return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: 'var(--loss)' }}>Error: {error}</p></div>;
  if (!trades.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10 }}>
      <p style={{ color: 'var(--t2)', fontSize: 14 }}>No trades yet — import a CSV to see your scorecard.</p>
    </div>
  );

  const RING_C = 263.9;
  const score = overallScore;
  const ringColor = score.total >= 80 ? ct.win : score.total >= 50 ? ct.warn : ct.loss;

  return (
    <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Top row: overall score + latest session */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>

        {/* Overall score ring */}
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '32px 22px' }}>
          <SectionTitle>Overall Discipline</SectionTitle>
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface2)" strokeWidth="9" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={ringColor} strokeWidth="9" strokeDasharray={`${(score.total / 100) * RING_C} ${RING_C}`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--t1)' }}>{score.total}</span>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>/ 100</span>
            </div>
          </div>
          <div style={{ padding: '5px 20px', borderRadius: 20, border: `1.5px solid ${GRADE_COLOR[score.grade]}`, background: `${GRADE_COLOR[score.grade]}18`, color: GRADE_COLOR[score.grade], fontWeight: 700, fontSize: 14 }}>
            Grade {score.grade}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>{trades.length} trades · {dailyData.length} sessions</p>
        </Card>

        {/* Latest session breakdown */}
        {mostRecent && (
          <Card>
            <SectionTitle>Latest Session — {new Date(mostRecent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
              {[
                ['Score', `${mostRecent.score}/100`, { color: GRADE_COLOR[mostRecent.grade] }],
                ['Grade', `Grade ${mostRecent.grade}`, { color: GRADE_COLOR[mostRecent.grade] }],
                ['Trades', mostRecent.trades, {}],
                ['Win Rate', `${mostRecent.winRate}%`, {}],
              ].map(([l, v, s]) => (
                <div key={l} style={{ background: 'var(--surface2)', borderRadius: 7, padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--t1)', ...s }}>{v}</p>
                </div>
              ))}
            </div>
            {['timing', 'frequency', 'emotion', 'risk', 'quality'].map((k) => {
              const labels = { timing: 'Session Timing', frequency: 'Trade Frequency', emotion: 'Emotional Control', risk: 'Risk Discipline', quality: 'Outcome Quality' };
              const s = mostRecent.breakdown[k]; const frac = s / 20;
              const color = frac >= 0.7 ? 'var(--accent)' : frac >= 0.4 ? 'var(--warn)' : 'var(--loss)';
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 36px', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{labels[k]}</span>
                  <div style={{ height: 5, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.round(frac * 100)}%` }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', textAlign: 'right' }}>{s}/20</span>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Score history chart */}
      <Card>
        <SectionTitle>Score History</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} width={32} />
            <Tooltip {...TIP} formatter={(v, n) => [v, n === 'score' ? 'Score' : n]} labelFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
            <Line type="monotone" dataKey="score" stroke={ct.win} dot={{ fill: ct.win, r: 3, strokeWidth: 0 }} strokeWidth={2} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Session table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--bdr)' }}>
          <SectionTitle>Session History</SectionTitle>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bdr)' }}>
                {['Date', 'Score', 'Grade', 'Trades', 'Win Rate', 'P&L', 'Timing', 'Frequency', 'Emotion', 'Risk', 'Quality'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...dailyData].reverse().map((row) => (
                <tr key={row.date} style={{ borderBottom: '1px solid var(--bdr)' }}>
                  <td style={{ padding: '9px 14px', color: 'var(--t1)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ padding: '9px 14px', color: GRADE_COLOR[row.grade], fontWeight: 700 }}>{row.score}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, background: `${GRADE_COLOR[row.grade]}18`, color: GRADE_COLOR[row.grade], fontWeight: 600, fontSize: 11 }}>{row.grade}</span>
                  </td>
                  <td style={{ padding: '9px 14px', color: 'var(--t2)' }}>{row.trades}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--t2)' }}>{row.winRate}%</td>
                  <td style={{ padding: '9px 14px', color: row.pnl >= 0 ? 'var(--accent)' : 'var(--loss)', fontWeight: 600 }}>
                    {row.pnl >= 0 ? '+' : ''}{row.pnl.toFixed(2)}
                  </td>
                  {['timing', 'frequency', 'emotion', 'risk', 'quality'].map((k) => (
                    <td key={k} style={{ padding: '9px 14px', color: 'var(--t2)' }}>{row.breakdown[k]}/20</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Grade scale */}
      <Card>
        <SectionTitle>Grade Scale</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {GRADE_INFO.map(({ grade, range, label, desc }) => (
            <div key={grade} style={{ background: 'var(--surface2)', borderRadius: 7, padding: '12px 14px', borderTop: `3px solid ${GRADE_COLOR[grade]}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: GRADE_COLOR[grade] }}>{grade}</span>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>{range}</span>
              </div>
              <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--t3)', lineHeight: 1.4 }}>{desc}</p>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
