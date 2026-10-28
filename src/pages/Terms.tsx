import { PageTracker } from '@/components/PageTracker';

export function Terms() {
  return (
    <>
      <PageTracker eventName="terms_viewed" pagePath="/terms" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 prose-custom">
        <h1 className="text-3xl font-bold text-navy mb-6">Terms of Use</h1>
        <div className="space-y-6 text-ink leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Service</h2>
            <p className="text-muted">Next Wave Project Lab is a Next Wave initiative providing AI-driven project assessments and workshop registration. By using the service you agree to these terms.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Acceptable use</h2>
            <p className="text-muted">You agree to submit only repositories you have the right to share. You may not attempt to access another user's assessment, registration, or admin resources, or abuse the API with automated requests.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Assessment accuracy</h2>
            <p className="text-muted">AI-generated assessments are educational tools, not certifications. Scores and feedback are informational and may not reflect your complete abilities.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Workshop</h2>
            <p className="text-muted">Registration does not guarantee a seat until confirmed by email. Workshop content, dates, and joining details are shared with registered participants.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-navy mb-2">Liability</h2>
            <p className="text-muted">Next Wave Project Lab is provided "as is." We are not liable for decisions made based on assessment results.</p>
          </section>
        </div>
      </div>
    </>
  );
}
