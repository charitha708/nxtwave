-- Allow campaign analytics events to be tracked as retryable Sheets sync jobs.
ALTER TABLE integration_jobs DROP CONSTRAINT IF EXISTS integration_jobs_job_type_check;
ALTER TABLE integration_jobs ADD CONSTRAINT integration_jobs_job_type_check
  CHECK (job_type IN ('google_sheet', 'email', 'analytics_event'));
