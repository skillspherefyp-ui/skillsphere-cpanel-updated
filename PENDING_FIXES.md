# Pending Fixes — SkillSphere

## Phase 1 — Backend only (upload files, pm2 restart skillsphere)

### Fix 1 — DB connection pool
**File:** `backend/config/database.js`
**Lines:** 41–44 and 57–60 (both pool blocks)
**Change:**
```js
pool: { max: 20, min: 2, acquire: 30000, idle: 10000 }
```
**Note:** Check MySQL max_connections first: `SHOW VARIABLES LIKE 'max_connections';` — if it's 150, max: 20 is safe.

---

### Fix 2 — Wire up generalLimiter globally
**File:** `backend/server.js`
**Where:** Before the route registrations (~line 193)
**Change:** Add one line:
```js
app.use(generalLimiter);
```
Also add the import at the top if not already there:
```js
const { authLimiter, aiLimiter, generalLimiter } = require('./middleware/rateLimiter');
```

---

### Fix 3 — Scope 50MB body limit to upload routes only
**File:** `backend/server.js`
**Change global limit:**
```js
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```
**Then add 50mb override on these route files** (`backend/routes/`):
- `uploadRoutes.js`
- `courseRoutes.js` (PDF text during course creation)
- `aiTutorRoutes.js` (lecture content)
- `authRoutes.js` (profile picture base64)

Add at top of each of those route files:
```js
router.use(express.json({ limit: '50mb' }));
```

---

### Fix 4 — analyticsController unbounded queries
**File:** `backend/controllers/analyticsController.js`
**Lines:** 27, 48, 83, 94, 129, 187–213, 268
**Change:** Add `limit` to each `findAll` that doesn't have one:
```js
// example
const sessions = await AITutorSession.findAll({
  where: { ... },
  limit: 500,           // add this
  order: [['createdAt', 'DESC']],
});
```
Use `limit: 500` for session/message/memory queries, `limit: 1000` for enrollment queries.

---

### Fix 5A — generationJobs Map memory leak
**File:** `backend/services/aiTutorService.js`
**Where:** Wherever a job is set as complete or failed in the `generationJobs` Map
**Change:** After marking a job done/failed, delete it:
```js
generationJobs.delete(jobKey);
```
Search for `generationJobs.set` and `status: 'completed'` / `status: 'failed'` blocks — add the delete after each.

---

### Fix 5B — generationJobs survive server restart (do before Fix 7)
**File:** `backend/services/aiTutorService.js`
**What:** Replace `generationJobs.get/set` with DB queries using the `AILecture` model's existing status field.
- `startCourseGeneration` — check `AILecture` status instead of Map
- `getGenerationStatus` — query DB instead of Map
- `startSingleTopicGeneration` — same
**Effort:** 1–2 hours. Read all `generationJobs` usages first (lines 1270, 1302, 1330, 1347, 1544, 1556, 1579).

---

### Fix 6 — Rate limiter persistent store (low priority)
**Files:** `backend/middleware/rateLimiter.js`, `backend/package.json`
**Install:** `npm install rate-limit-sequelize`
**Change:** Add `store` option to all three limiters using the Sequelize instance.
Only needed if you ever run multiple PM2 processes or want counters to survive restarts.

---

## Phase 2 — PM2 cluster (do after Fix 5B)

### Fix 7 — PM2 cluster mode
**Create on server:** `backend/ecosystem.config.js`
```js
module.exports = {
  apps: [{
    name: 'skillsphere',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    cwd: '/path/to/backend',
  }]
};
```
**Then on server:**
```bash
pm2 delete skillsphere
pm2 start ecosystem.config.js
pm2 save
```
**Requires Fix 5B first** — generationJobs Map must be replaced with DB before clustering or job state won't be shared between processes.

---

## Phase 3 — Frontend (rebuild + re-upload public_html)

### Fix 9 — Course pagination on BrowseCoursesScreen + downstream screen fallbacks

**When:** Only needed at 300+ courses. Currently fine at 150.
**Status:** Downstream fallbacks (Part B) implemented. BrowseCoursesScreen pagination (Part A) pending.

---

#### Part A — BrowseCoursesScreen (pending)

**Approach:** BrowseCoursesScreen gets its own local paginated fetch. DataContext stays unchanged.
**File:** `AppAndroidSS/src/screens/student/BrowseCoursesScreen.js`
- Local state: `localCourses`, `page`, `hasMore`, `total`
- Filtering moves server-side (search/category/level/sort all sent as query params)
- Client-side `filteredCourses` useMemo replaced with server response
- Stats `totalCourses` comes from API `total` field
- Roadmap mode: fetch with `limit=500` when `sortOrder === 'roadmap'` so chains are complete
- Backend already supports all params: `?search=&category=&level=&sort=&page=&limit=`
- Test locally with `limit=3` first, then deploy with `limit=20`

**Test plan (local):**
1. Set `limit=3` in fetch call
2. Load screen → 3 courses shown, Load More visible
3. Click Load More → more courses appended
4. Type in search → server call, correct results
5. Change filter → resets to page 1
6. Pull to refresh → reloads from page 1
7. Change `limit=3` → `limit=20` before deploying

---

#### Part B — Downstream screen fallbacks (implemented)

**Problem:** After Part A, BrowseCoursesScreen will show courses beyond the first 100 that DataContext holds. When a student taps one of those courses, the downstream screens all do `courses.find(c => c.id === courseId)` from DataContext and get `undefined` — causing blank screens or stuck loading states.

All three downstream screens affected:
- `CourseDetailScreen.js:139` — `const course = courses.find(c => c.id === courseId)`
- `LearningScreen.js:569` — `const course = courses.find(c => c.id === courseId)`
- `AILearningScreen.js:256` — `const course = courses.find(item => String(item.id) === String(courseId))`

