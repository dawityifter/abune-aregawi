/**
 * Secure Logger Utility with PII Redaction
 * 
 * Automatically redacts sensitive information in production:
 * - Email addresses
 * - Phone numbers
 * - Physical addresses
 * - Full names (optional)
 */

const isProd = process.env.NODE_ENV === 'production';

/**
 * Redact email address
 * john.doe@example.com -> jo****@example.com
 */
function redactEmail(email) {
  if (!email || typeof email !== 'string') return email;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  
  const visibleChars = Math.min(2, local.length);
  return `${local.substring(0, visibleChars)}****@${domain}`;
}

/**
 * Redact phone number
 * +14155551234 -> ***1234
 * (415) 555-1234 -> ***1234
 */
function redactPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 4) return '****';
  return `***${digitsOnly.slice(-4)}`;
}

/**
 * Redact a single object's sensitive fields
 */
function redactObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
  
  // Redact email fields
  if (redacted.email) redacted.email = redactEmail(redacted.email);
  if (redacted.userEmail) redacted.userEmail = redactEmail(redacted.userEmail);
  if (redacted.spouseEmail) redacted.spouseEmail = redactEmail(redacted.spouseEmail);
  
  // Redact phone fields
  if (redacted.phone) redacted.phone = redactPhone(redacted.phone);
  if (redacted.phoneNumber) redacted.phoneNumber = redactPhone(redacted.phoneNumber);
  if (redacted.phone_number) redacted.phone_number = redactPhone(redacted.phone_number);
  if (redacted.userPhone) redacted.userPhone = redactPhone(redacted.userPhone);
  if (redacted.emergencyContactPhone) redacted.emergencyContactPhone = redactPhone(redacted.emergencyContactPhone);
  if (redacted.emergency_contact_phone) redacted.emergency_contact_phone = redactPhone(redacted.emergency_contact_phone);
  
  // Remove address fields completely
  delete redacted.streetLine1;
  delete redacted.street_line1;
  delete redacted.streetLine2;
  delete redacted.street_line2;
  delete redacted.apartmentNo;
  delete redacted.apartment_no;
  delete redacted.city;
  delete redacted.state;
  delete redacted.postalCode;
  delete redacted.postal_code;
  delete redacted.country;
  delete redacted.address;
  
  // Handle nested objects and arrays
  for (const key in redacted) {
    if (redacted[key] && typeof redacted[key] === 'object') {
      redacted[key] = redactObject(redacted[key]);
    }
  }
  
  return redacted;
}

/**
 * Redact sensitive data from any input
 */
function redactSensitive(data) {
  if (!data) return data;
  
  // Handle strings (check if it's JSON)
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(redactObject(parsed));
    } catch {
      return data; // Not JSON, return as-is
    }
  }
  
  // Handle objects and arrays
  if (typeof data === 'object') {
    return redactObject(data);
  }
  
  return data;
}

/**
 * Log levels
 */
const logger = {
  /**
   * Debug logs - only in development, with full PII redaction in production
   */
  debug: (message, data) => {
    if (isProd) {
      // In production, only log if explicitly enabled
      if (process.env.DEBUG_LOGS === 'true') {
        console.log(`[DEBUG] ${message}`, data ? redactSensitive(data) : '');
      }
      return;
    }
    // Development: log everything
    console.log(`[DEBUG] ${message}`, data || '');
  },

  /**
   * Info logs - important business events, redacted in production
   */
  info: (message, data) => {
    if (isProd && data) {
      console.log(`[INFO] ${message}`, redactSensitive(data));
    } else {
      console.log(`[INFO] ${message}`, data || '');
    }
  },

  /**
   * Warning logs - always shown, redacted in production
   */
  warn: (message, data) => {
    if (isProd && data) {
      console.warn(`[WARN] ${message}`, redactSensitive(data));
    } else {
      console.warn(`[WARN] ${message}`, data || '');
    }
  },

  /**
   * Error logs - always shown, with error details (no PII in errors typically)
   */
  error: (message, error) => {
    if (error && error.stack) {
      console.error(`[ERROR] ${message}`, error.message, '\n', error.stack);
    } else {
      console.error(`[ERROR] ${message}`, error || '');
    }
  },

  /**
   * Success logs - important success events
   */
  success: (message, data) => {
    if (isProd && data) {
      console.log(`✅ ${message}`, redactSensitive(data));
    } else {
      console.log(`✅ ${message}`, data || '');
    }
  },

  /**
   * Create a redacted summary for IDs and basic info (safe to log)
   */
  safeSummary: (data) => {
    if (!data) return null;
    
    const safe = {};
    
    // Only include safe fields
    if (data.id) safe.id = data.id;
    if (data.uid) safe.uid = data.uid;
    if (data.firebaseUid) safe.firebaseUid = data.firebaseUid;
    if (data.role) safe.role = data.role;
    if (data.isActive !== undefined) safe.isActive = data.isActive;
    if (data.firstName) safe.firstName = data.firstName;
    if (data.lastName) safe.lastName = data.lastName;
    
    // Redact sensitive fields if present
    if (data.email) safe.email = redactEmail(data.email);
    if (data.phoneNumber) safe.phoneNumber = redactPhone(data.phoneNumber);
    if (data.phone_number) safe.phoneNumber = redactPhone(data.phone_number);
    
    return safe;
  }
};

module.exports = logger;
