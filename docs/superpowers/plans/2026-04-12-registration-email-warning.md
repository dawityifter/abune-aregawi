# Registration Email Duplicate Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Check for duplicate email on blur in step 2 of registration and show an amber warning — never block submission.

**Architecture:** New `GET /api/members/check-email/:email` endpoint follows the existing `checkPhoneExists` pattern. A `warnings` state object in `MemberRegistration` holds the blur result and is passed as a prop to `ContactAddressStep`. The hard 400 duplicate-email block is removed from the `register` controller.

**Tech Stack:** Node/Express, Sequelize, React, TypeScript, Tailwind CSS

---

## Files

| File | Change |
|------|--------|
| `backend/src/controllers/memberController.js` | Add `checkEmailExists`; remove lines 561–573 (duplicate-email 400 block) |
| `backend/src/routes/memberRoutes.js` | Add `GET /check-email/:email` after line 52 |
| `backend/tests/integration/auth.test.js` | Replace "should reject registration with duplicate email" test; add check-email tests |
| `frontend/src/components/auth/MemberRegistration.tsx` | Add `warnings` state, `handleEmailBlur`, clear on change, pass to step |
| `frontend/src/components/auth/RegistrationSteps.tsx` | Update `ContactAddressStep` props: add `warnings`, `onEmailBlur`; wire blur; render warning |

---

### Task 1: Backend — `checkEmailExists` controller + route

**Files:**
- Modify: `backend/src/controllers/memberController.js` (after line 866, after `checkPhoneExists`)
- Modify: `backend/src/routes/memberRoutes.js` (after line 52)

- [ ] **Step 1: Write the failing integration test**

Add a new `describe` block in `backend/tests/integration/auth.test.js`, after the existing `POST /api/members/register` describe block:

```js
describe('GET /api/members/check-email/:email', () => {
  it('returns exists: false for an unknown email', async () => {
    const response = await request(app)
      .get('/api/members/check-email/nobody@unknown.com')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('exists', false);
  });

  it('returns exists: true for a registered email', async () => {
    // testMember was created in the POST /register tests above
    const response = await request(app)
      .get(`/api/members/check-email/${testMember.email}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('exists', true);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL (route not found)**

```bash
cd backend && npx jest tests/integration/auth.test.js --testNamePattern="check-email" -t "check-email" 2>&1 | tail -20
```

Expected: two failures with 404.

- [ ] **Step 3: Add `checkEmailExists` to the controller**

In `backend/src/controllers/memberController.js`, add after the `checkPhoneExists` function (after line 866):

