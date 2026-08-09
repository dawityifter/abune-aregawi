import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, trackPageView, setRoleGroup } from '../utils/analytics';
import { resolveRoleGroup } from '../utils/roleGroup';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../utils/roles';

/**
 * Loads the tracker once and records a page view on every route change.
 *
 * Lives inside the Router so useLocation works, and inside AuthProvider so it
 * can tag events with a role group. Renders nothing. Without this the app is a
 * single-page bundle and Umami would only ever see the first URL a visitor
 * landed on.
 */
const AnalyticsTracker: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    initAnalytics();
  }, []);

  // Runs before the pageview effect below on any change that affects both, so
  // a route change following a sign-in is tagged with the new group.
  useEffect(() => {
    const member = user?.data?.member || user;
    const roles: UserRole[] | null = member
      ? (member.roles || [member.role || 'member'])
      : null;
    setRoleGroup(resolveRoleGroup(roles));
  }, [user]);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search, user]);

  return null;
};

export default AnalyticsTracker;
