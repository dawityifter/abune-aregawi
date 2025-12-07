import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../firebase";
import ErrorBoundary from "../ErrorBoundary";
import { formatPhoneNumber, isValidPhoneNumber, normalizePhoneNumber } from "../../utils/formatPhoneNumber";
import { useLanguage } from "../../contexts/LanguageContext";

declare global {
  interface Window {
    recaptchaVerifier?: any;
  }
}

const SignIn: React.FC = () => {
  const { loginWithPhone, loading, currentUser, authReady } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Phone-only policy
  const [phone, setPhone] = useState(''); // Start with empty phone number
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Validate confirmationResult when it changes
  useEffect(() => {
    if (confirmationResult) {
      try {
        if (!confirmationResult.confirm || typeof confirmationResult.confirm !== 'function') {
          setError('Verification session error. Please try again.');
          setConfirmationResult(null);
        }
      } catch (err) {
        setError('Verification session error. Please try again.');
        setConfirmationResult(null);
      }
    }
  }, [confirmationResult]);
  const [error, setError] = useState("");
  const [recaptchaSolved, setRecaptchaSolved] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  // Initialize reCAPTCHA when component mounts (phone-only)
  const initializeRecaptcha = async () => {
    if (!window.recaptchaVerifier && !confirmationResult) {
      try {
        // Check if container exists in DOM
        const existingContainer = document.getElementById('recaptcha-container');

        if (!existingContainer) {
          setError('reCAPTCHA container missing. Please refresh the page.');
          return;
        }

        // Clear any existing recaptcha verifier
        if (window.recaptchaVerifier) {
          try {
            if (typeof window.recaptchaVerifier.clear === 'function') {
              window.recaptchaVerifier.clear();
            }
          } catch (e) {
            // Ignore cleanup errors
          }
          window.recaptchaVerifier = undefined;
        }

        // Create RecaptchaVerifier with the existing container
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          existingContainer,
          {
            size: "normal",
            callback: () => setRecaptchaSolved(true),
            'expired-callback': () => setRecaptchaSolved(false),
            'error-callback': () => setRecaptchaSolved(false)
          }
        );

        // Try to render the reCAPTCHA
        await window.recaptchaVerifier.render();

      } catch (err) {
        console.error('reCAPTCHA initialization error:', err);
        setError('reCAPTCHA initialization failed. Please refresh and try again.');
        setRecaptchaSolved(false);
      }
    }
  };

  // Initialize reCAPTCHA only when we need to show it (after 10 digits entered)
  const initializeRecaptchaIfNeeded = async () => {
    if (isValidPhoneNumber(phone) && !window.recaptchaVerifier && !confirmationResult) {
      await initializeRecaptcha();
    }
  };

  // Initialize reCAPTCHA when phone becomes valid (10 digits)
  useEffect(() => {
    if (isValidPhoneNumber(phone) && !recaptchaSolved) {
      initializeRecaptchaIfNeeded();
    }
  }, [phone, recaptchaSolved]);

  // Magic Phone Auto-Solve
  useEffect(() => {
    const clean = normalizePhoneNumber(phone);
    if ((clean === '+14699078229' || clean === '+14699078230') && !recaptchaSolved) {
      console.log('✨ Magic Phone detected - Auto-solving reCAPTCHA');
      setRecaptchaSolved(true);
    }
  }, [phone]);

  // No method switching in phone-only policy

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          if (window.recaptchaVerifier && typeof window.recaptchaVerifier.clear === 'function') {
            window.recaptchaVerifier.clear();
          }
        } catch (err) {
          console.log('reCAPTCHA cleanup error on unmount (non-critical):', err);
        } finally {
          window.recaptchaVerifier = undefined;
        }
      }
    };
  }, []);

  // Fallback redirect: if user is authenticated, leave /login
  useEffect(() => {
    if (!authReady) return;
    if (!currentUser) return;
    // AuthContext handles all navigation now - SignIn component should not navigate
    // This prevents race conditions between AuthContext and SignIn navigation
    if (window.location.pathname === '/login') {
      console.log('🔄 User authenticated on /login, letting AuthContext handle navigation');
    }
  }, [authReady, currentUser]);

  // Get clean phone number for Firebase (E.164 format)
  const getCleanPhoneNumber = (displayValue: string): string => {
    return normalizePhoneNumber(displayValue);
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPhone = getCleanPhoneNumber(phone);

    // Validation
    if (!cleanPhone) {
      setError("Please enter a valid phone number.");
      return;
    }

    // Debug logging
    console.log('🔍 Phone authentication debug:');
    console.log('📞 Clean phone:', cleanPhone);

    // Magic Phone Bypass
    if (cleanPhone === '+14699078229' || cleanPhone === '+14699078230') {
      console.log('✨ Magic Phone detected - Bypassing reCAPTCHA');

      // Determine if this is the "New User" test case
      const isNewUserMode = cleanPhone === '+14699078230';

      setConfirmationResult({
        confirm: async (code: string) => {
          if (code === '123456') { // Mock OTP
            if (isNewUserMode) {
              localStorage.setItem('magic_new_user_mode', 'true');
              localStorage.removeItem('magic_demo_mode');
            } else {
              localStorage.setItem('magic_demo_mode', 'true');
              localStorage.removeItem('magic_new_user_mode');
            }
            return { user: { getIdToken: async () => 'MAGIC_DEMO_TOKEN' } };
          }
          throw new Error('Invalid verification code');
        }
      });
      return;
    }

    if (!recaptchaSolved) {
      setError("Please complete the reCAPTCHA verification first.");
      return;
    }

    if (!window.recaptchaVerifier) {
      setError("reCAPTCHA not initialized. Please refresh the page.");
      return;
    }

    try {
      const result = await loginWithPhone(cleanPhone, window.recaptchaVerifier);

      if (result) {
        // Validate the result before setting it
        if (result && typeof result.confirm === 'function') {
          setConfirmationResult(result);
        } else {
          setError('Invalid verification session. Please try again.');
          return;
        }
      }
    } catch (err: any) {

      // Handle specific error types
      if (err.message && err.message.includes('verifier._reset is not a function')) {
        setError("reCAPTCHA verification error. Please refresh the page and try again.");
      } else if (err.message && (err.message.includes('timeout') || err.message.includes('Timeout'))) {
        setError("Request timed out. Please try again.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many requests. Please wait a moment and try again.");
      } else {
        setError("Phone login failed: " + err.message);
      }

      // Delay reCAPTCHA cleanup to avoid race conditions with Firebase
      setTimeout(() => {
        if (window.recaptchaVerifier && typeof window.recaptchaVerifier.clear === 'function') {
          try {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = undefined;
            setRecaptchaSolved(false);
          } catch (clearErr) {
            // Force cleanup even if clear() fails
            window.recaptchaVerifier = undefined;
          }
        }
      }, 1000); // Wait 1 second before cleanup
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim()) {
      setError("Please enter the OTP sent to your phone.");
      return;
    }

    if (!confirmationResult) {
      setError("Verification session expired. Please request a new OTP.");
      return;
    }

    setOtpVerifying(true);
    setError("");

    try {
      console.log('🔍 Starting OTP verification...');

      // Verify OTP via the confirmation result
      // This works for both Firebase (real) and our Magic Mock (custom confirm)
      await confirmationResult.confirm(otp);

      console.log('✅ OTP Verified Successfully');

      // Check if this was a magic login
      if (localStorage.getItem('magic_demo_mode') === 'true' || localStorage.getItem('magic_new_user_mode') === 'true') {
        console.log('✨ Magic Demo Mode verified - Reloading to initialize context');
        window.location.reload();
        return;
      }

      // For regular Firebase auth, onAuthStateChanged in AuthContext will trigger
      // and update the user state. We just wait or let the listener handle navigation.
      // However, to be safe and ensure smooth UI:
      setRedirecting(true);

      // AuthContext listener will handle the actual navigation

    } catch (err: any) {
      setOtpVerifying(false);

      // Log the full error for debugging
      console.error('OTP verification error:', {
        code: err.code,
        message: err.message,
        name: err.name,
        stack: err.stack
      });

      // Handle specific Firebase Auth error codes with user-friendly messages
      if (err.code === 'auth/invalid-verification-code') {
        setError("The verification code is incorrect. Please check and try again.");
      } else if (err.code === 'auth/code-expired') {
        setError("The verification code has expired. Please request a new OTP.");
        resetVerification();
      } else if (err.code === 'auth/session-expired') {
        setError("Your verification session has expired. Please request a new OTP.");
        resetVerification();
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many failed attempts. Please wait a few minutes and try again.");
      } else if (err.message && (err.message.includes('timeout') || err.message.includes('Timeout'))) {
        setError("The request timed out. Please check your connection and try again.");
      } else if (err.message && err.message.includes('network-request-failed')) {
        setError("Network error. Please check your internet connection and try again.");
      } else {
        setError(`Verification failed: ${err.message || 'An unknown error occurred. Please try again.'}`);
      }
    }
  };

  // Reset verification state to allow retry
  const resetVerification = () => {
    console.log('🔄 Resetting verification state...');

    // Reset all states
    setConfirmationResult(null);
    setOtp("");
    setError("");
    setRecaptchaSolved(false);
    setOtpVerifying(false);

    // Clear existing reCAPTCHA verifier
    if (window.recaptchaVerifier) {
      console.log('🧹 Cleaning up reCAPTCHA verifier...');
      try {
        // Check if the verifier is still valid before trying to clear it
        if (window.recaptchaVerifier && typeof window.recaptchaVerifier.clear === 'function') {
          window.recaptchaVerifier.clear();
        }
        if (window.recaptchaVerifier && typeof window.recaptchaVerifier._reset === 'function') {
          window.recaptchaVerifier._reset();
        }
      } catch (err) {
        console.error('Error cleaning up reCAPTCHA:', err);
      } finally {
        window.recaptchaVerifier = undefined;
      }
    }

    // Clear reCAPTCHA container
    const container = document.getElementById('recaptcha-container');
    if (container) {
      console.log('🧹 Cleaning up reCAPTCHA container...');
      container.innerHTML = '';

      // Create a new container to ensure clean state
      const newContainer = document.createElement('div');
      newContainer.id = 'recaptcha-container';
      container.parentNode?.replaceChild(newContainer, container);
    }

    // Re-initialize reCAPTCHA after a short delay
    console.log('🔄 Re-initializing reCAPTCHA...');
    setTimeout(() => {
      initializeRecaptcha();
    }, 1000);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white/5 rounded-full blur-lg"></div>
        </div>

        {/* reCAPTCHA container will be dynamically created to avoid Enterprise/v2 conflicts */}
        <div data-recaptcha-parent className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-md">
          {/* Church Icon Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-700 rounded-full mb-4">
              <i className="fas fa-cross text-2xl text-white"></i>
            </div>
            <h2 className="text-3xl font-serif font-bold text-primary-700 mb-2">{t('auth.welcomeBack')}</h2>
            <p className="text-accent-600 text-sm">{t('auth.loginSubtitle')}</p>
          </div>
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6 text-center">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          )}
          {!confirmationResult && (
            <form onSubmit={handlePhoneSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-accent-700 mb-2">
                  <i className="fas fa-phone mr-2 text-primary-700"></i>
                  Phone Number
                </label>
                <input
                  value={phone}
                  onChange={e => {
                    const rawValue = e.target.value;
                    const formatted = formatPhoneNumber(rawValue);
                    setPhone(formatted);
                  }}
                  placeholder="(555) 123-4567"
                  type="tel"
                  required
                  className="w-full px-4 py-3 border border-accent-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white/50 backdrop-blur-sm"
                />
                <div className="text-xs text-accent-600 mt-2 flex items-center">
                  <i className="fas fa-info-circle mr-1"></i>
                  Enter 10 digits (e.g., 5551234567) - will auto-format
                </div>
              </div>

              {/* reCAPTCHA container - always in DOM but visibility controlled */}
              <div
                id="recaptcha-container"
                style={{
                  margin: "12px 0",
                  minHeight: isValidPhoneNumber(phone) && !recaptchaSolved ? "78px" : "0px",
                  display: isValidPhoneNumber(phone) && !recaptchaSolved ? "flex" : "none",
                  justifyContent: "center"
                }}
              ></div>

              {/* Show reCAPTCHA instruction only when needed */}
              {isValidPhoneNumber(phone) && !recaptchaSolved && (
                <div style={{ fontSize: 12, color: "#dc2626", textAlign: "center", marginBottom: 8 }}>
                  Please solve the reCAPTCHA above to continue
                </div>
              )}

              {/* Show error with retry option */}
              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: "#dc2626", marginBottom: 8 }}>{error}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setRecaptchaSolved(false);
                      setConfirmationResult(null);
                      // Clear existing verifier and re-initialize
                      if (window.recaptchaVerifier) {
                        try {
                          window.recaptchaVerifier.clear();
                        } catch (e) {
                          // Ignore cleanup errors
                        }
                        window.recaptchaVerifier = undefined;
                      }
                      // Re-initialize reCAPTCHA after clearing error
                      setTimeout(() => {
                        if (isValidPhoneNumber(phone)) {
                          initializeRecaptchaIfNeeded();
                        }
                      }, 100);
                    }}
                    style={{
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "6px 12px",
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    Try Again
                  </button>
                </div>
              )}
              {/* SMS consent disclaimer */}
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 text-gray-700 p-3">
                <div className="flex items-start gap-2">
                  <i className="fas fa-sms mt-0.5 text-primary-700"></i>
                  <div className="text-[11px] sm:text-xs leading-relaxed">
                    <span className="font-semibold text-gray-800">SMS Consent:</span> By entering your phone number you consent to receive SMS notifications from Abune Aregawi Church about event reminders.
                    <div className="mt-1 text-gray-600">
                      Frequency may vary; SMS and data rates may apply. Consent is not a condition of purchase. Reply <span className="font-semibold">HELP</span> for help and <span className="font-semibold">STOP</span> to unsubscribe.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 md:mt-6 sticky md:static bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur supports-backdrop-blur:bg-white/80 py-2">
                <button
                  type="submit"
                  disabled={loading || !isValidPhoneNumber(phone) || !recaptchaSolved}
                  className={`w-full py-4 px-5 rounded-xl font-semibold sm:font-bold text-base sm:text-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 ${loading || !isValidPhoneNumber(phone) || !recaptchaSolved
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed ring-2 ring-primary-300/60 shadow"
                    : "text-white bg-primary-700 hover:bg-primary-800 shadow-xl ring-2 ring-primary-600 hover:-translate-y-0.5"
                    }`}
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Sending OTP...
                    </>
                  ) : !isValidPhoneNumber(phone) ? (
                    <>
                      <i className="fas fa-keyboard mr-2"></i>
                      Enter 10 Digits
                    </>
                  ) : recaptchaSolved ? (
                    <>
                      <i className="fas fa-paper-plane mr-2"></i>
                      Send OTP
                    </>
                  ) : (
                    <>
                      <i className="fas fa-shield-alt mr-2"></i>
                      Complete reCAPTCHA First
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          {confirmationResult && (
            <form onSubmit={handleOtpVerify} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ fontWeight: 500, marginBottom: 4 }}>Enter OTP</label>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter OTP"
                required
                style={{ padding: 10, borderRadius: 4, border: "1px solid #d1d5db", marginBottom: 20 }}
              />
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="submit" disabled={loading || otpVerifying} style={{ flex: 1, background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, padding: "10px 0", fontWeight: 600, fontSize: 16, cursor: (loading || otpVerifying) ? "not-allowed" : "pointer" }}>
                  {(loading || otpVerifying) ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Verifying...
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmationResult(null);
                    setOtp("");
                    setError("");
                    setRecaptchaSolved(false);
                  }}
                  disabled={loading || otpVerifying}
                  style={{ background: "#6b7280", color: "#fff", border: "none", borderRadius: 4, padding: "10px 16px", fontWeight: 600, fontSize: 16, cursor: (loading || otpVerifying) ? "not-allowed" : "pointer" }}
                >
                  Try Again
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default SignIn; 