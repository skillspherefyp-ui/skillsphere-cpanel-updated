# Security Fixes — Test Guide

Base URL: `https://skillsphere.com.pk/api`
Get a valid token: login at `/api/auth/login` with a real account.

---

## 1. Upload requires auth (SS-C1)

**Test:** POST to upload with no token
```
curl -X POST https://skillsphere.com.pk/api/upload/file
```
**Expected:** `401 { "error": "Access token required" }`

---

## 2. Webhook rejected without signature (SS-D3)

**Test:** POST to webhook with no signature header
```
curl -X POST https://skillsphere.com.pk/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"payment:created","data":{"state":"PAID","order_id":"SS-1-5-123"}}'
```
**Expected:** `200 { "received": true }` (fast ack) but server logs show "missing signature or secret — rejecting". No enrollment is created.

---

## 3. Payment verify rejects wrong user's order (SS-D1/D2)

**Test:** Login as User A, get their token. Call verify with a courseId that doesn't match a real order for that user.
```
curl -X POST https://skillsphere.com.pk/api/payments/verify \
  -H "Authorization: Bearer TOKEN_OF_USER_A" \
  -H "Content-Type: application/json" \
  -d '{"tracker":"some_tracker","courseId":99}'
```
**Expected:** `403 { "error": "Payment verification failed: no order ID returned" }` (if Safepay returns no orderId) OR `403 order does not belong to this user` (if orderId has wrong userId)

---

## 4. OTP not visible in production logs (SS-A3)

**Test:** On your server with `NODE_ENV=production`, trigger a signup OTP email. Even if the email fails, check the server logs.
**Expected:** Log shows `⚠️ Email error: ...` but does NOT show the OTP value itself.

**Quick code check:**
```bash
grep "NODE_ENV.*production.*OTP\|OTP.*NODE_ENV" backend/controllers/authController.js
```
Expected: 4 lines found, all wrapped in the guard.

---

## 5. Security headers present (SS-I2)

**Test:**
```
curl -I https://skillsphere.com.pk/api/health
```
**Expected headers present:**
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- No `X-Powered-By: Express` header

---

## 6. Body limit 5mb (H4)

**Test:** Send a JSON body larger than 5mb
```bash
# Generate a 6mb JSON string and POST it
python3 -c "import json,sys; print(json.dumps({'data':'x'*6000000}))" | \
  curl -X POST https://skillsphere.com.pk/api/auth/login \
  -H "Content-Type: application/json" --data-binary @-
```
**Expected:** `413 Payload Too Large`

---

## 7. Forgot password — no email enumeration (H7)

**Test with non-existent email:**
```
curl -X POST https://skillsphere.com.pk/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"doesnotexist@fake.com"}'
```
**Expected:** `200 { "success": true, "message": "If this email exists, a reset code has been sent" }`

**Test with real email:**
Same request with a real email.
**Expected:** Same `200` response (attacker can't tell the difference).

---

## 8. Progress can't be forced to 100% (SS-B4)

**Test:** As a student enrolled in a course, send progress=100 manually
```
curl -X PUT https://skillsphere.com.pk/api/enrollments/progress \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":5,"progress":100}'
```
**Expected:** Returns actual computed progress (e.g. `5%` if only 1 of 20 topics done), NOT 100%.

---

## 9. Certificate requires course completion (SS-B5)

**Test:** Try to verify payment for a course you haven't completed
- Enroll in a course, complete 0 topics, attempt payment verify
**Expected:** `500 { "error": "Verification failed" }` (server logs show "has not completed course X")

---

## 10. Password change invalidates old token (SS-A1)

**Test:**
1. Login → get `OLD_TOKEN`
2. Change password via `PUT /api/auth/change-password` using `OLD_TOKEN`
3. Use `OLD_TOKEN` to call any authenticated endpoint

```
curl https://skillsphere.com.pk/api/auth/profile \
  -H "Authorization: Bearer OLD_TOKEN"
```
**Expected:** `401 { "error": "Session expired. Please log in again." }`

---

## 11. OTP stored as hash (SS-A2)

**Test:** Trigger a signup OTP for a test email, then check the DB directly.
```sql
SELECT otpCode FROM users WHERE email = 'test@example.com';
```
**Expected:** 64-character hex string (e.g. `a3f8b2...`), NOT a 6-digit number.

Also verify wrong OTP is rejected:
```
curl -X POST https://skillsphere.com.pk/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"000000"}'
```
**Expected:** `400 { "error": "Invalid OTP code." }`

---

## 12. Account lockout after 5 failures (SS-F1)

**Test:** Send 6 login attempts with wrong password
```bash
for i in 1 2 3 4 5 6; do
  curl -s -X POST https://skillsphere.com.pk/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"real@user.com","password":"wrongpassword"}' | grep -o '"error":"[^"]*"'
done
```
**Expected:**
- Attempts 1–5: `"error":"Invalid email or password"`
- Attempt 6: `"error":"Account temporarily locked. Try again later."` with HTTP `429`

After 15 minutes, login works again with the correct password.

---

## 13. File type spoofing blocked (SS-C2)

**Test:** Upload an HTML file disguised as a PNG
```bash
echo '<script>alert(1)</script>' > fake.png

curl -X POST https://skillsphere.com.pk/api/upload/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@fake.png;type=image/png"
```
**Expected:** `400 { "error": "File type not allowed" }`

**Test valid PNG still works:**
```bash
curl -X POST https://skillsphere.com.pk/api/upload/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@real-image.png"
```
**Expected:** `200 { "success": true, "file": { "url": "https://res.cloudinary.com/..." } }`

---

## Quick DB check after first deploy

Run this SQL to confirm the new columns were auto-created:
```sql
DESCRIBE users;
```
**Expected columns present:** `tokenVersion`, `failedLoginAttempts`, `lockedUntil`, and `otpCode` with type `varchar(64)`.
