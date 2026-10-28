import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apikey, X-Client-Info' };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const body = await req.json();
    const registrationId = typeof body.registrationId === 'string' ? body.registrationId.slice(0, 80) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    if (!registrationId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Registration ID and email are required.' }, 400);
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: registration } = await db.from('registrations').select('registration_id').eq('registration_id', registrationId).eq('email', email).maybeSingle();
    if (!registration) return json({ error: 'Registration not found.' }, 404);
    const [{ data: mail }, { data: sheet }] = await Promise.all([
      db.from('email_outbox').select('status, provider_message_id, error').eq('registration_id', registrationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('integration_jobs').select('status, error, updated_at').eq('ref_id', registrationId).eq('job_type', 'google_sheet').order('created_at', { ascending: false }).limit(1).maybeSingle()
    ]);
    return json({ ok: true, emailStatus: mail?.status ?? 'pending', providerMessageId: mail?.provider_message_id ?? null, emailError: mail?.error ?? null, sheetStatus: sheet?.status ?? 'pending', sheetError: sheet?.error ?? null });
  } catch { return json({ error: 'Invalid request.' }, 400); }
});
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
