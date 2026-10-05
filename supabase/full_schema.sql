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

-- 7.3 Delivery Branches (Verified common hub branches for EMU, BTS, UzPost)
INSERT INTO delivery_branches (provider, provider_branch_code, region, district, city, branch_name, address, phone, active)
VALUES
    -- BTS Branches
    ('BTS', 'BTS-TAS-01', 'Toshkent', 'Chilonzor', 'Toshkent sh.', 'BTS Chilonzor', 'Chilonzor 9-mavze, Qatortol ko''chasi 1', '+998712000000', true),
    ('BTS', 'BTS-NAM-01', 'Namangan', 'Namangan sh.', 'Namangan sh.', 'BTS Chorsu', 'Chorsu dahasi, Bobur shoh ko''chasi 15', '+998692000000', true),
    ('BTS', 'BTS-SAM-01', 'Samarqand', 'Samarqand sh.', 'Samarqand sh.', 'BTS Registon', 'Dagbitskaya ko''chasi 45', '+998662000000', true),
    ('BTS', 'BTS-AND-01', 'Andijon', 'Andijon sh.', 'Andijon sh.', 'BTS Markaz', 'Amir Temur shoh ko''chasi 88', '+998742000000', true),
    ('BTS', 'BTS-FER-01', 'Farg''ona', 'Farg''ona sh.', 'Farg''ona sh.', 'BTS Farg''ona Markaz', 'Al-Farg''oniy ko''chasi 22', '+998732000000', true),

    -- EMU Branches
    ('EMU', 'EMU-TAS-01', 'Toshkent', 'Yunusobod', 'Toshkent sh.', 'EMU Yunusobod', 'Yunusobod 4-mavze, Amir Temur ko''chasi', '+998712000001', true),
    ('EMU', 'EMU-NAM-01', 'Namangan', 'Chortoq', 'Chortoq sh.', 'EMU Chortoq', 'Mustaqillik ko''chasi 10', '+998692000001', true),
    ('EMU', 'EMU-SAM-01', 'Samarqand', 'Samarqand sh.', 'Samarqand sh.', 'EMU Samarqand', 'Mirzo Ulug''bek ko''chasi 12', '+998662000001', true),
    ('EMU', 'EMU-AND-01', 'Andijon', 'Asaka', 'Asaka sh.', 'EMU Asaka', 'O''zbekiston ko''chasi 5', '+998742000001', true),
    ('EMU', 'EMU-FER-01', 'Farg''ona', 'Qo''qon', 'Qo''qon sh.', 'EMU Qo''qon', 'Turkiston ko''chasi 33', '+998732000001', true),

    -- UzPost Branches
    ('UZPOST', 'UZP-TAS-01', 'Toshkent', 'Mirobod', 'Toshkent sh.', 'Bosh Pochtampt', 'Shahrisabz ko''chasi 7', '+998712330000', true),
    ('UZPOST', 'UZP-NAM-01', 'Namangan', 'Namangan sh.', 'Namangan sh.', 'Namangan 1-Aloqa bo''limi', 'Navoiy ko''chasi 3', '+998692260000', true),
    ('UZPOST', 'UZP-SAM-01', 'Samarqand', 'Samarqand sh.', 'Samarqand sh.', 'Samarqand Bosh Aloqa', 'Pochtovaya ko''chasi 1', '+998662330000', true)
ON CONFLICT DO NOTHING;

