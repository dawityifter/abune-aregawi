import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { I18nProvider } from './i18n/I18nProvider';
import reportWebVitals from './reportWebVitals';
import { initErrorTracking } from './lib/errorTracking';

// No-ops without REACT_APP_SENTRY_DSN, outside production, or under Do Not
// Track — see lib/errorTracking.ts. Safe to call unconditionally here.
initErrorTracking();

// No app-level 'unhandledrejection' listener here: @sentry/browser's
// globalHandlersIntegration is on by default and already captures
// unhandled promise rejections (and uncaught errors) without one. An
// earlier version of this file added its own listener that called
// reportError with `new Error(String(reason))` — which double-reported
// every rejection (once via globalHandlersIntegration, once via the app
// listener) and the synthesized wrapper defeated Sentry's dedupe on top of
// that. Removed rather than fixed in place. Left alone: the
// reCAPTCHA/Firebase timeout-suppression listener below, which is
// unrelated (it only quiets a known-benign console message) and does not
// stop globalHandlersIntegration's own listener from also seeing the event.

// Suppress noisy reCAPTCHA timeouts that can occur after navigation
// when Firebase's reCAPTCHA script rejects internally. We ignore only
// Timeout errors originating from recaptcha scripts, leaving other
// errors visible for debugging.
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason: any = event?.reason;
    const message = reason?.message || '';
    const stack = String(reason?.stack || '');

    // Identify benign timeouts coming from 3rd-party auth widgets that sometimes
    // fire after navigation (Firebase/recaptcha scripts). We suppress only those,
    // leaving application errors visible.
    const isTimeout = /timeout/i.test(message) || /Timeout/i.test(message) || message === 'Timeout';
    const fromRecaptcha = stack.includes('recaptcha') || stack.includes('recaptcha__') || /www\.google\.com\/recaptcha|gstatic\/recaptcha/i.test(stack);
    const fromFirebase = /firebase|gstatic|app-check|identitytoolkit/i.test(stack);

    if (isTimeout && (fromRecaptcha || fromFirebase)) {
      console.info('[unhandledrejection] Suppressed benign Timeout from 3rd-party auth script');
      event.preventDefault();
      return;
    }
  } catch {
    // no-op
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
