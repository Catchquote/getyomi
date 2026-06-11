import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseMT5CSV } from '../lib/parseCSV';
import { useAuth } from '../hooks/useAuth';
import { validateCSVFile, checkImportRateLimit, recordImport } from '../lib/validation';
import { fetchExistingTickets, insertTrades, fetchTradeStats } from '../api/trades';
import { supabase } from '../lib/supabase';

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseSummary(trades) {
  const dates = trades.map((t) => t.open_date).filter(Boolean).sort((a, b) => a - b);
  const totalPnl = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
  return { count: trades.length, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null, totalPnl };
}

const COLS = ['ticket', 'symbol', 'direction', 'open_time', 'close_time', 'volume', 'profit'];

function Card({ children, style }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 8, ...style }}>{children}</div>;
}

function StatPill({ label, value, valueStyle }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '12px 18px', minWidth: 120 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', ...valueStyle }}>{value}</p>
    </div>
  );
}

export default function Import() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [trades, setTrades]         = useState(null);
  const [parseErr, setParseErr]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [savedCount, setSavedCount] = useState(null);
  const [saveErr, setSaveErr]       = useState(null);
  const [dbStats, setDbStats]       = useState(null);

  // Load current DB summary
  useEffect(() => {
    if (!user?.id) return;
    fetchTradeStats(user.id).then((stats) => { if (stats) setDbStats(stats); }).catch(() => {});
  }, [savedCount, user?.id]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const fileErr = validateCSVFile(file);
    if (fileErr) { setParseErr(fileErr); return; }
    setParseErr(null); setTrades(null); setSavedCount(null); setSaveErr(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseMT5CSV(e.target.result);
        if (!parsed.length) { setParseErr('No valid trades found. Make sure this is an MT5 positions history CSV.'); return; }
        setTrades(parsed);
      } catch { setParseErr('Could not parse file — check it is a valid MT5 CSV export.'); }
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = async () => {
    if (!trades?.length) return;
    if (!user?.id) { setSaveErr('Not signed in — please log out and sign in again.'); return; }
    const rateCheck = checkImportRateLimit();
    if (!rateCheck.allowed) { setSaveErr(rateCheck.message); return; }
    setSaving(true); setSaveErr(null);
    try {
      // Verify JWT is valid with a live server check before attempting insert
      const { data: { user: liveUser }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !liveUser) {
        setSaveErr('Session expired — please sign out and sign in again.');
        return;
      }

      // Diagnostic: ask the database what it sees for this request
      const { data: rls, error: rlsErr } = await supabase.rpc('debug_rls');
      if (rlsErr) {
        // Function not in DB yet — skip diagnostic, proceed
      } else {
        const authUid  = rls?.auth_uid  ?? 'NULL';
        const jwtSub   = rls?.jwt_sub   ?? '';
        const role     = rls?.current_role ?? '';
        if (!rls?.auth_uid) {
          setSaveErr(
            `RLS blocked: auth.uid() is NULL in the database.\n` +
            `DB role: ${role} | jwt_sub: "${jwtSub || 'empty'}"\n` +
            `Client user.id: ${liveUser.id}\n` +
            `→ JWT is NOT reaching PostgREST. Sign out, sign in again, then retry.`
          );
          return;
        }
        if (authUid !== liveUser.id) {
          setSaveErr(
            `UID mismatch: DB auth.uid()="${authUid}" but client user.id="${liveUser.id}".\n` +
            `Sign out, sign in again, then retry.`
          );
          return;
        }
      }

      const existingTickets = await fetchExistingTickets(liveUser.id);
      const newTrades = trades
        .filter((t) => !existingTickets.has(t.ticket))
        .map(({ open_date, close_date, open_time, close_time, ...rest }) => ({
          ...rest,
          user_id:    liveUser.id,
          open_time:  open_date?.toISOString()  ?? null,
          close_time: close_date?.toISOString() ?? null,
        }));
      if (!newTrades.length) { setSavedCount(0); return; }
      await insertTrades(newTrades);
      recordImport();
      setSavedCount(newTrades.length);
      setTimeout(() => navigate('/dashboard'), 1400);
    } catch (err) {
      setSaveErr('Import failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const summary = trades ? parseSummary(trades) : null;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Drop zone */}
      {!trades && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '60px 40px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              cursor: 'pointer', transition: 'background 0.15s',
              background: isDragging ? 'var(--accent-muted)' : 'transparent',
              borderRadius: 8,
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: 14, border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--bdr2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDragging ? 'var(--accent)' : 'var(--t3)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>
                Drop your MT5 CSV here, or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse</span>
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--t3)' }}>Positions history export (.csv)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        </Card>
      )}

      {/* Parse error */}
      {parseErr && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-muted)', border: '1px solid var(--loss)', fontSize: 13, color: 'var(--loss)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{parseErr}</span>
          <button onClick={() => { setParseErr(null); setTrades(null); }} style={{ background: 'none', border: 'none', color: 'var(--loss)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>Try again</button>
        </div>
      )}

      {/* Preview */}
      {trades && summary && !savedCount && (
        <>
          {/* Summary pills */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatPill label="Trades found" value={summary.count} valueStyle={{ color: 'var(--t1)' }} />
            <StatPill label="Date range"   value={`${fmtDate(summary.from)} – ${fmtDate(summary.to)}`} valueStyle={{ color: 'var(--t1)', fontSize: 13 }} />
            <StatPill label="Total P&L"    value={`${summary.totalPnl >= 0 ? '+' : ''}$${fmt(summary.totalPnl)}`} valueStyle={{ color: summary.totalPnl >= 0 ? 'var(--accent)' : 'var(--loss)' }} />
          </div>

          {/* Table */}
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bdr)' }}>
                    {COLS.map((c) => (
                      <th key={c} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 100).map((t, i) => (
                    <tr key={t.ticket ?? i} style={{ borderBottom: '1px solid var(--bdr)' }}>
                      {COLS.map((c) => (
                        <td key={c} style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: c === 'profit' ? ((t[c] ?? 0) >= 0 ? 'var(--accent)' : 'var(--loss)') : 'var(--t1)', fontWeight: c === 'profit' ? 600 : 400 }}>
                          {c === 'profit' ? (t[c] != null ? fmt(t[c]) : '—') : (t[c] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {trades.length > 100 && (
                <p style={{ padding: '8px 12px', margin: 0, fontSize: 11, color: 'var(--t3)' }}>Showing first 100 of {trades.length} trades</p>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleConfirm} disabled={saving}
              style={{ padding: '9px 20px', borderRadius: 7, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {saving && <svg style={{ animation: 'spin 1s linear infinite', width: 14, height: 14 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" /><path fill="currentColor" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {saving ? 'Saving…' : `Confirm import (${trades.length} trades)`}
            </button>
            <button onClick={() => { setTrades(null); setParseErr(null); }} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--t3)', cursor: 'pointer' }}>Cancel</button>
          </div>
          {saveErr && <p style={{ margin: 0, fontSize: 12, color: 'var(--loss)' }}>{saveErr}</p>}
        </>
      )}

      {/* Success */}
      {savedCount != null && (
        <Card style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-muted)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>
            {savedCount === 0 ? 'All trades already imported.' : `${savedCount} trade${savedCount !== 1 ? 's' : ''} saved successfully.`}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--t3)' }}>Redirecting to dashboard…</p>
        </Card>
      )}

      {/* Current dataset */}
      {dbStats && !trades && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Dataset</p>
          <Card style={{ padding: '16px 20px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['Trades', dbStats.count],
              ['Total P&L', `${dbStats.total >= 0 ? '+' : ''}$${Math.abs(dbStats.total).toFixed(2)}`],
              ['From', new Date(dbStats.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
              ['To',   new Date(dbStats.to).toLocaleDateString('en-US',   { month: 'short', day: 'numeric', year: 'numeric' })],
            ].map(([l, v]) => (
              <div key={l}>
                <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>{v}</p>
              </div>
            ))}
          </Card>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
