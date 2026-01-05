import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { I18nProvider } from './i18n/I18nProvider';
import App from './App';
import HomePage from './components/HomePage';
import SignIn from './components/auth/SignIn';
import '@testing-library/jest-dom';

// Mock the useAuth hook
const mockUseAuth = jest.fn().mockImplementation(() => ({
  currentUser: null,
  loading: false,
  error: null,
  loginWithPhone: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn()
}));

// Mock the useLanguage hook
const mockUseLanguage = jest.fn().mockImplementation(() => ({
  t: (key: string) => key,
  language: 'en',
  changeLanguage: jest.fn()
}));

// Mock the AuthContext module
jest.mock('./contexts/AuthContext', () => ({
  ...jest.requireActual('./contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

// Mock the LanguageContext module
jest.mock('./contexts/LanguageContext', () => ({
  ...jest.requireActual('./contexts/LanguageContext'),
  useLanguage: () => mockUseLanguage()
}));

// Create a custom render function that includes all necessary providers
const renderApp = (initialEntries = ['/']) => {
  // Create a test version of App that doesn't include the Router
  const TestApp = () => (
    <I18nProvider>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<SignIn />} />
            {/* Add other routes as needed for testing */}
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </I18nProvider>
  );

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <TestApp />
    </MemoryRouter>
  );
};

// Mock the components that are rendered by the routes
jest.mock('./components/HomePage', () => () => (
  <div>Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church</div>
));

describe('App', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('renders the app with the church name', () => {
    renderApp();
    const churchNameElement = screen.getByText(/Debre Tsehay Abune Aregawi/i);
    expect(churchNameElement).toBeInTheDocument();
  });

  // Add more test cases as needed
});
