# Next Wave Project Lab — implementation status

This file describes changes made to the uploaded Bolt project source. It is not a production certification.

## Changes in this working copy

- Kept the existing Vite + React + TypeScript application and added the Google Apps Script receiver at `automation/google-apps-script/Code.gs`.
- Registration now requires explicit registration-email consent on the server, validates field lengths, uses a UUID-based registration ID, and preserves database-first behavior.
- Missing Resend or Sheets configuration is recorded as a failed/not-sent operation instead of a successful development send/sync.
- Resend send requests and retries use a stable registration-based idempotency key.
- Registration confirmation UI no longer claims that email was sent when the provider did not accept it; it shows sheet-sync status separately.
- Added a registration-status Edge Function that checks registration ID + matching email before returning integration status.
- Added a `track-event` Edge Function to persist allowlisted campaign events and synchronize them to the `Campaign Events` tab.
- The Apps Script checks a shared secret, creates the three reporting tabs, prevents duplicate event/registration rows, and rebuilds a campaign summary from event and registration rows.
- Added admin API/UI handling for failed email and spreadsheet jobs, including retry controls and campaign/community filters.
- Changed assessment start, resume, answer saving, grading, and report retrieval to use server-side Edge Function actions with session ownership and expiry checks.
- Corrected Resend webhook verification to use the signed Svix payload, timestamp freshness checks, and constant-time signature comparison.
- Added migrations to support analytics-event jobs and revoke direct browser access to application tables; the validated Edge Functions use the service role.
- Removed duplicate registration-page view tracking and stabilized first-touch attribution in browser storage.

## Checks actually run

- TypeScript/TSX syntax parse: 28 source files parsed; no syntax diagnostics reported by TypeScript's transpile parser.
- Google Apps Script JavaScript syntax check: passed with Node's syntax checker after copying the `.gs` file to a temporary `.js` file.
- Full `npm run build`, `npm run typecheck`, and `npm run lint`: **not verified**. `npm ci` failed in this environment with an npm internal error, and Vite was unavailable afterward.
- Supabase migrations: not applied to a live project.
- Edge Functions: not deployed or executed against live credentials.
- Email: no real email was sent or received in this session.
- Google Sheets: Apps Script was not deployed and no live spreadsheet row was verified.
- Production website: not deployed or verified.

## Required before real student traffic

1. Set the frontend Supabase URL and anon key in `.env` / hosting settings.
2. Apply every SQL migration in `supabase/migrations/` in filename order, especially the table-privilege hardening migration.
3. Configure Supabase Edge Function secrets for Resend, the Apps Script URL/shared secret, workshop details, and an AI provider if real AI assessment is required.
4. Deploy the Apps Script and set its `SPREADSHEET_ID` and `SHEETS_WEBAPP_SECRET` script properties.
5. Deploy all six Edge Functions: `ai-examiner`, `register-workshop`, `registration-status`, `track-event`, `admin-api`, and `resend-webhook`.
6. Verify the Resend sending domain and webhook secret.
7. Create an admin account and add its email to `public.admins`.
8. Install dependencies in a normal development environment and run build/typecheck/lint. Fix any errors before deployment.
9. Add rate limiting/bot protection to public endpoints before a broad campaign launch.
10. Run a live end-to-end test: unique campaign link → registration → database row → received email → delivery webhook → spreadsheet rows and summary → admin view and retries.

## Important caveats

- Without an LLM API key, assessment generation/grading uses the project's mock provider and must not be presented as real AI evaluation.
- A Resend API acceptance (`sent`) is not the same as inbox delivery (`delivered`). Use the webhook status for delivery reporting.
- Browser storage provides first-touch attribution only within that browser's local storage. It cannot reliably attribute cross-device visits.
- Do not launch publicly until dependency checks, migrations, endpoint abuse protection, and live integration tests have passed.
