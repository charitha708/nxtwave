export interface Assessment {
  id: string;
  session_id: string;
  repo_url: string;
  category: string | null;
  experience_level: string | null;
  duration_minutes: number;
  status: 'pending' | 'analyzing' | 'ready' | 'in_progress' | 'completed' | 'expired';
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  report: AssessmentReport | null;
  repo_snapshot: RepoSnapshot | null;
  created_at: string;
}

export interface RepoSnapshot {
  repo: string;
  description: string | null;
  language: string | null;
  stars: number | null;
  files: Array<{ path: string; kind: string }>;
  readme_excerpt: string | null;
  dependencies: string[] | null;
  architecture_summary: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  position: number;
  category: string;
  prompt: string;
  evidence_refs: string[] | null;
}

export interface AssessmentAnswer {
  id: string;
  question_id: string;
  assessment_id: string;
  answer_text: string;
  saved_at: string;
}

export interface QuestionFeedback {
  question_id: string;
  score: number;
  correct_aspects: string[];
  missing_concepts: string[];
  inaccuracies: string[];
  expected_reasoning: string;
  evidence: string;
  improvement_exercise: string;
}

export interface AssessmentReport {
  overall_score: number;
  category_scores: Record<string, number>;
  question_feedback: QuestionFeedback[];
  learning_roadmap: Array<{ priority: string; topic: string; rationale: string }>;
}

export interface Registration {
  id: string;
  registration_id: string;
  full_name: string;
  email: string;
  marketing_consent: boolean;
  workshop_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ref: string | null;
  landing_page: string | null;
  registration_page: string | null;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  event_id: string;
  session_id: string;
  event_name: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ref: string | null;
  page_path: string | null;
  registration_id: string | null;
  device_category: string | null;
  created_at: string;
}

export interface EmailOutbox {
  id: string;
  registration_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'dev_logged';
  provider_message_id: string | null;
  error: string | null;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
}

export interface IntegrationJob {
  id: string;
  job_type: 'google_sheet' | 'email';
  ref_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attempts: number;
  error: string | null;
  created_at: string;
}
