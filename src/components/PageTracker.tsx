import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics';

export function PageTracker({ eventName, pagePath }: { eventName: string; pagePath: string }) {
  const location = useLocation();
  useEffect(() => {
    trackEvent(eventName, { pagePath });
  }, [eventName, pagePath, location.pathname]);
  return null;
}
