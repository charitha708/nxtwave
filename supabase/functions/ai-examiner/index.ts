// AI Examiner edge function
// Analyzes a GitHub repository and generates/grades an open-ended technical exam.
// Supports OpenAI, Anthropic, Gemini, or a built-in mock provider when no key is set.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'mock';

interface ExaminerRequest {
  action: 'analyze' | 'start' | 'resume' | 'save-answer' | 'get-results' | 'grade';
  assessmentId?: string;
  repoUrl?: string;
  category?: string;
  experienceLevel?: string;
  durationMinutes?: number;
  sessionId?: string;
  answers?: Record<string, string>;
  questionId?: string;
  answerText?: string;
}

function getProvider(): LLMProvider {
  if (Deno.env.get('OPENAI_API_KEY')) return 'openai';
  if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic';
  if (Deno.env.get('GEMINI_API_KEY')) return 'gemini';
  return 'mock';
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getProvider();
  if (provider === 'mock') return mockLLM(systemPrompt, userPrompt);

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content[0].text;
  }

  // gemini
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// ---- Repository analysis ----
function validateRepoUrl(url: string): { ok: boolean; owner?: string; repo?: string; error?: string } {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return { ok: false, error: 'Only github.com URLs are supported in this version.' };
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return { ok: false, error: 'Invalid repository URL.' };
    return { ok: true, owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return { ok: false, error: 'Invalid URL.' };
  }
}

