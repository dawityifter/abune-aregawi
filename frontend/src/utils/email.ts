// Utility functions for safely displaying emails
// Emails ending with '@phone-signin.local' are placeholders created by phone auth.
// We should hide them in the UI.

export const isPhoneSigninEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.toLowerCase().endsWith('@phone-signin.local');
};

// Returns a value safe to render in UI. Will return an empty string for phone-signin emails.
export const getDisplayEmail = (email?: string | null): string => {
  if (!email) return '';
  return isPhoneSigninEmail(email) ? '' : email;
};
