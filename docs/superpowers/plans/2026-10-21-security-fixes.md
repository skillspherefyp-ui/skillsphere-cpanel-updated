# SkillSphere Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remediate all 13 confirmed vulnerabilities from the 2026-10-19 security audit without breaking the payment flow, OTP login flow, or enrollment system.

**Architecture:** Targeted, minimal fixes to existing files only. No new abstractions. DB schema changes (tokenVersion, failedLoginAttempts) use Sequelize's auto-sync (alter: drop:false) already running at startup — no migration scripts needed.

**Tech Stack:** Node.js, Express, Sequelize/MySQL, jsonwebtoken, bcryptjs, crypto (built-in), express-rate-limit, helmet (new dep)

**Spec:** SkillSphere_Security_Audit_Report 2026-10-19 — findings SS-C1, SS-D3, SS-D2, SS-D1, SS-B4, SS-A3, SS-A1, SS-A2, SS-C2, SS-F1, SS-I2, SS-B5, SS-A7, H1, H2, H4, H7

## Global Constraints

- Do NOT break the Safepay payment flow — verify orderId exists before rejecting
- Do NOT break active OTP sessions during SS-A2 rollout — hash migration is additive
- Do NOT remove any existing API response fields used by the React Native frontend
- otpCode field length must be expanded to STRING(64) to hold SHA-256 hex (SS-A2)
- tokenVersion defaults to 0 — existing JWTs lacking tv field treated as tv=0, which matches the DB default, so no forced logout on deploy
- All fixes are backend-only except H6 (AsyncStorage) which is deferred — not in this plan

## Review Focus

- Payment tracker validation (SS-D1/D2): If Safepay does not return order_id in response, the fix must REJECT not allow-through — a null orderId must be treated as untrusted, not skipped
- OTP hashing (SS-A2): Any OTP stored before this deploy will be a 6-char plaintext string; after deploy it will be a 64-char hash. Mid-flight OTPs will fail verification — acceptable (user requests new OTP)
- tokenVersion (SS-A1): JWT tokens issued before this deploy lack the `tv` claim. decoded.tv will be undefined, user.tokenVersion will be 0. `undefined !== 0` is TRUE — this WOULD force logout of all users. Fix: treat missing tv as 0: `(decoded.tv ?? 0) !== user.tokenVersion`
- Webhook HMAC (SS-D3): Uses JSON.stringify(req.body) for HMAC — must match exactly what Safepay signs. If Safepay signs the raw body bytes, this may mismatch. Add note to test with real webhook after deploy
- DB-level lockout (SS-F1): failedLoginAttempts must reset on successful login AND on OTP verify — check both code paths

---

## Task 1: SS-C1 — Add auth to upload routes (CRITICAL)

**Files:**
- Modify: `backend/routes/uploadRoutes.js:1-5`

- [ ] Add `const { authenticateToken } = require('../middleware/auth');` after existing requires
- [ ] Add `router.use(authenticateToken);` before the two route handlers
- [ ] Verify: `curl -X POST https://skillsphere.com.pk/api/upload/file` with no token returns 401

---

## Task 2: SS-D3 — Mandatory webhook signature (CRITICAL)

**Files:**
- Modify: `backend/controllers/paymentController.js:141-151`

- [ ] Replace optional signature check with mandatory rejection:
  - If `!signature` OR `!SAFEPAY_SECRET` → log error, `return` (already responded)
  - Use `crypto.timingSafeEqual` for comparison
  - Use `Buffer.from(signature, 'hex')` and `Buffer.from(expected, 'hex')` for safe compare
- [ ] Verify: POST /api/payments/webhook without x-sfpy-signature header returns no action (already responded 200 but logs rejection)

---

## Task 3: SS-D1 + SS-D2 — Validate orderId in verifyPayment (CRITICAL)

**Files:**
- Modify: `backend/controllers/paymentController.js:89-131`

- [ ] After getting `safepayOrderId` at line 125, add null check:
  - If `!safepayOrderId` → return 403 `{ error: 'Payment verification failed: no order ID returned' }`
- [ ] Validate user ownership: `if (!safepayOrderId.startsWith('SS-' + req.user.id + '-'))` → 403
- [ ] Validate courseId: `const parts = safepayOrderId.split('-'); if (String(parts[2]) !== String(courseId))` → 403
- [ ] Verify: calling verifyPayment with another user's tracker returns 403

