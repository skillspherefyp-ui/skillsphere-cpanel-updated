# Remove Expert Role & Student Feedback Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the expert role entirely and add a student feedback screen that appears after course completion, before the certificate preview screen.

**Architecture:** Four backend changes (model field rename, userId added, role guard removed, instructor view updated) and four frontend changes (new screen, three nav wires, expert routing deleted). The DB cleanup (delete expert accounts, ALTER ENUM) is a separate SQL guide — run on cPanel after the code deploy.

**Tech Stack:** Node.js/Express/Sequelize/MySQL (backend), React Native + React Native Web (frontend), React Navigation stack navigator.

**Spec:** User request — remove expert role, feedback done by student after course completion before certificate preview, navigate to cert after submit. DB queries to remove expert accounts provided separately.

## Global Constraints

- Do NOT drop the `feedbacks` table — repurpose it for student feedback
- `expertName` DB column renamed to `studentName` in both DB and Sequelize model
- New `userId` INT column added to `feedbacks` (nullable FK, SET NULL on user delete)
- `CertificatesScreen.js` navigate-to-CertificatePreview calls stay unchanged (browsing existing certs, not post-completion flow)
- Use `navigation.replace` (not `navigate`) from CourseFeedbackScreen to CertificatePreview so Back does not loop back through feedback
- Expert role removed from AppNavigator routing — any residual expert user falls through to StudentNavigator as safe fallback until DB is cleaned
- No new npm packages required

## Review Focus

- Student hits Back from CertificatePreview after feedback: should NOT return to feedback screen — Task 3 uses `replace` not `navigate`.
- Student skips feedback: should reach CertificatePreview with correct `courseId`/`courseName` — Task 2 skip button uses same `replace` call.
- Instructor FeedbackScreen shows `expertName` field: Task 4 renames all three references to `studentName`.
- Existing feedback rows have `expertName` populated: SQL guide renames the column, data preserved in `studentName`.
- Expert user logs in after code deploy but before DB cleanup: falls through to StudentNavigator — acceptable degraded state, handled by Task 4 AppNavigator change.

---

## Task 1: Backend — Rework Feedback model and controller for students

**Files:**
- Modify: `backend/models/Feedback.js`
- Modify: `backend/controllers/feedbackController.js`

**Interfaces:**
- Produces: `POST /api/feedback` accepts `{ rating, feedback, courseId, courseName }` from any authenticated student; `studentName` and `userId` sourced server-side from `req.user`

- [ ] **Step 1:** In `backend/models/Feedback.js`, rename field `expertName` → `studentName` (same type `DataTypes.STRING`, `allowNull: false`), and add:
  ```js
  userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } }
  ```

- [ ] **Step 2:** In `backend/controllers/feedbackController.js`, `createFeedback`:
  - Change role check to: `if (!['student', 'instructor', 'admin'].includes(req.user.role))` → 403
  - Remove `expertName` from destructured body
  - Add `studentName: req.user.name` and `userId: req.user.id` to the `Feedback.create(...)` call
  - Keep `courseName`, `feedback`, `rating`, `courseId` from body

- [ ] **Step 3:** Verify the module loads:
  ```
  cd backend && node -e "require('./models/Feedback'); require('./controllers/feedbackController'); console.log('OK')"
  ```
  Expected: `OK`

---

## Task 2: Frontend — Create CourseFeedbackScreen

**Files:**
- Create: `AppAndroidSS/src/screens/student/CourseFeedbackScreen.js`

**Interfaces:**
- Consumes: route params `{ courseId: number, courseName: string }`
- Produces: default export `CourseFeedbackScreen`; on submit or skip calls `navigation.replace('CertificatePreview', { courseId, courseName })`

- [ ] **Step 1:** Create `CourseFeedbackScreen.js`. Model it on the existing expert `FeedbackFormScreen.js` (same star-rating UI, text input, guidelines card). Key differences:
  - No sidebar — use plain `View` + `KeyboardAvoidingView` + `ScrollView` (same pattern as `ForgotPasswordScreen.js`)
  - Top bar with back-arrow button (same style as ForgotPasswordScreen topBar) and SkillSphere logo wordmark
  - Title: `"Rate Your Experience"`, subtitle: `"Help us improve — your feedback goes to the instructor"`
  - Remove the course-name fetch `useEffect` — `courseName` comes from route params
  - `feedbackData` sent to `feedbackAPI.create`: `{ courseName, feedback: feedback.trim(), rating, courseId }` — no `expertName` field
  - On successful submit: `navigation.replace('CertificatePreview', { courseId, courseName })`
  - Skip button below submit (text only, no border): label `"Skip, get my certificate"` → `navigation.replace('CertificatePreview', { courseId, courseName })`
  - Guidelines bullets: `"What did you enjoy most?"`, `"What could be improved?"`, `"Would you recommend this course?"`, `"How did this help your learning?"`
  - ORANGE constant: `'#F68B3C'` (matches rest of student screens)

- [ ] **Step 2:** Verify syntax:
  ```
  cd AppAndroidSS && node --input-type=module -e "import './src/screens/student/CourseFeedbackScreen.js'" 2>&1 | head -5
  ```
  Expected: either silent or only harmless React Native web shim warnings — no SyntaxError.

---

## Task 3: Frontend — Wire feedback into post-completion navigation

