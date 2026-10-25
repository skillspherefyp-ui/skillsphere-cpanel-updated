# Auth System — Issues & Fix Guide

Generated from code analysis of `LoginScreen.js`, `SignupScreen.js`, `AuthContext.js`,
`authController.js`, and `authRoutes.js`.

---

## 1. CRITICAL — Plain-text Password Logged to Console

**File:** `backend/controllers/authController.js` — Lines 47–50

**Problem:**
```js
console.log('Password length:', password?.length);
console.log('Password:', password);  // logs the actual password
console.log('Full request body:', JSON.stringify(req.body, null, 2));
```
Every login attempt prints the user's raw password to the server logs. In production this
means passwords can end up in log files, monitoring dashboards (e.g. Railway, Papertrail),
and anywhere stdout is captured. This is a critical credential leak.

**How to Fix:**
- Remove lines 48–50 entirely (password, password length, and full body logs).
- Keep only non-sensitive logs like `console.log('Login attempt for:', email)`.
- As a rule: never log `req.body` on auth endpoints — always log individual safe fields.

---

## 2. CRITICAL — Google Token Not Cryptographically Verified (Firebase Not Configured)

**File:** `backend/controllers/authController.js` — Lines 816–850

**Problem:**
When Firebase env vars are absent (which is the case in the current `.env`), the fallback
path decodes the Google ID token by base64-decoding the JWT payload only — it does NOT
verify the token signature against Google's public keys:

```js
const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
// Only checks iss field and exp timestamp — no signature verification
```

A malicious actor can craft a JWT with a valid-looking `iss`, any `email` they want, and a
future `exp`, and the backend will create or log into any account without Google ever
issuing that token. This is effectively an authentication bypass for all Google OAuth users.

**How to Fix — Option A (Recommended, no Firebase needed):**
Verify the token by calling Google's public tokeninfo endpoint:
```
GET https://oauth2.googleapis.com/tokeninfo?id_token=<TOKEN>
```
Google validates the signature server-side and returns the payload only if valid.
No additional npm dependency required.

**How to Fix — Option B:**
Install `google-auth-library` and use `OAuth2Client.verifyIdToken()` with your Google
Client ID. This verifies the signature locally using Google's cached public keys.

**How to Fix — Option C:**
Make Firebase config required. If the env vars are missing, return a 503 error instead
of falling through to the insecure decode path.

---

## 3. CRITICAL — `/register` Endpoint Allows Self-Assigning Admin Role

**File:** `backend/controllers/authController.js` — Lines 126–128
**File:** `backend/routes/authRoutes.js` — Line 9

**Problem:**
```js
const validRoles = ['student', 'expert', 'instructor', 'admin'];
const roleToUse = validRoles.includes(role) ? role : 'student';
```
The public `/register` endpoint accepts a `role` field from the request body and will
create an `admin` account if `role: "admin"` is passed. There is no authentication or
authorization check — the endpoint is fully public.

Any user can send:
```json
POST /api/auth/register
{ "name": "attacker", "email": "x@x.com", "password": "123456", "role": "admin" }
```
and receive back a valid JWT with `role: admin`, giving full admin access to the platform.

**How to Fix:**
- Restrict the allowed roles on the public `/register` endpoint to only `["student"]`.
- If `expert` or `instructor` self-registration is needed, use a separate route with
  an invite token or an approval flow.
- Admin accounts should only be creatable via the seed script (`npm run seed`) or by an
  existing admin through a protected internal route that requires `authenticateToken`.

---

## 4. MEDIUM — `/google-auth` Has No Rate Limiter

**File:** `backend/routes/authRoutes.js` — Line 30

**Problem:**
```js
router.post('/google-auth', authController.googleAuth);  // no authLimiter
```
Every other auth endpoint (`/login`, `/send-otp`, `/verify-otp`, etc.) uses `authLimiter`,
but `/google-auth` is unprotected from abuse. An attacker can spam this endpoint to:
- Enumerate which email addresses have registered accounts (response differs for known
  vs unknown emails).
- Abuse the user-creation path at high volume to flood the database with fake accounts.

**How to Fix:**
Add `authLimiter` to the route the same way it is applied to every other auth route:
```js
router.post('/google-auth', authLimiter, authController.googleAuth);
```