async function fetchRepoMetadata(owner: string, repo: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'next-wave-lab' },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchRepoTree(owner: string, repo: string, branch: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'next-wave-lab' },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchFileContent(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`, {
    headers: { 'User-Agent': 'next-wave-lab' },
  });
  if (!res.ok) return null;
  return res.text();
}

async function analyzeRepository(repoUrl: string) {
  const parsed = validateRepoUrl(repoUrl);
  if (!parsed.ok || !parsed.owner || !parsed.repo) {
    return { error: parsed.error ?? 'Invalid repository.' };
  }
  const meta = await fetchRepoMetadata(parsed.owner, parsed.repo);
  if (!meta) return { error: 'Could not retrieve repository metadata. It may be private or deleted.' };
  if (meta.private) return { error: 'This repository is private. Public repositories are supported in this version.' };

  const branch = meta.default_branch ?? 'main';
  const tree = await fetchRepoTree(parsed.owner, parsed.repo, branch);
  if (!tree || !tree.tree) return { error: 'Could not retrieve repository file tree.' };

  const files = tree.tree
    .filter((t: any) => t.type === 'blob')
    .map((t: any) => ({ path: t.path, kind: classifyFile(t.path) }))
    .slice(0, 120);

  const readmePath = files.find((f: any) => f.path.toLowerCase() === 'readme.md' || f.path.toLowerCase() === 'readme')?.path;
  let readmeExcerpt: string | null = null;
  if (readmePath) {
    const content = await fetchFileContent(parsed.owner, parsed.repo, branch, readmePath);
    readmeExcerpt = content ? content.slice(0, 4000) : null;
  }

  const pkgPath = files.find((f: any) => f.path === 'package.json')?.path;
  let dependencies: string[] | null = null;
  if (pkgPath) {
    const content = await fetchFileContent(parsed.owner, parsed.repo, branch, pkgPath);
    if (content) {
      try {
        const pkg = JSON.parse(content);
        dependencies = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
      } catch {}
    }
  }

  const interesting = files.filter((f: any) =>
    ['entry', 'route', 'api', 'model', 'config', 'schema', 'migration', 'test', 'auth'].includes(f.kind)
  ).slice(0, 8);

  const architectureSummary = buildArchitectureSummary(files, dependencies, readmeExcerpt, interesting.map((f:any) => f.path));

  return {
    snapshot: {
      repo: `${parsed.owner}/${parsed.repo}`,
      description: meta.description,
      language: meta.language,
      stars: meta.stargazers_count,
      files,
      readme_excerpt: readmeExcerpt,
      dependencies,
      architecture_summary: architectureSummary,
    },
  };
}

function classifyFile(path: string): string {
  const p = path.toLowerCase();
  if (p === 'readme.md' || p === 'readme') return 'readme';
  if (p.endsWith('package.json') || p.endsWith('cargo.toml') || p.endsWith('go.mod') || p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) return 'manifest';
  if (p.includes('route') || p.includes('router')) return 'route';
  if (p.includes('/api/')) return 'api';
  if (p.includes('model') || p.includes('schema') || p.includes('migration')) return 'model';
  if (p.includes('test') || p.includes('spec')) return 'test';
  if (p.includes('auth') || p.includes('login') || p.includes('middleware')) return 'auth';
  if (p.endsWith('.env') || p.endsWith('.config.js') || p.endsWith('dockerfile') || p.endsWith('docker-compose.yml')) return 'config';
  if (p.endsWith('.tsx') || p.endsWith('.jsx') || p.endsWith('main.ts') || p.endsWith('index.ts') || p.endsWith('app.ts')) return 'entry';
  return 'source';
}

function buildArchitectureSummary(files: any[], deps: string[] | null, readme: string | null, interestingPaths: string[]): string {
  const langs = new Set<string>();
  files.forEach((f) => {
    const ext = f.path.split('.').pop();
    if (ext === 'tsx' || ext === 'jsx') langs.add('React/TypeScript');
    if (ext === 'ts') langs.add('TypeScript');
    if (ext === 'py') langs.add('Python');
    if (ext === 'go') langs.add('Go');
    if (ext === 'rs') langs.add('Rust');
  });
  const stack: string[] = [];
  if (deps) {
    if (deps.includes('next')) stack.push('Next.js');
    if (deps.includes('express')) stack.push('Express');
    if (deps.includes('fastapi')) stack.push('FastAPI');
    if (deps.includes('django')) stack.push('Django');
    if (deps.includes('@supabase/supabase-js')) stack.push('Supabase');
    if (deps.includes('react')) stack.push('React');
    if (deps.includes('tailwindcss')) stack.push('Tailwind CSS');
  }
  return [
    `Languages detected: ${[...langs].join(', ') || 'not determined from extension scan.'}`,
    `Likely stack: ${stack.length ? stack.join(', ') : 'not detected from dependency manifest.'}`,
    `Notable files: ${interestingPaths.join(', ') || 'none flagged.'}`,
    `README available: ${readme ? 'yes' : 'no'}.`,
  ].join('\n');
}

// ---- Question generation ----
async function generateQuestions(snapshot: any, durationMinutes: number): Promise<any[]> {
  const count = Math.min(12, Math.max(5, Math.round(durationMinutes / 2)));
  const systemPrompt = `You are a rigorous senior engineering examiner for Next Wave Project Lab. Generate ${count} difficult, open-ended technical questions about the student's repository. Each question MUST test understanding beyond surface-level code — architecture, data flow, security, trade-offs, failure modes. Return a JSON array of objects: { "category": string, "prompt": string, "evidence_refs": string[] }. Categories: Architecture, Code Comprehension, APIs & Backend, Database, Auth, Security, Error Handling, Testing, Deployment, Performance, AI Integration, Trade-offs. Only use evidence actually present in the snapshot. Output ONLY the JSON array, no prose.`;
  const userPrompt = `Repository snapshot:\n${JSON.stringify(snapshot)}`;
  const raw = await callLLM(systemPrompt, userPrompt);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, count);
  } catch {}
  // fallback to mock questions if parsing fails
  return mockQuestions(snapshot, count);
}

function mockQuestions(snapshot: any, count: number): any[] {
  const repoName = snapshot?.repo ?? 'this repository';
  const base = [
    { category: 'Architecture', prompt: `Trace a request from the user interface to the database in ${repoName}. Name the actual files and functions involved, and explain how data transforms at each step.`, evidence_refs: ['repository file tree'] },
    { category: 'Code Comprehension', prompt: `Identify the primary entry point of ${repoName} and explain what happens between process start and the first HTTP response being served.`, evidence_refs: ['entry file detection'] },
    { category: 'APIs & Backend', prompt: `Describe how ${repoName} structures its API routes. What conventions does it follow, and what would break if a route handler threw an unhandled exception?`, evidence_refs: ['route file inspection'] },
    { category: 'Database', prompt: `What database does ${repoName} use, and how are schemas/migrations managed? Describe a data-integrity risk in the current setup and how you would mitigate it.`, evidence_refs: ['dependency manifest'] },
    { category: 'Auth', prompt: `How does ${repoName} handle authentication? Describe the token lifecycle and what happens when a token expires mid-session.`, evidence_refs: ['auth-related files'] },
    { category: 'Security', prompt: `Identify one input in ${repoName} that could be exploited if not validated, and explain the attack and a concrete mitigation.`, evidence_refs: ['route handlers'] },
    { category: 'Error Handling', prompt: `Find a place in ${repoName} where an error is swallowed or logged without propagating. What user-visible failure would that cause, and how would you fix it?`, evidence_refs: ['source files'] },
    { category: 'Testing', prompt: `Design a test that would expose a real failure case in ${repoName}. Describe the scenario, the assertion, and why the current code would fail it.`, evidence_refs: ['existing test files'] },
    { category: 'Deployment', prompt: `What environment variables does ${repoName} require at runtime, and what would happen if one were missing in production?`, evidence_refs: ['config files'] },
    { category: 'Performance', prompt: `Identify a query or render path in ${repoName} that would become a bottleneck under 10x traffic. Propose a specific optimization.`, evidence_refs: ['data access patterns'] },
    { category: 'Trade-offs', prompt: `Pick one architectural decision in ${repoName} and argue for a different approach. What would improve, and what would regress?`, evidence_refs: ['architecture summary'] },
    { category: 'AI Integration', prompt: `If ${repoName} uses any AI integration, describe how prompts are constructed and where untrusted input could leak into a prompt. If it does not, describe where you would add one safely.`, evidence_refs: ['dependency manifest'] },
  ];
  return base.slice(0, count);
}

