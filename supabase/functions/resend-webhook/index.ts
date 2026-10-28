// Resend webhook receiver
// Verifies the webhook signature using RESEND_WEBHOOK_SECRET and updates the
// email_outbox row matching the provider message id with delivery status.
// In dev mode (no secret), it still accepts the payload but marks dev_logged.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false; // Never accept unsigned webhooks in production.
  const id = req.headers.get('svix-id') ?? '';
  const timestamp = req.headers.get('svix-timestamp') ?? '';
  const signatureHeader = req.headers.get('svix-signature') ?? '';
  if (!id || !timestamp || !signatureHeader) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const encodedSecret = WEBHOOK_SECRET.startsWith('whsec_') ? WEBHOOK_SECRET.slice(6) : WEBHOOK_SECRET;
  let secretBytes: Uint8Array;
  try {
    const binary = atob(encodedSecret);
    secretBytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch { return false; }
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(new Uint8Array(signature));
  return signatureHeader.split(' ').some((part) => {
    const [version, value] = part.split(',', 2);
    return version === 'v1' && !!value && constantTimeEqual(value, expected);
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const raw = await req.text();
    if (!(await verifySignature(req, raw))) return json({ error: 'Invalid signature.' }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const event = JSON.parse(raw);
    const messageId = event.data?.email_id ?? event.data?.message_id;
    const status: string = event.type ?? event.event_type ?? '';

    if (!messageId) return json({ error: 'No message id.' }, 400);

    const mapped: string = status.includes('delivered') ? 'delivered' : status.includes('bounced') || status.includes('complained') ? 'bounced' : status.includes('failed') ? 'failed' : 'sent';
    const { error } = await supabase
      .from('email_outbox')
      .update({ status: mapped })
      .eq('provider_message_id', messageId);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, messageId, status: mapped });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
