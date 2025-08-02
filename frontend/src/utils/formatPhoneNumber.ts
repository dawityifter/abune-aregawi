/**
 * Formats a phone number for display as (XXX) XXX-XXXX
 * @param value - Raw phone number input
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(value: string): string {
  // If empty, return empty string
  if (!value) return '';
  
  // Remove all non-digit characters
  const cleaned = value.replace(/\D/g, '');
  
  // If no digits, return the original value (for backspace/delete)
  if (!cleaned) return value;
  
  // Limit to 10 digits for US numbers
  const digits = cleaned.slice(0, 10);
  
  // Format as (XXX) XXX-XXXX
  if (digits.length <= 3) {
    return `(${digits}`;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
}

/**
 * Normalizes a phone number to E.164 format for backend storage and Firebase
 * @param value - Phone number in any format
 * @returns E.164 formatted phone number (+1XXXXXXXXXX) or empty string if invalid
 */
export function normalizePhoneNumber(value: string): string {
  if (!value) return '';
  
  // If already in E.164 format (starts with +), return as-is
  if (value.startsWith('+')) {
    return value;
  }
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
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