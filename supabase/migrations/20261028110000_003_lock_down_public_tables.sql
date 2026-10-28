-- Public clients must use the validated Edge Functions rather than direct table writes.
-- The service role used inside Edge Functions bypasses RLS; the browser anon key does not.
REVOKE ALL ON TABLE public.assessments FROM anon, authenticated;
REVOKE ALL ON TABLE public.assessment_questions FROM anon, authenticated;
REVOKE ALL ON TABLE public.assessment_answers FROM anon, authenticated;
REVOKE ALL ON TABLE public.registrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.analytics_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_outbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.integration_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.admins FROM anon, authenticated;
