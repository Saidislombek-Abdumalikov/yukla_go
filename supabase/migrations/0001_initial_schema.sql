-- ==============================================================================
-- YUKLA GO — SUPABASE / POSTGRES INITIAL SCHEMA (STAGE 2)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START WITH 100;

-- 3. COMMON TRIGGER FOR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCTION TO GENERATE UNIQUE CUSTOMER CODE (YK-100, YK-101...)
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'YK-' || nextval('customer_code_seq')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 5. TABLES
-- ==============================================================================

-- 5.1 DELIVERY BRANCHES MASTER TABLE (EMU, BTS, UzPost)
CREATE TABLE IF NOT EXISTS delivery_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('EMU', 'BTS', 'UZPOST')),
    provider_branch_code TEXT,
    region TEXT NOT NULL,
    district TEXT,
    city TEXT,
    branch_name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_delivery_branches_updated_at
BEFORE UPDATE ON delivery_branches
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_delivery_branches_provider_active ON delivery_branches(provider, active);
CREATE INDEX IF NOT EXISTS idx_delivery_branches_region ON delivery_branches(region);

-- 5.2 OFERTA VERSIONS
CREATE TABLE IF NOT EXISTS oferta_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5.3 USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT UNIQUE NOT NULL,
    customer_code TEXT UNIQUE NOT NULL DEFAULT generate_customer_code(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    default_delivery_branch_id UUID REFERENCES delivery_branches(id),
    onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
    onboarding_step TEXT DEFAULT 'oferta' NOT NULL CHECK (onboarding_step IN ('oferta', 'phone', 'name', 'provider', 'region', 'branch', 'completed')),
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_users_customer_code ON users(customer_code);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 5.4 OFERTA ACCEPTANCES AUDIT
CREATE TABLE IF NOT EXISTS oferta_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    oferta_version_id UUID NOT NULL REFERENCES oferta_versions(id),
    accepted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_oferta_acceptances_user ON oferta_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_oferta_acceptances_telegram ON oferta_acceptances(telegram_user_id);

-- 5.5 UPSTREAM CHINA CARGO PROVIDERS
CREATE TABLE IF NOT EXISTS cargo_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_name TEXT NOT NULL, -- Internal only (e.g., 'iPost', 'Cargo A')
    receiver_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT,
    full_address TEXT NOT NULL,
    warehouse_code TEXT NOT NULL,
    address_template TEXT NOT NULL, -- e.g. '{warehouse_code} {customer_id}'
    active BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_cargo_providers_updated_at
BEFORE UPDATE ON cargo_providers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enforce at most one active cargo provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_cargo_providers_single_active ON cargo_providers(active) WHERE active = TRUE;

-- 5.6 PARCELS TABLE (WITH MANDATORY IMMUTABLE SNAPSHOTS)
CREATE TABLE IF NOT EXISTS parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tracking_number TEXT NOT NULL UNIQUE,
    customer_code_snapshot TEXT NOT NULL, -- e.g. 'YK-100'
    cargo_provider_id UUID REFERENCES cargo_providers(id),
    cargo_address_snapshot JSONB NOT NULL,     -- Immutable snapshot of China warehouse
    delivery_branch_id UUID REFERENCES delivery_branches(id),
    delivery_address_snapshot JSONB NOT NULL,  -- Immutable snapshot of Uzbekistan branch
    status TEXT DEFAULT 'added' NOT NULL CHECK (status IN ('added', 'china_warehouse', 'in_transit', 'uzbekistan', 'delivered')),
    payment_status TEXT DEFAULT 'pending' NOT NULL CHECK (payment_status IN ('pending', 'paid')),
    amount NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    currency TEXT DEFAULT 'USD' NOT NULL,
    weight_kg NUMERIC(8, 2) DEFAULT 0 NOT NULL,
    image_url TEXT,
    cargo_submitted_at TIMESTAMPTZ, -- Marked when admin submits to upstream system
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_parcels_updated_at
BEFORE UPDATE ON parcels
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_parcels_user_id ON parcels(user_id);
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_number ON parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_payment_status ON parcels(payment_status);
CREATE INDEX IF NOT EXISTS idx_parcels_submitted ON parcels(cargo_submitted_at);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at DESC);

-- 5.7 DELIVERY LOCATION CHANGE REQUESTS
CREATE TABLE IF NOT EXISTS delivery_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_branch_id UUID REFERENCES delivery_branches(id),
    requested_branch_id UUID NOT NULL REFERENCES delivery_branches(id),
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by BIGINT, -- admin telegram id
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_change_requests_user ON delivery_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON delivery_change_requests(status);

-- 5.8 SERVER-SIDE ROLES & ADMINS
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_roles_telegram ON user_roles(telegram_user_id);

-- 5.9 ADMIN AUDIT LOGS
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_telegram_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- 5.10 CONFIGURABLE APP SETTINGS
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- In our architecture, the Vercel backend interacts with Supabase using the
-- server-side Service Role key. To prevent any accidental direct browser leaks,
-- RLS is enabled across all tables by default.
ALTER TABLE delivery_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE oferta_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oferta_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Read-only public policy for active branches & active oferta if accessed with anon key
CREATE POLICY "Public branches read active" ON delivery_branches FOR SELECT USING (active = true);
CREATE POLICY "Public oferta read active" ON oferta_versions FOR SELECT USING (is_active = true);

-- ==============================================================================
-- 7. INITIAL SEED DATA
-- ==============================================================================

