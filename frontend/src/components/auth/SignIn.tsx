import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../firebase";
import ErrorBoundary from "../ErrorBoundary";
import { formatPhoneNumber, isValidPhoneNumber, normalizePhoneNumber } from "../../utils/formatPhoneNumber";
import { featureFlags, getDefaultAuthMethod, getEnabledAuthMethods } from "../../config/featureFlags";
import { useLanguage } from "../../contexts/LanguageContext";

declare global {
  interface Window {
    recaptchaVerifier?: any;
  }
}

const SignIn: React.FC = () => {
  const { loginWithEmail, loginWithPhone, loading } = useAuth();
  const { t } = useLanguage();
  
  // Get enabled authentication methods and set default
  const enabledMethods = getEnabledAuthMethods();
  const defaultMethod = getDefaultAuthMethod();
  
  // Initialize method state with feature flag-aware default
  const [method, setMethod] = useState<"email" | "phone">(() => {
    if (!defaultMethod) {
      return 'phone'; // Fallback
    }
    return defaultMethod;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(''); // Start with empty phone number
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

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

  // Initialize reCAPTCHA when component mounts and method is phone
  const initializeRecaptcha = async () => {
    if (method === "phone" && !window.recaptchaVerifier && !confirmationResult) {
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
    if (method === "phone" && isValidPhoneNumber(phone) && !window.recaptchaVerifier && !confirmationResult) {
      await initializeRecaptcha();
    }
  };

  // Initialize reCAPTCHA when phone becomes valid (10 digits)
  useEffect(() => {
    if (method === "phone" && isValidPhoneNumber(phone) && !recaptchaSolved) {
      initializeRecaptchaIfNeeded();
    }
  }, [method, phone, recaptchaSolved]);

  // Reset reCAPTCHA state when switching methods
  useEffect(() => {
    if (method !== "phone") {
      setRecaptchaSolved(false);
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    }
  }, [method]);

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  // Get clean phone number for Firebase (E.164 format)
  const getCleanPhoneNumber = (displayValue: string): string => {
    return normalizePhoneNumber(displayValue);
  };



  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Email sign-in failed. Please try again.');
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email address.");
      } else if (err.code === 'auth/wrong-password') {
        setError("Incorrect password. Please try again.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Invalid email address format.");
      } else if (err.code === 'auth/user-disabled') {
        setError("This account has been disabled. Please contact support.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many failed login attempts. Please try again later.");
      } else {
        setError("Login failed. Please check your credentials and try again.");
      }
    }
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
      const credential = await confirmationResult.confirm(otp);
      console.log('✅ OTP verification successful, user authenticated');
      
      // Clear OTP form state immediately
      setConfirmationResult(null);
      setOtp("");
      setOtpVerifying(false);
      
      // Clear any previous errors
      setError("");
      
      // Immediately clean up reCAPTCHA to prevent timeout errors
      if (window.recaptchaVerifier) {
        try {
          if (typeof window.recaptchaVerifier.clear === 'function') {
            window.recaptchaVerifier.clear();
          }
          if (typeof window.recaptchaVerifier._reset === 'function') {
            window.recaptchaVerifier._reset();
          }
          window.recaptchaVerifier = undefined;
        } catch (cleanupError) {
          console.log('reCAPTCHA cleanup error (non-critical):', cleanupError);
        }
      }
      
      console.log('🔄 Login successful, reCAPTCHA cleaned up, AuthContext will handle navigation...');
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
        if (typeof window.recaptchaVerifier.clear === 'function') {
          window.recaptchaVerifier.clear();
        }
        if (typeof window.recaptchaVerifier._reset === 'function') {
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
            <h2 className="text-3xl font-serif font-bold text-primary-700 mb-2">{t('welcome.back')}</h2>
            <p className="text-accent-600 text-sm">{t('sign.in.to.access.community')}</p>
          </div>
        
        {/* Only show method selection if multiple auth methods are enabled */}
        {enabledMethods.length > 1 && (
          <div className="flex gap-3 mb-6 justify-center">
            {featureFlags.enableEmailPasswordAuth && (
              <button
                onClick={() => setMethod("email")}
                className={`px-6 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
                  method === "email" 
                    ? "bg-primary-700 text-white shadow-lg transform -translate-y-0.5" 
                    : "bg-white/50 text-accent-700 border border-accent-300 hover:bg-white/70"
                }`}
              >
                <i className="fas fa-envelope mr-2"></i>
                Email/Password
              </button>
            )}
            {featureFlags.enablePhoneAuth && (
              <button
                onClick={() => setMethod("phone")}
                className={`px-6 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
                  method === "phone" 
                    ? "bg-primary-700 text-white shadow-lg transform -translate-y-0.5" 
                    : "bg-white/50 text-accent-700 border border-accent-300 hover:bg-white/70"
                }`}
              >
                <i className="fas fa-phone mr-2"></i>
                Phone
              </button>
            )}
          </div>
        )}
        
        {/* Show single method title if only one method is enabled */}
        {enabledMethods.length === 1 && (
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium">
              {featureFlags.enableEmailPasswordAuth && (
                <>
                  <i className="fas fa-envelope mr-2"></i>
                  Sign in with Email/Password
                </>
              )}
              {featureFlags.enablePhoneAuth && (
                <>
                  <i className="fas fa-phone mr-2"></i>
                  Sign in with Phone Number
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Show error if no auth methods are enabled */}
        {enabledMethods.length === 0 && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6 text-center">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            <strong>No authentication methods available.</strong>
            <br />
            <span className="text-sm">Please contact your administrator for assistance.</span>
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6 text-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </div>
        )}
        {method === "email" && featureFlags.enableEmailPasswordAuth && (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-accent-700 mb-2">
                <i className="fas fa-envelope mr-2 text-primary-700"></i>
                Email Address
              </label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                type="email"
                required
                className="w-full px-4 py-3 border border-accent-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white/50 backdrop-blur-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-accent-700 mb-2">
                <i className="fas fa-lock mr-2 text-primary-700"></i>
                Password
              </label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 border border-accent-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white/50 backdrop-blur-sm"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-300 ${
                loading 
                  ? "bg-accent-400 cursor-not-allowed" 
                  : "bg-primary-700 hover:bg-primary-800 transform hover:-translate-y-0.5 shadow-lg"
              }`}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Signing In...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-2"></i>
                  Sign In
                </>
              )}
            </button>
          </form>
        )}
        {method === "phone" && featureFlags.enablePhoneAuth && !confirmationResult && (
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
            
            <button 
              type="submit" 
              disabled={loading || !isValidPhoneNumber(phone) || !recaptchaSolved} 
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-300 ${
                loading || !isValidPhoneNumber(phone) || !recaptchaSolved
                  ? "bg-accent-400 cursor-not-allowed" 
                  : "bg-primary-700 hover:bg-primary-800 transform hover:-translate-y-0.5 shadow-lg"
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
          </form>
        )}
        {method === "phone" && featureFlags.enablePhoneAuth && confirmationResult && (
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