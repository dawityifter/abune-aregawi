import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import HomePage from './components/HomePage';
import MemberRegistration from './components/auth/MemberRegistration';
import Login from './components/auth/Login';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navigation from './components/Navigation';
import CreditsPage from './components/CreditsPage';
import MemberStatus from './components/MemberStatus';
import DonatePage from './components/DonatePage';
import './index.css';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Navigation />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<MemberRegistration />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
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
              {/* Add more routes here as we build them */}
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
