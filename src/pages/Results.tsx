import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTracker } from '@/components/PageTracker';
import { getSessionId } from '@/lib/attribution';
import { getSessionId } from '@/lib/attribution';
import { ArrowRight, Award, TrendingUp, AlertTriangle, Target, BookOpen, Loader2 } from 'lucide-react';

export function Results() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const [report, setReport] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('No assessment id provided.'); setLoading(false); return; }
    (async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-examiner`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ action: 'get-results', assessmentId: id, sessionId: getSessionId() }),
        });
        const result = await response.json();
        if (!response.ok || !result.assessment) { setError(result.error ?? 'Assessment not found. Open results in the same browser session used for the exam.'); setLoading(false); return; }
        setAssessment(result.assessment); setReport(result.report); setQuestions(result.questions ?? []);
      } catch { setError('Could not load the report. Check your connection and try again.'); }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>;
  if (error) return <div className="max-w-xl mx-auto py-20 text-center"><p className="text-err">{error}</p><Link to="/assessment" className="btn-primary mt-4">Back to assessment</Link></div>;

  const score = report?.overall_score ?? 0;
  const scoreColor = score >= 75 ? 'text-ok' : score >= 50 ? 'text-primary' : 'text-err';
  const scoreRing = score >= 75 ? '#16803D' : score >= 50 ? '#155EEF' : '#B42318';

  return (
    <>
      <PageTracker eventName="results_viewed" pagePath="/assessment/results" />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 pb-32">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy">Your assessment report</h1>
          <p className="text-muted mt-2">
            {assessment?.repo_snapshot?.repo ?? 'Repository'} — {assessment?.duration_minutes} minute exam
          </p>
        </div>

        {/* Score card */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 text-center">
            <div className="text-xs text-muted uppercase tracking-wide mb-2">Overall score</div>
            <div className={`text-5xl font-bold ${scoreColor}`}>{score}</div>
            <div className="text-sm text-muted mt-1">out of 100</div>
            <svg className="mx-auto mt-4 h-2 w-32" viewBox="0 0 120 8">
              <rect x="0" y="2" width="120" height="4" rx="2" fill="#EAF2FF" />
              <rect x="0" y="2" width={(score / 100) * 120} height="4" rx="2" fill={scoreRing} />
            </svg>
          </div>
          <div className="card p-6 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-ink">Category breakdown</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(report?.category_scores ?? {}).map(([cat, sc]: [string, any]) => (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink">{cat}</span>
                    <span className="font-semibold text-muted tabular-nums">{sc}</span>
                  </div>
                  <div className="h-2 rounded-full bg-pale overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${sc}%` }} />
                  </div>
                </div>
              ))}
              {Object.keys(report?.category_scores ?? {}).length === 0 && (
                <p className="text-sm text-muted">No category scores available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Question feedback */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-navy mb-4">Question-by-question feedback</h2>
          <div className="space-y-4">
            {report?.question_feedback?.map((f: any, i: number) => {
              const q = questions.find((qq) => qq.id === f.question_id) ?? questions[i];
              return (
                <div key={f.question_id ?? i} className="card p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="badge bg-pale text-primary">{q?.category ?? 'Question'}</span>
                      <p className="text-sm font-medium text-ink mt-2">{q?.prompt ?? 'Question'}</p>
                    </div>
                    <div className={`text-lg font-bold shrink-0 ${f.score >= 75 ? 'text-ok' : f.score >= 50 ? 'text-primary' : 'text-err'}`}>
                      {f.score}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    {f.correct_aspects?.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-ok mb-1 flex items-center gap-1"><Target className="h-3 w-3" /> Correct aspects</div>
                        <ul className="text-xs text-muted space-y-1 list-disc list-inside">{f.correct_aspects.map((a: string, j: number) => <li key={j}>{a}</li>)}</ul>
                      </div>
                    )}
                    {f.missing_concepts?.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-err mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Missing concepts</div>
                        <ul className="text-xs text-muted space-y-1 list-disc list-inside">{f.missing_concepts.map((a: string, j: number) => <li key={j}>{a}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {f.expected_reasoning && (
                    <div className="mt-3 text-xs text-muted">
                      <span className="font-semibold text-ink">Expected reasoning: </span>{f.expected_reasoning}
                    </div>
                  )}
                  {f.evidence && (
                    <div className="mt-2 text-xs text-muted">
                      <span className="font-semibold text-ink">Evidence: </span>{f.evidence}
                    </div>
                  )}
                  {f.improvement_exercise && (
                    <div className="mt-3 rounded-lg bg-pale p-3 text-xs text-ink">
                      <span className="font-semibold text-primary">Improvement exercise: </span>{f.improvement_exercise}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Roadmap */}
        {report?.learning_roadmap?.length > 0 && (
          <div className="card p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-ink">Prioritized learning roadmap</h3>
            </div>
            <div className="space-y-3">
              {report.learning_roadmap.map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`badge mt-0.5 ${r.priority === 'High' ? 'bg-red-50 text-err' : r.priority === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-pale text-primary'}`}>
                    {r.priority}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-ink">{r.topic}</div>
                    <div className="text-xs text-muted">{r.rationale}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-primary mt-1" />
            <div>
              <h3 className="font-semibold text-ink">Want to close these gaps?</h3>
              <p className="text-sm text-muted mt-1">The Next Wave 60-Minute AI Project Making Workshop is built to address exactly the gaps this assessment surfaces.</p>
              <Link to="/workshop" className="btn-primary mt-4">Explore the Next Wave Workshop <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent funnel banner */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-navy/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <p className="text-white font-semibold text-sm">You built a project. Now understand how it works in the real world—with Next Wave.</p>
            <p className="text-blue-200 text-xs mt-0.5">Understand the complete project workflow, connect frontend and backend systems, and learn to use AI as a coding partner.</p>
          </div>
          <Link to="/workshop" className="btn bg-white text-navy hover:bg-pale shrink-0">
            Explore the Next Wave Workshop <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