-- 7.1 Oferta Version 1
INSERT INTO oferta_versions (version, title, content, is_active)
VALUES (
    1,
    'Yukla Go Xizmatidan Foydalanish Shartlari (Ommaviy Oferta)',
    '1. Umumiy qoidalar: Ushbu oferta Yukla Go xizmatidan foydalanish shartlarini belgilaydi. 2. Taqiqlangan buyumlar: Havo orqali akkumulyator, magnit, suyuqlik va yonuvchan moddalarni jo''natish taqiqlanadi. 3. Yetkazib berish va to''lov: Yuklar O''zbekistonga belgilangan muddatda yetkaziladi va to''lov hajm/og''irlikka ko''ra amalga oshiriladi.',
    TRUE
) ON CONFLICT (version) DO NOTHING;

-- 7.2 Initial Cargo Provider (Active by default, internal details never exposed to customers)
INSERT INTO cargo_providers (
    internal_name, receiver_name, phone, province, city, district, full_address, warehouse_code, address_template, active
) VALUES (
    'Main China Air Hub',
    'Yukla Go',
    '13335957161',
    'Zhejiang',
    'Jinhua/Yiwu',
    'Suxi',
    '077库房/70099号',
    '077库房/70099号',
    '{warehouse_code} {customer_id}',
    TRUE
) ON CONFLICT DO NOTHING;

-- 7.3 Delivery Branches (Active Toshkent & Fergana Valley hub branches for EMU, BTS, UzPost)
INSERT INTO delivery_branches (provider, provider_branch_code, region, district, city, branch_name, address, phone, active)
VALUES
    -- BTS Branches
    ('BTS', 'BTS-TAS-01', 'Toshkent', 'Chilonzor', 'Toshkent sh.', 'BTS Chilonzor', 'Chilonzor 9-mavze, Qatortol ko''chasi 1', '+998712000000', true),
    ('BTS', 'BTS-NAM-01', 'Namangan', 'Namangan sh.', 'Namangan sh.', 'BTS Chorsu', 'Chorsu dahasi, Bobur shoh ko''chasi 15', '+998692000000', true),
    ('BTS', 'BTS-AND-01', 'Andijon', 'Andijon sh.', 'Andijon sh.', 'BTS Markaz', 'Amir Temur shoh ko''chasi 88', '+998742000000', true),
    ('BTS', 'BTS-FER-01', 'Farg''ona', 'Farg''ona sh.', 'Farg''ona sh.', 'BTS Farg''ona Markaz', 'Al-Farg''oniy ko''chasi 22', '+998732000000', true),

    -- EMU Branches
    ('EMU', 'EMU-TAS-01', 'Toshkent', 'Yunusobod', 'Toshkent sh.', 'EMU Yunusobod', 'Yunusobod 4-mavze, Amir Temur ko''chasi', '+998712000001', true),
    ('EMU', 'EMU-NAM-01', 'Namangan', 'Chortoq', 'Chortoq sh.', 'EMU Chortoq', 'Mustaqillik ko''chasi 10', '+998692000001', true),
    ('EMU', 'EMU-AND-01', 'Andijon', 'Asaka', 'Asaka sh.', 'EMU Asaka', 'O''zbekiston ko''chasi 5', '+998742000001', true),
    ('EMU', 'EMU-FER-01', 'Farg''ona', 'Qo''qon', 'Qo''qon sh.', 'EMU Qo''qon', 'Turkiston ko''chasi 33', '+998732000001', true),

    -- UzPost Branches
    ('UZPOST', 'UZP-TAS-01', 'Toshkent', 'Mirobod', 'Toshkent sh.', 'Bosh Pochtampt', 'Shahrisabz ko''chasi 7', '+998712330000', true),
    ('UZPOST', 'UZP-NAM-01', 'Namangan', 'Namangan sh.', 'Namangan sh.', 'Namangan 1-Aloqa bo''limi', 'Navoiy ko''chasi 3', '+998692260000', true)
ON CONFLICT DO NOTHING;

-- Deactivate retired regions if they exist from prior migrations
UPDATE delivery_branches 
SET active = false 
WHERE region ILIKE '%Samarqand%' 
   OR region ILIKE '%Buxoro%' 
   OR region ILIKE '%Navoiy%' 
   OR region ILIKE '%Qashqadaryo%' 
   OR region ILIKE '%Surxondaryo%' 
   OR region ILIKE '%Jizzax%' 
   OR region ILIKE '%Sirdaryo%' 
   OR region ILIKE '%Xorazm%' 
   OR region ILIKE '%Qoraqalpog%' 
   OR region ILIKE '%Nukus%';

-- 7.4 App Settings
INSERT INTO app_settings (key, value)
VALUES
    ('cargo_rates', '{"price_per_kg": 9.5, "currency": "USD"}'::jsonb),
    ('exchange_rate', '{"usd_to_uzs": 12850}'::jsonb),
    ('support_contact', '{"telegram_username": "nothing_related"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7.5 Pre-seed Administrators (Telegram IDs: 7232597769, 5059829001)
INSERT INTO users (telegram_user_id, customer_code, name, phone, onboarding_completed, onboarding_step, status)
VALUES 
    (7232597769, 'ADMIN', 'Administrator', '+998900000000', TRUE, 'completed', 'active'),
    (5059829001, 'ADMIN-2', 'Admin 2', '+998900000001', TRUE, 'completed', 'active')
ON CONFLICT (telegram_user_id) DO NOTHING;

INSERT INTO user_roles (telegram_user_id, role)
VALUES 
    (7232597769, 'super_admin'),
    (5059829001, 'super_admin')
ON CONFLICT (telegram_user_id) DO UPDATE SET role = 'super_admin';
