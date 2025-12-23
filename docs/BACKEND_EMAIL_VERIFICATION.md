# Backend Email Handling Verification

## Current Backend Implementation

### Location: `../backend/src/controllers/donationController.js`

The backend **already has** default email logic at line 48:
```javascript
donor_email = 'abunearegawitx@gmail.com'
```

This means when the frontend doesn't send `donor_email`, the backend automatically uses the default church email.

---

## ⚠️ POTENTIAL ISSUE: Member Email Lookup Missing

### Current Flow:
1. Frontend sends payment data with optional `donor_email`
2. Backend uses `donor_email` from request OR defaults to `'abunearegawitx@gmail.com'`
3. Backend looks up member by email/phone (lines 66-79) but **doesn't fetch member's email to use it**

### Problem Scenario:
**If treasurer:**
- Selects a member who has email `john@example.com` in database
- Doesn't enter email in the Email Address field
- Frontend sends NO donor_email (empty)

**Current backend behavior:**
- Receives no `donor_email`
- Uses default: `'abunearegawitx@gmail.com'`
- ❌ **Does NOT look up and use member's actual email `john@example.com`**

---

## Required Backend Fix

You need to add logic to look up the member's email when:
1. Frontend doesn't provide `donor_email`
2. Frontend provides `memberId` in metadata
3. Member exists in database with a valid email

### Recommended Code Changes

**File:** `../backend/src/controllers/donationController.js`

**Current code (line 40-53):**
```javascript
const {
  amount,
  currency = 'usd',
  donation_type,
  frequency,
  payment_method,
  donor_first_name,
  donor_last_name,
  donor_email = 'abunearegawitx@gmail.com',  // ← Always defaults
  donor_phone,
  donor_address,
  donor_zip_code,
  metadata = {}
} = req.body;
```

**Should be changed to:**
```javascript
const {
  amount,
  currency = 'usd',
  donation_type,
  frequency,
  payment_method,
  donor_first_name,
  donor_last_name,
  donor_email,  // ← Don't default here yet
  donor_phone,
  donor_address,
  donor_zip_code,
  metadata = {}
} = req.body;

// Determine final email to use
let finalEmail = donor_email;

// If no email provided and we have a memberId, look up member's email
if (!finalEmail && metadata.memberId) {
  try {
    const member = await Member.findByPk(metadata.memberId);
    if (member && member.email && member.email !== '') {
      finalEmail = member.email;
      console.log(`📧 Using member's email from database: ${finalEmail}`);
    }
  } catch (err) {
    console.warn('⚠️ Failed to lookup member email:', err.message);
  }
}

// If still no email, use default church email
if (!finalEmail || finalEmail === '') {
  finalEmail = 'abunearegawitx@gmail.com';
  console.log('📧 Using default church email');
}
```

Then update all references from `donor_email` to `finalEmail` in the rest of the function.

---

## Complete Updated Function

```javascript
const createPaymentIntent = async (req, res) => {
  try {
    // Check if Stripe is available
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Payment processing is currently unavailable. Please try again later.'
      });
    }

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      amount,
      currency = 'usd',
      donation_type,
      frequency,
      payment_method,
      donor_first_name,
      donor_last_name,
      donor_email,  // ← No default here
      donor_phone,
      donor_address,
      donor_zip_code,
      metadata = {}
    } = req.body;

    // Determine final email to use (NEW LOGIC)
    let finalEmail = donor_email;

    // If no email provided and we have a memberId, look up member's email
    if (!finalEmail && metadata.memberId) {
      try {
        const member = await Member.findByPk(metadata.memberId);
        if (member && member.email && member.email !== '' && member.email !== 'abunearegawitx@gmail.com') {
          finalEmail = member.email;
          console.log(`📧 Using member's email from database: ${finalEmail} for member ID: ${metadata.memberId}`);
        }
      } catch (err) {
        console.warn('⚠️ Failed to lookup member email:', err.message);
      }
    }

    // If still no email, use default church email
    if (!finalEmail || finalEmail === '') {
      finalEmail = 'abunearegawitx@gmail.com';
      console.log('📧 Using default church email (no member email available)');
    }

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least $1.00'
      });
    }

    // Convert amount to cents for Stripe
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Attempt to find a member by email or phone for metadata linking
    let linkedMember = null;
    try {
      if (finalEmail && finalEmail !== 'abunearegawitx@gmail.com') {
        linkedMember = await Member.findOne({ where: { email: finalEmail } });
      }
      if (!linkedMember && donor_phone) {
        const normalizedPhone = donor_phone.startsWith('+') ? donor_phone : `+${donor_phone}`;
        linkedMember = await Member.findOne({ where: { phone_number: normalizedPhone } });
      }
    } catch (memberErr) {
      console.warn('⚠️ Member lookup failed while creating payment intent:', memberErr.message);
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      payment_method_types: payment_method === 'ach' ? ['us_bank_account'] : ['card'],
      metadata: {
        donation_type,
        frequency: frequency || '',
        payment_method,
        donor_first_name,
        donor_last_name,
        donor_email: finalEmail,  // ← Use finalEmail
        donor_phone: donor_phone || '',
        donor_address: donor_address || '',
        donor_zip_code: donor_zip_code || '',
        memberId: linkedMember ? String(linkedMember.id) : (metadata.memberId || ''),
        firebaseUid: metadata.firebaseUid || '',
        purpose: metadata.purpose || 'donation',
        year: metadata.year || String(new Date().getFullYear()),
        ...metadata
      }
    });

    // Create donation record in database
    const donation = await Donation.create({
      stripe_payment_intent_id: paymentIntent.id,
      amount: amount,
      currency,
      donation_type,
      frequency,
      payment_method,
      status: 'pending',
      donor_first_name,
      donor_last_name,
      donor_email: finalEmail,  // ← Use finalEmail
      donor_phone,
      donor_address,
      donor_zip_code,
      metadata
    });

    res.status(200).json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      donation_id: donation.id
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
};
```

---

## Testing the Backend Changes

### Test 1: Member with Email, Frontend Sends No Email
**Request:**
```json
{
  "amount": 25,
  "donation_type": "one-time",
  "payment_method": "card",
  "donor_first_name": "John",
  "donor_last_name": "Doe",
  "metadata": {
    "memberId": "123",
    "purpose": "tithe"
  }
}
```

**Expected Backend Behavior:**
1. Receives no `donor_email`
2. Finds `metadata.memberId = 123`
3. Looks up Member with ID 123
4. Member has email `john@example.com`
5. Sets `finalEmail = 'john@example.com'`
6. Logs: `📧 Using member's email from database: john@example.com for member ID: 123`
7. Creates payment intent with `john@example.com`

