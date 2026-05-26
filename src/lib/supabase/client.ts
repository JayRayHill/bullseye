// Supabase client. Initialized lazily on first access so build-time env-var
// substitution has happened by the time we read import.meta.env.
//
// If either VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is unset, this module
// exposes `null`. Consumers (SentHistoryContext, NotesContext) check for null
// and gracefully fall back to local-only mode — useful for local dev without
// a Supabase project, and as a defensive fallback if the backend is unreachable.
//
// Schema lives in supabase/schema.sql at the repo root; paste it into Supabase's
// SQL editor once when bootstrapping a new project.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True if Supabase is configured and the shared backend should be used. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;
  cached = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      // We don't use Supabase Auth — access is gated by the shared app
      // password (VITE_APP_PASSWORD) at the React layer, and the Postgres
      // tables use anon-permissive RLS policies. Disable Supabase's own
      // session machinery so it doesn't try to persist tokens we don't issue.
      persistSession: false,
      autoRefreshToken: false,
    },
    // Realtime is opt-in per subscription; the default is fine.
  });
  return cached;
}
