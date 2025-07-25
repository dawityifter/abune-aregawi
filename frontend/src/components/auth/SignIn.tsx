import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../firebase";
// import app from "../../firebase"; // Remove unused import

declare global {
  interface Window {
    recaptchaVerifier?: any;
  }
}

const SignIn: React.FC = () => {
  const { loginWithEmail, loginWithPhone, loading } = useAuth();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [error, setError] = useState("");

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  // Phone number formatting function
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    
    let formatted = '';
    if (match[1]) {
      formatted = `(${match[1]}`;
      if (match[1].length === 3) {
        formatted += ')';
      }
    }
    if (match[2]) {
      formatted += match[2].length > 0 ? ` ${match[2]}` : '';
    }
    if (match[3]) {
      formatted += match[3].length > 0 ? `-${match[3]}` : '';
    }
    return formatted.trim();
  };

  // Get clean phone number for Firebase (E.164 format)
  const getCleanPhoneNumber = (displayValue: string): string => {
    const digits = displayValue.replace(/\D/g, '');
    // Assume US number if no country code
    return digits.length === 10 ? `+1${digits}` : `+${digits}`;
  };

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    loginWithEmail(email, password);
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validate phone number
    const cleanPhone = getCleanPhoneNumber(phone);
    if (cleanPhone.length < 10) {
      setError("Please enter a complete phone number.");
      return;
    }

    try {
      // Validate Firebase Auth is properly initialized
      if (!auth || !(auth as any).app) {
        setError("Firebase Auth is not initialized. Please check your Firebase configuration.");
        return;
      }
      
      // Check if Firebase config is valid
      const app = (auth as any).app;
      if (!app.options || !app.options.apiKey || app.options.apiKey.includes('YOUR_')) {
        setError("Firebase configuration is incomplete. Please set up your Firebase credentials in the .env file.");
        return;
      }

      // Clear any existing recaptcha
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }

      // Check if reCAPTCHA container exists
      const recaptchaContainer = document.getElementById('recaptcha-container');
      if (!recaptchaContainer) {
        setError("reCAPTCHA container not found. Please refresh the page.");
        return;
      }

      // Create RecaptchaVerifier with correct Firebase v9+ syntax for Enterprise
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: "invisible", // Back to invisible to test CSP behavior
            callback: () => {
              console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
              console.log('reCAPTCHA expired');
              setError('reCAPTCHA expired. Please try again.');
            }
          }
        );
        // Don't manually render for Enterprise - let Firebase handle it
      } catch (recaptchaError: any) {
        console.error('RecaptchaVerifier creation failed:', recaptchaError);
        setError(`Failed to initialize reCAPTCHA: ${recaptchaError.message}`);
        return;
      }

      const appVerifier = window.recaptchaVerifier;
      const result = await loginWithPhone(cleanPhone, appVerifier);
      if (result) setConfirmationResult(result);
    } catch (err: any) {
      console.error('Phone sign-in error:', err);
      console.error('Error code:', err.code);
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        phoneNumber: cleanPhone,
        recaptchaVerifier: !!window.recaptchaVerifier
      });
      
      // Check for specific error types
      if (err.code === 'auth/too-many-requests') {
        setError("Phone verification temporarily blocked. This may be due to reCAPTCHA configuration. Please try again in a few minutes or contact support.");
      } else {
        setError("Phone login failed: " + err.message);
      }
      
      // Clear recaptcha on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp) {
      setError("Please enter the OTP sent to your phone.");
      return;
    }
    await loginWithPhone(phone, null, otp, confirmationResult);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7fafc" }}>
      {/* Always render the recaptcha container */}
      <div id="recaptcha-container"></div>
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", padding: 32, width: 360, maxWidth: "90vw" }}>
        <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: 28, marginBottom: 24 }}>Sign In</h2>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", justifyContent: "center" }}>
          <button
            onClick={() => setMethod("email")}
            style={{
              background: method === "email" ? "#2563eb" : "#f0f0f0",
              color: method === "email" ? "#fff" : "#333",
              border: "none",
              padding: "0.5rem 1.2rem",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 16,
              boxShadow: method === "email" ? "0 2px 8px rgba(37,99,235,0.08)" : undefined
            }}
          >
            Email/Password
          </button>
          <button
            onClick={() => setMethod("phone")}
            style={{
              background: method === "phone" ? "#2563eb" : "#f0f0f0",
              color: method === "phone" ? "#fff" : "#333",
              border: "none",
              padding: "0.5rem 1.2rem",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 16,
              boxShadow: method === "phone" ? "0 2px 8px rgba(37,99,235,0.08)" : undefined
            }}
          >
            Phone
          </button>
        </div>
        {error && <div style={{ color: "#b91c1c", background: "#fee2e2", borderRadius: 4, padding: 8, marginBottom: 16, textAlign: "center" }}>{error}</div>}
        {method === "email" && (
          <form onSubmit={handleEmailSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ fontWeight: 500, marginBottom: 4 }}>Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
              style={{ padding: 10, borderRadius: 4, border: "1px solid #d1d5db", marginBottom: 12 }}
            />
            <label style={{ fontWeight: 500, marginBottom: 4 }}>Password</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              required
              style={{ padding: 10, borderRadius: 4, border: "1px solid #d1d5db", marginBottom: 20 }}
            />
            <button type="submit" disabled={loading} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, padding: "10px 0", fontWeight: 600, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        )}
        {method === "phone" && !confirmationResult && (
          <form onSubmit={handlePhoneSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ fontWeight: 500, marginBottom: 4 }}>Phone Number</label>
            <input
              value={phone}
              onChange={e => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="(555) 123-4567"
              type="tel"
              required
              style={{ padding: 10, borderRadius: 4, border: "1px solid #d1d5db", marginBottom: 8 }}
            />
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              Enter 10 digits (e.g., 5551234567) - will auto-format
            </div>
            <button type="submit" disabled={loading} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, padding: "10px 0", fontWeight: 600, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}
        {method === "phone" && confirmationResult && (
          <form onSubmit={handleOtpVerify} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ fontWeight: 500, marginBottom: 4 }}>Enter OTP</label>
            <input
              value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="Enter OTP"
              required
              style={{ padding: 10, borderRadius: 4, border: "1px solid #d1d5db", marginBottom: 20 }}
            />
            <button type="submit" disabled={loading} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, padding: "10px 0", fontWeight: 600, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignIn; 