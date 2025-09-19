import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import HomePage from './components/HomePage';
import MemberRegistration from './components/auth/MemberRegistration';
import SignIn from './components/auth/SignIn';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import OutreachDashboard from './components/admin/OutreachDashboard';
import TreasurerDashboard from './components/admin/TreasurerDashboard';
import SmsBroadcast from './components/admin/SmsBroadcast';
import Profile from './components/Profile';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import CreditsPage from './components/CreditsPage';
import MemberStatus from './components/MemberStatus';
import DonatePage from './components/DonatePage';
import DuesPage from './components/DuesPage';
import DependentsManagement from './components/DependentsManagement';
import ChurchBylaw from './components/ChurchBylaw';
import ParishPulseSignUp from './components/ParishPulseSignUp';
import PledgePage from './pages/PledgePage';
import ThankYouPage from './pages/ThankYouPage';
import PrivacyPage from './pages/PrivacyPage';
import './index.css';
import DevBanner from './components/DevBanner';
import { isFeatureEnabled } from './config/featureFlags';
import FirstLoginModal from './components/auth/FirstLoginModal';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <AuthProvider>
          <div className="App">
            {isFeatureEnabled('enableDevBanner') && <DevBanner />}
            <Navigation />
            {/* Global first-time sign-in modal (shows once per session) */}
            <FirstLoginModal />
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
              <Route path="/member-status" element={<MemberStatus />} />
              <Route path="/donate" element={<DonatePage />} />
              <Route path="/dues" element={<ProtectedRoute><DuesPage /></ProtectedRoute>} />
              <Route path="/church-bylaw" element={<ChurchBylaw />} />
              <Route path="/dependents" element={<ProtectedRoute><DependentsManagement /></ProtectedRoute>} />
              <Route path="/parish-pulse-sign-up" element={<ParishPulseSignUp />} />
              <Route path="/pledge" element={<PledgePage />} />
              <Route path="/thank-you" element={<ThankYouPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              {/* Add more routes here as we build them */}
            </Routes>
          </div>
        </AuthProvider>
      </Router>
    </LanguageProvider>
  );
}

export default App;

