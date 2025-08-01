# Feature Flags Documentation

## Overview

The Church Management System includes a feature flag system that allows you to enable or disable authentication methods without removing code. This is particularly useful for testing, gradual rollouts, or temporarily disabling features.

## Authentication Feature Flags

### Available Flags

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `enableEmailPasswordAuth` | `REACT_APP_ENABLE_EMAIL_AUTH` | `true` | Controls email/password authentication |
| `enablePhoneAuth` | `REACT_APP_ENABLE_PHONE_AUTH` | `true` | Controls phone number authentication |

### Configuration

Feature flags are configured via environment variables in your `.env` file:

```bash
# Enable both authentication methods (default)
REACT_APP_ENABLE_EMAIL_AUTH=true
REACT_APP_ENABLE_PHONE_AUTH=true

# Disable email authentication (phone only)
REACT_APP_ENABLE_EMAIL_AUTH=false
REACT_APP_ENABLE_PHONE_AUTH=true

# Disable phone authentication (email only)
REACT_APP_ENABLE_EMAIL_AUTH=true
REACT_APP_ENABLE_PHONE_AUTH=false

# Disable all authentication (not recommended)
REACT_APP_ENABLE_EMAIL_AUTH=false
REACT_APP_ENABLE_PHONE_AUTH=false
```

### Accepted Values

The following values are recognized as `true`:
- `true`
- `1` 
- `yes`
- `on`

The following values are recognized as `false`:
- `false`
- `0`
- `no`
- `off`

Any other value will log a warning and use the default value.

## User Experience

### Multiple Methods Enabled
When both authentication methods are enabled, users see:
- Method selection buttons (Email/Password and Phone)
- Can switch between authentication methods
- Default method is Phone (preferred)

### Single Method Enabled
When only one authentication method is enabled:
- No method selection buttons shown
- Displays a subtitle indicating the available method
- Form shows directly for the enabled method

### No Methods Enabled
When no authentication methods are enabled:
- Shows an error message
- Directs users to contact administrator
- No authentication forms are displayed

## Implementation Details

### Files Modified

1. **`/src/config/featureFlags.ts`** - Main feature flags configuration
2. **`/src/components/auth/SignIn.tsx`** - Updated to respect feature flags
3. **`/.env.example`** - Added feature flag documentation

### Key Functions

- `getEnabledAuthMethods()` - Returns array of enabled auth methods
- `getDefaultAuthMethod()` - Returns preferred default method
- `isFeatureEnabled(feature)` - Checks if specific feature is enabled

### Development Logging

In development mode, feature flag status is logged to console:

```
🏁 Feature Flags Status: {
  emailAuth: '✅ Enabled',
  phoneAuth: '✅ Enabled', 
  defaultMethod: 'phone',
  enabledMethods: ['email', 'phone']
}
```

## Testing Scenarios

### Test Email Authentication Only
```bash
REACT_APP_ENABLE_EMAIL_AUTH=true
REACT_APP_ENABLE_PHONE_AUTH=false
```

### Test Phone Authentication Only  
```bash
REACT_APP_ENABLE_EMAIL_AUTH=false
REACT_APP_ENABLE_PHONE_AUTH=true
```

### Test No Authentication (Error State)
```bash
REACT_APP_ENABLE_EMAIL_AUTH=false
REACT_APP_ENABLE_PHONE_AUTH=false
```

## Deployment Considerations

1. **Production Safety**: Always ensure at least one authentication method is enabled in production
2. **Environment Consistency**: Keep feature flags consistent across environments unless testing
3. **User Communication**: If disabling a method users rely on, communicate changes in advance
4. **Rollback Plan**: Keep previous environment configuration for quick rollback if needed

## Future Extensions

The feature flag system is designed to be extensible. Future authentication methods can be added:

```typescript
export interface FeatureFlags {
  enableEmailPasswordAuth: boolean;
  enablePhoneAuth: boolean;
  enableSocialAuth: boolean;        // Future: Google, Facebook, etc.
  enableTwoFactorAuth: boolean;     // Future: 2FA requirement
  enableBiometricAuth: boolean;     // Future: Fingerprint, Face ID
}
```

## Troubleshooting

### Common Issues

1. **No authentication methods showing**
   - Check `.env` file exists and has correct values
   - Verify environment variables are prefixed with `REACT_APP_`
   - Restart development server after changing `.env`

2. **Feature flag not taking effect**
   - Ensure you restart the development server
   - Check browser console for feature flag status logs
   - Verify environment variable spelling and values

3. **Users can't sign in**
   - Verify at least one authentication method is enabled
   - Check Firebase configuration for enabled auth methods
   - Ensure backend supports the enabled authentication methods

### Debug Commands

```bash
# Check current environment variables
printenv | grep REACT_APP_ENABLE

# Verify .env file
cat .env | grep ENABLE_.*_AUTH
```
