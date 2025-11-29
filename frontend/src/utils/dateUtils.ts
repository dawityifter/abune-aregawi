/**
 * Utility functions for handling dates consistently across the application
 * All dates are handled in CST (America/Chicago) timezone
 */

// CST timezone identifier
const CST_TIMEZONE = 'America/Chicago';

/**
 * Formats a date string to display in CST timezone
 * This is useful for dates that should be displayed as-is (like birth dates, join dates, etc.)
 * 
 * @param dateString - The date string from the database (e.g., "1990-01-15")
 * @param options - Optional Intl.DateTimeFormat options
 * @returns Formatted date string in CST
 */
export function formatDateForDisplay(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '';
  
  // For dates that are already in YYYY-MM-DD format (like from date inputs),
  // we need to ensure they're treated as local dates, not UTC
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse as local date to avoid timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    // Format in CST timezone
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: CST_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      ...options
    };
    
    return date.toLocaleDateString('en-US', defaultOptions);
  }
  
  // For other date formats, parse and format in CST
  const date = new Date(dateString);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...options
  };
  
  return date.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Formats a date for use in date input fields
 * Ensures the date is in YYYY-MM-DD format for HTML date inputs
 * 
 * @param dateString - The date string to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  
  // If it's already in YYYY-MM-DD format, return as-is
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Convert to YYYY-MM-DD format in CST timezone
  const date = new Date(dateString);
  
  // Format in CST timezone to get the correct date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

/**
 * Validates if a date string is valid
 * 
 * @param dateString - The date string to validate
 * @returns True if the date is valid, false otherwise
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Get current date in CST timezone formatted as YYYY-MM-DD
 * @returns Current date string in YYYY-MM-DD format
 */
export function getCurrentDateCST(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a date with time in CST timezone
 * @param dateString - The date string to format
 * @param options - Optional Intl.DateTimeFormat options
 * @returns Formatted date and time string
 */
export function formatDateTimeForDisplay(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  
  return date.toLocaleString('en-US', defaultOptions);
} 