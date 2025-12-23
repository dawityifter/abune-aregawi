# Firebase Authentication Testing Guide

This guide will help you test the complete Firebase authentication setup for the Abune Aregawi Church web application.

## 🚀 Current Setup Status

✅ **Backend**: Running on `http://localhost:5000` (SQLite database)
✅ **Frontend**: Running on `http://localhost:3000` (React app)
✅ **Firebase Auth**: Integrated with context and components
✅ **Protected Routes**: Implemented with authentication checks

## 🧪 Testing Checklist

### **1. Basic Navigation Test**

1. **Open the application**: `http://localhost:3000`
2. **Verify homepage loads**: Should see church homepage with hero section
3. **Check language switching**: English/Tigrigna toggle should work
4. **Verify responsive design**: Test on different screen sizes

### **2. Authentication Flow Test**

#### **A. Sign-in Driven Registration (Phone OTP)**
1. **Go to Sign In**: Visit `/login`, select the "Phone" tab.
2. **Verify phone**: Enter phone, send OTP, and complete verification.
3. **Post-auth check**: After OTP success, the app calls backend profile:
   - If backend returns **404 (not found)**, you are redirected to `/register` to complete profile.
   - If backend returns **200 (found)**, you are taken directly to the dashboard.
4. **Complete registration (when redirected)**:
   - Fill out: Personal, Contact & Address, Family, Spiritual, Contribution.
   - Submit: Should create backend member record and return 201.
   - Redirect: Should navigate to dashboard on success.
5. **Notes**:
   - There is no standalone "regular registration" start anymore; it begins after successful phone sign-in when no member exists.
   - Email/password login remains for existing accounts but is not used to initiate registration.

#### **B. User Login (Email/Password)**
1. **Navigate to login**: Click "Sign In" or go to `/login`
2. **Select email method**: Ensure "Email" tab is selected
3. **Enter credentials**: Use the email and password from registration
4. **Submit login**: Should authenticate and redirect to dashboard
5. **Verify authentication state**: User should remain logged in

#### **C. User Login (Phone/OTP)**
1. **Navigate to login**: Click "Sign In" or go to `/login`
2. **Select phone method**: Click "Phone" tab
3. **Enter phone number**: Use format `(XXX) XXX-XXXX` or `+1XXXXXXXXXX`
4. **Test phone number formatting**: 
   - Enter `1234567890` → Should format to `(123) 456-7890`
   - Enter `+11234567890` → Should format to `(123) 456-7890`
5. **Test reCAPTCHA behavior**:
   - **Development mode**: Should auto-bypass reCAPTCHA
   - **Test numbers** (`+1234567890`, `+15551234567`): Should bypass reCAPTCHA
   - **Regular numbers**: Should show invisible reCAPTCHA (auto-solved)
6. **Send OTP**: Click "Send OTP" button
7. **Verify OTP form**: Should show OTP input field
8. **Enter OTP**: Input the 6-digit code received
9. **Submit OTP**: Click "Verify OTP"
10. **Verify authentication**: On success, app either redirects to dashboard (existing member) or to `/register` (new user) as described above.
11. **Test error handling**:
    - **Invalid OTP**: Should show "Invalid verification code" message
    - **Expired OTP**: Should show "Verification code has expired" message
    - **Try Again button**: Should reset form and allow retry

#### **D. Password Reset**
1. **On login page**: Click "Forgot Password?"
2. **Enter email**: Use registered email address
3. **Submit**: Should send reset email (check console for Firebase messages)
4. **Return to login**: Click "Back to Login"

#### **E. User Logout**
1. **From dashboard**: Click "Sign Out" in header
2. **Verify logout**: Should redirect to homepage
3. **Check authentication state**: User should be logged out

### **3. Protected Routes Test**

#### **A. Dashboard Access**
1. **Without authentication**: Try to access `/dashboard` directly
2. **Expected behavior**: Should redirect to `/login`
3. **With authentication**: Login and access `/dashboard`
4. **Expected behavior**: Should show member dashboard