```js
exports.checkEmailExists = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const member = await Member.findOne({ where: { email } });

    return res.status(200).json({
      success: true,
      exists: !!member
    });
  } catch (error) {
    console.error('Error checking email existence:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 4: Register the route**

In `backend/src/routes/memberRoutes.js`, add after line 52 (`router.get('/check-phone/:phoneNumber', ...)`):

```js
router.get('/check-email/:email', memberController.checkEmailExists);
```

- [ ] **Step 5: Run the test — expect PASS**

```bash
cd backend && npx jest tests/integration/auth.test.js --testNamePattern="check-email" 2>&1 | tail -10
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/memberController.js backend/src/routes/memberRoutes.js backend/tests/integration/auth.test.js
git commit -m "feat: add GET /check-email/:email endpoint"
```

---

### Task 2: Backend — remove duplicate-email hard block from `register`

**Files:**
- Modify: `backend/src/controllers/memberController.js` (lines 561–573)
- Modify: `backend/tests/integration/auth.test.js` (update the "reject duplicate email" test)

- [ ] **Step 1: Update the existing test before touching the controller**

In `backend/tests/integration/auth.test.js`, replace the test at line 61:

```js
// OLD:
it('should reject registration with duplicate email', async () => {
  const response = await request(app)
    .post('/api/members/register')
    .send(validMemberData)
    .expect(400);

  expect(response.body).toHaveProperty('success', false);
  expect(response.body.message).toContain('email');
});
```

with:

```js
it('should reject registration with duplicate phone number', async () => {
  const response = await request(app)
    .post('/api/members/register')
    .send(validMemberData)  // same phone number as first registration
    .expect(400);

  expect(response.body).toHaveProperty('success', false);
  expect(response.body.message).toContain('phone');
});
```

- [ ] **Step 2: Run the test — expect FAIL (still blocked by email check)**

```bash
cd backend && npx jest tests/integration/auth.test.js --testNamePattern="duplicate phone" 2>&1 | tail -20
```

Expected: FAIL — the test receives a 400 with `message` containing "email", not "phone".

- [ ] **Step 3: Remove the duplicate-email block from `register`**

In `backend/src/controllers/memberController.js`, remove lines 561–573 (the duplicate-email check block) and the variable `existingMemberByEmail` that is now unused. The result should look like:

```js
    // Use provided email or null (do not generate fake emails)
    const email = providedEmail || null;

    // Handle Firebase-authenticated users completing their profile
    if (firebaseUid) {
```

(The lines between `const email = ...` and `// Handle Firebase-authenticated users` are completely removed.)

- [ ] **Step 4: Run the full backend test suite — expect all pass**

```bash
cd backend && npx jest 2>&1 | tail -15
```

Expected: all tests pass, including the updated "duplicate phone number" test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/memberController.js backend/tests/integration/auth.test.js
git commit -m "feat: allow duplicate email on register, check moved to blur warning"
```

---

### Task 3: Frontend — `warnings` state + `handleEmailBlur` in `MemberRegistration`

**Files:**
- Modify: `frontend/src/components/auth/MemberRegistration.tsx`

- [ ] **Step 1: Add `warnings` state**

In `MemberRegistration.tsx`, after the `errors` state declaration (around line 29), add:

```tsx
const [warnings, setWarnings] = useState<any>({});
```

- [ ] **Step 2: Clear `emailExists` warning when the email field changes**

In `handleInputChange` (around line 157 where errors are cleared), add a parallel block for warnings:

```tsx
// Clear email warning when email field changes
if (field === 'email') {
  setWarnings((prev: any) => ({ ...prev, emailExists: false }));
}
```

Place this immediately after the existing `if (errors[field])` block.

- [ ] **Step 3: Add `handleEmailBlur`**

After the `validateHeadOfHouseholdPhone` function (around line 191), add:

```tsx
const handleEmailBlur = async () => {
  const email = formData.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/members/check-email/${encodeURIComponent(email)}`
    );
    const data = await response.json();
    if (data.success && data.exists) {
      setWarnings((prev: any) => ({ ...prev, emailExists: true }));
    }
  } catch {
    // Silently ignore — this is a best-effort warning, not a hard check
  }
};
```

- [ ] **Step 4: Pass `warnings` and `onEmailBlur` to `ContactAddressStep`**

In the `stepConfig` `useMemo`, update the `contact` step's render function (around line 511):

```tsx
{ key: 'contact', titleKey: 'contact.address', render: () => (
  <ContactAddressStep
    formData={formData}
    handleInputChange={handleInputChange}
    errors={errors}
    warnings={warnings}
    onEmailBlur={handleEmailBlur}
    t={t}
  />) },
```

- [ ] **Step 5: Run frontend tests — expect all pass**

```bash
cd frontend && CI=true npm test -- --watchAll=false 2>&1 | tail -15
```

Expected: all pass (no ContactAddressStep TypeScript errors yet — that's Task 4).

> Note: TypeScript may warn about the new prop not being in the type signature. If the CI build fails, proceed to Task 4 immediately and come back to verify.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/auth/MemberRegistration.tsx
git commit -m "feat: add email blur warning state and handler in MemberRegistration"
```

---

### Task 4: Frontend — `ContactAddressStep` warning display

**Files:**
- Modify: `frontend/src/components/auth/RegistrationSteps.tsx` (lines 209–260)

- [ ] **Step 1: Update the `ContactAddressStep` props type**

In `RegistrationSteps.tsx`, update the component signature (line 209):

```tsx
const ContactAddressStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  warnings: any;
  onEmailBlur: () => void;
  t: any;
}> = ({ formData, handleInputChange, errors, warnings, onEmailBlur, t }) => (
```

- [ ] **Step 2: Add `onBlur` to the email `<input>` and render the warning**

Locate the email input block (around line 244). Replace the entire email `<div>` block with:

```tsx
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">
    {t('email.address')} <span className="text-gray-500 text-xs">({t('optional')})</span>
  </label>
  <input
    type="email"
    value={formData.email}
    onChange={(e) => handleInputChange('email', e.target.value)}
    onBlur={onEmailBlur}
    className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
      errors.email
        ? 'border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
    } focus:outline-none focus:ring-1`}
    placeholder={t('email.placeholder')}
  />
  {errors.email && (
    <p className="text-red-500 text-xs sm:text-sm mt-1">
      {errors.email}
    </p>
  )}
  {warnings.emailExists && (
    <div className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p className="text-xs text-amber-700">
        A member with this email already exists. You may still proceed.
      </p>
    </div>
  )}
</div>
```

- [ ] **Step 3: Run frontend tests — expect all pass**

```bash
cd frontend && CI=true npm test -- --watchAll=false 2>&1 | tail -15
```

Expected: all 12 test suites pass.

- [ ] **Step 4: Run full test suite (backend + frontend)**

```bash
cd /Users/dawit/development/church/abune-aregawi && npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/RegistrationSteps.tsx
git commit -m "feat: show amber warning when duplicate email detected on blur"
```

---

## Manual Smoke Test

After all tasks are complete, verify in the browser:

1. Open the registration form (step 2 — Contact & Address).
2. Enter an email that is already registered for an existing member.
3. Click out of the email field (trigger blur).
4. **Expected:** Amber warning appears below the email field: _"A member with this email already exists. You may still proceed."_
5. Change the email to anything else.
6. **Expected:** Warning disappears immediately.
7. Re-enter the duplicate email and click **Next** through all steps to **Submit**.
8. **Expected:** Registration completes successfully (201) — the duplicate email does not block submission.
