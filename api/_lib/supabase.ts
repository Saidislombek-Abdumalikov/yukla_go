import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let clientInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (clientInstance) return clientInstance;
  if (supabaseUrl && supabaseServiceKey) {
    clientInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return clientInstance;
  }
  return null;
};
