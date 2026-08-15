import React, { Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { lazyWithRecovery as lazy } from './utils/lazyWithRecovery';

// Eager: everything on the first paint of the two paths almost all traffic
// takes — arriving at the home page, or signing in and landing on the
// dashboard. Splitting these would add a spinner to the common case and save
// nothing, since they are needed immediately.
import HomePage from './components/HomePage';
import SignIn from './components/auth/SignIn';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navigation from './components/Navigation';
import BottomNav from './components/mobile/BottomNav';
import MoreSheet from './components/mobile/MoreSheet';
import UpdateToast from './components/mobile/UpdateToast';
import ErrorBoundary from './components/ErrorBoundary';
import DevBanner from './components/DevBanner';
import FirstLoginModal from './components/auth/FirstLoginModal';
import ChatWidget from './components/ChatWidget';
import AnalyticsTracker from './components/AnalyticsTracker';
import RouteFallback from './components/RouteFallback';
import { isFeatureEnabled } from './config/featureFlags';
import { useServiceWorker } from './hooks/useServiceWorker';
import './index.css';

// Lazy: routes a given member may never open. Before this, every member
// downloaded the treasurer's reconciliation tables, the admin panel, the
// TipTap editor, and Stripe Elements just to read today's fasting status on a
// phone. Each of these is now fetched only when someone actually navigates to
// it — which, for the roles they belong to, is rarely and on a real connection.
//
// The five staff-only routes below carry an explicit webpackChunkName. That name
// is not cosmetic: frontend/src/service-worker.js filters the service worker's
// precache manifest by matching /(admin|treasurer|outreach|sms)/ against each
// chunk's URL. Webpack's default production chunk names are hashed numeric ids
// (e.g. "172.fa105aaf.chunk.js") with no relation to the source path, so an
// unnamed chunk matches nothing and silently re-enters the precache — i.e. gets
// downloaded onto every member's phone on install, which is the exact problem
// this code-splitting exists to avoid. If you add another staff-only lazy
// route, give it a matching chunk name or it will bypass the filter.
const AdminDashboard = lazy(() => import(/* webpackChunkName: "admin" */ './components/admin/AdminDashboard'));
const TreasurerDashboard = lazy(() => import(/* webpackChunkName: "treasurer" */ './components/admin/TreasurerDashboard'));
const OutreachDashboard = lazy(() => import(/* webpackChunkName: "outreach" */ './components/admin/OutreachDashboard'));
const SmsBroadcast = lazy(() => import(/* webpackChunkName: "sms" */ './components/admin/SmsBroadcast'));
const VoicemailInbox = lazy(() => import(/* webpackChunkName: "admin-voicemails" */ './components/admin/VoicemailInbox'));
const SurveyReportPage = lazy(() => import(/* webpackChunkName: "admin-survey-report" */ './components/admin/SurveyReportPage'));
// Lives under components/admin/ but its route (/departments/:id/meetings/:id) is a
// department-member feature, not staff-only — deliberately left unnamed so it stays
// in the precache and works offline.
const MeetingDetailsPage = lazy(() => import('./components/admin/MeetingDetailsPage'));

const MemberRegistration = lazy(() => import('./components/auth/MemberRegistration'));
const Profile = lazy(() => import('./components/Profile'));
const DuesPage = lazy(() => import('./components/DuesPage'));
const DependentsManagement = lazy(() => import('./components/DependentsManagement'));

// Stripe Elements and the payment flows live behind these two.
const DonatePage = lazy(() => import('./components/DonatePage'));
const PledgePage = lazy(() => import('./pages/PledgePage'));

const DepartmentsPage = lazy(() => import('./components/DepartmentsPage'));
const DepartmentDashboard = lazy(() => import('./components/DepartmentDashboard'));
const BoardMembers = lazy(() => import('./components/board/BoardMembers'));
const GalleryPage = lazy(() => import('./components/GalleryPage'));
const ChurchBylaw = lazy(() => import('./components/ChurchBylaw'));
const CreditsPage = lazy(() => import('./components/CreditsPage'));
const ParishPulseSignUp = lazy(() => import('./components/ParishPulseSignUp'));
const SurveyPage = lazy(() => import('./components/survey/SurveyPage'));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));

