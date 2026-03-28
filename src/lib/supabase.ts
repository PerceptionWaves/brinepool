import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export const supabase = {
  get client() {
    if (!_supabase) {
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return _supabase;
  },
  from(table: string) {
    return this.client.from(table);
  },
};

export const supabaseAdmin = {
  get client() {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
    }
    return _supabaseAdmin;
  },
  from(table: string) {
    return this.client.from(table);
  },
  rpc(fn: string, params?: Record<string, unknown>) {
    return this.client.rpc(fn, params);
  },
};
