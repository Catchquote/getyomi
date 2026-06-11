import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    '[Yomi] Missing Supabase environment variables.\n' +
    'Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'See .env.example for the required format.'
  );
}

// When PostgREST returns 401 the stored JWT is invalid (wrong project, rotated
// secret, etc.). Auto-sign-out so ProtectedRoute redirects to /login and the
// user gets a fresh token on next login.
let _client = null;
const fetchWithTokenRecovery = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 401) {
    const reqUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    if (reqUrl.includes('/rest/v1/') && _client) {
      _client.auth.signOut().catch(() => {});
    }
  }
  return res;
};

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: { fetch: fetchWithTokenRecovery },
});
_client = supabase;