**Backend Log to Check:**
```
📧 Using member's email from database: john@example.com for member ID: 123
```

---

### Test 2: Member Without Email, Frontend Sends No Email
**Request:**
```json
{
  "amount": 30,
  "donation_type": "one-time",
  "payment_method": "card",
  "donor_first_name": "Jane",
  "donor_last_name": "Smith",
  "metadata": {
    "memberId": "456",
    "purpose": "offering"
  }
}
```

**Expected Backend Behavior:**
1. Receives no `donor_email`
2. Finds `metadata.memberId = 456`
3. Looks up Member with ID 456
4. Member has NO email (null or empty)
5. Sets `finalEmail = 'abunearegawitx@gmail.com'`
6. Logs: `📧 Using default church email (no member email available)`
7. Creates payment intent with default email

**Backend Log to Check:**
```
📧 Using default church email (no member email available)
```

---

### Test 3: Frontend Sends Email (Overrides Member Email)
**Request:**
```json
{
  "amount": 50,
  "donation_type": "one-time",
  "payment_method": "card",
  "donor_first_name": "John",
  "donor_last_name": "Doe",
  "donor_email": "newemail@example.com",
  "metadata": {
    "memberId": "123",
    "purpose": "tithe"
  }
}
```

**Expected Backend Behavior:**
1. Receives `donor_email = 'newemail@example.com'`
2. Sets `finalEmail = 'newemail@example.com'` immediately
3. Does NOT look up member email (already provided)
4. Creates payment intent with `newemail@example.com`

**Backend Log to Check:**
No special log (email was provided, used as-is)

---

### Test 4: Anonymous Payment, No Email
**Request:**
```json
{
  "amount": 100,
  "donation_type": "one-time",
  "payment_method": "card",
  "donor_first_name": "Anonymous",
  "donor_last_name": "Donor",
  "metadata": {
    "purpose": "donation"
  }
}
```

**Expected Backend Behavior:**
1. Receives no `donor_email`
2. No `memberId` in metadata
3. Sets `finalEmail = 'abunearegawitx@gmail.com'`
4. Logs: `📧 Using default church email (no member email available)`
5. Creates payment intent with default email

---

## Backend Validation Routes Update

The validation in `donationRoutes.js` is already correct:

```javascript
body('donor_email')
  .customSanitizer((value) => {
    // Convert empty strings to undefined so optional() works
    return value === '' ? undefined : value;
  })
  .optional()
  .isEmail()
  .normalizeEmail()
  .withMessage('Valid email is required'),
```

This properly handles:
- ✅ Empty strings → `undefined`
- ✅ Optional field (can be missing)
- ✅ If present, must be valid email

**No changes needed to validation.**

---

## Quick Backend Verification Checklist

Before testing frontend changes:

- [ ] Update `createPaymentIntent` function in `donationController.js`
- [ ] Add member email lookup logic when no email provided
- [ ] Add logging for which email source is used
- [ ] Test with member that has email
- [ ] Test with member without email
- [ ] Test with provided email (should override)
- [ ] Test anonymous payment (no member)
- [ ] Verify logs show correct email source
- [ ] Check Stripe dashboard shows correct emails
- [ ] Verify donation records have correct emails

---

## Implementation Steps

1. **Update Backend First**
   ```bash
   cd ../backend/src/controllers
   # Edit donationController.js with changes above
   ```

2. **Restart Backend Server**
   ```bash
   npm run dev
   ```

3. **Test Backend Directly with Postman/curl**
   ```bash
   # Test with no email, with memberId
   curl -X POST http://localhost:5000/api/donations/create-payment-intent \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 25,
       "donation_type": "one-time",
       "payment_method": "card",
       "donor_first_name": "Test",
       "donor_last_name": "User",
       "metadata": {"memberId": "1"}
     }'
   ```

4. **Verify Logs**
   Check backend console for:
   - `📧 Using member's email from database: ...` OR
   - `📧 Using default church email (no member email available)`

5. **Test Frontend**
   Only after backend is verified working

---

## Summary

**Current State:**
- ✅ Backend has default email fallback
- ❌ Backend does NOT look up member's email from database

**Required Change:**
- Add member email lookup when:
  - Frontend doesn't provide email
  - Metadata contains memberId
  - Member has valid email in database

**Priority:** 
⚠️ **HIGH** - Must be fixed before frontend changes are fully functional

Without this backend change, member emails won't be used even when they exist in the database.