---

## 5. MEDIUM — Default Fallback Role in `normalizeUser` is `'instructor'` Instead of `'student'`

**File:** `AppAndroidSS/src/context/AuthContext.js` — Line 19

**Problem:**
```js
const rawRole =
  payload.role ||
  fallbackRole ||
  'instructor';  // wrong default
```
If `payload.role` is missing AND no `fallbackRole` is passed, the function defaults to
`'instructor'`. This means a user whose role is absent from the token or AsyncStorage
will be routed to the Instructor navigator instead of the Student navigator, giving them
unintended access to instructor-level screens.

Most call sites pass an explicit `fallbackRole` so this does not always trigger, but it
is a silent bug that can surface in edge cases such as corrupted AsyncStorage or an
incomplete API response.

**How to Fix:**
Change the default from `'instructor'` to `'student'`:
```js
const rawRole =
  payload.role ||
  fallbackRole ||
  'student';
```
`'student'` is the least-privileged role and a safe fallback for any ambiguous auth state.

---

## 6. MEDIUM — Duplicate / Overlapping OTP Verification Endpoints

**File:** `backend/controllers/authController.js`
**File:** `backend/routes/authRoutes.js` — Lines 17, 27

**Problem:**
There are two endpoints that both verify a signup OTP:

- `POST /verify-otp` — verifies OTP, marks `emailVerified: true`, does NOT return a token
- `POST /verify-signup-otp` — verifies OTP, marks `emailVerified: true`, AND returns a JWT

The frontend `SignupOTPScreen` calls `verifyOTP` which hits `/verify-otp` (no token), then
navigates to `SignupDetails` where `completeRegistration` sets the password and logs in.
The `/verify-signup-otp` endpoint does the same verification but also returns a token,
suggesting it was added as an alternative flow but never removed.

Having two overlapping endpoints for the same action creates confusion about which is
authoritative, and both need to be kept in sync whenever OTP logic changes.

**How to Fix:**
- Decide on one canonical flow and remove or clearly document the other.
- Recommended: Keep `/verify-otp` (no auto-login token) for the current multi-step flow
  (SignupOTPScreen -> SignupDetails -> completeRegistration).
- Deprecate and remove `/verify-signup-otp` if no screen is actively calling it.
- Before removing, grep the codebase for `verifySignupOTP` to confirm no screen uses it.

---

## 7. LOW — Excessive Debug Logging Left On in Production Login Path

**File:** `backend/controllers/authController.js` — Lines 46–50, 63–66, 72–74, 103–104

**Problem:**
The login controller has roughly 10 `console.log` statements that dump full user objects,
role details, permissions, and the entire response token on every single login. In
production this:
- Pollutes logs, making real errors harder to find.
- Leaks internal user data structure to anyone with log access.
- Has a minor but real performance cost on every request due to JSON serialization.

Example:
```js
console.log('Sending response:', JSON.stringify(response, null, 2));
// Logs the full user object including permissions on every login
```

**How to Fix:**
- Replace verbose logs with a single structured summary per request:
  ```js
  console.log(`Login success: ${user.email} (${user.role})`);
  ```
- Wrap any debug-only logs in an environment guard:
  ```js
  if (process.env.NODE_ENV !== 'production') {
    console.log('Debug info:', ...);
  }
  ```
- Consider adopting a logger like `winston` or `pino` with log levels so debug output
  is suppressed automatically in production without manual guards everywhere.

---

## Priority Order for Fixes

| Priority | Issue | Severity | Effort |
|---|---|---|---|
| 1 | Password logged to console | CRITICAL | Low — delete the lines |
| 2 | Google token not verified | CRITICAL | Medium — add google-auth-library |
| 3 | /register allows admin role | CRITICAL | Low — restrict validRoles array |
| 4 | /google-auth no rate limit | MEDIUM | Low — add authLimiter |
| 5 | Wrong default role in normalizeUser | MEDIUM | Low — change one string |
| 6 | Duplicate OTP endpoints | MEDIUM | Medium — audit and remove one |
| 7 | Verbose production logging | LOW | Low — clean up console.log calls |
