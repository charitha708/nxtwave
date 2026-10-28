// Server-side analytics persistence and Google Sheets synchronization.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SHEETS_WEBAPP_URL = Deno.env.get('SHEETS_WEBAPP_URL');
const SHEETS_WEBAPP_SECRET = Deno.env.get('SHEETS_WEBAPP_SECRET');
const ALLOWED_EVENTS = new Set([
  'landing_page_viewed', 'assessment_page_viewed', 'assessment_started', 'assessment_completed',
  'results_viewed', 'blog_viewed', 'registration_page_viewed', 'registration_submitted',
  'registration_completed', 'registration_success_viewed', 'terms_viewed', 'privacy_viewed',
  'admin_login_viewed', 'admin_dashboard_viewed'
]);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const body = await req.json();
    if (!ALLOWED_EVENTS.has(body.eventName)) return json({ error: 'Unsupported event.' }, 400);
    const sessionId = String(body.sessionId || '');
    const eventId = String(body.eventId || '');
    if (!sessionId || sessionId.length > 100 || !eventId || eventId.length > 100) return json({ error: 'Invalid event/session ID.' }, 400);
    const attr = body.attribution && typeof body.attribution === 'object' ? body.attribution : {};
    const row = {
      event_id: eventId,
      session_id: sessionId,
      event_name: body.eventName,
      utm_source: clean(attr.utm_source),
      utm_medium: clean(attr.utm_medium),
      utm_campaign: clean(attr.utm_campaign),
      utm_content: clean(attr.utm_content),
      utm_term: clean(attr.utm_term),
      ref: clean(attr.ref),
      page_path: clean(body.pagePath) ?? '/',
      registration_id: clean(body.registrationId),
      device_category: ['mobile', 'tablet', 'desktop'].includes(body.deviceCategory) ? body.deviceCategory : 'unknown'
    };
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: insertError } = await supabase.from('analytics_events').insert(row);
    if (insertError && insertError.code !== '23505') return json({ error: 'Could not save analytics event.' }, 500);
    if (insertError?.code === '23505') return json({ ok: true, duplicate: true, sheetsSynced: false });

    const sheetPayload = {
      tab: 'Campaign Events', timestamp: new Date().toISOString(), event_id: row.event_id, session_id: row.session_id,
      event_name: row.event_name, utm_source: row.utm_source, utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign, utm_content: row.utm_content, ref: row.ref,
      page_path: row.page_path, registration_id: row.registration_id, device_category: row.device_category
    };
    let sheetsSynced = false;
    let syncError: string | null = null;
    if (!SHEETS_WEBAPP_URL || !SHEETS_WEBAPP_SECRET) {
      syncError = 'Google Sheets URL or shared secret is not configured.';
    } else {
      try {
        const response = await fetch(SHEETS_WEBAPP_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...sheetPayload, secret: SHEETS_WEBAPP_SECRET })
        });
        const result = await response.json().catch(() => null);
        sheetsSynced = response.ok && result?.ok === true;
        if (!sheetsSynced) syncError = result?.error || `Google Sheets returned HTTP ${response.status}.`;
      } catch (error) { syncError = error instanceof Error ? error.message : 'Google Sheets request failed.'; }
    }
    await supabase.from('integration_jobs').insert({
      job_type: 'analytics_event', ref_id: eventId, status: sheetsSynced ? 'completed' : 'failed',
      attempts: 1, error: syncError, payload: sheetPayload
    });
    return json({ ok: true, sheetsSynced, syncError });
  } catch (_error) {
    return json({ error: 'Invalid request.' }, 400);
  }
});
function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim().slice(0, 500);
  return result || null;
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