-- 7.4 App Settings
INSERT INTO app_settings (key, value)
VALUES
    ('cargo_rates', '{"price_per_kg": 9.5, "currency": "USD"}'::jsonb),
    ('exchange_rate', '{"usd_to_uzs": 12850}'::jsonb),
    ('support_contact', '{"telegram_username": "yuklago_support"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- ==============================================================================
-- YUKLA GO — SUPABASE / POSTGRES ACADEMY LMS SCHEMA MIGRATION
-- ==============================================================================

-- 1. COURSES TABLE
CREATE TABLE IF NOT EXISTS academy_courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'cargo',
    icon TEXT DEFAULT '📚',
    "order" INT NOT NULL DEFAULT 1,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_academy_courses_updated_at
BEFORE UPDATE ON academy_courses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. LESSONS TABLE
CREATE TABLE IF NOT EXISTS academy_lessons (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
    "order" INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    youtube_video_id TEXT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 360,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_academy_lessons_updated_at
BEFORE UPDATE ON academy_lessons
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_academy_lessons_course_order ON academy_lessons(course_id, "order");

-- 3. USER LESSON PROGRESS TABLE
CREATE TABLE IF NOT EXISTS academy_user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
    max_watched_seconds INT NOT NULL DEFAULT 0,
    last_position_seconds INT NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    last_sync_timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_academy_user_lesson UNIQUE (user_id, lesson_id)
);

CREATE TRIGGER trg_academy_user_progress_updated_at
BEFORE UPDATE ON academy_user_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_academy_user_progress_user ON academy_user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_user_progress_lesson ON academy_user_progress(lesson_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_progress ENABLE ROW LEVEL SECURITY;

-- 4.1 Courses & Lessons are readable by authenticated users and service role
CREATE POLICY "Public courses readable" ON academy_courses
    FOR SELECT USING (active = true);

CREATE POLICY "Public lessons readable" ON academy_lessons
    FOR SELECT USING (true);

-- 4.2 User Progress: users can read and update their own progress
CREATE POLICY "Users read own progress" ON academy_user_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert/update own progress" ON academy_user_progress
    FOR ALL USING (auth.uid() = user_id);

-- 5. INITIAL DATA SEED
INSERT INTO academy_courses (id, title, description, category, icon, "order")
VALUES 
    ('course_cargo_101', 'Xitoydan buyurtma berish kursi', 'Xitoy saytlaridan mustaqil xarid qilish va O''zbekistonga tez yetkazib berish bo''yicha qo''llanma.', 'cargo', '📦', 1),
    ('course_english_logistics', 'Logistika & Biznes ingliz tili', 'Xalqaro yuk tashish va yetkazib beruvchilar bilan muzokara uchun amaliy ingliz tili darslari.', 'student', '🇬🇧', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO academy_lessons (id, course_id, "order", title, description, youtube_video_id, duration_seconds)
VALUES
    ('les_c1_1', 'course_cargo_101', 1, '1. Kirish: Xitoy karqo qanday ishlaydi?', 'Aviakargo va avtokargo farqlari, bojxona qoidalari va mijoz kodi (YK-###) mohiyati.', 'M7lc1UVf-VE', 360),
    ('les_c1_2', 'course_cargo_101', 2, '2. Taobao va 1688 ilovalarida ro''yxatdan o''tish', 'Alipay hamyonini ulash, akkaunt xavfsizligi va blokdan saqlanish usullari.', 'jNQXAC9IVRw', 480),
    ('les_c1_3', 'course_cargo_101', 3, '3. Xitoy ombor manzilini to''g''ri kiritish (YK-###)', 'Yukla Go ombor manzilini Taobao ilovasiga bir martalik nusxa orqali avtomatik joylash.', '21X5lGlDOfg', 420),
    ('les_c1_4', 'course_cargo_101', 4, '4. To''lov qilish va mahsulot sifatini tekshirish', 'Sotuvchi reytingi, mijozlar sharhlari va xavfsiz to''lov tizimi.', 'L_LUpnjgPso', 540),
    ('les_c1_5', 'course_cargo_101', 5, '5. Trek kodini kiritish va O''zbekistonda qabul qilish', 'Yukni O''zbekistonga yetib kelguncha kuzatish va belgilangan filialdan qabul qilib olish.', 'fJ9rUzIMcZQ', 390)
ON CONFLICT (id) DO NOTHING;