---

## Task 4: SS-A3 — Guard OTP console logs (HIGH, 1-line per occurrence)

**Files:**
- Modify: `backend/controllers/authController.js:276, 365, 491, 600`

- [ ] Wrap each of the 4 `console.log('...OTP for development:', otp)` lines:
  ```js
  if (process.env.NODE_ENV !== 'production') { console.log('OTP for development:', otp); }
  ```
- [ ] Verify: grep confirms no bare `console.log` with `otp` variable outside NODE_ENV guard

---

## Task 5: SS-I2 — Add helmet (MEDIUM)

**Files:**
- Modify: `backend/server.js:1` (require) and `server.js:~43` (use)
- Install: `helmet` npm package

- [ ] `npm install helmet` in backend/
- [ ] Add `const helmet = require('helmet');` near top of server.js
- [ ] Add `app.use(helmet());` as the FIRST middleware line, before CORS handler (line 134)
- [ ] Verify: response headers include `X-Frame-Options`, `X-Content-Type-Options`, no `X-Powered-By`

---

## Task 6: SS-A7 — Use toJSON() for req.user to prevent accidental permission persistence (LOW)

**Files:**
- Modify: `backend/middleware/auth.js:35`

- [ ] Change `req.user = user;` to `req.user = user.toJSON();`
- [ ] Verify: subsequent `req.user.save` calls would throw (plain object, not Sequelize instance) — good

---

## Task 7: SS-B4 — Server-side enrollment progress computation (HIGH)

**Files:**
- Modify: `backend/controllers/enrollmentController.js:170-202`

- [ ] Add `const { Topic, Progress } = require('../models');` to imports at top
- [ ] In `updateEnrollmentProgress`, ignore `req.body.progress` — compute instead:
  ```js
  const totalTopics = await Topic.count({ where: { courseId } });
  const completedTopics = await Progress.count({
    where: { userId: req.user.id, courseId, completed: true }
  });
  const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  ```
- [ ] Use computed `progress` for `enrollment.progressPercentage` etc.
- [ ] Keep `courseId` validation — keep 404 if not enrolled
- [ ] Verify: PUT /api/enrollments/progress with `{ courseId: X, progress: 100 }` no longer forces completion

---

## Task 8: SS-B5 — Require course completion before payment certificate (MEDIUM)

**Files:**
- Modify: `backend/controllers/paymentController.js:170-180` (issueCertificate function)

- [ ] Add `Enrollment` to the destructured require at line 171
- [ ] After the duplicate-cert check (line 177), add:
  ```js
  const enrollment = await Enrollment.findOne({ where: { userId, courseId, status: 'completed' } });
  if (!enrollment) throw new Error(`User ${userId} has not completed course ${courseId}`);
  ```
- [ ] Verify: verifyPayment for an incomplete course returns 500 with "has not completed"

---

## Task 9: SS-A1 — tokenVersion for JWT invalidation on password change (MEDIUM)

**Files:**
- Modify: `backend/models/User.js` — add `tokenVersion` field
- Modify: `backend/controllers/authController.js:33-39` — embed `tv` in JWT
- Modify: `backend/middleware/auth.js:13-22` — validate `tv` on every request
- Modify: `backend/controllers/authController.js:225, 641` — increment tokenVersion

- [ ] Add to User model (before `createdAt`):
  ```js
  tokenVersion: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false }
  ```
- [ ] In `generateToken`: `{ id: user.id, email: user.email, role: user.role, tv: user.tokenVersion || 0 }`
- [ ] In `authenticateToken` after `findByPk`:
  ```js
  if ((decoded.tv ?? 0) !== user.tokenVersion) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  ```
- [ ] In `changePassword` success path: `await user.increment('tokenVersion');`
- [ ] In `resetPassword` success path: `await user.increment('tokenVersion');`
- [ ] Verify: password change invalidates old JWT (old token gets 401 on next request)

---

## Task 10: SS-A2 — Cryptographic OTP: CSPRNG + hashed storage + timing-safe compare (MEDIUM)

**Files:**
- Modify: `backend/utils/otpUtils.js:1-50`
- Modify: `backend/models/User.js` — expand otpCode field length
- Note: authController.js stores/reads otpCode — no change needed there (it passes raw OTP to utils)

