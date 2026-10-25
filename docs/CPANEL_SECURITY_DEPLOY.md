# cPanel Security Deployment Guide

These steps deploy the security fixes from the 2026-10-21 security audit.

## What Changed (Backend)

| Fix | Details |
|-----|---------|
| Auth on upload routes | All uploads now require a valid JWT |
| Webhook signature | Safepay webhook is now mandatory HMAC-verified |
| orderId ownership check | Payment verify validates user + course match |
| OTP log guard | OTP values no longer logged in production |
| helmet.js | Security headers added (X-Frame-Options, etc.) |
| user.toJSON() | req.user is now a plain object (no accidental save) |
| Body limit 5mb | JSON body limit reduced from 50mb to 5mb |
| Login error unification | 'Invalid email or password' (no user enumeration) |
| Forgot-password enum | Always returns 200 regardless of email existence |
| Server-side progress | Enrollment progress computed from DB, not client |
| Completion gate | Certificate requires completed enrollment |
| tokenVersion | Password change invalidates all existing JWT sessions |
| OTP hashing | OTPs stored as SHA-256 hashes; CSPRNG generation |
| Account lockout | 5 failed logins → 15-minute DB-level lockout |
| Magic-byte detection | File uploads validated by content, not Content-Type |

---

## Deployment Steps

### 1. Upload Files

Upload the entire `backend/` folder to your cPanel server (overwrite existing).

The key changed files are:
- `backend/controllers/authController.js`
- `backend/controllers/enrollmentController.js`
- `backend/controllers/paymentController.js`
- `backend/middleware/auth.js`
- `backend/models/User.js`
- `backend/routes/uploadRoutes.js`
- `backend/server.js`
- `backend/utils/otpUtils.js`
- `backend/package.json`
- `backend/package-lock.json`

### 2. Install New Dependencies

SSH into your cPanel server, navigate to your backend directory, and run:

```bash
cd /home/YOUR_CPANEL_USER/public_html/api   # adjust to your backend path
npm install
```

This will automatically install the two new packages:
- `helmet` — HTTP security headers middleware
- `file-type@16` — Magic-byte file type detection (CommonJS compatible)

If you prefer to install them individually:

```bash
npm install helmet --save
npm install file-type@16 --save
```

### 3. Apply Database Schema Changes (Auto)

The new User model fields (`tokenVersion`, `failedLoginAttempts`, `lockedUntil`,
and the expanded `otpCode` to 64 chars) are picked up automatically by
Sequelize's `alter: true` sync that already runs on startup.

**No migration scripts are needed.** Just restart the Node.js app and the
columns will be added automatically.

### 4. Restart Node.js Application

In cPanel → "Setup Node.js App" → click **Restart** on your app.

Or via SSH if using PM2:

```bash
pm2 restart skillsphere-backend
# or
pm2 restart all
```

### 5. Verify Deployment

After restart, check:

```bash
# Should return security headers (X-Frame-Options, X-Content-Type-Options, etc.)
curl -I https://skillsphere.com.pk/api/health

# Upload without auth should return 401
curl -X POST https://skillsphere.com.pk/api/upload/file

# Webhook without signature should be silently rejected (logs error, returns 200)
curl -X POST https://skillsphere.com.pk/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"payment:created"}'
```

---

## Notes

### Helmet on cPanel
Helmet works on any Node.js/Express server — it only sets HTTP response headers.
cPanel does not interfere with Express middleware. No server-side configuration needed.

### tokenVersion and existing sessions
Existing logged-in users will **not** be force-logged out on deploy.
Existing JWTs lack the `tv` claim (`decoded.tv` is `undefined`).
The code treats `undefined ?? 0` as `0`, which matches the DB default of `0`.
Users are only logged out when they change their password after this deploy.

### OTP migration
OTPs generated before this deploy are 6-char plaintext strings in the DB.
After deploy, new OTPs are 64-char SHA-256 hashes.
Any in-flight OTP (sent before deploy, verified after) will fail —
the user will need to request a new OTP. This is acceptable.

### Safepay webhook test
The webhook now requires a valid `X-SFPY-SIGNATURE` header.
After deploy, verify with Safepay that real webhook calls include this header.
If Safepay signs the raw body bytes (not `JSON.stringify(body)`), the HMAC
may mismatch — test with a real payment and check server logs.
