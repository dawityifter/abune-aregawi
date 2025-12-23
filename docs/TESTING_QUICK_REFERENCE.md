# Payment Email Testing - Quick Reference Card

## 🎯 What Changed

### Frontend Changes
✅ Email Address field now shows **EMPTY** by default
✅ Only sends email to backend if user enters one
✅ No longer sends default church email

### Backend Requirement
⚠️ **MUST UPDATE** - Backend must look up member's email when not provided

---

## 🔧 Setup Before Testing

### 1. Update Backend Code
📁 File: `../backend/src/controllers/donationController.js`

Add member email lookup (see BACKEND_EMAIL_VERIFICATION.md for full code)

### 2. Restart Backend
```bash
cd backend
npm run dev
```

### 3. Use Stripe Test Mode
- Test publishable key: `pk_test_...`
- Test secret key: `sk_test_...`
- **Stripe Test Dashboard**: https://dashboard.stripe.com/test
- **Payments**: https://dashboard.stripe.com/test/payments

### 4. Test Cards
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`

---

## 🧪 Critical Test Scenarios (Must Pass)

| # | Member Email | User Enters | Expected Result |
|---|-------------|-------------|-----------------|
| 1 | ✅ Has email | ❌ Empty | Use member's email |
| 2 | ❌ No email | ❌ Empty | Use default church email |
| 3 | ✅ Has email | ✅ Enters | Use entered email |
| 4 | ❌ No email | ✅ Enters | Use entered email |

---

## 📋 Test Checklist

### Before Frontend Testing
- [ ] Backend updated with email lookup logic
- [ ] Backend restarted
- [ ] Backend logs working
- [ ] Test with Postman/curl first

### Frontend Testing
- [ ] Test Scenario 1 - Card
- [ ] Test Scenario 1 - ACH
- [ ] Test Scenario 2 - Card
- [ ] Test Scenario 2 - ACH
- [ ] Test Scenario 3 - Card
- [ ] Test Scenario 4 - Card
- [ ] Anonymous payment - no email
- [ ] Anonymous payment - with email

### Verification
- [ ] Check backend logs for email source
- [ ] Check Stripe Dashboard for correct email
- [ ] Verify receipts go to correct address
- [ ] Test email receipt delivery
- [ ] Check database donation records

---

## 🔍 What to Look For

### Backend Logs
```bash
# Should see one of these for each payment:
📧 Using member's email from database: john@example.com for member ID: 123
📧 Using default church email (no member email available)
```

### Stripe Dashboard
- Go to: https://dashboard.stripe.com/test/payments
- Click: Latest Payment
- Check: Receipt email field
- Verify: Matches expected email

### Browser Console
- No errors about email
- Payment completes successfully
- Transaction recorded

---

## 🚨 Common Issues

### Issue: Payment uses default even when member has email
**Cause:** Backend not updated
**Fix:** Implement member email lookup in backend

### Issue: "Email required" error
**Cause:** Frontend sending empty string
**Fix:** Ensure frontend sends `undefined` or omits field

### Issue: Email field shows "undefined"
**Cause:** React state issue
**Fix:** Already fixed - email initialized as empty string `''`

---

## 📊 Test Matrix

Download full test scenarios: `STRIPE_PAYMENT_TEST_SCENARIOS.md`

---

## 🎬 Quick Test Flow

1. **Start Backend** → Check logs running
2. **Open Frontend** → Add Payment modal
3. **Select Member with Email** → Leave email empty
4. **Enter Amount** → $25.00
5. **Select Payment Type** → Tithe
6. **Select Method** → Credit Card
7. **Fill Card** → 4242 4242 4242 4242
8. **Submit** → Watch backend logs
9. **Verify Log** → `📧 Using member's email from database`
10. **Check Stripe** → Confirm correct email

---

## 📝 Backend Update Priority

**CRITICAL:** Backend must be updated FIRST before frontend changes work correctly.

Without backend update:
- ❌ Member emails won't be used
- ❌ Always defaults to church email
- ❌ Defeats purpose of frontend change

With backend update:
- ✅ Member emails used when available
- ✅ Default email only when needed
- ✅ User-entered emails respected

---

## 🎯 Success Criteria

All tests pass when:
- ✅ Member email used from database when available
- ✅ Default email used only when member has no email
- ✅ User-entered email always takes priority
- ✅ No console errors
- ✅ Stripe receipts go to correct email
- ✅ Transactions recorded properly
- ✅ Backend logs show correct email source

---

## 📚 Documentation Files

1. **STRIPE_PAYMENT_TEST_SCENARIOS.md** - Full test plan with 12 scenarios
2. **BACKEND_EMAIL_VERIFICATION.md** - Backend code changes required
3. **TESTING_QUICK_REFERENCE.md** - This file (quick reference)

---

## 🚀 Production Deployment

Only deploy to production after:
- [ ] All 12 test scenarios pass
- [ ] Backend updated and tested
- [ ] Staging environment tested
- [ ] Email receipts verified
- [ ] No console errors
- [ ] Database transactions verified
- [ ] Team approval

---

## 💡 Pro Tips

1. **Test in order** - Backend first, then frontend
2. **Check logs** - Backend logs tell you which email was used
3. **Verify in Stripe** - Always check Stripe Dashboard
4. **Test email delivery** - Use real test emails to verify receipts
5. **Document issues** - Note any problems for debugging

---

## 📞 Need Help?

If tests fail:
1. Check backend logs for errors
2. Check browser console for frontend errors
3. Verify Stripe test mode is active
4. Confirm backend code was updated
5. Review BACKEND_EMAIL_VERIFICATION.md for code changes

---

## ✅ Ready to Test?

1. ✅ Backend code updated
2. ✅ Backend restarted
3. ✅ Test members created
4. ✅ Stripe test mode active
5. ✅ Documentation reviewed

**START TESTING!** 🎉
