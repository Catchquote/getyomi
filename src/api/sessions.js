import { supabase } from '../lib/supabase';

export async function fetchSessions(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
