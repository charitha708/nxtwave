import { getSessionId, getAttribution, deviceCategory, type Attribution } from './attribution';

export async function trackEvent(eventName: string, extra: Partial<{ registrationId: string; pagePath: string; attribution: Attribution }> = {}) {
  try {
    const attr = extra.attribution ?? getAttribution();
    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;
    if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) return;
    const response = await fetch(`${VITE_SUPABASE_URL}/functions/v1/track-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VITE_SUPABASE_ANON_KEY}`, apikey: VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({
        eventId: crypto.randomUUID(), sessionId: getSessionId(), eventName,
        pagePath: extra.pagePath ?? window.location.pathname,
        registrationId: extra.registrationId ?? null,
        deviceCategory: deviceCategory(), attribution: attr,
      }),
      keepalive: true,
    });
    if (!response.ok) console.warn('analytics event could not be persisted', response.status);
  } catch (error) {
    console.warn('analytics track error', error);
  }
}