**Fix applied to each screen:**
1. Added `getCourseById` to `useData()` destructure
2. Added `const [localCourse, setLocalCourse] = useState(null)`
3. Changed `courses.find(...)` → `courses.find(...) || localCourse`
4. Added `useEffect` — if course not found in DataContext, fetches it individually via `GET /courses/:id`

`getCourseById` returns the full course object with topics, so all topic lookups and navigation work correctly once the individual fetch completes.

**Files changed:**
- `AppAndroidSS/src/screens/student/CourseDetailScreen.js`
- `AppAndroidSS/src/screens/student/LearningScreen.js`
- `AppAndroidSS/src/screens/student/AILearningScreen.js`

---

## Fix 10 — `listLectures` returns oversized payload (unused LONGTEXT fields)

**Priority:** High — affects every instructor on every course open
**Phase:** Backend only (upload + pm2 restart)

---

### Background

`GET /ai-tutor/courses/:courseId/lectures` is called by the instructor's topic management screen (`AddTopicsScreen`) to show generation status badges per topic (Ready, Processing, Failed). This is a **generation management** call — not lecture delivery.

The delivery flow is completely separate:
- `POST /ai-tutor/topics/:topicId/start` (`startSession`) — returns full lecture object to student
- `POST /ai-tutor/sessions/:sessionId/next` (`getNextChunk`) — streams chunks to student

`listLectures` is never called during delivery. Only called once — from `AddTopicsScreen` on mount.

---

### Problem

`listLectures` does a bare `findAll` with no `attributes` projection, so Sequelize runs `SELECT *`:

```js
// backend/controllers/aiTutorController.js:168
const lectures = await AILecture.findAll({
  where: req.query.topicId
    ? { courseId: req.params.courseId, topicId: req.query.topicId }
    : { courseId: req.params.courseId },
  include: [{ model: Topic, as: 'topic' }],
  order: [['createdAt', 'ASC']]
});
```

This fetches every column including:

| Column | DB Type | Typical Size per Row | Used by AddTopicsScreen |
|---|---|---|---|
| `teachingScript` | `LONGTEXT` | 5,000–15,000 words | No — never read |
| `summary` | `TEXT('long')` | 500–2,000 words | No — never read |
| `preparationNotes` | `JSON` | variable blob | No — never read |

**`teachingScript`** is a backend-only field. It is generated by OpenAI, stored once, and used only inside `backend/services/aiTutorService.js` to build lecture chunks. After chunks are created it has no purpose. It does not appear in any screen or component in the frontend codebase.

**`summary`** is used in `AILearningScreen.js` but only from the `startSession` response — a completely different API call. It is not read from the `listLectures` response anywhere in the app.

---

### What AddTopicsScreen Actually Reads

```js
// AppAndroidSS/src/screens/instructor/AddTopicsScreen.js:161-165
setLectureMetaByTopic(
  (response.lectures || []).reduce((acc, lecture) => {
    acc[lecture.topicId] = lecture;
    return acc;
  }, {})
);
```

Fields rendered per topic card:
- `lecture.status` — Ready / Processing / Failed badge
- `lecture.title` — lecture title
- `lecture.topicId` — map key
- `lecture.estimatedDurationMinutes` — duration display
- `lecture.errorMessage` — shown on failed state
- `lecture.createdAt` — timestamp

6 small fields. Everything else is stored in state and never accessed.

---

### Effect

Example: instructor with a 100-topic course opens AddTopicsScreen.

| Data transferred | Approximate size |
|---|---|
| `teachingScript` x 100 | 2–5 MB |
| `summary` x 100 | ~300 KB |
| `preparationNotes` x 100 | ~50 KB |
| Fields actually used | ~20 KB |

- Several MB downloaded and discarded on every screen open
- MySQL reads `LONGTEXT` off-page from InnoDB storage — 100 topics = 100+ off-page reads per request
- Fires on every navigation to AddTopicsScreen, including after triggering generation
- On Android (mobile network) a 3–5 MB response causes visible delay before screen renders
- Concurrent instructors multiply the DB read amplification

---

### Why Not Pagination

`topicId` has a `UNIQUE` constraint in the model (`backend/models/AILecture.js:22`), so there is exactly one lecture per topic maximum. Row count is always equal to topic count — naturally bounded. Pagination adds complexity with zero benefit here. The correct fix is field projection only.

---

### Solution

Add `attributes` to the `findAll` call.

**File:** `backend/controllers/aiTutorController.js`

```js
// BEFORE (line 168)
const lectures = await AILecture.findAll({
  where: req.query.topicId
    ? { courseId: req.params.courseId, topicId: req.query.topicId }
    : { courseId: req.params.courseId },
  include: [{ model: Topic, as: 'topic' }],
  order: [['createdAt', 'ASC']]
});
```

```js
// AFTER
const lectures = await AILecture.findAll({
  where: req.query.topicId
    ? { courseId: req.params.courseId, topicId: req.query.topicId }
    : { courseId: req.params.courseId },
  attributes: ['id', 'topicId', 'title', 'status', 'estimatedDurationMinutes', 'errorMessage', 'createdAt'],
  include: [{ model: Topic, as: 'topic' }],
  order: [['createdAt', 'ASC']]
});
```

No frontend changes needed.

---

### Files Involved

| File | Change |
|---|---|
| `backend/controllers/aiTutorController.js` | Add `attributes` projection on line 168 |

---

### Verification After Fix

1. Open instructor course with 20+ topics — screen loads faster
2. Network tab: response payload drops from MB range to ~20 KB
3. Generation status badges (Ready / Processing / Failed) still render correctly
4. Triggering generation and reloading still works
5. Student delivery flow (`startSession`, `getNextChunk`) completely unaffected — separate API calls
