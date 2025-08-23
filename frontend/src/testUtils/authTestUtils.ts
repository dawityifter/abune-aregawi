// Utilities for auth-related test mocking
// Standardize mocking of firebaseUser.getIdToken and extracting Authorization headers

export const setFirebaseUserToken = (firebaseUser: any, token: string = 'test-token') => {
  if (!firebaseUser) return undefined;
  const fn = jest.fn().mockResolvedValue(token);
  firebaseUser.getIdToken = fn;
  return fn;
};

export const extractHeader = (headers: any, key: string) => {
  if (!headers) return undefined;
  // Support Headers instance and plain objects
  if (typeof headers.get === 'function') return headers.get(key);
  // Try case-insensitive access as some code may use lowercase keys
  const direct = headers[key];
  if (direct) return direct;
  const lower = headers[key?.toLowerCase?.()];
  if (lower) return lower;
  // Fallback: iterate entries if possible
  try {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === key.toLowerCase()) return v as any;
    }
  } catch {}
  return undefined;
};