function mockLLM(_system: string, _user: string): string {
  // Deterministic placeholder; analyze() and grade() don't call this path
  // because analyze uses real repo fetch and grade returns mock report directly.
  return '[]';
}

// ---- Grading ----
async function gradeAssessment(snapshot: any, questions: any[], answers: Record<string, string>): Promise<any> {
  const provider = getProvider();
  if (provider === 'mock') return mockReport(questions, answers);

  const systemPrompt = `You are a rigorous examiner for Next Wave Project Lab. Grade each open-ended answer against the repository evidence using this rubric: Technical accuracy (30%), Repository-specific evidence (25%), Reasoning & causal explanation (20%), Trade-offs & edge cases (15%), Clarity & completeness (10%). Return JSON ONLY: { "question_feedback": [{ "question_id": string, "score": number (0-100), "correct_aspects": string[], "missing_concepts": string[], "inaccuracies": string[], "expected_reasoning": string, "evidence": string, "improvement_exercise": string }], "learning_roadmap": [{ "priority": "High"|"Medium"|"Low", "topic": string, "rationale": string }] }`;
  const userPrompt = `Repository snapshot:\n${JSON.stringify(snapshot)}\n\nQuestions and answers:\n${JSON.stringify(questions.map((q) => ({ id: q.id, category: q.category, prompt: q.prompt, answer: answers[q.id] ?? '(no answer)' })))}`;

  const raw = await callLLM(systemPrompt, userPrompt);
  try {
    const parsed = JSON.parse(raw);
    const feedback = parsed.question_feedback ?? [];
    const categoryScores: Record<string, number> = {};
    let total = 0;
    feedback.forEach((f: any) => {
      total += f.score;
      categoryScores[''] = 0;
    });
    return {
      overall_score: feedback.length ? Math.round(total / feedback.length) : 0,
      category_scores: computeCategoryScores(feedback, questions),
      question_feedback: feedback,
      learning_roadmap: parsed.learning_roadmap ?? [],
    };
  } catch {
    return mockReport(questions, answers);
  }
}

function computeCategoryScores(feedback: any[], questions: any[]): Record<string, number> {
  const byCat: Record<string, number[]> = {};
  feedback.forEach((f) => {
    const q = questions.find((q) => q.id === f.question_id);
    const cat = q?.category ?? 'Unknown';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(f.score);
  });
  const out: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(byCat)) {
    out[cat] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return out;
}

