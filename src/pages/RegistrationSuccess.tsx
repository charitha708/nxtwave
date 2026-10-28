import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTracker } from '@/components/PageTracker';
import { CheckCircle2, Mail, ArrowRight, Loader2, AlertCircle, Bell } from 'lucide-react';

export function RegistrationSuccess() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const emailSent = params.get('emailSent') === '1';
  const sheetSynced = params.get('sheetSynced') === '1';
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sheetStatus, setSheetStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('nw_registration_email');
    if (storedEmail) setEmail(storedEmail);
    (async () => {
      if (!id) { setLoading(false); return; }
      const registeredEmail = storedEmail?.trim().toLowerCase();
      if (registeredEmail) {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/registration-status`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({ registrationId: id, email: registeredEmail })
          });
          if (response.ok) { const result = await response.json(); setStatus(result.emailStatus); setSheetStatus(result.sheetStatus); }
        } catch { /* Keep the confirmation page usable if status lookup is temporarily unavailable. */ }
      }
      setLoading(false);
    })();
  }, [id]);

  const emailConfirmed = status ? ['sent', 'delivered'].includes(status) : emailSent;
  const sheetConfirmed = sheetStatus ? sheetStatus === 'completed' : sheetSynced;

  return (
    <>
      <PageTracker eventName="registration_success_viewed" pagePath="/registration/success" />
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-green-50 items-center justify-center text-ok mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-navy">You're registered</h1>
          <p className="mt-3 text-muted">Next Wave 60-Minute AI Project Making Workshop</p>
        </div>

        <div className="card p-6 lg:p-8 space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-pale p-4">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <div className="font-semibold text-ink">{emailConfirmed ? 'Confirmation email accepted by the email provider' : 'Registration saved; email not confirmed as sent'}</div>
              {email && <div className="text-muted">to {email}</div>}
            </div>
          </div>

          <div className="rounded-lg border border-line p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-ink">Email delivery status</span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</div>
            ) : !emailConfirmed ? (
              <p className="text-xs text-muted">The registration is saved, but the application did not confirm that an email was accepted by Resend. An administrator must configure or retry email delivery.</p>
            ) : (
              <p className="text-xs text-muted">
                Status: <span className="font-semibold text-ink">{status ?? (emailConfirmed ? 'sent' : 'pending')}</span>. Provider acceptance is not a guarantee of inbox delivery.
              </p>
            )}
          </div>

          <div className="rounded-lg bg-surface p-4 text-sm text-ink">
            <div className="font-semibold text-navy mb-1">Your registration ID</div>
            <div className="font-mono text-xs text-muted">{id ?? '—'}</div>
          </div>

          {!sheetConfirmed && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              Your registration is saved, but spreadsheet synchronization is not confirmed ({sheetStatus ?? 'pending'}). The administrator can retry it from the dashboard after configuring Google Sheets.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link to="/workshop" className="btn-secondary flex-1">Back to workshop</Link>
            <Link to="/assessment" className="btn-primary flex-1">Take the assessment <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </>
  );
}
