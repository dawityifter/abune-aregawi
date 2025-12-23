# 🔐 Authentication Flow Test Plan

## **Overview**
This document outlines the test scenarios for both authentication flows after OTP verification:
1. **New User**: No backend record → Register flow
2. **Existing User**: Backend record available → Dashboard with profile update capability

## **Scenario 1: New User (No Backend Record)**

### **Test Steps:**
1. **Firebase Authentication**
   - User enters phone number
   - OTP is sent and verified
   - Firebase user is created

2. **Backend Check**
   - Frontend calls `/api/members/profile/firebase/:uid`
   - Backend returns 404 (user not found)
   - Frontend sets user as `_temp: true`

3. **Navigation to Registration**
   - User is redirected to `/register`
   - Registration form is pre-filled with phone/email
   - User completes all registration steps

4. **Registration Submission**
   - Frontend sends data to `/api/members/register`
   - Backend creates member record
   - Frontend shows success message
   - User is redirected to `/dashboard`

### **Expected Results:**
- ✅ User successfully registers
- ✅ Member record created in database
- ✅ User redirected to dashboard
- ✅ User can access all features

## **Scenario 2: Existing User (Backend Record Available)**

### **Test Steps:**
1. **Firebase Authentication**
   - User enters phone number
   - OTP is sent and verified
   - Firebase user is authenticated

2. **Backend Check**
   - Frontend calls `/api/members/profile/firebase/:uid`
   - Backend returns 200 with member data
   - Frontend sets user as `_temp: false`

3. **Navigation to Dashboard**
   - User is redirected to `/dashboard`
   - User sees their profile information
   - User can access all features

4. **Profile Update Capability**
   - User navigates to `/profile`
   - User can edit their information
   - Changes are saved to backend
   - User sees updated information

### **Expected Results:**
- ✅ User successfully logs in
- ✅ User profile loaded from backend
- ✅ User redirected to dashboard
- ✅ User can update profile information

## **Profile Update Flow**

### **Test Steps:**
1. **Access Profile Page**
   - User navigates to `/profile`
   - Profile information is loaded
   - Edit mode is available

2. **Update Profile**
   - User modifies information
   - User clicks "Save"
   - Frontend sends PUT request to `/api/members/profile/firebase/:uid`
   - Backend updates member record

3. **Verify Updates**
   - User sees success message
   - Updated information is displayed
   - Changes persist across sessions

### **Expected Results:**
- ✅ Profile updates work correctly
- ✅ Changes are saved to backend
- ✅ User sees updated information
- ✅ No data loss occurs

## **Error Handling**

### **Test Cases:**
1. **Network Errors**
   - Backend unavailable during auth
   - Network timeout during profile fetch
   - Connection lost during registration

2. **Validation Errors**
   - Invalid phone number format
   - Missing required fields
   - Invalid email format

3. **Authentication Errors**
   - Invalid OTP code
   - Expired OTP code
   - Too many attempts

### **Expected Results:**
- ✅ Appropriate error messages shown
- ✅ User can retry failed operations
- ✅ No infinite loops or crashes
- ✅ Graceful degradation

## **Testing Commands**

### **Frontend Development:**
```bash
cd frontend
npm start
```

### **Backend Development:**
```bash
cd backend
npm start
```

### **Database Check:**
```bash
cd backend
node check-migration-state.js
```

## **Key Endpoints to Test**

### **Authentication:**
- `GET /api/members/profile/firebase/:uid` - Check user profile
- `POST /api/members/register` - Register new user
- `PUT /api/members/profile/firebase/:uid` - Update profile

### **Profile Management:**
- `GET /api/members/profile` - Get current user profile
- `PUT /api/members/profile` - Update current user profile

## **Success Criteria**

### **New User Flow:**
- ✅ OTP verification works
- ✅ Registration form loads correctly
- ✅ All form validation passes
- ✅ Registration creates backend record
- ✅ User is redirected to dashboard
- ✅ User can access all features

### **Existing User Flow:**
- ✅ OTP verification works
- ✅ User profile loads from backend
- ✅ User is redirected to dashboard
- ✅ Profile update functionality works
- ✅ Changes persist correctly

### **Profile Updates:**
- ✅ All profile fields are editable
- ✅ Changes are saved to backend
- ✅ Success/error messages are shown
- ✅ Data integrity is maintained

## **Monitoring & Debugging**

### **Frontend Console Logs:**
- Check for authentication state changes
- Verify profile fetch attempts
- Monitor navigation events
- Look for error messages

### **Backend Logs:**
- Check API request/response logs
- Verify database operations
- Monitor authentication middleware
- Look for validation errors

### **Database Verification:**
- Check member records are created
- Verify profile updates are saved
- Confirm data consistency
- Monitor for orphaned records

## **Common Issues & Solutions**

### **Issue 1: User stuck on registration page**
**Solution**: Check if user already exists in database, clear cache if needed

### **Issue 2: Profile not loading after registration**
**Solution**: Verify backend record creation, check API response format

### **Issue 3: Profile updates not saving**
**Solution**: Check API endpoint permissions, verify request format

### **Issue 4: Navigation loops**
**Solution**: Add proper route guards, check authentication state logic

## **Performance Considerations**

### **Optimizations:**
- Cache user profile data
- Minimize API calls
- Use optimistic updates
- Implement proper loading states

### **Monitoring:**
- Track authentication success rates
- Monitor registration completion rates
- Measure profile update success rates
- Monitor API response times 