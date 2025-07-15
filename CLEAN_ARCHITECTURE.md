# Clean Architecture: Firebase Auth + PostgreSQL Only

## **Overview**

This system now uses a **clean, single source of truth architecture**:

- **Firebase Authentication**: Handles user login/logout
- **PostgreSQL Database**: Stores all member data and roles
- **No Firestore**: Eliminated to prevent role confusion

## **Authentication Flow**

```
1. User logs in via Firebase Auth
   ↓
2. Frontend gets Firebase user token
   ↓
3. Frontend calls backend API with user email
   ↓
4. Backend looks up user in PostgreSQL by email
   ↓
5. Backend returns PostgreSQL role and member data
   ↓
6. Frontend uses PostgreSQL role for authorization
```

## **Key Benefits**

### ✅ **Single Source of Truth**
- All member data stored in PostgreSQL
- No more role confusion between systems
- Consistent data across the application

### ✅ **Clear Separation of Concerns**
- **Firebase Auth**: Authentication only
- **PostgreSQL**: All business data and roles
- **Backend API**: Bridge between systems

### ✅ **Simplified Maintenance**
- No more syncing between Firestore and PostgreSQL
- Clear data flow
- Easier debugging

## **Data Flow**

### **User Registration**
1. User creates Firebase Auth account
2. User completes registration via backend API
3. Backend creates member record in PostgreSQL
4. Firebase UID is stored in PostgreSQL for linking

### **User Login**
1. User logs in via Firebase Auth
2. Frontend calls backend API with user email
3. Backend returns PostgreSQL member data and role
4. Frontend uses PostgreSQL role for permissions

### **Role Management**
- Roles are managed entirely in PostgreSQL
- Admin can update roles via backend API
- No Firestore role storage

## **API Endpoints**

### **Authentication**
- `GET /api/members/profile/firebase/:uid` - Get member profile
- `PUT /api/members/profile/firebase/:uid` - Update member profile

### **Role Management**
- `PATCH /api/members/:id/role` - Update member role (admin only)

### **Member Management**
- `GET /api/members/all/firebase` - Get all members (admin)
- `PUT /api/members/:id` - Update member (admin)

## **Frontend Changes**

### **AuthContext**
- Removed all Firestore dependencies
- Uses backend API for profile data
- Falls back to Firebase Auth data if backend unavailable

### **Role Handling**
- Always uses PostgreSQL roles from backend
- No more Firestore role confusion
- Clear permission system

## **Backend Changes**

### **Firebase Middleware**
- Updated to use PostgreSQL roles
- Links Firebase UID to PostgreSQL member
- Handles both email and loginEmail fields

### **Profile Endpoints**
- Enhanced to properly link Firebase UID
- Returns complete PostgreSQL member data
- Includes role information

## **Migration Steps**

1. ✅ **Updated Frontend AuthContext** - Removed Firestore
2. ✅ **Updated Backend Profile Endpoints** - Enhanced linking
3. ✅ **Updated Firebase Middleware** - Uses PostgreSQL roles
4. ✅ **Removed Firestore Dependencies** - Clean architecture

## **Testing**

### **Verify Role System**
```bash
# Check your role in PostgreSQL
node test-role-fix.js

# Should show: role: 'admin'
```

### **Test Frontend**
1. Log out and log back in
2. Check browser console for role information
3. Should show PostgreSQL role, not Firestore role

## **Future Considerations**

### **Optional: Remove Firestore Completely**
- Delete Firestore database
- Remove Firestore from Firebase project
- Update Firebase configuration

### **Optional: Pure PostgreSQL Auth**
- Remove Firebase Auth entirely
- Use JWT tokens with PostgreSQL
- Simpler but less secure

## **Benefits Achieved**

1. **No More Role Confusion** - Single source of truth
2. **Cleaner Code** - Removed Firestore complexity
3. **Better Performance** - Direct PostgreSQL queries
4. **Easier Debugging** - Clear data flow
5. **Simplified Maintenance** - One database to manage

## **Architecture Diagram**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   PostgreSQL    │
│                 │    │                 │    │                 │
│ Firebase Auth   │───▶│ Firebase Middle │───▶│ Member Data     │
│ (Login/Logout)  │    │ (Role Check)    │    │ (Single Source) │
│                 │    │                 │    │                 │
│ Backend API     │◀───│ Profile Endpts  │◀───│ Role Management │
│ (Get Profile)   │    │ (Get/Update)    │    │ (Admin/Member)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

This architecture eliminates confusion and provides a clean, maintainable system. 