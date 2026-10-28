import { Link } from 'react-router-dom';
import { PageTracker } from '@/components/PageTracker';
import { Brain, Timer, BarChart3, ShieldCheck, ArrowRight, Github, FileCode2, Network, Lock } from 'lucide-react';

export function Landing() {
  return (
    <>
      <PageTracker eventName="landing_page_viewed" pagePath="/" />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-pale to-white">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,#EAF2FF_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="badge bg-pale text-primary border border-line mb-5">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                A Next Wave initiative
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-navy leading-[1.1] tracking-tight">
                You built a project.<br />
                <span className="text-primary">Now understand how it works.</span>
              </h1>
              <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed">
                Submit your GitHub repository and take a timed, AI-driven technical exam
                designed to reveal what you truly understand — and where the gaps are.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/assessment" className="btn-primary">
                  Start your assessment <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/workshop" className="btn-secondary">
                  Explore the workshop
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted">
                Free during the Next Wave program. No sign-up required to take the assessment.
              </p>
            </div>
            <div className="relative">
              <div className="card p-6 lg:p-8 max-w-md mx-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-pale flex items-center justify-center text-primary">
                    <Github className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink">your-repo / app</div>
                    <div className="text-xs text-muted">Public GitHub repository</div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { icon: FileCode2, label: 'Analyzing README, structure, dependencies…', done: true },
                    { icon: Network, label: 'Tracing architecture and request flow…', done: true },
                    { icon: Brain, label: 'Generating repository-specific questions…', done: true },
                    { icon: Timer, label: 'Timed, open-ended examination begins', done: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.done ? 'bg-primary/10 text-primary' : 'bg-pale text-muted'}`}>
                        <s.icon className="h-4 w-4" />
                      </div>
                      <span className={s.done ? 'text-ink' : 'text-muted'}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-5 border-t border-line">
                  <div className="flex items-center justify-between text-xs text-muted mb-2">
                    <span>Assessment progress</span>
                    <span>5 / 12 questions</span>
                  </div>
                  <div className="h-2 rounded-full bg-pale overflow-hidden">
                    <div className="h-full w-2/5 rounded-full bg-primary"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-navy">How the assessment works</h2>
          <p className="mt-3 text-muted">A rigorous, evidence-grounded process — not multiple-choice guessing.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Github, title: 'Submit your repo', desc: 'Paste a public GitHub URL. We inspect the actual README, structure, dependencies, routes, and models — not just the description.' },
            { icon: Brain, title: 'Answer real questions', desc: 'The AI examiner writes open-ended questions specific to your code. Trace request flow, find security gaps, explain trade-offs.' },
            { icon: BarChart3, title: 'Get a scored report', desc: 'Receive a category breakdown, per-question feedback, and a prioritized learning roadmap grounded in your own code.' },
          ].map((c, i) => (
            <div key={i} className="card p-6">
              <div className="h-11 w-11 rounded-xl bg-pale flex items-center justify-center text-primary mb-4">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-ink mb-2">{c.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What it tests */}
      <section className="bg-surface border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-navy mb-4">What we test</h2>
              <p className="text-muted leading-relaxed mb-6">
                AI-generated code can accelerate development, but it does not automatically create
                understanding. The Next Wave assessment verifies whether you can explain, defend,
                and reason about the project you built.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Architecture & component communication',
                  'Request and data-flow tracing',
                  'APIs and backend behavior',
                  'Database design and integrity',
                  'Authentication & authorization',
                  'Security and threat modeling',
                  'Error handling and debugging',
                  'Testing, deployment, performance',
                  'Engineering trade-offs',
                  'AI integration safety',
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2 text-sm text-ink">
                    <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-8">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <Lock className="h-5 w-5" />
                <span className="font-semibold text-ink">Server-authoritative timer</span>
              </div>
              <p className="text-sm text-muted mb-4">
                Choose 5, 10, 15, or 20 minutes. The countdown is enforced on the server, not just the
                browser. Answers autosave and survive a refresh — but submissions after expiry are
                rejected.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {['5m', '10m', '15m', '20m'].map((d) => (
                  <div key={d} className="rounded-lg border border-line bg-white py-3 text-center text-sm font-semibold text-navy">
                    {d}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="rounded-3xl bg-navy p-10 lg:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,#155EEF_0%,transparent_70%)] opacity-40" />
          <div className="relative">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to find out what you really know?</h2>
            <p className="text-blue-100 max-w-xl mx-auto mb-8">
              The assessment takes as little as 5 minutes. Your report links directly to the Next Wave
              workshop if you want to close the gaps it finds.
            </p>
            <Link to="/assessment" className="btn-primary inline-flex">
              Start your assessment <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
