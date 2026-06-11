import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { getHourlyPnl, getEquityCurve, getDrawdownMap, getRevengeTradeIndices, getRollingWinRate } from '../lib/analytics';
import { calcDisciplineScore } from '../lib/scoreEngine';
import { useTheme } from '../contexts/ThemeContext';
import { getChartTheme } from '../lib/chartTheme';
import { useTrades } from '../hooks/useTrades';

// ─── helpers ─────────────────────────────────────────────────────────────────

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function dollar(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n >= 0 ? '+$' : '-$') + abs;
}
function pct(n, d = 1) {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(d) + '%';
}
function isPos(n) { return n >= 0; }

// ─── sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, valueStyle }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '16px 18px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 500, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', ...valueStyle }}>{value}</p>
      {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--t3)' }}>{sub}</p>}
    </div>
  );
}

function Card({ title, children, style }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '18px 20px', ...style }}>
      {title && <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>}
      {children}
    </div>
  );
}

function ScoreBar({ label, score, max = 20 }) {
  const frac = score / max;
  const color = frac >= 0.7 ? 'var(--accent)' : frac >= 0.4 ? 'var(--warn)' : 'var(--loss)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--t2)' }}>{label}</span>
        <span style={{ color: 'var(--t1)', fontWeight: 600 }}>{score}<span style={{ color: 'var(--t3)', fontWeight: 400 }}>/{max}</span></span>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.round(frac * 100)}%`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

const GRADE_COLOR = { S: '#F59E0B', A: '#1D9E75', B: '#6366F1', C: '#F97316', D: '#E24B4A', F: '#E24B4A' };

const SCORE_META = {
  timing:    { label: 'Session Timing',    insight: (s) => s < 8 ? 'Most trades were outside peak London/NY hours — high spread, low liquidity.' : s < 14 ? 'Some trades taken in lower-probability off-session windows.' : null },
  frequency: { label: 'Trade Frequency',   insight: (s) => s < 8 ? 'Heavy overtrading detected. Target max 5 setups per day.' : s < 14 ? 'Some sessions had above-average trade counts.' : null },
  emotion:   { label: 'Emotional Control', insight: (s) => s < 8 ? 'Long losing streaks detected — add a 3-loss kill switch.' : s < 14 ? 'Moderate losing streaks suggest emotional pressure.' : null },
  risk:      { label: 'Risk Discipline',   insight: (s) => s < 8 ? 'Many trades had no stop loss and erratic lot sizing.' : s < 14 ? 'Inconsistent SL usage or lot sizing variance detected.' : null },
  quality:   { label: 'Outcome Quality',   insight: (s) => s < 8 ? 'Win rate and R:R ratio both below acceptable thresholds.' : s < 14 ? 'Win rate or reward-to-risk ratio needs improvement.' : null },
};

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { theme } = useTheme();
  const ct = getChartTheme(theme);

  const { data: trades = [], isPending: loading, error: queryError } = useTrades();
  const error = queryError?.message ?? null;

  const analytics = useMemo(() => {
    if (!trades.length) return null;
    return {
      equityCurve:    getEquityCurve(trades).map(({ index, equity }) => ({ index, equity: Number.isFinite(equity) ? equity : 0 })),
      hourlyPnl:      getHourlyPnl(trades).map((p) => ({ ...p, pnl: Number.isFinite(p.pnl) ? p.pnl : 0 })),
      rollingWinRate: getRollingWinRate(trades),
      revengeCount:   getRevengeTradeIndices(trades).length,
    };
  }, [trades]);

  const metrics = useMemo(() => {
    if (!trades.length) return null;
    const winners = trades.filter((t) => t.profit > 0);
    const losers  = trades.filter((t) => t.profit < 0);
    const totalPnl = trades.reduce((s, t) => s + toNum(t.profit), 0);
    const winRate  = (winners.length / trades.length) * 100;
    const grossWin  = winners.reduce((s, t) => s + toNum(t.profit), 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + toNum(t.profit), 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;

    const ddMap = getDrawdownMap(trades);
    const maxDD = ddMap.length ? Math.max(...ddMap.map((d) => d.drawdown)) : 0;

    let bestStreak = 0, streak = 0;
    for (const t of trades) { if (t.profit > 0) { streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0; }

    const getBucket = (v) => { if (v <= 0.01) return '0.01'; if (v <= 0.05) return '0.02–0.05'; if (v <= 0.10) return '0.06–0.10'; if (v <= 0.50) return '0.11–0.50'; return '0.51+'; };
    const lotMap = {};
    for (const t of trades) { const b = getBucket(t.volume ?? 0); lotMap[b] = (lotMap[b] ?? 0) + toNum(t.profit); }
    const lotPnlData = ['0.01', '0.02–0.05', '0.06–0.10', '0.11–0.50', '0.51+'].filter((b) => b in lotMap).map((b) => ({ label: b, pnl: parseFloat(lotMap[b].toFixed(2)) }));

    const avgDur = (arr) => arr.length ? Math.round(arr.reduce((s, t) => s + toNum(t.duration_mins), 0) / arr.length) : 0;
    const durationData = [{ label: 'Winners', mins: avgDur(winners) }, { label: 'Losers', mins: avgDur(losers) }];
    const donutData = [{ name: 'Wins', value: winners.length }, { name: 'Losses', value: losers.length }];

    return { totalPnl, winRate, profitFactor, maxDD, bestStreak, winsCount: winners.length, lossesCount: losers.length, donutData, lotPnlData, durationData };
  }, [trades]);

  const score = useMemo(() => calcDisciplineScore(trades), [trades]);
  const insights = useMemo(() => {
    if (!score) return [];
    return ['timing', 'frequency', 'emotion', 'risk', 'quality']
      .map((k) => ({ score: score[k], ...SCORE_META[k] }))
      .sort((a, b) => a.score - b.score).slice(0, 3)
      .map(({ score: s, insight }) => insight(s)).filter(Boolean);
  }, [score]);

  const TIP = useMemo(() => ({
    contentStyle: { background: ct.tooltip.background, border: `1px solid ${ct.tooltip.border}`, borderRadius: 8, fontSize: 11, color: ct.tooltip.color, padding: '6px 10px' },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
    itemStyle: { color: ct.axis },
  }), [ct]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: 'var(--t3)', fontSize: 13 }}>Loading trades…</p></div>;
  if (error)   return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: 'var(--loss)', fontSize: 13 }}>Error: {error}</p></div>;
  if (!trades.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <p style={{ color: 'var(--t2)', fontSize: 14 }}>No trades imported yet.</p>
      <Link to="/import" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>Import CSV →</Link>
    </div>
  );

  const { equityCurve, hourlyPnl, rollingWinRate, revengeCount } = analytics;
  const { totalPnl, winRate, profitFactor, maxDD, bestStreak, winsCount, lossesCount, donutData, lotPnlData, durationData } = metrics;

  const pfColor = !profitFactor ? 'var(--t2)' : profitFactor >= 1.5 ? 'var(--accent)' : profitFactor >= 1 ? 'var(--warn)' : 'var(--loss)';
  const RING_C = 263.9;
  const ringColor = score.total >= 80 ? 'var(--accent)' : score.total >= 50 ? 'var(--warn)' : 'var(--loss)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400 }}>

      {/* ── Section 1: Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        <MetricCard label="Total P&L"      value={dollar(totalPnl)}  valueStyle={{ color: isPos(totalPnl) ? 'var(--accent)' : 'var(--loss)' }} />
        <MetricCard label="Win Rate"       value={pct(winRate)}       sub={`${winsCount}W / ${lossesCount}L`} valueStyle={{ color: 'var(--t1)' }} />
        <MetricCard label="Total Trades"   value={trades.length}     valueStyle={{ color: 'var(--t1)' }} />
        <MetricCard label="Profit Factor"  value={profitFactor != null && Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : '—'} valueStyle={{ color: pfColor }} />
        <MetricCard label="Max Drawdown"   value={pct(maxDD)}         valueStyle={{ color: maxDD > 20 ? 'var(--loss)' : maxDD > 10 ? 'var(--warn)' : 'var(--t1)' }} />
        <MetricCard label="Best Streak"    value={`${bestStreak}×`}  valueStyle={{ color: 'var(--t1)' }} />
      </div>

      {/* ── Section 2: Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Card title="Equity Curve">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equityCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={isPos(totalPnl) ? ct.win : ct.loss} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isPos(totalPnl) ? ct.win : ct.loss} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="index" tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={52} />
              <Tooltip {...TIP} formatter={(v) => [`$${Number.isFinite(v) ? v.toFixed(2) : '0.00'}`, 'Equity']} labelFormatter={(l) => `Trade #${l}`} />
              <Area type="monotone" dataKey="equity" stroke={isPos(totalPnl) ? ct.win : ct.loss} fill="url(#eq-grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Win / Loss">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={78} dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                <Cell fill={ct.win} />
                <Cell fill={ct.loss} />
              </Pie>
              <Tooltip {...TIP} formatter={(v, name) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: -4 }}>
            {[['Wins', winsCount, ct.win], ['Losses', lossesCount, ct.loss]].map(([l, v, c]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                {l} {v}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Rolling win rate */}
      <Card title="Rolling Win Rate (10-trade window)">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={rollingWinRate} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis dataKey="index" tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
            <Tooltip {...TIP} formatter={(v) => [v != null ? `${v}%` : '—', 'Win Rate']} labelFormatter={(l) => `Trade #${l}`} />
            <Line type="monotone" dataKey="winRate" stroke={ct.blue} dot={false} strokeWidth={2} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Section 3: Behaviour ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Card title="P&L by Hour">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyPnl} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} tickFormatter={(h) => `${h}h`} />
              <YAxis tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={44} />
              <Tooltip {...TIP} formatter={(v) => [`$${Number.isFinite(v) ? v.toFixed(2) : '0.00'}`, 'P&L']} labelFormatter={(l) => `${l}:00`} />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {hourlyPnl.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? ct.win : ct.loss} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Avg Hold Duration (min)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={durationData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.axis }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} width={36} />
              <Tooltip {...TIP} formatter={(v) => [`${Number.isFinite(v) ? v : 0} min`, 'Avg Duration']} />
              <Bar dataKey="mins" radius={[4, 4, 0, 0]}>
                <Cell fill={ct.win} />
                <Cell fill={ct.loss} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="P&L by Lot Size">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={lotPnlData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={44} />
              <Tooltip {...TIP} formatter={(v) => [`$${Number.isFinite(v) ? v.toFixed(2) : '0.00'}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {lotPnlData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? ct.win : ct.loss} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Section 4: Discipline Scorecard ── */}
      <Card title="Discipline Scorecard">
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 32, alignItems: 'start' }}>

          {/* Ring + grade */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', width: 136, height: 136 }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface2)" strokeWidth="9" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={score.total >= 80 ? ct.win : score.total >= 50 ? ct.warn : ct.loss} strokeWidth="9" strokeDasharray={`${(score.total / 100) * RING_C} ${RING_C}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>{score.total}</span>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>/ 100</span>
              </div>
            </div>
            <div style={{ padding: '5px 18px', borderRadius: 20, border: `1.5px solid ${GRADE_COLOR[score.grade]}`, background: `${GRADE_COLOR[score.grade]}18`, color: GRADE_COLOR[score.grade], fontWeight: 700, fontSize: 13 }}>
              Grade {score.grade}
            </div>
          </div>

          {/* Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ScoreBar label="Session Timing"    score={score.timing} />
            <ScoreBar label="Trade Frequency"   score={score.frequency} />
            <ScoreBar label="Emotional Control" score={score.emotion} />
            <ScoreBar label="Risk Discipline"   score={score.risk} />
            <ScoreBar label="Outcome Quality"   score={score.quality} />
          </div>

          {/* Insights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>What to improve</p>
            {insights.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0 }}>All categories performing well. Keep it up.</p>
              : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {insights.map((msg, i) => (
                    <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
                      <span style={{ color: 'var(--loss)', flexShrink: 0, marginTop: 1 }}>▾</span>
                      {msg}
                    </li>
                  ))}
                </ul>
              )
            }
            {revengeCount > 0 && (
              <div style={{ marginTop: 4, padding: '8px 12px', borderRadius: 7, background: 'var(--warn-muted)', border: '1px solid var(--warn)' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--warn)' }}>
                  <strong>{revengeCount} potential revenge trade{revengeCount !== 1 ? 's' : ''}</strong> — entered within 5 min of a loss.
                </p>
              </div>
            )}
          </div>

        </div>
      </Card>

    </div>
  );
}
