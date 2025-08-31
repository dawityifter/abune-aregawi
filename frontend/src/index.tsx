import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { I18nProvider } from './i18n/I18nProvider';
import reportWebVitals from './reportWebVitals';

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