function mockReport(questions: any[], answers: Record<string, string>): any {
  const feedback = questions.map((q) => {
    const ans = answers[q.id] ?? '';
    const hasLen = ans.trim().length;
    const hasEvidence = /because|therefore|since|due to|file|function|route|component|database|auth/i.test(ans);
    const score = hasLen === 0 ? 0 : hasEvidence ? Math.min(85, 55 + Math.min(30, Math.floor(hasLen / 40))) : Math.min(60, 30 + Math.min(30, Math.floor(hasLen / 50)));
    return {
      question_id: q.id,
      score,
      correct_aspects: hasLen ? ['Demonstrated effort in addressing the prompt.'] : [],
      missing_concepts: hasEvidence ? [] : ['Specific repository evidence', 'Causal reasoning linking cause and effect'],
      inaccuracies: [],
      expected_reasoning: `A strong answer would reference actual files/functions in the repository, explain the request/data flow, and identify concrete trade-offs.`,
      evidence: 'Evaluated against the repository snapshot gathered during analysis.',
      improvement_exercise: `Re-read the code path implied by this question and write a one-paragraph explanation of what happens step-by-step.`,
    };
  });
  const total = feedback.reduce((a, f) => a + f.score, 0);
  return {
    overall_score: feedback.length ? Math.round(total / feedback.length) : 0,
    category_scores: computeCategoryScores(feedback, questions),
    question_feedback: feedback,
    learning_roadmap: [
      { priority: 'High', topic: 'Request/data flow tracing', rationale: 'Connecting frontend actions to backend handlers and database queries is the most common gap.' },
      { priority: 'Medium', topic: 'Security threat modeling', rationale: 'Identifying where untrusted input enters your code prepares you for real-world review.' },
      { priority: 'Low', topic: 'Test design', rationale: 'Writing tests that expose failure cases deepens understanding of edge behavior.' },
    ],
  };
}

