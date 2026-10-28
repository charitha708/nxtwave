import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTracker } from '@/components/PageTracker';
import { getAttribution } from '@/lib/attribution';
import { trackEvent } from '@/lib/analytics';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [necessaryConsent, setNecessaryConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ registrationId: string } | null>(null);


  const submit = async () => {
    setError(null);
    if (!fullName.trim() || fullName.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!necessaryConsent) { setError('Please consent to receive registration-related emails.'); return; }

    setSubmitting(true);
    trackEvent('registration_submitted');
    try {
      const attr = getAttribution();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/register-workshop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          necessaryConsent,
          marketingConsent,
          attribution: {
            ...attr,
            landing_page: '/',
            registration_page: '/register',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Registration failed.'); setSubmitting(false); return; }
      trackEvent('registration_completed', { registrationId: data.registrationId });
      setSuccess({ registrationId: data.registrationId });
      sessionStorage.setItem('nw_registration_id', data.registrationId);
      sessionStorage.setItem('nw_registration_email', email.trim().toLowerCase());
      // navigate after a brief delay
      setTimeout(() => {
        const emailSent = data.email?.sent === true ? '1' : '0';
        const sheetSynced = data.sheets?.synced === true ? '1' : '0';
        window.location.href = `/registration/success?id=${encodeURIComponent(data.registrationId)}&emailSent=${emailSent}&sheetSynced=${sheetSynced}`;
      }, 600);
    } catch (e) {
      setError('Network error. Please try again.'); setSubmitting(false);
    }
  };

  return (
    <>
      <PageTracker eventName="registration_page_viewed" pagePath="/register" />
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-navy">Register for the workshop</h1>
          <p className="mt-3 text-muted">Next Wave 60-Minute AI Project Making Workshop</p>
        </div>

        <div className="card p-6 lg:p-8 space-y-5">
          <div>
            <label className="label">Full name</label>
            <input className="input" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={submitting || !!success} />
          </div>
          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting || !!success} />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={necessaryConsent} onChange={(e) => setNecessaryConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line text-primary focus:ring-primary" disabled={submitting} />
              <span className="text-sm text-ink">I consent to receive registration-related emails (confirmation and workshop details).</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line text-primary focus:ring-primary" disabled={submitting} />
              <span className="text-sm text-muted">I'd also like to hear about future Next Wave programs (optional).</span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-err">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-ok">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              Registration saved. Redirecting to your confirmation page…
            </div>
          )}

          <button onClick={submit} disabled={submitting || !!success} className="btn-primary w-full">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>Register <ArrowRight className="h-4 w-4" /></>}
          </button>

          <div className="flex items-center gap-2 text-xs text-muted pt-2">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Your registration is stored securely. We collect only what's necessary. See our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </div>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          Already thinking about the assessment? <Link to="/assessment" className="text-primary hover:underline">Start here</Link>.
        </p>
      </div>
    </>
  );
}
