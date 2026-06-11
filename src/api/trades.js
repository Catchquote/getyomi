import { supabase } from '../lib/supabase';

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function hydrateTrade(t) {
  return {
    ...t,
    profit:        toNum(t.profit),
    volume:        toNum(t.volume),
    open_price:    toNum(t.open_price),
    close_price:   toNum(t.close_price),
    duration_mins: toNum(t.duration_mins),
    sl:            toNum(t.sl),
    tp:            toNum(t.tp),
    commission:    toNum(t.commission),
    swap:          toNum(t.swap),
    open_date:     t.open_time  ? new Date(t.open_time)  : null,
    close_date:    t.close_time ? new Date(t.close_time) : null,
  };
}

export async function fetchTrades(userId, { limit = 1000, offset = 0 } = {}) {
  if (!userId) throw new Error('userId is required');
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('open_time', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map(hydrateTrade);
}

export async function fetchExistingTickets(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('trades')
    .select('ticket')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.ticket));
}

export async function insertTrades(trades) {
  const { error } = await supabase.from('trades').insert(trades);
  if (error) throw new Error(error.message);
}

export async function fetchTradeStats(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('trades')
    .select('profit, open_time')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  if (!data?.length) return null;
  const profits = data.map((r) => toNum(r.profit));
  const total   = profits.reduce((s, n) => s + n, 0);
  const dates   = data.map((r) => r.open_time).filter(Boolean).sort();
  return { count: data.length, total, from: dates[0], to: dates[dates.length - 1] };
}
