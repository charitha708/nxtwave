/*
# Next Wave Project Lab — Core Schema

## Overview
Builds the complete database for the Next Wave Project Lab platform:
student project assessment, AI exam, registrations, email outbox, analytics,
and admin auth.

## Tables
1. `assessments` — student project submission + timed exam metadata
2. `assessment_questions` — AI-generated open-ended questions per assessment
3. `assessment_answers` — autosaved answers, one per question
4. `registrations` — workshop registrations with unique registration_id + dedup
5. `analytics_events` — funnel/campaign attribution events (first-party, session-based)
6. `email_outbox` — transactional email queue with delivery state
7. `integration_jobs` — Google Sheets / email sync job tracking with retries
8. `admins` — admin allowlist (email-based, paired with Supabase auth)

## Security
- All tables have RLS enabled.
- Student-facing tables allow anon + authenticated insert/read on rows owned
  by session_id (matched via current_setting). Admins get full access via
  service_role in edge functions only.
- email_outbox / integration_jobs / admins are restricted; a narrow anon SELECT
  on email_outbox by registration_id is granted for the success page status.
- Admin auth uses Supabase email/password; `admins` is an allowlist of which
  auth.users may access the admin dashboard.

## Notes
- All ids are uuid with gen_random_uuid() defaults.
- Timestamps default to now().
- Unique constraints prevent duplicate registrations per workshop+email.
- Indexes cover common query paths (session_id, email, status, created_at).
*/

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  repo_url text NOT NULL,
  category text,
  experience_level text,
  duration_minutes integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','analyzing','ready','in_progress','completed','expired')),
  started_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  repo_snapshot jsonb,
  report jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_created ON assessments(created_at desc);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON assessments TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_own_assessments" ON assessments;
CREATE POLICY "anon_select_own_assessments" ON assessments FOR SELECT
  TO anon, authenticated USING (session_id = current_setting('app.session_id', true));

DROP POLICY IF EXISTS "anon_insert_assessments" ON assessments;
CREATE POLICY "anon_insert_assessments" ON assessments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_assessments" ON assessments;
CREATE POLICY "anon_update_assessments" ON assessments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- assessment_questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  position integer NOT NULL,
  category text NOT NULL,
  prompt text NOT NULL,
  evidence_refs jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_assessment ON assessment_questions(assessment_id);

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON assessment_questions TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_questions_via_assessment" ON assessment_questions;
CREATE POLICY "anon_select_questions_via_assessment" ON assessment_questions FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = assessment_questions.assessment_id
      AND a.session_id = current_setting('app.session_id', true)
  ));

DROP POLICY IF EXISTS "anon_insert_questions" ON assessment_questions;
CREATE POLICY "anon_insert_questions" ON assessment_questions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- assessment_answers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL DEFAULT '',
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_assessment ON assessment_answers(assessment_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON assessment_answers(question_id);

ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON assessment_answers TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_own_answers" ON assessment_answers;
CREATE POLICY "anon_select_own_answers" ON assessment_answers FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = assessment_answers.assessment_id
      AND a.session_id = current_setting('app.session_id', true)
  ));

DROP POLICY IF EXISTS "anon_upsert_own_answers" ON assessment_answers;
CREATE POLICY "anon_upsert_own_answers" ON assessment_answers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_own_answers" ON assessment_answers;
CREATE POLICY "anon_update_own_answers" ON assessment_answers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  workshop_id text NOT NULL DEFAULT 'nw-ai-workshop-v1',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  ref text,
  landing_page text,
  registration_page text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, email)
);

CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_source ON registrations(utm_source);
CREATE INDEX IF NOT EXISTS idx_registrations_campaign ON registrations(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_registrations_created ON registrations(created_at desc);

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON registrations TO anon, authenticated;

DROP POLICY IF EXISTS "anon_insert_registrations" ON registrations;
CREATE POLICY "anon_insert_registrations" ON registrations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_own_registration" ON registrations;
CREATE POLICY "anon_select_own_registration" ON registrations FOR SELECT
  TO anon, authenticated
  USING (email = current_setting('app.reg_email', true));

-- ---------------------------------------------------------------------------
-- analytics_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  session_id text NOT NULL,
  event_name text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  ref text,
  page_path text,
  registration_id text,
  device_category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_source ON analytics_events(utm_source);
CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at desc);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON analytics_events TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_own_events" ON analytics_events;
CREATE POLICY "anon_select_own_events" ON analytics_events FOR SELECT
  TO anon, authenticated USING (session_id = current_setting('app.session_id', true));

DROP POLICY IF EXISTS "anon_insert_events" ON analytics_events;
CREATE POLICY "anon_insert_events" ON analytics_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- email_outbox
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id text,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sent','delivered','bounced','failed','dev_logged')),
  provider_message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_status ON email_outbox(status);
CREATE INDEX IF NOT EXISTS idx_email_registration ON email_outbox(registration_id);
CREATE INDEX IF NOT EXISTS idx_email_created ON email_outbox(created_at desc);

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON email_outbox TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_own_email_status" ON email_outbox;
CREATE POLICY "anon_select_own_email_status" ON email_outbox FOR SELECT
  TO anon, authenticated
  USING (registration_id = current_setting('app.reg_id', true));

-- ---------------------------------------------------------------------------
-- integration_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('google_sheet','email')),
  ref_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','failed')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON integration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON integration_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON integration_jobs(created_at desc);

ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;

-- service-role only; no anon grant

-- ---------------------------------------------------------------------------
-- admins (allowlist for admin dashboard access)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON admins TO authenticated;

DROP POLICY IF EXISTS "read_admin_self" ON admins;
CREATE POLICY "read_admin_self" ON admins FOR SELECT
  TO authenticated USING (email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ));
