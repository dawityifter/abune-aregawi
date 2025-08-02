import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import HomePage from './components/HomePage';
import MemberRegistration from './components/auth/MemberRegistration';
import SignIn from './components/auth/SignIn';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import TreasurerDashboard from './components/admin/TreasurerDashboard';
import Profile from './components/Profile';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navigation from './components/Navigation';
import CreditsPage from './components/CreditsPage';
import MemberStatus from './components/MemberStatus';
import DonatePage from './components/DonatePage';
import DependantsManagement from './components/DependantsManagement';
import ChurchBylaw from './components/ChurchBylaw';
import ParishPulseSignUp from './components/ParishPulseSignUp';
import './index.css';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <AuthProvider>
          <div className="App">
            <Navigation />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<SignIn />} />
              <Route path="/register" element={<MemberRegistration />} />
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
              <Route path="/church-bylaw" element={<ChurchBylaw />} />
              <Route path="/children" element={<ProtectedRoute><DependantsManagement /></ProtectedRoute>} />
              <Route path="/parish-pulse-sign-up" element={<ParishPulseSignUp />} />
              {/* Add more routes here as we build them */}
            </Routes>
          </div>
        </AuthProvider>
      </Router>
    </LanguageProvider>
  );
}

export default App;