function App() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { updateAvailable, applyUpdate, canInstall, isIos, promptInstall, dismissInstall } = useServiceWorker();

  return (
    <LanguageProvider>
      <Router>
        <AuthProvider>
          <div className="App pb-bottom-nav md:pb-0">
            {isFeatureEnabled('enableDevBanner') && <DevBanner />}
            {/* Inside Router so it can see route changes; renders nothing. */}
            <AnalyticsTracker />
            <Navigation />
            <BottomNav onMoreClick={() => setMoreOpen(true)} />
            <MoreSheet
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              canInstall={canInstall}
              isIos={isIos}
              onInstall={promptInstall}
              onDismissInstall={dismissInstall}
            />
            {/* Both are z-50, and the toast renders after the sheet here, so
                with the sheet open it would paint over the sheet panel —
                including the sign-out button — and put an actionable Refresh
                button outside the sheet's aria-modal="true" container,
                unreachable by a screen-reader user inside it. Suppressed
                while the sheet is open; updateAvailable itself is untouched,
                so the toast reappears as soon as the sheet closes. */}
            <UpdateToast show={updateAvailable && !moreOpen} onRefresh={applyUpdate} />
            <ChatWidget />
            {/* Global first-time sign-in modal (shows once per session) */}
            <FirstLoginModal />
            {/* One boundary around all routes: a member only ever waits for the
                single chunk they navigated to. Also the backstop for
                lazyWithRecovery's one-shot chunk-load recovery — when that
                gives up (or can't run at all, e.g. offline), the rejection
                propagates up through Suspense and must land on an
                ErrorBoundary or React unmounts the whole tree, including the
                sibling <nav> below, leaving a blank #root. Per-route
                boundaries further down (register, board-members) catch
                first for those two chunks specifically; this one is what
                catches for the other ~20. */}
            <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<SignIn />} />
                <Route path="/register" element={<ErrorBoundary><MemberRegistration /></ErrorBoundary>} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowTempUser={true}>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/treasurer"
                  element={
                    <ProtectedRoute>
                      <TreasurerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/outreach"
                  element={
                    <ProtectedRoute>
                      <OutreachDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sms"
                  element={
                    <ProtectedRoute>
                      <SmsBroadcast />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route path="/credits" element={<CreditsPage />} />
                <Route path="/donate" element={<DonatePage />} />
                <Route path="/dues" element={<ProtectedRoute><DuesPage /></ProtectedRoute>} />
                <Route path="/church-bylaw" element={<ChurchBylaw />} />
                <Route path="/dependents" element={<ProtectedRoute><DependentsManagement /></ProtectedRoute>} />
                <Route path="/parish-pulse-sign-up" element={<ParishPulseSignUp />} />
                <Route path="/survey" element={<SurveyPage />} />
                <Route path="/pledge" element={<PledgePage />} />
                <Route path="/thank-you" element={<ThankYouPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/departments" element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} />
                <Route path="/departments/:id" element={<ProtectedRoute><DepartmentDashboard /></ProtectedRoute>} />
                <Route path="/departments/:departmentId/meetings/:meetingId" element={<ProtectedRoute><MeetingDetailsPage /></ProtectedRoute>} />
                <Route path="/admin/voicemails" element={<ProtectedRoute><VoicemailInbox /></ProtectedRoute>} />
                <Route path="/admin/survey-report" element={<ProtectedRoute><SurveyReportPage /></ProtectedRoute>} />
                <Route path="/board-members" element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <BoardMembers />
                    </ErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/gallery" element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />
                <Route path="/gallery/:folderId" element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />
                {/* Add more routes here as we build them */}
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </div>
        </AuthProvider>
      </Router>
    </LanguageProvider>
  );
}

export default App;
