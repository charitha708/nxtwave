import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PageTracker } from '@/components/PageTracker';
import { trackEvent } from '@/lib/analytics';
import { getSessionId } from '@/lib/attribution';
import { Github, Loader2, AlertCircle, Clock, Save, ArrowRight, ArrowLeft, FileCode2, CheckCircle2, Lock } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Phase = 'submit' | 'analyzing' | 'exam' | 'grading' | 'done';

interface Q {
  id: string;
  position: number;
  category: string;
  prompt: string;
  evidence_refs: string[] | null;
}

const DURATIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
];

const CATEGORIES = [
  'Web App', 'API / Backend', 'Mobile', 'Data / ML', 'CLI / Tool', 'Full-Stack', 'Other',
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export function Assessment() {
  const [phase, setPhase] = useState<Phase>('submit');
  const [repoUrl, setRepoUrl] = useState('');
  const [category, setCategory] = useState('Web App');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [duration, setDuration] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [provider, setProvider] = useState<string>('mock');
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const sessionIdRef = useRef(getSessionId());
  const saveTimerRef = useRef<number | null>(null);
  const finalizingRef = useRef(false);

  // Restore progress from the server, not only from local browser state.
  useEffect(() => {
    const saved = sessionStorage.getItem('nw_assessment');
    if (!saved) return;
    let s: any;
    try { s = JSON.parse(saved); } catch { sessionStorage.removeItem('nw_assessment'); return; }
    if (!s.assessmentId || !s.questions?.length) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-examiner`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ action: 'resume', assessmentId: s.assessmentId, sessionId: sessionIdRef.current }),
        });
        const data = await res.json();
        if (!res.ok || !data.assessment || !['in_progress', 'expired'].includes(data.assessment.status)) {
          sessionStorage.removeItem('nw_assessment'); return;
        }
        setAssessmentId(s.assessmentId); setQuestions(data.questions ?? s.questions);
        setAnswers(data.answers ?? s.answers ?? {}); setSnapshot(data.assessment.repo_snapshot ?? s.snapshot);
        setProvider(s.provider ?? data.provider ?? 'mock'); setDuration(data.assessment.duration_minutes ?? s.duration ?? 10);
        const seconds = data.assessment.expires_at ? Math.max(0, Math.ceil((new Date(data.assessment.expires_at).getTime() - Date.now()) / 1000)) : 0;
        setRemainingSec(seconds); setExpired(seconds <= 0); setPhase('exam');
      } catch { setError('Could not restore the assessment. Check your connection and retry.'); }
    })();
  }, []);

  const persistExam = useCallback((aid: string, qs: Q[], ans: Record<string, string>, snap: any, prov: string, dur: number) => {
    sessionStorage.setItem('nw_assessment', JSON.stringify({
      assessmentId: aid, questions: qs, answers: ans, snapshot: snap, provider: prov, duration: dur,
    }));
  }, []);

  const handleSubmitRepo = async () => {
    setError(null);
    if (!repoUrl.trim()) { setError('Please enter a GitHub repository URL.'); return; }
    setPhase('analyzing');
    trackEvent('assessment_started');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-examiner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({
          action: 'analyze',
          repoUrl,
          category,
          experienceLevel,
          durationMinutes: duration,
          sessionId: sessionIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Analysis failed.'); setPhase('submit'); return; }
      setAssessmentId(data.assessmentId);
      setQuestions(data.questions);
      setProvider(data.provider);
      setSnapshot(data.snapshot);
      setAnswers({});
      setCurrentIdx(0);
      setExpired(false);
      persistExam(data.assessmentId, data.questions, {}, data.snapshot, data.provider, duration);

      const startRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-examiner`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ action: 'start', assessmentId: data.assessmentId, sessionId: sessionIdRef.current }),
      });
      const startData = await startRes.json();
      if (!startRes.ok || !startData.expiresAt) throw new Error(startData.error ?? 'Could not start the timed assessment.');
      setRemainingSec(Math.max(0, Math.ceil((new Date(startData.expiresAt).getTime() - Date.now()) / 1000)));
      setPhase('exam');
    } catch (e) {
      setError('Network error during analysis. Please try again.'); setPhase('submit');
    }
  };

  // countdown
  useEffect(() => {
    if (phase !== 'exam' || remainingSec === null) return;
    if (remainingSec <= 0) {
      setExpired(true);
      finalize(true);
      return;
    }
    const t = setTimeout(() => setRemainingSec((s) => (s ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, remainingSec]);

  // autosave current answer
  const saveAnswer = useCallback(async (qid: string, text: string) => {
    if (!assessmentId) return false;
    let res: Response;
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/ai-examiner`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ action: 'save-answer', assessmentId, sessionId: sessionIdRef.current, questionId: qid, answerText: text }),
      });
    } catch {
      setError('Network error: answer could not be saved yet. Check your connection.');
      return false;
    }
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Answer could not be saved.'); return false; }
    setAnswers((prev) => {
      const next = { ...prev, [qid]: text };
      persistExam(assessmentId, questions, next, snapshot, provider, duration);
      return next;
    });
    return true;
  }, [assessmentId, questions, snapshot, provider, duration, persistExam]);

  const debouncedSave = useCallback((qid: string, text: string) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveAnswer(qid, text), 1200);
  }, [saveAnswer]);

  const finalize = async (_auto = false) => {
    if (!assessmentId || finalizingRef.current) return;
    finalizingRef.current = true;
    setPhase('grading');
    try {
      // ensure last answer is saved
      const current = questions[currentIdx];
      if (!_auto && current && answers[current.id] !== undefined) {
        const saved = await saveAnswer(current.id, answers[current.id]);
        if (!saved) { setPhase('exam'); finalizingRef.current = false; return; }
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-examiner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ action: 'grade', assessmentId, sessionId: sessionIdRef.current }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Grading failed.'); setPhase('exam'); finalizingRef.current = false; return; }
      trackEvent('assessment_completed');
      sessionStorage.removeItem('nw_assessment');
      setReportUrl(`/assessment/results?id=${assessmentId}`);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error during grading.'); setPhase('exam'); finalizingRef.current = false;
    }
  };


  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ---------- Submit phase ----------
  if (phase === 'submit') {
    return (
      <>
        <PageTracker eventName="assessment_page_viewed" pagePath="/assessment" />
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <div className="inline-flex h-12 w-12 rounded-xl bg-pale items-center justify-center text-primary mb-4">
              <Github className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold text-navy">Start your project assessment</h1>
            <p className="mt-3 text-muted">Submit your public GitHub repository. We'll analyze the actual code and generate a timed, open-ended exam.</p>
          </div>

          <div className="card p-6 lg:p-8 space-y-6">
            <div>
              <label className="label">Public GitHub repository URL</label>
              <input
                className="input"
                placeholder="https://github.com/yourname/your-repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <p className="text-xs text-muted mt-1.5">Only public github.com repositories are supported in this version. Private repos are rejected safely.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Project category</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Experience level (optional)</label>
                <select className="input" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Assessment duration</label>
              <div className="grid grid-cols-4 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`rounded-lg border py-3 text-sm font-semibold transition-colors ${
                      duration === d.value ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink hover:bg-pale'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-err">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button onClick={handleSubmitRepo} className="btn-primary w-full">
              Analyze repository and begin <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-xs text-center text-muted">
              By submitting, you agree to our <Link to="/terms" className="text-primary hover:underline">Terms</Link>.
              We only inspect the repository you provide.
            </p>
          </div>
        </div>
      </>
    );
  }

  // ---------- Analyzing ----------
  if (phase === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-5" />
        <h2 className="text-xl font-semibold text-navy mb-2">Analyzing your repository</h2>
        <p className="text-muted text-sm max-w-sm text-center">
          Fetching README, file tree, dependencies, and architecture. Generating repository-specific questions…
        </p>
      </div>
    );
  }

  // ---------- Exam ----------
  if (phase === 'exam' || phase === 'grading') {
    const q = questions[currentIdx];
    const lowTime = remainingSec !== null && remainingSec < 60;
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Timer bar */}
        <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 bg-white/95 backdrop-blur border-b border-line">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Clock className={`h-4 w-4 ${lowTime ? 'text-err' : 'text-primary'}`} />
              <span className={`font-semibold tabular-nums ${lowTime ? 'text-err' : 'text-ink'}`}>
                {remainingSec !== null ? fmtTime(remainingSec) : '--:--'}
              </span>
              {expired && <span className="badge bg-red-50 text-err ml-2">Time expired</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">
                Question {currentIdx + 1} of {questions.length}
              </span>
              {provider === 'mock' && (
                <span className="badge bg-amber-50 text-amber-700">Dev mode (mock AI)</span>
              )}
            </div>
          </div>
          <div className="h-1 bg-pale">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* repo snapshot */}
        {snapshot && (
          <div className="card p-4 mb-6 bg-surface">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy mb-1">
              <FileCode2 className="h-4 w-4 text-primary" />
              {snapshot.repo}
            </div>
            <p className="text-xs text-muted line-clamp-2">{snapshot.architecture_summary}</p>
          </div>
        )}

        {q && (
          <div className="card p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge bg-pale text-primary">{q.category}</span>
              <span className="text-xs text-muted">Question {q.position}</span>
            </div>
            <h2 className="text-lg font-semibold text-ink leading-relaxed mb-4">{q.prompt}</h2>
            {q.evidence_refs && q.evidence_refs.length > 0 && (
              <div className="text-xs text-muted mb-4">
                <span className="font-medium">Relevant evidence:</span> {q.evidence_refs.join(', ')}
              </div>
            )}
            <textarea
              className="input min-h-[200px] resize-y leading-relaxed"
              placeholder="Write your answer here. Be specific — reference actual files, functions, and data flow from your repository…"
              value={answers[q.id] ?? ''}
              onChange={(e) => {
                const next = { ...answers, [q.id]: e.target.value };
                setAnswers(next);
                debouncedSave(q.id, e.target.value);
              }}
              disabled={expired || phase === 'grading'}
            />
            <div className="flex items-center justify-between mt-2 text-xs text-muted">
              <span className="flex items-center gap-1"><Save className="h-3 w-3" /> Autosaved</span>
              <span>{(answers[q.id] ?? '').length} characters</span>
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0 || phase === 'grading'}
                className="btn-ghost"
              >
                <ArrowLeft className="h-4 w-4" /> Previous
              </button>
              {currentIdx < questions.length - 1 ? (
                <button onClick={() => setCurrentIdx((i) => i + 1)} className="btn-primary">
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => finalize(false)}
                  disabled={expired || phase === 'grading'}
                  className="btn-primary"
                >
                  {phase === 'grading' ? <><Loader2 className="h-4 w-4 animate-spin" /> Grading…</> : <>Submit for grading <ArrowRight className="h-4 w-4" /></>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* question nav */}
        <div className="flex flex-wrap gap-2 mt-6">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrentIdx(i)}
              className={`h-9 w-9 rounded-lg text-xs font-semibold border transition-colors ${
                i === currentIdx ? 'border-primary bg-primary text-white'
                : answers[qq.id]?.trim() ? 'border-line bg-pale text-primary'
                : 'border-line bg-white text-muted hover:bg-pale'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {expired && (
          <div className="card p-4 mt-6 bg-amber-50 border-amber-200 flex items-start gap-2 text-sm text-amber-800">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            Time has expired. Your saved answers are being finalized automatically.
          </div>
        )}
      </div>
    );
  }

  // ---------- Done ----------
  if (phase === 'done' && reportUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <CheckCircle2 className="h-14 w-14 text-ok mb-4" />
        <h2 className="text-2xl font-bold text-navy mb-2">Assessment complete</h2>
        <p className="text-muted mb-6">Your report is ready.</p>
        <Link to={reportUrl} className="btn-primary">View your report <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  return null;
}
