# Security & Logging Review

## 🔴 Critical: Sensitive Information Being Logged

### **Summary**
Multiple backend files are logging sensitive personal information that should be suppressed or redacted in production.

---

## 📋 Sensitive Data Found in Logs

### **1. Authentication Middleware (`middleware/auth.js`)**

**Lines 172, 179, 185-187, 200, 218, 234:**
```javascript
// PROBLEM: Logs email and phone in plain text
console.log('📞 Got phone number from user profile');
console.log('   - Email:', userEmail || 'Not provided');
console.log('   - Phone:', userPhone || 'Not provided');
console.log(`🔍 Searching for member by email: ${userEmail}`);
console.log(`🔍 Searching for member by phone: ${normalizedPhone}`);
console.log('❌ Member not found for:', { email: userEmail, phone: userPhone });
```

**Risk:** High - Authentication logs contain PII on every request

---

### **2. Member Controller (`controllers/memberController.js`)**

**Lines 936-942, 966-967, 981, 1041:**
```javascript
// PROBLEM: Debug logs expose full request details
console.log('🔍 Request user:', req.user);
console.log('🔍 Request query:', req.query);
console.log('🔍 Final response:', JSON.stringify(response, null, 2));
```

**Lines 1206-1207, 1227-1232, 1275, 1320, 1467:**
```javascript
// PROBLEM: Profile endpoints log email, phone, addresses
console.log('🔍 getProfileByFirebaseUid called:', { uid, userEmail, userPhone });
console.log('✅ Found member by Firebase UID:', { 
  id: memberByUid.id, 
  email: memberByUid.email, 
  phoneNumber: memberByUid.phone_number,
  firebaseUid: memberByUid.firebase_uid 
});
console.log('📤 Response status: 200, data:', { 
  memberId: memberByUid.id, 
  email: memberByUid.email, 
  phone: memberByUid.phone_number 
});
```

**Risk:** High - Every profile fetch logs PII

---

### **3. Database Scripts (One-time use)**

**Files:** `database/countMembers.js`, `database/importMembersPayments.js`, `database/dryRunImportMembers.js`

**Risk:** Medium - These are admin scripts, not production code, but should still be careful

---

## ✅ Recommendations

### **Priority 1: Remove/Redact in Production**

1. **Create a utility function for safe logging:**
```javascript
// utils/logger.js
const isProd = process.env.NODE_ENV === 'production';

function redactSensitive(data) {
  if (!data) return data;
  const redacted = { ...data };
  
  // Redact email
  if (redacted.email) {
    const [local, domain] = redacted.email.split('@');
    redacted.email = `${local.substring(0, 2)}***@${domain}`;
  }
  
  // Redact phone
  if (redacted.phone || redacted.phoneNumber) {
    const phone = redacted.phone || redacted.phoneNumber;
    redacted.phone = `***${phone.slice(-4)}`;
    redacted.phoneNumber = `***${phone.slice(-4)}`;
  }
  
  // Remove address fields
  delete redacted.streetLine1;
  delete redacted.city;
  delete redacted.state;
  delete redacted.postalCode;
  delete redacted.address;
  
  return redacted;
}

module.exports = {
  logInfo: (message, data) => {
    if (isProd && data) {
      console.log(message, redactSensitive(data));
    } else {
      console.log(message, data);
    }
  },
  logError: (message, error) => {
    console.error(message, error.message || error);
  }
};
```

2. **Replace sensitive console.log statements**

3. **Keep only essential logs:**
   - Request IDs
   - Operation types
   - Success/failure status
   - Error messages (without PII)

### **Priority 2: Suppress Debug Logs in Production**

Remove or guard these with `if (!isProd)`:
- `🔍 getAllMembersFirebase called`
- `🔍 Request user:`, `🔍 Request query:`
- `🔍 Where clause:`, `🔍 Parsed params:`
- `🔍 Final response:` (contains all member data!)

### **Priority 3: Keep Safe Logs**

These are OK to keep:
- Error counts and types
- Operation success/failure
- Performance metrics
- Request counts

---

## 🎯 Specific Files to Update

### **High Priority:**
1. ✅ `middleware/auth.js` - Lines 172-234
2. ✅ `controllers/memberController.js` - Lines 936-1041, 1206-1467
3. ✅ `controllers/transactionController.js` - Check for similar patterns

### **Medium Priority:**
4. Database scripts (used by admins, but still good practice)

### **Low Priority:**
5. Other controllers - Review for similar patterns

---

## 🔒 Production Best Practices

1. **Never log:**
   - Full email addresses
   - Phone numbers
   - Physical addresses
   - API tokens/secrets
   - Full user objects

2. **Use log levels:**
   - ERROR: For exceptions only
   - WARN: For recoverable issues
   - INFO: For key business events (redacted)
   - DEBUG: Disabled in production

3. **Use structured logging:**
   - Request ID tracking
   - User ID (not email/phone)
   - Operation type
   - Timestamp
   - Success/error status

---

## 📝 Action Items

- [ ] Create `utils/logger.js` with redaction
- [ ] Update `middleware/auth.js` 
- [ ] Update `controllers/memberController.js`
- [ ] Add environment check for debug logs
- [ ] Test that errors still log properly
- [ ] Document logging guidelines for team

---

**Status:** Awaiting implementation approval
