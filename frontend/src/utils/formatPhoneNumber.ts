/**
 * Formats a phone number for display as (XXX) XXX-XXXX
 * @param value - Raw phone number input
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
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
}

/**
 * Normalizes a phone number to E.164 format for backend storage and Firebase
 * @param value - Phone number in any format
 * @returns E.164 formatted phone number (+1XXXXXXXXXX) or empty string if invalid
 */
export function normalizePhoneNumber(value: string): string {
  if (!value) return '';
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Handle Firebase test phone numbers - these must be passed through as-is
  if (digits === '1234567890') {
    return '+1234567890';
  }
  if (digits === '5551234567' || digits === '15551234567') {
    return '+15551234567';
  }
  
  // Handle different input formats for regular numbers
  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length > 11) {
    // International number
    return `+${digits}`;
  }
  
  // Invalid length
  return '';
}

/**
 * Validates if a phone number is valid for US format
 * @param value - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(value: string): boolean {
  if (!value) return false;
  
  const digits = value.replace(/\D/g, '');
  
  // Valid US phone number should be 10 digits (without country code) or 11 digits (with country code)
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Gets clean digits from a phone number
 * @param value - Phone number in any format
 * @returns Clean digits string
 */
export function getPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats phone number for display from E.164 format
 * @param e164Number - Phone number in E.164 format (+1XXXXXXXXXX)
 * @returns Formatted display number (XXX) XXX-XXXX
 */
export function formatE164ToDisplay(e164Number: string): string {
  if (!e164Number) return '';
  
  // Remove + and country code for US numbers
  const digits = e164Number.replace(/^\+1/, '').replace(/\D/g, '');
  
  if (digits.length === 10) {
    return formatPhoneNumber(digits);
  }
  
  return e164Number; // Return as-is for non-US numbers
} 