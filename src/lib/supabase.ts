import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Shared Supabase client, or null when the project is not configured yet.
 * Callers must handle null so the site still builds and runs without keys.
 * Server code that needs a user token or the service role uses createSupabase
 * instead of this singleton. The service role key is never read here.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = supabase !== null;

export function createSupabase(supabaseUrl: string, key: string, accessToken?: string): SupabaseClient {
  return createClient(supabaseUrl, key, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
