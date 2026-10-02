/**
 * Automated script to verify Supabase Database connectivity and tables for Yukla Go
 * Usage: node --experimental-strip-types scripts/verify-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('⚠️ SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY topilmadi.');
  console.log('Iltimos, .env faylida ushbu parametrlarni to\'ldiring.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const requiredTables = [
  'delivery_branches',
  'oferta_versions',
  'users',
  'oferta_acceptances',
  'cargo_providers',
  'parcels',
  'delivery_change_requests',
  'user_roles',
  'admin_audit_logs',
  'app_settings',
];

async function verifyTables() {
  console.log(`Connecting to Supabase at ${supabaseUrl}...`);
  let hasErrors = false;

  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`  ❌ ${table}: Xatolik (${error.message})`);
        hasErrors = true;
      } else {
        console.log(`  ✓ ${table}: Mavjud va sozlangan`);
      }
    } catch (e: any) {
      console.log(`  ❌ ${table}: Ulanish xatosi (${e.message})`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log('\n✅ Barcha jadvallar muvaffaqiyatli tekshirildi!');
  } else {
    console.log('\n⚠️ Ba\'zi jadvallar topilmadi. supabase/migrations/0001_initial_schema.sql faylini SQL Editorda ishga tushiring.');
  }
}

verifyTables();