- [ ] Expand `otpCode` field in User.js: `DataTypes.STRING(64)` (SHA-256 hex = 64 chars)
- [ ] In `otpUtils.js` `generateOTP`: replace `Math.random()` with:
  ```js
  const crypto = require('crypto');
  return crypto.randomInt(100000, 1000000).toString();
  ```
- [ ] Add `hashOTP(otp)` function: `crypto.createHash('sha256').update(otp).digest('hex')`
- [ ] In `verifyOTP`:
  ```js
  const inputHash = crypto.createHash('sha256').update(inputOTP).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedOTP))) { ... }
  ```
- [ ] In `authController.js`: everywhere `otpCode: otp` is saved to DB, change to `otpCode: hashOTP(otp)`
  Import `hashOTP` from otpUtils. Affected: sendOTP (line 256/264), resendOTP (line 355), sendLoginOTP (line 475), forgotPassword (line 584)
- [ ] Export `hashOTP` from otpUtils.js
- [ ] Verify: OTP stored in DB is 64-char hex, not 6-digit number

---

## Task 11: SS-F1 — DB-level account lockout (MEDIUM)

**Files:**
- Modify: `backend/models/User.js` — add `failedLoginAttempts`, `lockedUntil`
- Modify: `backend/controllers/authController.js` — login and loginWithOTP

- [ ] Add to User model:
  ```js
  failedLoginAttempts: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
  lockedUntil: { type: DataTypes.DATE, allowNull: true }
  ```
- [ ] In `login()` after finding user, before password check:
  ```js
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
  }
  ```
- [ ] On failed password: `await user.increment('failedLoginAttempts'); if (user.failedLoginAttempts >= 5) { await user.update({ lockedUntil: new Date(Date.now() + 15*60*1000) }); }`
- [ ] On successful login: `await user.update({ failedLoginAttempts: 0, lockedUntil: null });`
- [ ] Apply same lockout check in `loginWithOTP()` — on OTP failure increment, on success reset
- [ ] Verify: 5 wrong passwords → 429 on 6th attempt

---

## Task 12: Hardening — H2, H4, H7 (1-liners)

**Files:**
- Modify: `backend/controllers/authController.js:55-56` (H2 — login error)
- Modify: `backend/server.js:171` (H4 — body limit)
- Modify: `backend/controllers/authController.js:573` (H7 — forgotPassword enum)

- [ ] H2: Change `'User not found'` at login line 56 to `'Invalid email or password'`
- [ ] H4: Change `express.json({ limit: '50mb' })` to `express.json({ limit: '5mb' })` (uploads use multipart, not JSON)
- [ ] H7: Change `'No account found with this email'` in forgotPassword to `'If this email exists, a reset code has been sent'` and always return 200

---

## Task 13: SS-C2 — Magic-byte file type detection (MEDIUM)

**Files:**
- Modify: `backend/routes/uploadRoutes.js`
- Install: `file-type` npm package

**Note:** `file-type` v17+ is ESM-only. Use v16 which is CommonJS: `npm install file-type@16`

- [ ] `npm install file-type@16` in backend/
- [ ] In `uploadRoutes.js`, add async magic-byte check in the upload handler (after multer processes):
  ```js
  const { fileTypeFromBuffer } = require('file-type');
  const allowed = ['application/pdf','image/jpeg','image/png','image/webp','image/gif'];
  // In route handler after req.file exists:
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !allowed.includes(detected.mime)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }
  ```
- [ ] Note: Cloudinary storage streams directly — need `memoryStorage` for buffer access, OR check post-upload. Use multer memoryStorage for the upload route specifically.
- [ ] Verify: uploading HTML file with `Content-Type: image/png` is rejected

---

## Execution Order

1. Task 1 (SS-C1) — immediate critical
2. Task 2 (SS-D3) — immediate critical
3. Task 3 (SS-D1/D2) — immediate critical
4. Task 4 (SS-A3) — 1-line high impact
5. Task 5 (SS-I2) — helmet
6. Task 6 (SS-A7) — safe low-risk
7. Task 12 (H2/H4/H7) — 1-liners
8. Task 7 (SS-B4) — server-side progress
9. Task 8 (SS-B5) — cert completion check
10. Task 9 (SS-A1) — tokenVersion
11. Task 10 (SS-A2) — OTP crypto
12. Task 11 (SS-F1) — DB lockout
13. Task 13 (SS-C2) — MIME detection
