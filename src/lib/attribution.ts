export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ref: string | null;
}

const STORAGE_KEY = 'nw_attribution';
const SESSION_KEY = 'nw_session_id';

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const incoming: Attribution = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    ref: params.get('ref'),
  };

  const hasIncoming = Object.values(incoming).some((v) => v !== null && v.trim() !== '');
  const stored = readStored();
  const hasStored = Object.values(stored).some((v) => v !== null && v.trim() !== '');

  // Keep first-touch attribution stable. Later links should not overwrite the
  // original campaign that brought this browser to the site.
  if (hasIncoming && !hasStored) {
    const firstTouch = {
      utm_source: incoming.utm_source,
      utm_medium: incoming.utm_medium,
      utm_campaign: incoming.utm_campaign,
      utm_content: incoming.utm_content,
      utm_term: incoming.utm_term,
      ref: incoming.ref,
    };
    writeStored(firstTouch);
    return firstTouch;
  }
  return stored;
}

function readStored(): Attribution {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    return { ...empty(), ...(JSON.parse(raw) as Attribution) };
  } catch {
    return empty();
  }
}

function writeStored(a: Attribution) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    // ignore
  }
}

function empty(): Attribution {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    ref: null,
  };
}

export function deviceCategory(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/tablet/i.test(ua)) return 'tablet';
  if (/mobi/i.test(ua)) return 'mobile';
  return 'desktop';
}