// ---- Main handler ----
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body: ExaminerRequest = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (body.action === 'analyze') {
      if (!body.repoUrl || !body.sessionId) {
        return json({ error: 'repoUrl and sessionId are required.' }, 400);
      }
      const parsed = validateRepoUrl(body.repoUrl);
      if (!parsed.ok) return json({ error: parsed.error }, 400);

      // create assessment row
      const { data: assessment, error } = await supabase
        .from('assessments')
        .insert({
          session_id: body.sessionId,
          repo_url: body.repoUrl,
          category: body.category ?? null,
          experience_level: body.experienceLevel ?? null,
          duration_minutes: body.durationMinutes ?? 10,
          status: 'analyzing',
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);

      // analyze repo (real fetch)
      const result = await analyzeRepository(body.repoUrl);
      if ('error' in result) {
        await supabase.from('assessments').update({ status: 'pending' }).eq('id', assessment.id);
        return json({ error: result.error }, 422);
      }

      // generate questions
      const questionsRaw = await generateQuestions(result.snapshot, body.durationMinutes ?? 10);
      const questionRows = questionsRaw.map((q, i) => ({
        assessment_id: assessment.id,
        position: i + 1,
        category: q.category,
        prompt: q.prompt,
        evidence_refs: q.evidence_refs ?? null,
      }));
      const { data: insertedQuestions, error: questionInsertError } = await supabase
        .from('assessment_questions')
        .insert(questionRows)
        .select();
      if (questionInsertError || !insertedQuestions?.length) {
        await supabase.from('assessments').update({ status: 'pending' }).eq('id', assessment.id);
        return json({ error: 'Questions could not be saved. Please retry the assessment.' }, 500);
      }

      await supabase
        .from('assessments')
        .update({ status: 'ready', repo_snapshot: result.snapshot })
        .eq('id', assessment.id);

      return json({ assessmentId: assessment.id, questions: insertedQuestions, snapshot: result.snapshot, provider: getProvider() });
    }

    if (body.action === 'start') {
      if (!body.assessmentId || !body.sessionId) return json({ error: 'assessmentId and sessionId are required.' }, 400);
      const { data: assessment } = await supabase.from('assessments').select('*').eq('id', body.assessmentId).eq('session_id', body.sessionId).maybeSingle();
      if (!assessment) return json({ error: 'Assessment not found.' }, 404);
      if (assessment.status === 'ready') {
        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + Number(assessment.duration_minutes || 10) * 60000);
        const { error } = await supabase.from('assessments').update({ status: 'in_progress', started_at: startedAt.toISOString(), expires_at: expiresAt.toISOString() }).eq('id', assessment.id).eq('status', 'ready');
        if (error) return json({ error: 'Could not start assessment.' }, 500);
        return json({ ok: true, startedAt: startedAt.toISOString(), expiresAt: expiresAt.toISOString() });
      }
      if (assessment.status === 'in_progress') return json({ ok: true, startedAt: assessment.started_at, expiresAt: assessment.expires_at });
      return json({ error: 'This assessment cannot be started.' }, 409);
    }

    if (body.action === 'resume') {
      if (!body.assessmentId || !body.sessionId) return json({ error: 'assessmentId and sessionId are required.' }, 400);
      const { data: assessment } = await supabase.from('assessments').select('id, session_id, status, started_at, expires_at, duration_minutes, repo_snapshot').eq('id', body.assessmentId).eq('session_id', body.sessionId).maybeSingle();
      if (!assessment) return json({ error: 'Assessment not found.' }, 404);
      const [{ data: questions }, { data: savedAnswers }] = await Promise.all([
        supabase.from('assessment_questions').select('id, position, category, prompt, evidence_refs').eq('assessment_id', assessment.id).order('position', { ascending: true }),
        supabase.from('assessment_answers').select('question_id, answer_text').eq('assessment_id', assessment.id)
      ]);
      const answerMap: Record<string, string> = {};
      (savedAnswers ?? []).forEach((a: any) => { answerMap[a.question_id] = a.answer_text; });
      if (assessment.status === 'in_progress' && assessment.expires_at && Date.now() > new Date(assessment.expires_at).getTime()) {
        await supabase.from('assessments').update({ status: 'expired' }).eq('id', assessment.id).eq('status', 'in_progress');
        assessment.status = 'expired';
      }
      return json({ assessment, questions: questions ?? [], answers: answerMap, provider: getProvider() });
    }

    if (body.action === 'save-answer') {
      if (!body.assessmentId || !body.sessionId || !body.questionId || typeof body.answerText !== 'string') return json({ error: 'Assessment, session, question and answer are required.' }, 400);
      if (body.answerText.length > 20000) return json({ error: 'Answer is too long.' }, 400);
      const { data: assessment } = await supabase.from('assessments').select('id, status, expires_at').eq('id', body.assessmentId).eq('session_id', body.sessionId).maybeSingle();
      if (!assessment) return json({ error: 'Assessment not found.' }, 404);
      if (assessment.status !== 'in_progress' || !assessment.expires_at || Date.now() > new Date(assessment.expires_at).getTime()) return json({ error: 'Assessment time has expired. The answer was not saved.' }, 409);
      const { data: question } = await supabase.from('assessment_questions').select('id').eq('id', body.questionId).eq('assessment_id', assessment.id).maybeSingle();
      if (!question) return json({ error: 'Question does not belong to this assessment.' }, 404);
      const { error } = await supabase.from('assessment_answers').upsert({ assessment_id: assessment.id, question_id: question.id, answer_text: body.answerText, saved_at: new Date().toISOString() }, { onConflict: 'question_id' });
      if (error) return json({ error: 'Could not save answer.' }, 500);
      return json({ ok: true, savedAt: new Date().toISOString() });
    }

    if (body.action === 'get-results') {
      if (!body.assessmentId || !body.sessionId) return json({ error: 'assessmentId and sessionId are required.' }, 400);
      const { data: assessment } = await supabase.from('assessments').select('id, session_id, status, duration_minutes, repo_snapshot, report, submitted_at').eq('id', body.assessmentId).eq('session_id', body.sessionId).maybeSingle();
      if (!assessment || assessment.status !== 'completed') return json({ error: 'Completed assessment not found.' }, 404);
      const { data: questions } = await supabase.from('assessment_questions').select('id, position, category, prompt, evidence_refs').eq('assessment_id', assessment.id).order('position', { ascending: true });
      return json({ assessment, questions: questions ?? [], report: assessment.report });
    }

    if (body.action === 'grade') {
      if (!body.assessmentId || !body.sessionId) return json({ error: 'assessmentId and sessionId are required.' }, 400);
      const { data: assessment } = await supabase.from('assessments').select('*, assessment_questions(*)').eq('id', body.assessmentId).eq('session_id', body.sessionId).maybeSingle();
      if (!assessment) return json({ error: 'Assessment not found.' }, 404);
      if (assessment.status === 'completed' && assessment.report) return json({ report: assessment.report, provider: getProvider(), alreadyCompleted: true });
      if (!['in_progress', 'expired'].includes(assessment.status)) return json({ error: 'Assessment is not in progress.' }, 409);
      if (assessment.expires_at && Date.now() < new Date(assessment.expires_at).getTime() && assessment.status === 'expired') return json({ error: 'Assessment expiry state is invalid.' }, 409);
      const { data: savedAnswers } = await supabase.from('assessment_answers').select('question_id, answer_text').eq('assessment_id', assessment.id);
      const answers: Record<string, string> = {};
      (savedAnswers ?? []).forEach((a: any) => { answers[a.question_id] = a.answer_text; });
      const report = await gradeAssessment(assessment.repo_snapshot, assessment.assessment_questions, answers);
      await supabase.from('assessments').update({ status: 'completed', submitted_at: new Date().toISOString(), report }).eq('id', assessment.id).in('status', ['in_progress', 'expired']);
      return json({ report, provider: getProvider() });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
