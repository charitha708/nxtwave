import { Link } from 'react-router-dom';
import { PageTracker } from '@/components/PageTracker';
import { ArrowRight, Clock, Users, Lightbulb, ShieldCheck, GitBranch, Server, Database, Lock, Bug, TestTube, Rocket, Activity, Brain, BookOpen } from 'lucide-react';

export function Workshop() {
  const sections = [
    { n: 1, icon: GitBranch, title: 'Requirements & problem definition' },
    { n: 2, icon: Lightbulb, title: 'Architecture and data-flow design' },
    { n: 3, icon: BookOpen, title: 'Frontend implementation' },
    { n: 4, icon: Server, title: 'Backend services & API development' },
    { n: 5, icon: Database, title: 'Database integration' },
    { n: 6, icon: Lock, title: 'Authentication, authorization & validation' },
    { n: 7, icon: Bug, title: 'Error handling & debugging' },
    { n: 8, icon: TestTube, title: 'Testing & quality assurance' },
    { n: 9, icon: Rocket, title: 'Deployment & environment configuration' },
    { n: 10, icon: Activity, title: 'Monitoring, maintenance & iteration' },
  ];

  return (
    <>
      <PageTracker eventName="blog_viewed" pagePath="/workshop" />
      <article className="pb-32">
        {/* Hero */}
        <section className="bg-gradient-to-b from-pale to-white border-b border-line">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="badge bg-white text-primary border border-line mb-4">
              <Clock className="h-3.5 w-3.5" /> 60 minutes
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-navy leading-tight">
              The Next Wave 60-Minute AI Project Making Workshop
            </h1>
            <p className="mt-5 text-lg text-muted leading-relaxed">
              Building a project is not the same as understanding how it works. This workshop closes that gap —
              the complete real-world workflow, and how to use AI as a deliberate engineering partner.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/register" className="btn-primary">Reserve your seat <ArrowRight className="h-4 w-4" /></Link>
              <a href="#problem" className="btn-secondary">Read the article</a>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 space-y-16">
          {/* Section A */}
          <section id="problem">
            <div className="flex items-center gap-2 mb-4">
              <span className="badge bg-pale text-primary">Section A</span>
              <h2 className="text-2xl font-bold text-navy">The problem</h2>
            </div>
            <div className="prose-custom">
              <p className="text-ink leading-relaxed">
                Many students have projects that run — but they cannot explain the architecture, the request flow,
                the API interactions, the database operations, the security considerations, or how the
                application is deployed.
              </p>
              <p className="text-muted leading-relaxed mt-4">
                AI-generated code can accelerate development. It cannot, by itself, create understanding.
                A working demo is not evidence of engineering comprehension. When an interviewer asks "trace this
                request from the button to the database," copy-pasted code does not help.
              </p>
              <p className="text-muted leading-relaxed mt-4">
                This is the gap the Next Wave workshop is designed to close — not by teaching you to build again,
                but by teaching you to understand what you have already built.
              </p>
            </div>
            <div className="card p-6 bg-surface mt-6">
              <Link to="/register" className="btn-primary w-full sm:w-auto inline-flex">Register for the workshop <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>

          {/* Section B */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="badge bg-pale text-primary">Section B</span>
              <h2 className="text-2xl font-bold text-navy">How real-world projects work</h2>
            </div>
            <p className="text-ink leading-relaxed mb-6">
              A production application is not a single script. It is a system with a complete workflow, and
              every stage matters. During the workshop we walk through all ten:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {sections.map((s) => (
                <div key={s.n} className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
                  <div className="h-9 w-9 rounded-lg bg-pale flex items-center justify-center text-primary shrink-0">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted">Step {s.n}</div>
                    <div className="text-sm font-medium text-ink">{s.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section C */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="badge bg-pale text-primary">Section C</span>
              <h2 className="text-2xl font-bold text-navy">AI as a coding partner</h2>
            </div>
            <p className="text-ink leading-relaxed mb-4">
              The workshop does not discourage AI use — it teaches you to use AI deliberately, instead of
              blindly accepting generated code. You will learn how to use AI to:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'Understand unfamiliar code',
                'Break requirements into implementation tasks',
                'Generate and review tests',
                'Debug errors systematically',
                'Evaluate alternative designs',
                'Review security and reliability',
                'Validate generated code instead of blindly accepting it',
              ].map((t) => (
                <div key={t} className="flex items-start gap-2 text-sm text-ink">
                  <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </section>

          {/* Section D */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="badge bg-pale text-primary">Section D</span>
              <h2 className="text-2xl font-bold text-navy">Workshop learning outcomes</h2>
            </div>
            <p className="text-ink leading-relaxed mb-4">During the 60 minutes, participants will learn to:</p>
            <ul className="space-y-2">
              {[
                'Trace a request end-to-end through a real application architecture.',
                'Explain how frontend, backend, and database components communicate.',
                'Identify security and data-integrity risks in their own code.',
                'Use AI to explain, test, and review code — not to write it blindly.',
                'Adopt practical engineering habits used by working developers.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-ink">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted mt-4">
              The workshop focuses on understanding and habits. It does not promise guaranteed employment,
              mastery, or specific career outcomes.
            </p>
          </section>

          {/* Section E */}
          <section className="rounded-2xl bg-navy p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,#155EEF_0%,transparent_70%)] opacity-30" />
            <div className="relative">
              <div className="inline-flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Register for the Next Wave workshop</h2>
              <p className="text-blue-100 max-w-md mx-auto mb-6">
                Seats are confirmed by email after registration. Workshop details will be shared with registered participants.
              </p>
              <Link to="/register" className="btn bg-white text-navy hover:bg-pale inline-flex">
                Reserve your seat <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </article>
    </>
  );
}