#### **B. Dashboard Features**
1. **Profile card**: Should display user information
2. **Navigation cards**: All 6 cards should be visible
3. **Responsive layout**: Should work on mobile and desktop

### **4. API Integration Test**

#### **A. Backend Health Check**
```bash
curl http://localhost:5000/health
```
**Expected**: `{"success":true,"message":"Server is running",...}`

#### **B. Member Registration API**
```bash
curl -X POST http://localhost:5000/api/members/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "loginEmail": "test@example.com",
    "password": "password123",
    "phoneNumber": "1234567890"
  }'
```

#### **C. Member Login API**
```bash
curl -X POST http://localhost:5000/api/members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### **5. Firebase Integration Test**

#### **A. Firebase Configuration**
1. **Check browser console**: No Firebase configuration errors
2. **Verify environment variables**: All Firebase config should be loaded
3. **Test Firebase Auth**: Registration and login should work

#### **B. Firestore Integration**
1. **User profiles**: Should be created in Firestore
2. **Data synchronization**: Backend and Firebase should be in sync

### **6. Phone Authentication Comprehensive Test**

#### **A. Phone Number Normalization**
1. **Test various input formats**:
   - `1234567890` → Should normalize to `+11234567890`
   - `(123) 456-7890` → Should normalize to `+11234567890`
   - `123-456-7890` → Should normalize to `+11234567890`
   - `+1 123 456 7890` → Should normalize to `+11234567890`
2. **Test invalid formats**:
   - `123456789` (too short) → Should show validation error
   - `12345678901` (too long) → Should show validation error
   - `abcd567890` (letters) → Should show validation error

#### **B. reCAPTCHA Integration**
1. **Development mode testing**:
   - **Localhost/127.0.0.1**: Should auto-bypass reCAPTCHA
   - **Console logs**: Should show "Development mode - bypassing reCAPTCHA"
2. **Test phone number bypass**:
   - **+1234567890**: Should bypass reCAPTCHA completely
   - **+15551234567**: Should bypass reCAPTCHA completely
   - **UI message**: Should show "Test phone number detected"
3. **Production reCAPTCHA**:
   - **Regular numbers**: Should use invisible reCAPTCHA
   - **Auto-solve**: Should automatically solve without user interaction
   - **Error suppression**: Should not show "Timeout (h)" errors

#### **C. OTP Verification Flow**
1. **Successful OTP**:
   - **Send OTP**: Should receive confirmation result
   - **Enter valid OTP**: Should authenticate successfully
   - **Redirect**: Should go to dashboard
2. **Invalid OTP scenarios**:
   - **Wrong code**: Should show "Invalid verification code"
   - **Expired code**: Should show "Verification code has expired"
   - **Empty code**: Should show "Please enter the OTP"
3. **Try Again functionality**:
   - **Click Try Again**: Should reset OTP form
   - **Clear errors**: Should remove error messages
   - **Reset state**: Should allow new OTP request

#### **D. Error Recovery**
1. **Session timeout**:
   - **Wait for session expiry**: Should show appropriate message
   - **Request new OTP**: Should work after timeout
2. **Network interruption**:
   - **Disconnect network**: Should handle gracefully
   - **Reconnect**: Should allow retry
3. **Firebase errors**:
   - **Too many requests**: Should show rate limit message
   - **Service unavailable**: Should show service error message

### **7. Error Handling Test**

#### **A. Email Authentication Errors**
1. **Wrong password**: Try logging in with wrong password
2. **Expected**: Error message displayed
3. **Non-existent email**: Try logging in with non-existent email
4. **Expected**: Error message displayed

#### **B. Phone Authentication Errors**
1. **Invalid phone format**: Try with invalid phone number
2. **Expected**: "Please enter a valid phone number" message
3. **OTP verification errors**:
   - **Invalid OTP**: Should show "Invalid verification code"
   - **Expired session**: Should show "Verification session expired"
   - **Too many attempts**: Should show "Too many failed attempts"
4. **reCAPTCHA errors**: Should be suppressed in development mode

#### **C. Network Errors**
1. **Backend offline**: Stop backend server
2. **Try registration**: Should show appropriate error
3. **Try email login**: Should show appropriate error
4. **Try phone login**: Should show appropriate error

#### **D. Validation Errors**
1. **Invalid email format**: Try registration with invalid email
2. **Weak password**: Try registration with short password
3. **Missing required fields**: Try submitting incomplete forms
4. **Invalid phone format**: Try registration with invalid phone number

### **8. Multilingual Test**

#### **A. Language Switching**
1. **Switch to Tigrigna**: Click Tigrigna button
2. **Verify translations**: All text should change to Tigrigna
3. **Switch back to English**: Click English button
4. **Verify translations**: All text should change to English

#### **B. Form Validation Messages**
1. **Test in English**: Error messages should be in English
2. **Test in Tigrigna**: Error messages should be in Tigrigna

### **9. Responsive Design Test**

#### **A. Mobile View**
1. **Open DevTools**: Set to mobile viewport
2. **Test navigation**: All buttons should be accessible
3. **Test forms**: Registration and login forms should be usable
4. **Test dashboard**: Cards should stack properly

#### **B. Tablet View**
1. **Set viewport**: To tablet size
2. **Verify layout**: Should be optimized for tablet
3. **Test interactions**: All features should work

#### **C. Desktop View**
1. **Full screen**: Test on desktop viewport
2. **Verify layout**: Should use full width effectively
3. **Test hover effects**: Buttons should have hover states

## 🐛 Common Issues & Solutions

### **Issue 1: Firebase Configuration Error**
**Error**: "Firebase: Error (auth/invalid-api-key)"
**Solution**: 
1. Check `.env` file has correct Firebase config
2. Verify Firebase project is set up correctly
3. Ensure Authentication is enabled in Firebase console

### **Issue 2: Backend Connection Error**
**Error**: "Failed to fetch" or CORS errors
**Solution**:
1. Verify backend is running on port 5000
2. Check `REACT_APP_API_URL` in frontend `.env`
3. Ensure CORS is properly configured

### **Issue 3: Database Connection Error**
**Error**: "Connection refused" or database errors
**Solution**:
1. Check if SQLite file is created: `ls ../backend/database.sqlite`
2. Verify database permissions
3. Restart backend server

### **Issue 4: Authentication State Not Persisting**
**Error**: User logged out after page refresh
**Solution**:
1. Check Firebase Auth persistence settings
2. Verify AuthContext is properly wrapped
3. Check browser console for errors

### **Issue 5: Protected Route Not Working**
**Error**: Can access dashboard without authentication
**Solution**:
1. Verify ProtectedRoute component is used
2. Check AuthContext is providing correct state
3. Ensure routes are properly configured

## 📊 Test Results Template

```
Test Date: ___________
Tester: ___________

