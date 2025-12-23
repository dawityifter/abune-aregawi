# Bypassing Firebase for Local Development

This guide explains how to use your app locally without requiring Firebase Authentication.

## Quick Start: Using Magic Demo Mode (Recommended)

Your app already has built-in support for bypassing Firebase authentication through "Magic Demo Mode". This is the easiest way to develop locally.

### Step 1: Enable Demo Mode in Frontend

Create or update `../frontend/.env` (or `../frontend/.env.local`):

```env
# Backend API URL
REACT_APP_API_URL=http://localhost:5001

# Enable Demo Mode to bypass Firebase
REACT_APP_ENABLE_DEMO_MODE=true

# Firebase config (can be dummy values when demo mode is enabled)
REACT_APP_FIREBASE_API_KEY=dummy_key
REACT_APP_FIREBASE_AUTH_DOMAIN=dummy.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=dummy-project
REACT_APP_FIREBASE_STORAGE_BUCKET=dummy.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Step 2: Enable Demo Mode in Backend

Create or update `../backend/.env`:

```env
# Enable Demo Mode to accept magic tokens
ENABLE_DEMO_MODE=true

# Database Configuration (required)
DATABASE_URL=postgresql://username:password@localhost:5432/church_db

# Server Configuration
PORT=5001
NODE_ENV=development

# JWT Configuration (required)
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Firebase Configuration - NOT REQUIRED when demo mode is enabled
# You can omit FIREBASE_SERVICE_ACCOUNT_BASE64
```

### Step 3: Use Magic Phone Numbers

The demo mode works with special "magic" phone numbers:

1. **Existing User Demo**: Use phone number `+14699078229`
   - This simulates an existing user with a profile in your database
   - Use OTP code: `123456`

2. **New User Demo**: Use phone number `+14699078230`
   - This simulates a new user who needs to register
   - Use OTP code: `123456`

### How It Works

1. When you enter a magic phone number and enable demo mode:
   - The frontend bypasses reCAPTCHA verification
   - You can use any OTP code (typically `123456`)
   - A mock Firebase user object is created with `MAGIC_DEMO_TOKEN`
   - The mock user has a special UID: `magic-demo-uid` (or `magic-new-user-uid` for new users)

2. The backend recognizes `MAGIC_DEMO_TOKEN` when `ENABLE_DEMO_MODE=true`:
   - It bypasses Firebase token verification in `firebaseAuthMiddleware`
   - It uses the phone number to look up the user in your database
   - Returns user data as if Firebase authentication succeeded

3. For the profile check endpoint (`/api/members/profile/firebase/:uid`):
   - This endpoint doesn't require authentication
   - It has a built-in bypass that returns a mock admin profile for `magic-demo-uid`
   - For real users, it looks up by UID, email, or phone from query params

4. All other API calls that require authentication:
   - Use `firebaseUser.getIdToken()` which returns `'MAGIC_DEMO_TOKEN'` for magic users
   - The backend's `firebaseAuthMiddleware` recognizes and accepts this token when demo mode is enabled

## Alternative: Using Firebase Emulator

If you prefer to use the Firebase Auth Emulator (closer to production behavior):

### Frontend Setup

1. Start Firebase Emulator locally:
```bash
firebase emulators:start --only auth
```

2. In `../frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5001
# Your regular Firebase config values
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=localhost
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
# ... other Firebase config
```

3. Uncomment the emulator connection in `../frontend/src/firebase.ts`:
```typescript
if (isLocal) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  console.log('[Auth] Connected to Firebase Auth Emulator at 127.0.0.1:9099');
}
```

4. In `../backend/.env`:
```env
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIREBASE_PROJECT_ID=your-project-id
# No service account needed for emulator
```

## Important Notes

### Database Still Required

Even with demo mode, you still need:
- ✅ A working PostgreSQL database
- ✅ Your database must have member records matching the phone numbers you test with
- ✅ For the existing user demo (`+14699078229`), ensure this phone number exists in your `members` table

### What Gets Bypassed

With Magic Demo Mode:
- ✅ Firebase Authentication (no real Firebase calls)
- ✅ reCAPTCHA verification (skipped)
- ✅ SMS OTP verification (mock OTP accepted)
- ❌ Database queries (still required)
- ❌ JWT token generation (backend still uses JWT)

### Security Warning

⚠️ **Never enable demo mode in production!** The magic tokens bypass all authentication and are a major security risk.

The demo mode is automatically disabled if:
- `REACT_APP_ENABLE_DEMO_MODE` is not set to `'true'` (string, not boolean)
- `ENABLE_DEMO_MODE` is not set to `'true'` in backend

## Testing Different User Scenarios

### Test Existing User Flow
1. Use phone: `+14699078229`
2. Enter OTP: `123456`
3. Should log in and redirect to dashboard

### Test New User Registration Flow
1. Use phone: `+14699078230`
2. Enter OTP: `123456`
3. Should redirect to registration page

### Test with Your Own Phone Numbers

To use your own phone numbers:

1. **Add member to database** with your phone number
2. **Modify the magic phone numbers** in the code:
   - `../frontend/src/components/auth/SignIn.tsx` (line ~110, ~168)
   - `../frontend/src/contexts/AuthContext.tsx` (line ~416, ~419)
   - `../backend/src/middleware/auth.js` (line ~152)

Or better: Make the magic phone numbers configurable via environment variables (future enhancement).

## Troubleshooting

### "Access denied. No token provided"
- Ensure demo mode is enabled in both frontend and backend
- Check that `REACT_APP_ENABLE_DEMO_MODE=true` (string 'true', not boolean)
- Restart both frontend and backend after changing .env files

### "Member not found"
- The phone number must exist in your database `members` table
- Check that the phone number format matches (should be E.164: `+1...`)

### "Firebase Admin SDK not initialized"
- This is OK in demo mode - the backend doesn't need Firebase when demo mode is active
- If you see auth errors, check that `ENABLE_DEMO_MODE=true` is set in backend `.env`

### reCAPTCHA still required
- Ensure `REACT_APP_ENABLE_DEMO_MODE=true` is set
- Clear browser cache/localStorage
- Restart the frontend dev server

## Code Locations

Key files involved in demo mode:

- **Frontend Auth**: `../frontend/src/contexts/AuthContext.tsx` (line ~416)
- **Frontend Sign-In**: `../frontend/src/components/auth/SignIn.tsx` (line ~110, ~168)
- **Backend Auth Middleware**: `../backend/src/middleware/auth.js` (line ~152)
- **Firebase Config**: `../frontend/src/firebase.ts`

## Next Steps

1. Set environment variables as shown above
2. Restart both frontend and backend servers
3. Navigate to login page
4. Use magic phone number `+14699078229` with OTP `123456`
5. You should be logged in without Firebase!

