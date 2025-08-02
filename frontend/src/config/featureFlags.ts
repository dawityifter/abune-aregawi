/**
 * Feature Flags Configuration
 * 
 * This file manages feature flags for the application.
 * Feature flags can be controlled via environment variables or default values.
 */

export interface FeatureFlags {
  // Authentication features
  enableEmailPasswordAuth: boolean;
  enablePhoneAuth: boolean;
  
  // Future feature flags can be added here
  // enableSocialAuth: boolean;
  // enableTwoFactorAuth: boolean;
}

/**
 * Get feature flag value from environment variable with fallback to default
 */
const getFeatureFlagFromEnv = (envVar: string, defaultValue: boolean): boolean => {
  const envValue = process.env[envVar];
  
  if (envValue === undefined || envValue === '') {
    return defaultValue;
  }
  
  // Handle various truthy/falsy string representations
  const normalizedValue = envValue.toLowerCase().trim();
  
  if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes' || normalizedValue === 'on') {
    return true;
  }
  
  if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'no' || normalizedValue === 'off') {
    return false;
  }
  
  // If we can't parse it, use default
  return defaultValue;
};

/**
 * Feature flags configuration
 * 
 * Environment Variables:
 * - REACT_APP_ENABLE_EMAIL_AUTH: Enable/disable email/password authentication (default: true)
 * - REACT_APP_ENABLE_PHONE_AUTH: Enable/disable phone authentication (default: true)
 */
export const featureFlags: FeatureFlags = {
  // Email/Password Authentication
  // Set REACT_APP_ENABLE_EMAIL_AUTH=false to disable email authentication
  enableEmailPasswordAuth: getFeatureFlagFromEnv('REACT_APP_ENABLE_EMAIL_AUTH', true),
  
  // Phone Authentication  
  // Set REACT_APP_ENABLE_PHONE_AUTH=false to disable phone authentication
  enablePhoneAuth: getFeatureFlagFromEnv('REACT_APP_ENABLE_PHONE_AUTH', true),
};

// Debug logging to see what values are being read
console.log('🔧 Feature Flags Debug:', {
  REACT_APP_ENABLE_EMAIL_AUTH: process.env.REACT_APP_ENABLE_EMAIL_AUTH,
  REACT_APP_ENABLE_PHONE_AUTH: process.env.REACT_APP_ENABLE_PHONE_AUTH,
  enableEmailPasswordAuth: featureFlags.enableEmailPasswordAuth,
  enablePhoneAuth: featureFlags.enablePhoneAuth,
});

/**
 * Helper function to check if a specific feature is enabled
 */
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature];
};

/**
 * Helper function to get all enabled authentication methods
 */
export const getEnabledAuthMethods = (): Array<'email' | 'phone'> => {
  const methods: Array<'email' | 'phone'> = [];
  
  if (featureFlags.enableEmailPasswordAuth) {
    methods.push('email');
  }
  
  if (featureFlags.enablePhoneAuth) {
    methods.push('phone');
  }
  
  return methods;
};

/**
 * Helper function to get the default authentication method
 * Returns the first enabled method, with phone as preference if both are enabled
 */
export const getDefaultAuthMethod = (): 'email' | 'phone' | null => {
  const enabledMethods = getEnabledAuthMethods();
  
  if (enabledMethods.length === 0) {
    return null;
  }
  
  // Prefer phone if both are enabled, otherwise return the first available
  if (featureFlags.enablePhoneAuth) {
    return 'phone';
  }
  
  return enabledMethods[0];
};


