-- ==============================================================================
-- 0003: Academy access table (replaces the JSON blob in app_settings),
--       lock down academy tables. The API uses the service-role key, which
--       bypasses RLS; enabling RLS with no policies blocks anon/public access.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS academy_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'granted')),
    requested_at TIMESTAMPTZ,
    granted_at TIMESTAMPTZ,
    granted_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_academy_access UNIQUE (user_id, course_id)
);

CREATE TRIGGER trg_academy_access_updated_at
BEFORE UPDATE ON academy_access
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_academy_access_course ON academy_access(course_id, status);

ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
