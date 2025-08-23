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
  // UI/Global banners
  enableDevBanner: boolean;
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
 * - REACT_APP_ENABLE_DEV_BANNER: Enable/disable development banner (default: true in dev, false in prod)
 */
export const featureFlags: FeatureFlags = {
  // Email/Password Authentication (disabled by default for phone-only policy)
  // Set REACT_APP_ENABLE_EMAIL_AUTH=true to re-enable (not recommended per policy)
  enableEmailPasswordAuth: getFeatureFlagFromEnv('REACT_APP_ENABLE_EMAIL_AUTH', false),
  
  // Phone Authentication  
  // Set REACT_APP_ENABLE_PHONE_AUTH=false to disable phone authentication
  enablePhoneAuth: getFeatureFlagFromEnv('REACT_APP_ENABLE_PHONE_AUTH', true),

  // Development banner (global notice)
  // Defaults: enabled in development, disabled in production
  enableDevBanner: getFeatureFlagFromEnv(
    'REACT_APP_ENABLE_DEV_BANNER',
    process.env.NODE_ENV === 'production' ? false : true
  ),
};

// Debug logging to see what values are being read
console.log('🔧 Feature Flags Debug:', {
  REACT_APP_ENABLE_EMAIL_AUTH: process.env.REACT_APP_ENABLE_EMAIL_AUTH,
  REACT_APP_ENABLE_PHONE_AUTH: process.env.REACT_APP_ENABLE_PHONE_AUTH,
  REACT_APP_ENABLE_DEV_BANNER: process.env.REACT_APP_ENABLE_DEV_BANNER,
  enableEmailPasswordAuth: featureFlags.enableEmailPasswordAuth,
  enablePhoneAuth: featureFlags.enablePhoneAuth,
  enableDevBanner: featureFlags.enableDevBanner,
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


