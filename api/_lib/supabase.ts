import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://dajlwaqoqcnwrrhyvmtw.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhamx3YXFvcWNud3JyaHl2bXR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwOTk4NSwiZXhwIjoyMTA2Nzg1OTg1fQ.12KfEAK7aU17B2bidfcxeag8P0yLlKJq8QAhoq5mhAs';

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
