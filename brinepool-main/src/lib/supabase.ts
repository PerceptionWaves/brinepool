import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Convenience aliases
export const supabase = { from: (t: string) => getSupabase().from(t) };
export const supabaseAdmin = {
  from: (t: string) => getSupabaseAdmin().from(t),
  rpc: (fn: string, params?: Record<string, unknown>) => getSupabaseAdmin().rpc(fn, params),
};
