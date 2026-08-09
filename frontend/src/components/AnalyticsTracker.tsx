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

  // Deliberately no `user` dependency here, even though the pageview should
  // be tagged with the right role_group. That tagging already happens: the
  // setRoleGroup effect above is DECLARED FIRST, so on any render where both
  // effects' deps changed (e.g. a route change that follows a sign-in),
  // React runs setRoleGroup before this one and trackPageView reads the
  // already-updated module-level roleGroup. Adding `user` here buys nothing
  // and actively hurts: on a cold load by a signed-in member, this effect
  // fires once on mount (user === null, tagged 'visitor') and again the
  // moment the profile fetch resolves (user set, tagged 'member'/'staff') —
  // the same URL counted twice, with the second count polluting the
  // 'visitor' bucket with authenticated traffic. Do not add `user` back.
  useEffect(() => {
    trackPageView(location.pathname + location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsTracker;
