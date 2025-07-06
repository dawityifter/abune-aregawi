/**
 * Utility functions for handling dates consistently across the application
 */

/**
 * Formats a date string to display in the local timezone without timezone conversion issues
 * This is useful for dates that should be displayed as-is (like birth dates, join dates, etc.)
 * 
 * @param dateString - The date string from the database (e.g., "1990-01-15")
 * @returns Formatted date string in the user's locale
 */
export function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  
  // For dates that are already in YYYY-MM-DD format (like from date inputs),
  // we need to ensure they're treated as local dates, not UTC
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse as local date to avoid timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString();
  }
  
  // For other date formats, use the original behavior
  return new Date(dateString).toLocaleDateString();
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
  
  // Convert to YYYY-MM-DD format
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
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