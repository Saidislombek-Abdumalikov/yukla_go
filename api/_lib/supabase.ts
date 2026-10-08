import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://dajlwaqoqcnwrrhyvmtw.supabase.co';
const DEFAULT_SUPABASE_KEY = 'REMOVED_ROTATE_SERVICE_KEY';

let clientInstance: SupabaseClient | null = null;
let override: any = null;

export const setSupabaseForTests = (client: any | null) => {
  override = client;
};

export const getSupabase = (): SupabaseClient => {
  if (override) return override as SupabaseClient;
  if (clientInstance) return clientInstance;

  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_KEY;

  clientInstance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return clientInstance;
};
