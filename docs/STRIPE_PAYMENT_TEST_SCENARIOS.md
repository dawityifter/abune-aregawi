# Stripe Payment Email Testing - Test Scenarios

## Test Environment Setup

### Prerequisites
- [ ] Backend using Stripe test keys (`sk_test_...`)
- [ ] Frontend using Stripe test publishable key (`pk_test_...`)
- [ ] Test members created with different email configurations
- [ ] Access to Stripe Dashboard test mode: **https://dashboard.stripe.com/test**

### Test Members Setup
Create these test members in your database:

1. **Member A** - Has valid email
   - Name: John Doe
   - Email: `john.test@example.com`
   - Phone: (555) 123-4567

2. **Member B** - No email (empty/null)
   - Name: Jane Smith
   - Email: `null` or empty string
   - Phone: (555) 987-6543

3. **Member C** - Has default church email
   - Name: Bob Wilson
   - Email: `abunearegawitx@gmail.com`
   - Phone: (555) 555-5555

### Stripe Test Dashboard Quick Access

**Important Links:**
- **Main Dashboard**: https://dashboard.stripe.com/test
- **Payments List**: https://dashboard.stripe.com/test/payments
- **Customers**: https://dashboard.stripe.com/test/customers
- **Logs**: https://dashboard.stripe.com/test/logs

💡 **Tip**: Keep the Stripe test dashboard open in a separate tab while testing to immediately verify each payment.

---

## Test Scenarios

### ✅ Test 1: Member WITH Email - Email Field Empty - Credit Card
**Steps:**
1. Open Add Payment modal
2. Select "Member A" (john.test@example.com)
3. Amount: $25.00
4. Payment Type: Tithe
5. Payment Method: Debit/Credit Card
6. **DO NOT** enter anything in Email Address field
7. Fill card details: 4242 4242 4242 4242, any future date, any CVC
8. Submit payment

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend logs show member email used: `john.test@example.com`
- [ ] Stripe Dashboard shows payment with email: `john.test@example.com`
- [ ] Transaction record created with correct member_id
- [ ] No errors in console

