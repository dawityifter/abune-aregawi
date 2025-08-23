# Dependent Self-Claim API Guide

This document explains how a dependent user links their own account to a dependent record that already exists under a head-of-household.

The flow is 3 steps: start → verify → link.

Note: The API paths below are relative to the members router base. In most environments this is `/api/members`. If your server mounts the router at a different base, adjust accordingly.

## Prerequisites

- The claimant (dependent) is able to sign in to the frontend using Firebase Phone Auth.
- You must use 127.0.0.1 (not localhost) for local development when reCAPTCHA Enterprise is enabled.
- A `Member` row exists for the claimant with the same phone or email they use at sign-in.
- A `Dependent` row exists that should be linked to the claimant, and that dependent currently has:
  - `linkedMemberId = null` (i.e., not already linked)
  - Either `phone` equals the member’s `phone_number` OR `email` equals the member’s `email` (used to match the claimant to the correct dependent).

Firebase test numbers you can use in dev:
- +1234567890 (code 123456)
- +15551234567 (code 123456)

Your frontend already bypasses reCAPTCHA for these test numbers.

## Data assumptions

- Phone numbers are normalized E.164 on the backend (e.g., `+1XXXXXXXXXX`).
- Dependent matching uses:
  - phone-to-phone (normalized) OR
  - email-to-email (case-insensitive)
- Identity verification uses dependent `lastName` and/or `dateOfBirth` (YYYY-MM-DD).

## Endpoints

All endpoints require Firebase authentication via HTTP header:

- `Authorization: Bearer <Firebase ID Token of the claimant>`

1) Start self-claim
- POST `/api/members/dependents/self-claim/start`
- Body (all optional filters):
```json
{
  "lastName": "Doe",
  "dateOfBirth": "2010-05-01"
}
```
- Response:
```json
{
  "success": true,
  "data": {
    "candidates": [
      { "id": 123, "firstName": "Jane", "lastName": "Doe", "dateOfBirth": "2010-05-01", "relationship": "Daughter", "phone": "+15551234567", "email": "jane@example.com" }
    ]
  }
}
```

2) Verify a dependent and get a short-lived token
- POST `/api/members/dependents/self-claim/verify`
- Body (at least one of lastName or dateOfBirth is required):
```json
{
  "dependentId": 123,
  "lastName": "Doe",
  "dateOfBirth": "2010-05-01"
}
```
- Response:
```json
{
  "success": true,
  "data": { "token": "<jwt-valid-10m>" }
}
```

3) Link the dependent to the signed-in member
- POST `/api/members/dependents/self-claim/link`
- Body:
```json
{
  "dependentId": 123,
  "token": "<jwt-from-verify>"
}
```
- Response:
```json
{
  "success": true,
  "message": "Dependent linked successfully",
  "data": { "dependent": { /* updated dependent */ } }
}
```

## Step-by-step flow

1) Sign in as the dependent (phone auth) in the frontend.
2) Obtain the Firebase ID token and use it in the `Authorization` header.
   - Easiest: DevTools → Network → copy Authorization header from a protected request, or use the `window.getIdToken()` helper.
3) Call `POST /dependents/self-claim/start` (optional filters to narrow results).
4) Pick the correct dependent `id` from `candidates`.
5) Call `POST /dependents/self-claim/verify` with `dependentId` and at least one of `lastName` or `dateOfBirth`.
6) Use the returned short-lived `token` to call `POST /dependents/self-claim/link`.
7) Success: the dependent is now linked (`linkedMemberId` set to your member id).

## cURL examples

Replace BASE with your API origin (e.g., `http://127.0.0.1:5001/...`) and TOKEN with the Firebase ID token.

- Start
```bash
curl -X POST "$BASE/api/members/dependents/self-claim/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lastName":"Doe","dateOfBirth":"2010-05-01"}'
```

- Verify
```bash
curl -X POST "$BASE/api/members/dependents/self-claim/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dependentId":123,"lastName":"Doe","dateOfBirth":"2010-05-01"}'
```

- Link
```bash
curl -X POST "$BASE/api/members/dependents/self-claim/link" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dependentId":123,"token":"<jwt-from-verify>"}'
```

## Troubleshooting

- No Authorization header in Network:
  - The page/request you clicked may be public. Try another protected call or use the `window.getIdToken()` helper.
- 401 Invalid or expired token:
  - Re-authenticate and fetch a fresh token (`getIdToken(true)`).
- 403 Dependent does not match your contact information:
  - The dependent’s phone/email must match your member record’s phone/email.
- 400 Dependent already linked:
  - The dependent has `linkedMemberId` set; unlink first if this is expected.
- Use 127.0.0.1 for local reCAPTCHA Enterprise support.

## Security notes

- The self-claim verify token is short-lived (10 minutes) and bound to both the `dependentId` and the requesting `memberId`.
- Do not reuse or store the verify token long-term; use it immediately for the link step.
