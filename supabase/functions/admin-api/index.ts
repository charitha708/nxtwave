// Admin API edge function
// Serves dashboard metrics, registration list with filters, and retry controls.
// Requires a valid authenticated Supabase session (JWT verified) AND the user's
// email must be present in the admins allowlist table.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { verify as jwtVerify, createRemoteJWKSet } from 'npm:jose@5.9.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getUserEmail(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    return (payload.email as string) ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const email = await getUserEmail(req);
    if (!email) return json({ error: 'Unauthorized.' }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: admin } = await supabase.from('admins').select('email, role').eq('email', email).maybeSingle();
    if (!admin) return json({ error: 'Forbidden: not an admin.' }, 403);

    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/admin-api', '') || '/';

    if (path === '/metrics' && req.method === 'GET') {
      return json(await getMetrics(supabase));
    }

    if (path === '/emails' && req.method === 'GET') {
      const status = url.searchParams.get('status') ?? 'failed';
      const { data, error } = await supabase.from('email_outbox').select('id, registration_id, to_email, subject, status, attempts, error, created_at').eq('status', status).order('created_at', { ascending: false }).limit(100);
      if (error) return json({ error: error.message }, 500);
      return json({ emails: data ?? [] });
    }

    if (path === '/jobs' && req.method === 'GET') {
      const status = url.searchParams.get('status') ?? 'failed';
      let q = supabase.from('integration_jobs').select('id, job_type, ref_id, status, attempts, error, created_at').eq('status', status).order('created_at', { ascending: false }).limit(100);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ jobs: data ?? [] });
    }

    if (path === '/registrations' && req.method === 'GET') {
      const source = url.searchParams.get('source');
      const campaign = url.searchParams.get('campaign');
      const content = url.searchParams.get('content');
      let q = supabase.from('registrations').select('*').order('created_at', { ascending: false }).limit(500);
      if (source === 'direct') q = q.is('utm_source', null);
      else if (source) q = q.eq('utm_source', source);
      if (campaign) q = q.ilike('utm_campaign', `%${campaign}%`);
      if (content) q = q.ilike('utm_content', `%${content}%`);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ registrations: data });
    }

    if (path === '/retry-email' && req.method === 'POST') {
      const { emailId } = await req.json();
      const { data: job } = await supabase.from('email_outbox').select('*').eq('id', emailId).maybeSingle();
      if (!job) return json({ error: 'Email job not found.' }, 404);
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (!resendKey) {
        await supabase.from('email_outbox').update({ status: 'failed', attempts: job.attempts + 1, last_attempt_at: new Date().toISOString(), error: 'RESEND_API_KEY is not configured; email was not sent.' }).eq('id', emailId);
        return json({ error: 'RESEND_API_KEY is not configured; email was not sent.' }, 503);
      }
      // real retry path
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}`, 'Idempotency-Key': `nextwave-registration-${job.registration_id}` },
          body: JSON.stringify({ from: Deno.env.get('RESEND_FROM') ?? 'Next Wave <workshop@nextwave.dev>', to: [job.to_email], subject: job.subject, text: job.body }),
        });
        const body = await res.json();
        if (!res.ok) {
          await supabase.from('email_outbox').update({ status: 'failed', attempts: job.attempts + 1, last_attempt_at: new Date().toISOString(), error: body.message ?? `Resend ${res.status}` }).eq('id', emailId);
          return json({ error: body.message ?? 'Retry failed.' }, 500);
        }
        await supabase.from('email_outbox').update({ status: 'sent', provider_message_id: body.id ?? null, attempts: job.attempts + 1, last_attempt_at: new Date().toISOString(), error: null }).eq('id', emailId);
        await supabase.from('integration_jobs').update({ status: 'completed', attempts: job.attempts + 1, error: null }).eq('job_type', 'email').eq('ref_id', job.registration_id);
        return json({ ok: true, messageId: body.id });
      } catch (err) {
        await supabase.from('email_outbox').update({ status: 'failed', attempts: job.attempts + 1, last_attempt_at: new Date().toISOString(), error: err.message }).eq('id', emailId);
        return json({ error: err.message }, 500);
      }
    }

    if (path === '/retry-sheet' && req.method === 'POST') {
      const { jobId } = await req.json();
      const { data: job } = await supabase.from('integration_jobs').select('*').eq('id', jobId).maybeSingle();
      if (!job) return json({ error: 'Job not found.' }, 404);
      const sheetsUrl = Deno.env.get('SHEETS_WEBAPP_URL');
      const sheetsSecret = Deno.env.get('SHEETS_WEBAPP_SECRET');
      if (!sheetsUrl || !sheetsSecret) return json({ error: 'Google Sheets URL or shared secret is not configured.' }, 503);
      try {
        const res = await fetch(sheetsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...job.payload, secret: sheetsSecret }) });
        const result = await res.json().catch(() => null);
        if (!res.ok || result?.ok !== true) {
          const message = result?.error ?? `Sheet returned HTTP ${res.status} without confirming the write.`;
          await supabase.from('integration_jobs').update({ status: 'failed', attempts: job.attempts + 1, error: message }).eq('id', jobId);
          return json({ error: message }, 500);
        }
        await supabase.from('integration_jobs').update({ status: 'completed', attempts: job.attempts + 1, error: null }).eq('id', jobId);
        return json({ ok: true });
      } catch (err) {
        await supabase.from('integration_jobs').update({ status: 'failed', attempts: job.attempts + 1, error: err.message }).eq('id', jobId);
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'Unknown admin route.' }, 404);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

async function getMetrics(supabase: any) {
  const [visits, starts, completions, blogViews, regPageViews, regs, events, emails, jobs] = await Promise.all([
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_name', 'assessment_started'),
    supabase.from('assessments').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_name', 'blog_viewed'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_name', 'registration_page_viewed'),
    supabase.from('registrations').select('*', { count: 'exact', head: true }),
    supabase.from('analytics_events').select('event_name').order('created_at', { ascending: false }).limit(100),
    supabase.from('email_outbox').select('status'),
    supabase.from('integration_jobs').select('job_type, status'),
  ]);

  // funnel by source
  const { data: bySource } = await supabase.from('registrations').select('utm_source').order('created_at', { ascending: false });
  const sourceCounts: Record<string, number> = {};
  (bySource ?? []).forEach((r: any) => {
    const s = r.utm_source ?? 'direct';
    sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
  });

  const emailStats: Record<string, number> = {};
  (emails.data ?? []).forEach((e: any) => { emailStats[e.status] = (emailStats[e.status] ?? 0) + 1; });
  const jobStats: Record<string, number> = {};
  (jobs.data ?? []).forEach((j: any) => { jobStats[`${j.job_type}:${j.status}`] = (jobStats[`${j.job_type}:${j.status}`] ?? 0) + 1; });

  const regCount = regs.count ?? 0;
  const visitCount = visits.count ?? 0;
  const startCount = starts.count ?? 0;
  const completionCount = completions.count ?? 0;
  const conversionRate = startCount > 0 ? Math.round((completionCount / startCount) * 100) : 0;

  return {
    totalVisits: visitCount,
    assessmentStarts: startCount,
    assessmentCompletions: completionCount,
    blogViews: blogViews.count ?? 0,
    registrationPageViews: regPageViews.count ?? 0,
    completedRegistrations: regCount,
    conversionRate,
    registrationsBySource: sourceCounts,
    emailStats,
    jobStats,
  };
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