**Verification:**
- Check Stripe Dashboard (https://dashboard.stripe.com/test/payments) → Latest payment → Receipt email
- Check backend logs for email used in payment intent
- Verify transaction in database has correct member association

---

### ✅ Test 2: Member WITH Email - Email Field Empty - ACH
**Steps:**
1. Open Add Payment modal
2. Select "Member A" (john.test@example.com)
3. Amount: $30.00
4. Payment Type: Building Fund
5. Payment Method: ACH
6. **DO NOT** enter anything in Email Address field (if shown)
7. Fill bank details: Routing 110000000, Account 000123456789
8. Submit payment

**Expected Results:**
- [ ] Payment processes successfully (status: processing)
- [ ] Backend uses member email: `john.test@example.com`
- [ ] Stripe Dashboard shows ACH payment with correct email
- [ ] Transaction record created

---

### ✅ Test 3: Member WITHOUT Email - Email Field Empty - Credit Card
**Steps:**
1. Open Add Payment modal
2. Select "Member B" (no email)
3. Amount: $50.00
4. Payment Type: Offering
5. Payment Method: Debit/Credit Card
6. Email Address field should be empty
7. **DO NOT** enter email
8. Fill card details: 4242 4242 4242 4242
9. Submit payment

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend applies default email: `abunearegawitx@gmail.com`
- [ ] Stripe Dashboard shows payment with default church email
- [ ] Transaction record created with correct member_id
- [ ] Backend logs show "No member email, using default"

**Critical:** Backend MUST handle this - verify backend code adds default email

---

### ✅ Test 4: Member WITHOUT Email - Email Field Empty - ACH
**Steps:**
1. Open Add Payment modal
2. Select "Member B" (no email)
3. Amount: $75.00
4. Payment Type: Donation
5. Payment Method: ACH
6. **DO NOT** enter email
7. Fill bank details
8. Submit payment

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend applies default email: `abunearegawitx@gmail.com`
- [ ] Stripe Dashboard shows ACH with default email
- [ ] Transaction record created

---

### ✅ Test 5: Member WITH Email - User ENTERS Different Email - Credit Card
**Steps:**
1. Open Add Payment modal
2. Select "Member A" (john.test@example.com)
3. Amount: $100.00
4. Payment Type: Tithe
5. Payment Method: Debit/Credit Card
6. **ENTER** email: `newemail.test@example.com`
7. Fill card details: 4242 4242 4242 4242
8. Submit payment

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend receives and uses: `newemail.test@example.com`
- [ ] Stripe receipt goes to: `newemail.test@example.com`
- [ ] Transaction metadata shows `email_manually_entered: true`
- [ ] Original member email NOT used

---

### ✅ Test 6: Member WITH Email - User ENTERS Different Email - ACH
**Steps:**
1. Same as Test 5 but with ACH payment method
2. Use different test email: `treasurer.test@example.com`
3. Amount: $125.00

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend uses provided email: `treasurer.test@example.com`
- [ ] Original member email ignored

---

### ✅ Test 7: Member WITHOUT Email - User ENTERS Email - Credit Card
**Steps:**
1. Open Add Payment modal
2. Select "Member B" (no email)
3. Amount: $150.00
4. Payment Type: Vow
5. Payment Method: Debit/Credit Card
6. **ENTER** email: `treasurer.provided@example.com`
7. Fill card details: 4242 4242 4242 4242
8. Submit payment

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend uses provided email: `treasurer.provided@example.com`
- [ ] Default email NOT used
- [ ] Transaction metadata shows `email_manually_entered: true`

---

### ✅ Test 8: Anonymous Payment - No Email Entered - Credit Card
**Steps:**
1. Open Add Payment modal
2. Select "Anonymous / Non-Member Payment"
3. Donor Type: Individual
4. Leave Donor Name and Email empty
5. Amount: $200.00
6. Payment Type: Donation
7. Payment Method: Debit/Credit Card
8. Email field should be empty - DO NOT enter
9. Submit payment

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend applies default email: `abunearegawitx@gmail.com`
- [ ] Transaction created with null member_id
- [ ] donor_type = 'individual'

---

### ✅ Test 9: Anonymous Payment - Email Entered - Credit Card
**Steps:**
1. Open Add Payment modal
2. Select "Anonymous / Non-Member Payment"
3. Donor Name: Anonymous Donor
4. **ENTER** Email: `anonymous.donor@example.com`
5. Amount: $250.00
6. Payment Type: Building Fund
7. Payment Method: Debit/Credit Card
8. Submit payment

**Expected Results:**
- [ ] Payment processes successfully
- [ ] Backend uses: `anonymous.donor@example.com`
- [ ] Transaction created with provided donor_email

---

## Error Scenarios (Should Handle Gracefully)

### ✅ Test 10: Invalid Email Format
**Steps:**
1. Select member
2. Enter invalid email: `notanemail`
3. Try to submit

**Expected Results:**
- [ ] Browser validation catches invalid format
- [ ] Error message shown before submission
- [ ] Payment NOT submitted to Stripe

---

### ✅ Test 11: Declined Card - Member Without Email
**Steps:**
1. Select "Member B" (no email)
2. Payment Method: Credit Card
3. Use declined card: 4000 0000 0000 0002
4. Submit payment

**Expected Results:**
- [ ] Payment fails gracefully
- [ ] Error message shown to user
- [ ] No transaction created
- [ ] Can retry with different card

---

### ✅ Test 12: Requires Authentication - With Email
**Steps:**
1. Select member with email
2. Use card requiring 3D Secure: 4000 0025 0000 3155
3. Complete authentication
4. Submit payment

**Expected Results:**
- [ ] 3D Secure modal appears
- [ ] After auth, payment succeeds
- [ ] Correct email used throughout

---

## Stripe Dashboard Verification

After each test, verify in Stripe Dashboard (**https://dashboard.stripe.com/test/payments**):

1. **Payment Details**
   - [ ] Amount matches
   - [ ] Email matches expected
   - [ ] Metadata includes memberId (if applicable)
   - [ ] Metadata includes purpose

2. **Customer Object**
   - [ ] Customer created/updated with correct email
   - [ ] Phone number included (if available)

3. **Receipt**
   - [ ] Receipt sent to correct email
   - [ ] Check spam folder for test emails

---

## Backend Logs to Monitor

Check your backend logs for each test:

```
✅ "Payment intent created for member ID: XXX"
✅ "Using member email: john.test@example.com" OR
✅ "No member email found, using default: abunearegawitx@gmail.com" OR
✅ "Using provided email: newemail@example.com"
✅ "Transaction recorded successfully"
```

---

## Database Verification

After each test, check your transactions table:

```sql
SELECT 
  id,
  member_id,
  amount,
  payment_method,
  external_id,
  created_at,
  -- Check if any email field is stored
FROM transactions 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Production Readiness Checklist

Before deploying to production:

- [ ] All 12 test scenarios pass
- [ ] Backend correctly handles missing emails
- [ ] Backend correctly handles provided emails
- [ ] Backend correctly applies default email
- [ ] Stripe webhooks handle all payment statuses
- [ ] Error messages are user-friendly
- [ ] Console has no errors
- [ ] Backend logs show correct email logic
- [ ] Test with real staging members
- [ ] Verify email receipts go to correct addresses
- [ ] Test on mobile devices (responsive)
- [ ] Test with slow network (throttle connection)

---

## Common Issues to Watch For

### Issue 1: Backend Not Handling Empty Email
**Symptom:** Payment fails when member has no email
**Solution:** Update backend to check for empty/null email and apply default

### Issue 2: Stripe Receipt Goes to Wrong Email
**Symptom:** Receipt goes to default even when email provided
**Solution:** Verify frontend is actually sending the email in payload

### Issue 3: Email Field Shows "undefined"
**Symptom:** Email field displays "undefined" text
**Solution:** Ensure empty string fallback, not undefined

### Issue 4: Payment Succeeds but Transaction Not Recorded
**Symptom:** Stripe shows payment but database doesn't
**Solution:** Check webhook handling and error logs

---

## Test Tracking Sheet

| Test # | Scenario | Payment Method | Expected Email | Status | Notes |
|--------|----------|---------------|----------------|--------|-------|
| 1 | Member with email, empty field | Card | member email | ⬜ | |
| 2 | Member with email, empty field | ACH | member email | ⬜ | |
| 3 | Member no email, empty field | Card | default | ⬜ | |
| 4 | Member no email, empty field | ACH | default | ⬜ | |
| 5 | Member with email, user enters | Card | user entered | ⬜ | |
| 6 | Member with email, user enters | ACH | user entered | ⬜ | |
| 7 | Member no email, user enters | Card | user entered | ⬜ | |
| 8 | Anonymous, no email | Card | default | ⬜ | |
| 9 | Anonymous, with email | Card | provided | ⬜ | |
| 10 | Invalid email format | Card | N/A - should block | ⬜ | |
| 11 | Declined card, no email | Card | N/A - should fail gracefully | ⬜ | |
| 12 | 3D Secure, with email | Card | member email | ⬜ | |

---

## Next Steps

1. ✅ Create test members in database
2. ✅ Verify backend email handling logic exists
3. ✅ Run all test scenarios systematically
4. ✅ Document any issues found
5. ✅ Fix issues and re-test
6. ✅ Deploy to staging
7. ✅ Final verification in staging
8. ✅ Deploy to production
