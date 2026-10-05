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
