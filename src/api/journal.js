import { supabase } from '../lib/supabase';

export async function fetchJournalEntries(userId, limit = 30) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) {
    const err = new Error(error.message);
    err.code  = error.code;
    throw err;
  }
  return data ?? [];
}

export async function upsertJournalEntry(entry) {
  const { error } = await supabase
    .from('journal_entries')
    .upsert(entry, { onConflict: 'user_id,date' });
  if (error) {
    const err = new Error(error.message);
    err.code  = error.code;
    throw err;
  }
}
