# Registration Email Duplicate — On-Blur Warning Design

**Date:** 2026-04-12  
**Status:** Approved

---

## Problem

The duplicate-email check fires only when the user submits the final registration step, showing a red blocking error. Users have no chance to act on this information until all other steps are complete, and the hard block prevents registration even when duplicate email is acceptable (e.g., family member sharing an email, phone-authenticated user).

---

## Goals

1. Check email uniqueness as soon as the user leaves the email field (on blur, step 2).
2. Show the result as an amber/yellow **warning**, not a red blocking error.
3. Never block navigation or form submission based on duplicate email — it is informational only.
4. Duplicate emails are **included** in the submission (stored as-is, admin resolves later).

---

## Architecture

### Backend — new endpoint

`GET /api/members/check-email/:email`

- No authentication required (called during registration, before any session exists).
- Returns `{ success: true, exists: boolean }`.
- Used only by the frontend blur check.

Also remove the hard `400` block for duplicate email in `memberController.register`. The new member will be created with the duplicate email intact.

### Frontend — warning state + blur handler

**`MemberRegistration.tsx`**

- Add `warnings` state: `const [warnings, setWarnings] = useState<any>({})`.
- Add `handleEmailBlur` async function:
  - Skips check if email is empty or not a valid format.
  - Calls `GET /api/members/check-email/:email`.
  - Sets `warnings.emailExists = true` if the email is found.
  - Clears `warnings.emailExists` when the email field changes (in `handleInputChange`).
- Pass `warnings` and `onEmailBlur={handleEmailBlur}` as props to `ContactAddressStep`.

**`RegistrationSteps.tsx` — `ContactAddressStep`**

- Add `warnings` and `onEmailBlur` to the component's props.
- Add `onBlur={onEmailBlur}` to the email `<input>`.
- Render warning below the email field when `warnings.emailExists` is true:

```
⚠ A member with this email already exists. You may still proceed.
```

Styled amber: `text-amber-700 bg-amber-50 border border-amber-200 rounded`.

---

## What does NOT change

- All other field validations are unchanged.
- The step-2 "required" validation (email or phone required) is unchanged.
- The backend still validates email format via the existing middleware.

---

## Files affected

| File | Change |
|------|--------|
| `backend/src/routes/memberRoutes.js` | Add `GET /check-email/:email` route |
| `backend/src/controllers/memberController.js` | Add `checkEmailExists` function; remove duplicate-email `400` from `register` |
| `frontend/src/components/auth/MemberRegistration.tsx` | Add `warnings` state, `handleEmailBlur`, pass to step |
| `frontend/src/components/auth/RegistrationSteps.tsx` | Add `warnings` + `onEmailBlur` props to `ContactAddressStep`, wire blur, show warning |
