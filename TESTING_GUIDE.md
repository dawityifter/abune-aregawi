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

#### **A. User Registration**
1. **Navigate to registration**: Click "Register Member" or go to `/register`
2. **Fill out the form**:
   - Personal Information (Step 1)
   - Contact & Address (Step 2)
   - Family Information (Step 3)
   - Spiritual Information (Step 4)
   - Contribution & Giving (Step 5)
   - Account Information (Step 6)
3. **Submit registration**: Should create both Firebase Auth account and backend member record
4. **Verify redirect**: Should redirect to dashboard after successful registration

#### **B. User Login**
1. **Navigate to login**: Click "Sign In" or go to `/login`
2. **Enter credentials**: Use the email and password from registration
3. **Submit login**: Should authenticate and redirect to dashboard
4. **Verify authentication state**: User should remain logged in

#### **C. Password Reset**
1. **On login page**: Click "Forgot Password?"
2. **Enter email**: Use registered email address
3. **Submit**: Should send reset email (check console for Firebase messages)
4. **Return to login**: Click "Back to Login"

#### **D. User Logout**
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

### **6. Error Handling Test**

#### **A. Invalid Credentials**
1. **Wrong password**: Try logging in with wrong password
2. **Expected**: Error message displayed
3. **Non-existent email**: Try logging in with non-existent email
4. **Expected**: Error message displayed

#### **B. Network Errors**
1. **Backend offline**: Stop backend server
2. **Try registration**: Should show appropriate error
3. **Try login**: Should show appropriate error

#### **C. Validation Errors**
1. **Invalid email format**: Try registration with invalid email
2. **Weak password**: Try registration with short password
3. **Missing required fields**: Try submitting incomplete forms

### **7. Multilingual Test**

#### **A. Language Switching**
1. **Switch to Tigrigna**: Click Tigrigna button
2. **Verify translations**: All text should change to Tigrigna
3. **Switch back to English**: Click English button
4. **Verify translations**: All text should change to English

#### **B. Form Validation Messages**
1. **Test in English**: Error messages should be in English
2. **Test in Tigrigna**: Error messages should be in Tigrigna

### **8. Responsive Design Test**

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
1. Check if SQLite file is created: `ls backend/database.sqlite`
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
✅ User Login: _____
✅ Password Reset: _____
✅ User Logout: _____
✅ Protected Routes: _____
✅ Dashboard Features: _____
✅ API Integration: _____
✅ Firebase Integration: _____
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

1. **Set up real Firebase project** (see `FIREBASE_SETUP.md`)
2. **Configure production environment variables**
3. **Set up PostgreSQL database for production**
4. **Deploy to hosting platform**
5. **Set up monitoring and analytics**

## 🔧 Development Commands

```bash
# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm start

# Test backend health
curl http://localhost:5000/health

# Check database
ls backend/database.sqlite
```

---

**Remember**: This is a development setup. For production, you'll need to:
- Set up a real Firebase project
- Use proper environment variables
- Set up a production database
- Configure proper security rules
- Enable HTTPS 