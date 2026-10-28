import { useState, useEffect } from 'react';
import { PageTracker } from '@/components/PageTracker';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { BarChart3, Users, Mail, Database, RefreshCw, Loader2, LogOut, Lock, AlertCircle, Download, Filter } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Metrics {
  totalVisits: number;
  assessmentStarts: number;
  assessmentCompletions: number;
  blogViews: number;
  registrationPageViews: number;
  completedRegistrations: number;
  conversionRate: number;
  registrationsBySource: Record<string, number>;
  emailStats: Record<string, number>;
  jobStats: Record<string, number>;
}

export function Admin() {
  const [session, setSession] = useState<any>(null);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [failedJobs, setFailedJobs] = useState<any[]>([]);
  const [failedEmails, setFailedEmails] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [communityFilter, setCommunityFilter] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setSession(data.session); setAuthed(true); }
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); setAuthed(!!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    setAuthError(null); setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); setAuthed(false); setMetrics(null); setRegistrations([]); };

  const adminFetch = async (path: string, opts: RequestInit = {}) => {
    const token = session?.access_token;
    return fetch(`${SUPABASE_URL}/functions/v1/admin-api${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON_KEY, ...opts.headers },
    });
  };

  useEffect(() => {
    if (!authed) return;
    (async () => {
      setLoadingData(true); setDataError(null);
      try {
        const [m, r, j, em] = await Promise.all([
          adminFetch('/metrics'),
          adminFetch('/registrations?' + new URLSearchParams({ ...(sourceFilter ? { source: sourceFilter } : {}), ...(campaignFilter ? { campaign: campaignFilter } : {}), ...(communityFilter ? { content: communityFilter } : {}) }).toString()),
          adminFetch('/jobs?status=failed'),
          adminFetch('/emails?status=failed'),
        ]);
        if (m.ok) setMetrics(await m.json());
        if (r.ok) setRegistrations((await r.json()).registrations ?? []);
        if (j.ok) setFailedJobs((await j.json()).jobs ?? []);
        if (em.ok) setFailedEmails((await em.json()).emails ?? []);
        if (!m.ok || !r.ok || !j.ok || !em.ok) setDataError('Failed to load some dashboard data.');
      } catch (e) { setDataError('Network error loading data.'); }
      setLoadingData(false);
    })();
  }, [authed, sourceFilter, campaignFilter, communityFilter, session]);

  const retryEmail = async (id: string) => {
    setRetrying('email:' + id);
    try {
      const response = await adminFetch('/retry-email', { method: 'POST', body: JSON.stringify({ emailId: id }) });
      if (!response.ok) setDataError((await response.json().catch(() => null))?.error ?? 'Email retry failed.');
      else setDataError(null);
      const [emailsResponse, jobsResponse] = await Promise.all([adminFetch('/emails?status=failed'), adminFetch('/jobs?status=failed')]);
      if (emailsResponse.ok) setFailedEmails((await emailsResponse.json()).emails ?? []);
      if (jobsResponse.ok) setFailedJobs((await jobsResponse.json()).jobs ?? []);
    } catch { setDataError('Network error while retrying email.'); }
    setRetrying(null);
  };

  const retrySheet = async (id: string) => {
    setRetrying('sheet:' + id);
    try {
      const response = await adminFetch('/retry-sheet', { method: 'POST', body: JSON.stringify({ jobId: id }) });
      if (!response.ok) setDataError((await response.json().catch(() => null))?.error ?? 'Spreadsheet retry failed.');
      else setDataError(null);
      const jobsResponse = await adminFetch('/jobs?status=failed');
      if (jobsResponse.ok) setFailedJobs((await jobsResponse.json()).jobs ?? []);
    } catch { setDataError('Network error while retrying spreadsheet sync.'); }
    setRetrying(null);
  };

  const exportCsv = () => {
    if (!registrations.length) return;
    const headers = ['registration_id', 'full_name', 'email', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'created_at'];
    const rows = registrations.map((r) => headers.map((h) => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'nextwave-registrations.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!authChecked) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>;

  if (!authed) {
    return (
      <>
        <PageTracker eventName="admin_login_viewed" pagePath="/admin" />
        <div className="mx-auto max-w-sm px-4 py-20">
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 rounded-xl bg-pale items-center justify-center text-primary mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-navy">Admin dashboard</h1>
            <p className="text-muted text-sm mt-2">Sign in with your Next Wave admin account.</p>
          </div>
          <div className="card p-6 space-y-4">
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && signIn()} /></div>
            {authError && <div className="flex items-center gap-2 text-sm text-err"><AlertCircle className="h-4 w-4" /> {authError}</div>}
            <button onClick={signIn} disabled={authLoading} className="btn-primary w-full">
              {authLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </button>
            <p className="text-xs text-muted text-center">Your email must be in the admin allowlist. Ask a Next Wave organizer to add you.</p>
          </div>
        </div>
      </>
    );
  }

  if (loadingData && !metrics) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>;

  return (
    <>
      <PageTracker eventName="admin_dashboard_viewed" pagePath="/admin" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="badge bg-pale text-primary ml-2">Admin</span>
          </div>
          <button onClick={signOut} className="btn-ghost text-sm"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>

        {dataError && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6"><AlertCircle className="h-4 w-4" /> {dataError}</div>}

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { icon: BarChart3, label: 'Tracked events', value: metrics?.totalVisits ?? 0 },
            { icon: BarChart3, label: 'Assessment starts', value: metrics?.assessmentStarts ?? 0 },
            { icon: BarChart3, label: 'Completions', value: metrics?.assessmentCompletions ?? 0 },
            { icon: Users, label: 'Blog views', value: metrics?.blogViews ?? 0 },
            { icon: Users, label: 'Reg page views', value: metrics?.registrationPageViews ?? 0 },
            { icon: Users, label: 'Registrations', value: metrics?.completedRegistrations ?? 0 },
          ].map((c, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 text-muted mb-1.5"><c.icon className="h-4 w-4" /><span className="text-xs">{c.label}</span></div>
              <div className="text-2xl font-bold text-navy">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Conversion + sources */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-3">Conversion rate</h3>
            <div className="text-4xl font-bold text-primary">{metrics?.conversionRate ?? 0}%</div>
            <p className="text-xs text-muted mt-1">Completions ÷ assessment starts</p>
          </div>
          <div className="card p-6 lg:col-span-2">
            <h3 className="font-semibold text-ink mb-3">Registrations by source</h3>
            {Object.keys(metrics?.registrationsBySource ?? {}).length === 0 ? (
              <p className="text-sm text-muted">No registrations yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(metrics?.registrationsBySource ?? {}).sort((a, b) => b[1] - a[1]).map(([src, count]) => {
                  const max = Math.max(...Object.values(metrics?.registrationsBySource ?? {}));
                  return (
                    <div key={src}>
                      <div className="flex justify-between text-sm mb-1"><span className="text-ink">{src}</span><span className="font-semibold text-muted">{count}</span></div>
                      <div className="h-2 rounded-full bg-pale overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(count / max) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Email + job stats */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3"><Mail className="h-4 w-4 text-primary" /><h3 className="font-semibold text-ink">Email delivery</h3></div>
            {Object.keys(metrics?.emailStats ?? {}).length === 0 ? <p className="text-sm text-muted">No emails sent yet.</p> : (
              <div className="space-y-2">
                {Object.entries(metrics?.emailStats ?? {}).map(([s, c]) => (
                  <div key={s} className="flex justify-between text-sm"><span className="text-muted">{s}</span><span className="font-semibold text-ink">{c}</span></div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3"><Database className="h-4 w-4 text-primary" /><h3 className="font-semibold text-ink">Integration jobs</h3></div>
            {Object.keys(metrics?.jobStats ?? {}).length === 0 ? <p className="text-sm text-muted">No jobs yet.</p> : (
              <div className="space-y-2">
                {Object.entries(metrics?.jobStats ?? {}).map(([s, c]) => (
                  <div key={s} className="flex justify-between text-sm"><span className="text-muted">{s}</span><span className="font-semibold text-ink">{c}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Failed integrations */}
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-2 mb-3"><AlertCircle className="h-4 w-4 text-primary" /><h3 className="font-semibold text-ink">Failed integration jobs</h3></div>
          {failedJobs.length === 0 && failedEmails.length === 0 ? <p className="text-sm text-muted">No failed integration jobs.</p> : (
            <div className="space-y-3">
              {failedEmails.map((mail) => (
                <div key={mail.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">Email · {mail.to_email}</div>
                    <div className="text-xs text-err break-words">{mail.error ?? 'Email delivery failed.'}</div>
                    <div className="text-xs text-muted">Attempts: {mail.attempts}</div>
                  </div>
                  <button onClick={() => retryEmail(mail.id)} disabled={retrying === 'email:' + mail.id} className="btn-secondary text-sm shrink-0">
                    {retrying === 'email:' + mail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Retry email
                  </button>
                </div>
              ))}
              {failedJobs.map((job) => (
                <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{job.job_type.replace('_', ' ')} · {job.ref_id ?? job.id}</div>
                    <div className="text-xs text-err break-words">{job.error ?? 'No error details recorded.'}</div>
                    <div className="text-xs text-muted">Attempts: {job.attempts}</div>
                  </div>
                  {job.job_type === 'google_sheet' || job.job_type === 'analytics_event' ? (
                    <button onClick={() => retrySheet(job.id)} disabled={retrying === 'sheet:' + job.id} className="btn-secondary text-sm shrink-0">
                      {retrying === 'sheet:' + job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Retry Sheets
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registrations table */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-ink">Recent registrations</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Filter className="h-4 w-4 text-muted" />
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
                  <option value="">All sources</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="telegram">Telegram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="direct">Direct</option>
                </select>
              </div>
              <input aria-label="Filter by campaign" placeholder="Campaign" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm w-28" />
              <input aria-label="Filter by community or post" placeholder="Community / post" value={communityFilter} onChange={(e) => setCommunityFilter(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm w-32" />
              <button onClick={exportCsv} className="btn-secondary text-sm py-1.5"><Download className="h-3.5 w-3.5" /> Export</button>
            </div>
          </div>
          {registrations.length === 0 ? <p className="text-sm text-muted">No registrations match the filter.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted border-b border-line">
                  <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Source</th><th className="py-2 pr-4">Campaign</th><th className="py-2 pr-4">Date</th>
                </tr></thead>
                <tbody>
                  {registrations.map((r) => (
                    <tr key={r.id} className="border-b border-line/60 hover:bg-surface">
                      <td className="py-2 pr-4 font-medium text-ink">{r.full_name}</td>
                      <td className="py-2 pr-4 text-muted">{r.email}</td>
                      <td className="py-2 pr-4"><span className="badge bg-pale text-primary">{r.utm_source ?? 'direct'}</span></td>
                      <td className="py-2 pr-4 text-muted">{r.utm_campaign ?? '—'}</td>
                      <td className="py-2 pr-4 text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
