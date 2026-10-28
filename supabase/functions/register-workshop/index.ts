// Workshop registration edge function
// Handles registration persistence, confirmation email (Resend), and Google Sheets sync.
// Development mode: logs emails instead of sending and skips real sheet sync.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Next Wave <workshop@nextwave.dev>';
const SHEETS_WEBAPP_URL = Deno.env.get('SHEETS_WEBAPP_URL');
const SHEETS_WEBAPP_SECRET = Deno.env.get('SHEETS_WEBAPP_SECRET');
const WORKSHOP_DATE = Deno.env.get('WORKSHOP_DATE') ?? 'To be announced';
const WORKSHOP_TIME = Deno.env.get('WORKSHOP_TIME') ?? 'To be announced';
const WORKSHOP_JOIN_URL = Deno.env.get('WORKSHOP_JOIN_URL') ?? 'To be shared before the session';


interface RegisterRequest {
  fullName: string;
  email: string;
  necessaryConsent: boolean;
  marketingConsent: boolean;
  attribution: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    ref?: string;
    landing_page?: string;
    registration_page?: string;
  };
}

function validateEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function genRegistrationId(): string {
  return 'NWR-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
}

function buildEmailBody(fullName: string): string {
  return `Hi ${fullName},

Your registration for the Next Wave 60-Minute AI Project Making Workshop has been received successfully.

During the session, you will learn about practical project workflows, how application components connect, and how to use AI as a coding partner rather than blindly relying on generated code.

Workshop date: ${WORKSHOP_DATE}
Workshop time: ${WORKSHOP_TIME}
Joining link: ${WORKSHOP_JOIN_URL}

We will share any remaining workshop details using your registered email address.

Regards,
Next Wave`;
}

const EMAIL_SUBJECT = 'Next Wave Workshop: Your Registration Has Been Received';

async function sendEmail(to: string, subject: string, body: string, registrationId: string): Promise<{ sent: boolean; messageId: string | null; error: string | null; devPreview: boolean }> {
  if (!RESEND_API_KEY) {
    return { sent: false, messageId: null, error: 'RESEND_API_KEY is not configured; email was not sent.', devPreview: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Idempotency-Key': `nextwave-registration-${registrationId}`,
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text: body }),
    });
    const data = await res.json();
    if (!res.ok) return { sent: false, messageId: null, error: data.message ?? `Resend ${res.status}`, devPreview: false };
    return { sent: true, messageId: data.id ?? null, error: null, devPreview: false };
  } catch (err) {
    return { sent: false, messageId: null, error: err.message, devPreview: false };
  }
}

async function syncSheet(row: any): Promise<{ synced: boolean; error: string | null; devMock: boolean }> {
  if (!SHEETS_WEBAPP_URL) {
    return { synced: false, error: 'SHEETS_WEBAPP_URL is not configured; spreadsheet sync was skipped.', devMock: true };
  }
  if (!SHEETS_WEBAPP_SECRET) {
    return { synced: false, error: 'SHEETS_WEBAPP_SECRET is not configured; spreadsheet sync was blocked.', devMock: true };
  }
  try {
    const res = await fetch(SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...row, secret: SHEETS_WEBAPP_SECRET }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || result?.ok !== true) return { synced: false, error: result?.error ?? `Sheet returned HTTP ${res.status} without confirming the write.`, devMock: false };
    return { synced: true, error: null, devMock: false };
  } catch (err) {
    return { synced: false, error: err.message, devMock: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body: RegisterRequest = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // validate
    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!fullName || fullName.length < 2 || fullName.length > 120) return json({ error: 'Please enter your full name (2–120 characters).' }, 400);
    if (!email || email.length > 254 || !validateEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
    if (body.necessaryConsent !== true) return json({ error: 'Consent to registration-related emails is required.' }, 400);
    if (typeof body.marketingConsent !== 'boolean') return json({ error: 'Marketing consent must be true or false.' }, 400);

    // duplicate check
    const { data: existing } = await supabase
      .from('registrations')
      .select('registration_id')
      .eq('workshop_id', 'nw-ai-workshop-v1')
      .eq('email', email)
      .maybeSingle();
    if (existing) {
      return json({ error: 'You are already registered for this workshop. Check your email for confirmation details.', duplicate: true }, 409);
    }

    const registrationId = genRegistrationId();
    const attr = body.attribution ?? {};

    const { data: reg, error: insertErr } = await supabase
      .from('registrations')
      .insert({
        registration_id: registrationId,
        full_name: fullName,
        email,
        marketing_consent: body.marketingConsent,
        workshop_id: 'nw-ai-workshop-v1',
        utm_source: attr.utm_source ?? null,
        utm_medium: attr.utm_medium ?? null,
        utm_campaign: attr.utm_campaign ?? null,
        utm_content: attr.utm_content ?? null,
        utm_term: attr.utm_term ?? null,
        ref: attr.ref ?? null,
        landing_page: attr.landing_page ?? null,
        registration_page: attr.registration_page ?? null,
      })
      .select()
      .single();
    if (insertErr) {
      if (insertErr.code === '23505') return json({ error: 'You are already registered for this workshop.', duplicate: true }, 409);
      return json({ error: 'Could not save your registration. Please try again.' }, 500);
    }

    // email outbox + send
    const emailBody = buildEmailBody(fullName);
    const emailResult = await sendEmail(email, EMAIL_SUBJECT, emailBody, registrationId);

    await supabase.from('email_outbox').insert({
      registration_id: registrationId,
      to_email: email,
      subject: EMAIL_SUBJECT,
      body: emailBody,
      status: emailResult.sent ? 'sent' : 'failed',
      provider_message_id: emailResult.messageId,
      error: emailResult.error,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    });

    // integration job tracking
    await supabase.from('integration_jobs').insert({
      job_type: 'email',
      ref_id: registrationId,
      status: emailResult.sent ? 'completed' : 'failed',
      attempts: 1,
      error: emailResult.error,
      payload: { to: email, subject: EMAIL_SUBJECT },
    });

    // sheets sync
    const sheetRow = {
      tab: 'Registrations',
      timestamp: reg.created_at,
      registration_id: registrationId,
      full_name: fullName,
      email,
      workshop_id: 'nw-ai-workshop-v1',
      utm_source: attr.utm_source ?? '',
      utm_medium: attr.utm_medium ?? '',
      utm_campaign: attr.utm_campaign ?? '',
      utm_content: attr.utm_content ?? '',
      referral_code: attr.ref ?? '',
      landing_page: attr.landing_page ?? '',
      registration_page: attr.registration_page ?? '',
      marketing_consent: body.marketingConsent,
      email_status: emailResult.sent ? 'sent' : 'failed',
      email_provider_message_id: emailResult.messageId ?? '',
    };
    const sheetResult = await syncSheet(sheetRow);

    await supabase.from('integration_jobs').insert({
      job_type: 'google_sheet',
      ref_id: registrationId,
      status: sheetResult.synced ? 'completed' : 'failed',
      attempts: 1,
      error: sheetResult.error,
      payload: sheetRow,
    });

    return json({
      ok: true,
      registrationId,
      devMode: !emailResult.sent || !sheetResult.synced,
      email: { devPreview: emailResult.devPreview, sent: emailResult.sent, messageId: emailResult.messageId, error: emailResult.error },
      sheets: { devMock: sheetResult.devMock, synced: sheetResult.synced, error: sheetResult.error },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
