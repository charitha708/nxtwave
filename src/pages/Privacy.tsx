import { PageTracker } from '@/components/PageTracker';

export function Privacy() {
  return (
    <>
      <PageTracker eventName="privacy_viewed" pagePath="/privacy" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 prose-custom">
        <h1 className="text-3xl font-bold text-navy mb-6">Privacy Policy</h1>
        <div className="space-y-6 text-ink leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">What we collect</h2>
            <p className="text-muted">Next Wave Project Lab collects the minimum information necessary to operate:</p>
            <ul className="mt-2 space-y-1 text-muted list-disc list-inside">
              <li>The public GitHub repository URL you submit for assessment.</li>
              <li>Your assessment answers and the AI-generated report.</li>
              <li>Registration details: full name and email address, with your consent.</li>
              <li>Anonymous, first-party campaign attribution parameters (UTM tags, referral code) stored with a session identifier. We do not fingerprint you.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">How we use it</h2>
            <p className="text-muted">To run assessments, send workshop confirmations, attribute registrations to campaigns, and produce aggregated analytics on the admin dashboard. We never sell your data.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Data storage</h2>
            <p className="text-muted">Data is stored in a Supabase Postgres database protected by row-level security. Email delivery is handled by Resend; reporting is mirrored to a private Google Sheet accessible only to Next Wave organizers.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Your rights</h2>
            <p className="text-muted">You may request deletion of your assessment or registration data by contacting Next Wave. Anonymous analytics events are retained for campaign measurement.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Contact</h2>
            <p className="text-muted">For privacy questions, reach out to the Next Wave team.</p>
          </section>
        </div>
      </div>
    </>
  );
}
