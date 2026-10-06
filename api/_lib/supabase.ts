import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;
let override: any = null;

/** Test hook: inject a fake client (pass null to remove). */
export const setSupabaseForTests = (client: any | null) => {
  override = client;
};

export const getSupabase = (): SupabaseClient | null => {
  if (override) return override as SupabaseClient;
  if (clientInstance) return clientInstance;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (url && key) {
    clientInstance = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return clientInstance;
  }
  return null;
};
