import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, trackPageView } from '../utils/analytics';

/**
 * Loads the tracker once and records a page view on every route change.
 *
 * Lives inside the Router so useLocation works, and renders nothing. Without
 * this the app is a single-page bundle and Umami would only ever see the first
 * URL a visitor landed on.
 */
const AnalyticsTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsTracker;