**Files:**
- Modify: `AppAndroidSS/src/navigation/StudentNavigator.js`
- Modify: `AppAndroidSS/src/screens/student/PaymentScreen.js` — lines 69, 96, 126, 211
- Modify: `AppAndroidSS/src/screens/student/QuizResultScreen.js` — line 137
- Modify: `AppAndroidSS/src/screens/student/CourseDetailScreen.js` — line 580

**Interfaces:**
- Consumes: `CourseFeedbackScreen` default export from Task 2
- Route name: `'CourseFeedback'`; params shape: `{ courseId, courseName }`

- [ ] **Step 1:** In `StudentNavigator.js`:
  - Add `import CourseFeedbackScreen from '../screens/student/CourseFeedbackScreen';`
  - Add `<Stack.Screen name="CourseFeedback" component={CourseFeedbackScreen} />` after the `CertificatePreview` Stack.Screen line

- [ ] **Step 2:** In `PaymentScreen.js`, change all four `'CertificatePreview'` navigate calls (lines 69, 96, 126, 211) to `'CourseFeedback'`. Params stay the same: `{ courseId, courseName }`.

- [ ] **Step 3:** In `QuizResultScreen.js` line 137, change `navigate('CertificatePreview', { courseId })` to `navigate('CourseFeedback', { courseId })`.

- [ ] **Step 4:** In `CourseDetailScreen.js` line 580, change `navigate('CertificatePreview',` to `navigate('CourseFeedback',`.

- [ ] **Step 5:** Manual verify in browser: run `npm run dev:web`, complete a payment or quiz flow, confirm the feedback screen appears before the certificate.

---

## Task 4: Remove expert routing + update instructor feedback view

**Files:**
- Modify: `AppAndroidSS/src/screens/instructor/FeedbackScreen.js` — 3 `expertName` references
- Modify: `AppAndroidSS/src/navigation/AppNavigator.js` — remove ExpertNavigator import and route
- Modify: `backend/middleware/auth.js` — remove expert from permissions default
- Modify: `backend/models/User.js` — remove expert from ENUM and permissions fallback

- [ ] **Step 1:** In `FeedbackScreen.js`, replace all 3 occurrences of `feedback.expertName` with `feedback.studentName`.

- [ ] **Step 2:** In `AppNavigator.js`:
  - Remove `import ExpertNavigator from './ExpertNavigator';`
  - Remove the `role === 'expert' ? <Stack.Screen name="Expert" component={ExpertNavigator} /> :` branch — existing expert users now fall through to the default `StudentNavigator`

- [ ] **Step 3:** In `backend/middleware/auth.js`:
  - Change `(user.role === 'instructor' || user.role === 'expert')` to `user.role === 'instructor'`

- [ ] **Step 4:** In `backend/models/User.js`:
  - Change ENUM to `DataTypes.ENUM('student', 'instructor', 'admin')` (remove `'expert'`)
  - Change permissions fallback to `return ['instructor'].includes(this.role) ? {} : null`
  - **Important:** Run the DB Section A SQL (delete expert users) before restarting the server with this change, or Sequelize's alter will fail on existing rows with `role='expert'`

- [ ] **Step 5:** Verify backend modules load:
  ```
  cd backend && node -e "require('./middleware/auth'); require('./models/User'); console.log('OK')"
  ```
  Expected: `OK`

---

## Task 5: DB Cleanup SQL Guide

**Files:**
- Create: `docs/EXPERT_REMOVAL_DB_GUIDE.md`

- [ ] **Step 1:** Create `docs/EXPERT_REMOVAL_DB_GUIDE.md` with the sections below.

### Deployment Order

```
1. Run Section A SQL in cPanel phpMyAdmin (BEFORE uploading new code)
2. Upload new backend + frontend files, run: cd backend && npm install
3. Restart Node.js app in cPanel Setup Node.js App panel
4. Run Section B SQL in cPanel phpMyAdmin (AFTER app restarts)
5. Run Section C to verify
```

### Section A — Run BEFORE deploying new code

```sql
-- 1. Delete all expert user accounts
DELETE FROM users WHERE role = 'expert';

-- 2. Optional: delete legacy expert feedback rows
--    Skip if you want to keep old feedback data (it will show studentName = NULL)
-- DELETE FROM feedbacks WHERE userId IS NULL AND expertName IS NOT NULL;
```

### Section B — Run AFTER deploying and restarting the app

```sql
-- 3. Rename expertName column to studentName
ALTER TABLE feedbacks CHANGE expertName studentName VARCHAR(255) NOT NULL;

-- 4. Add userId column
ALTER TABLE feedbacks ADD COLUMN userId INT NULL;

-- 5. Add FK constraint (safe: nullable + SET NULL)
ALTER TABLE feedbacks ADD CONSTRAINT fk_feedback_userId
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL;

-- 6. Remove expert from role ENUM
--    Only safe after Step A1 has run (no expert rows exist)
ALTER TABLE users
  MODIFY COLUMN role ENUM('student', 'instructor', 'admin') NOT NULL DEFAULT 'student';
```

### Section C — Verify

```sql
-- No expert users remain
SELECT COUNT(*) AS expert_count FROM users WHERE role = 'expert';
-- Expected: 0

-- feedbacks table has new structure
DESCRIBE feedbacks;
-- Expected: studentName column (not expertName), userId column present

-- ENUM updated
SHOW COLUMNS FROM users LIKE 'role';
-- Expected: enum('student','instructor','admin') — no 'expert'
```
