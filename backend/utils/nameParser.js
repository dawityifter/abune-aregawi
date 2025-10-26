/**
 * Name parsing utilities for extracting first, middle, and last names
 * from a full name string (e.g., from "Name on Card" field)
 */

/**
 * Parse a full name into first, middle, and last name components
 * 
 * Examples:
 * - "John Smith" → { firstName: "John", lastName: "Smith" }
 * - "John Michael Smith" → { firstName: "John", middleName: "Michael", lastName: "Smith" }
 * - "John" → { firstName: "John", lastName: "Donor" }
 * - "" → { firstName: "Anonymous", lastName: "Donor" }
 * - "Anonymous" → { firstName: "Anonymous", lastName: "Donor" }
 * 
 * @param {string} fullName - Full name string to parse
 * @returns {Object} { firstName, middleName, lastName }
 */
function parseFullName(fullName) {
  // Trim and handle empty/null
  const trimmed = (fullName || '').trim();
  
  // Handle empty or "Anonymous" case
  if (!trimmed || trimmed.toLowerCase() === 'anonymous') {
    return {
      firstName: 'Anonymous',
      middleName: null,
      lastName: 'Donor'
    };
  }

  // Split by spaces
  const parts = trimmed.split(/\s+/).filter(part => part.length > 0);

  // Single name (e.g., "Prince", "Madonna")
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: null,
      lastName: 'Donor' // Fallback for single names
    };
  }

  // Two names (most common: "FirstName LastName")
  if (parts.length === 2) {
    return {
      firstName: parts[0],
      middleName: null,
      lastName: parts[1]
    };
  }

  // Three or more names
  // Strategy: First is firstName, Last is lastName, everything in between is middleName
  if (parts.length >= 3) {
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const middleParts = parts.slice(1, -1);
    const middleName = middleParts.join(' ');

    return {
      firstName,
      middleName,
      lastName
    };
  }

  // Fallback (shouldn't reach here, but just in case)
  return {
    firstName: trimmed,
    middleName: null,
    lastName: 'Donor'
  };
}

/**
 * Check if a name appears to be anonymous/placeholder
 * 
 * @param {string} firstName 
 * @param {string} lastName 
 * @returns {boolean}
 */
function isAnonymousName(firstName, lastName) {
  const anonymous = ['anonymous', 'donor', 'guest', 'n/a', 'none', 'test'];
  const first = (firstName || '').toLowerCase();
  const last = (lastName || '').toLowerCase();
  
  return anonymous.includes(first) || anonymous.includes(last);
}

module.exports = {
  parseFullName,
  isAnonymousName
};
