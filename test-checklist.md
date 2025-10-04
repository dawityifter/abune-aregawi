# Income GL Codes - Testing Checklist

**Date:** October 3, 2025  
**Tester:** ___________  
**Environment:** Local Development

---

## 🎯 Critical Tests (Must Pass)

### Backend Tests
- [ ] `curl http://localhost:5001/health` → Returns "OK"
- [ ] `curl http://localhost:5001/api/income-categories` → Returns 9 categories
- [ ] Database has 9 income categories (all active)

### Frontend - Income Category Auto-Assignment
- [ ] Open Add Payment modal
- [ ] Income Category field appears (between Payment Type and Payment Method)
- [ ] Field is READ-ONLY (gray background, not clickable)
- [ ] Select "Membership Fee" → Shows "INC001 - Membership"
- [ ] Select "Tithe" → Shows "INC002 - Weekly Offering"
- [ ] Select "Building Fund" → Shows "INC003 - Fundraising"
- [ ] Select "Vow" → Shows "INC008 - Vow (Selet) & Tselot"
- [ ] Select "Offering" → Shows "INC002 - Weekly Offering"
- [ ] Select "Other Donation" → Shows "INC004 - Special Donation"

### Frontend - Transaction Creation
- [ ] Create Membership transaction → Success
- [ ] Create Vow transaction → Success (no enum error!)
- [ ] Create Tithe transaction → Success
- [ ] Create Building Fund transaction → Success

### Frontend - Transaction List
- [ ] GL Code column exists
- [ ] GL Code column positioned between "Type" and "Method"
- [ ] GL codes display correctly (two-line: code + name)
- [ ] Test transactions show correct GL codes

### Browser Console
- [ ] No red errors in console
- [ ] No API failures in network tab
- [ ] POST requests include `income_category_id`

---

## 🔄 Regression Tests (Existing Features)

- [ ] Can login successfully
- [ ] Can view member list
- [ ] Can create regular payment (cash)
- [ ] Dashboard statistics display correctly
- [ ] Transaction list loads and displays
- [ ] Search/filter works

---

## 🐛 Issues Found

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 |       |          |        |
| 2 |       |          |        |
| 3 |       |          |        |

---

## ✅ Test Result

**Overall Status:** [ ] Pass / [ ] Fail

**Notes:**
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

**Ready to Push?** [ ] Yes / [ ] No

---

## 📸 Screenshots

Attach screenshots of:
1. Add Payment modal showing read-only GL code field
2. Transaction list with GL Code column
3. Browser console (no errors)
4. Network tab showing successful API calls

---

**Tested By:** ___________  
**Date:** ___________  
**Time:** ___________