✅ Basic Navigation: _____
✅ User Registration: _____
✅ Email Login: _____
✅ Phone Login: _____
✅ Phone Number Formatting: _____
✅ reCAPTCHA Integration: _____
✅ OTP Verification: _____
✅ Password Reset: _____
✅ User Logout: _____
✅ Protected Routes: _____
✅ Dashboard Features: _____
✅ API Integration: _____
✅ Firebase Integration: _____
✅ Phone Auth Comprehensive: _____
✅ Error Handling: _____
✅ Multilingual Support: _____
✅ Responsive Design: _____

Issues Found:
1. ________________________________
2. ________________________________
3. ________________________________

Notes:
________________________________
________________________________
```

## 🚀 Next Steps After Testing

1. **Set up real Firebase project** (see `../frontend/FIREBASE_SETUP.md`)
2. **Configure production environment variables**
3. **Set up PostgreSQL database for production**
4. **Deploy to hosting platform**
5. **Set up monitoring and analytics**

## 🔧 Development Commands

```bash
# Start backend
cd ../backend && npm run dev

# Start frontend
cd ../frontend && npm start

# Test backend health
curl http://localhost:5000/health

# Check database
ls ../backend/database.sqlite
```

---

**Remember**: This is a development setup. For production, you'll need to:
- Set up a real Firebase project
- Use proper environment variables
- Set up a production database
- Configure proper security rules
- Enable HTTPS 