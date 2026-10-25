# SkillSphere — Changes Applied

> A structured log of all improvements, bug fixes, and UI redesigns applied to the SkillSphere codebase.

---

## Table of Contents

| # | Change | Type |
|---|--------|------|
| 1 | [Server-Side Pagination](#1-server-side-pagination) | Performance |
| 2 | ["Course Not Found" Bug Fix](#2-course-not-found-bug-fix) | Bug Fix |
| 3 | ["Start Learning" Button Fix](#3-start-learning-button-fix) | Bug Fix |
| 4 | [Topics Not Showing After Add](#4-topics-not-showing-after-add-without-refresh) | Bug Fix |
| 5 | ["Topic Not Found" Flash Before Skeleton](#5-topic-not-found-flash-before-skeleton) | Bug Fix |
| 6 | [Skeleton Loading State](#6-skeleton-loading-state-ailearningscreen) | UI / UX |
| 7 | [Manage Courses Header Redesign](#7-manage-courses-header-redesign) | UI / UX |
| 8 | [StatsCard Component Redesign](#8-statscard-component-redesign) | UI / UX |
| 9 | [Global Stats Fix](#9-global-stats-fix-courselistscreen) | Bug Fix |
| 10 | [DashboardStatCard Redesign (Admin + Instructor)](#10-dashboardstatcard-redesign-admin--instructor-dashboards) | UI / UX |
| 11 | [Student Dashboard Stat Cards Redesign](#11-student-dashboard-stat-cards-redesign) | UI / UX |
| 12 | [Header Search Bar](#12-header-search-bar-replaced-datetime-pill) | Feature |
| 13 | [SKILLSPHERE Text — Mobile Fix](#13-skillsphere-text--mobile-fix) | Bug Fix |

---

## 1. Server-Side Pagination

**Type:** `Performance`

### Problem
All courses were loaded into memory at once via `DataContext`. With 500+ courses this caused:
- Slow initial loads
- Stale data downstream
- "Course not found" errors when navigating to detail screens

### Screens Changed
| Screen | Path |
|--------|------|
| Browse Courses | `screens/student/BrowseCoursesScreen.js` |
| Explore Courses | `screens/auth/ExploreCoursesScreen.js` |
| Course List (Instructor) | `screens/instructor/CourseListScreen.js` |

### Pattern Used
```javascript
const [courses, setCourses]       = useState([]);
const [page, setPage]             = useState(1);
const [hasMore, setHasMore]       = useState(true);
const [total, setTotal]           = useState(0);
const [loadingMore, setLoadingMore] = useState(false);

const fetchPage = async (pageNum = 1, replace = false) => {
  const res = await courseAPI.getAll({ page: pageNum, limit: 20, ...filters });
  setCourses(prev => replace ? res.courses : [...prev, ...res.courses]);
  setHasMore(res.hasMore);
  setTotal(res.total);
};

// Triggered on scroll end
const handleLoadMore = () => {
  if (!hasMore || loadingMore) return;
  const next = page + 1;
  setPage(next);
  fetchPage(next);
};
```

> **Capacity:** No hard limit. Each page loads 20 courses. Infinite scroll continues until `hasMore = false`.

---

## 2. "Course Not Found" Bug Fix

**Type:** `Bug Fix`

### Problem
After pagination, courses no longer lived in `DataContext`. Downstream screens did a **synchronous** `courses.find(id)` which returned `undefined`, causing an instant "Course not found" error screen before any fetch could run.

### Root Cause
`fetchingCourse` was initialized to `false`, so the first render hit the "not found" branch before `useEffect` completed.

### Fix Pattern
```javascript
const [localCourse, setLocalCourse]   = useState(null);
const [fetchingCourse, setFetchingCourse] = useState(true); // true on init prevents flash

useEffect(() => {
  const inContext = courses.find(c => String(c.id) === String(courseId));
  if (inContext) {
    setFetchingCourse(false);
    return;
  }
  getCourseById(courseId)
    .then(res => { if (res.success && res.course) setLocalCourse(res.course); })
    .finally(() => setFetchingCourse(false));
}, []);

const course = courses.find(c => String(c.id) === String(courseId)) || localCourse;

// Render guards
if ((isLoading || fetchingCourse) && !course) return <Spinner />;
if (!course) return <NotFound />;
```

### Files Changed
- `screens/instructor/CourseDetailScreen.js`
- `screens/student/CourseDetailScreen.js`
- `screens/student/AILearningScreen.js`

---

## 3. "Start Learning" Button Fix

**Type:** `Bug Fix`

**Same root cause as [#2](#2-course-not-found-bug-fix).** The student course detail screen did a synchronous `DataContext` lookup which returned `undefined` after pagination moved course data out of context.

**Fix:** Applied the same `fetchingCourse = true` initialization + `getCourseById` fallback pattern.

---

## 4. Topics Not Showing After Add (Without Refresh)

**Type:** `Bug Fix`

### Problem
After adding a topic in `AddTopicsScreen`, `refreshCourse()` called `fetchCourses()` — which fetched all 100 courses into `DataContext`. But the screen read `localCourse || courses.find(...)`, so with `DataContext` stale the **wrong priority** caused the old course version to display.

### Fix
Flip priority so `localCourse` always wins, and use a targeted single-course fetch:

```javascript
// Priority flipped — localCourse takes precedence
const course = localCourse || courses.find(c => String(c.id) === String(courseId));

// Targeted single-course refresh instead of bulk fetchCourses()
const refreshCourse = async () => {
  const res = await getCourseById(courseId);
  if (res.success && res.course) setLocalCourse(res.course);
};
```

### File Changed
- `screens/instructor/AddTopicsScreen.js`

---

## 5. "Topic Not Found" Flash Before Skeleton

**Type:** `Bug Fix`

### Problem
`AILearningScreen` flashed "topic not found" for a split second before skeleton loaded, because `fetchingCourse` was initialized to `false`.

### Fix
Initialize `fetchingCourse = true`. Set to `false` only after the course is found or fetched in `useEffect`. Both `!course || !topic` and `loading` states now render the same `LectureSkeleton`.

---

## 6. Skeleton Loading State (AILearningScreen)

**Type:** `UI / UX`

### Problem
A plain spinner was shown while the AI lecture loaded — no sense of layout or progress.

### Fix
Replaced spinner with an animated `LectureSkeleton` component:

| Feature | Detail |
|---------|--------|
| Animation | `RNAnimated.Value(0)` breathing opacity `0.35 → 0.75` |
| Layout mimic | Icon rail, progress bar, whiteboard block, text lines, controls |

### File Changed
- `screens/student/AILearningScreen.js`

---

## 7. Manage Courses Header Redesign

**Type:** `UI / UX`

### Problem
`CourseListScreen` header was plain text — inconsistent with other admin screens (Categories, etc.) which had a colored banner with back button and icon circle.

### Fix
Added a `pageHeaderBanner` styled like `CategoryManagementScreen`:
- Circular back button
- Colored tint background
- Icon circle with emoji/icon
- Subtitle showing live course count

### File Changed
- `screens/instructor/CourseListScreen.js`

---

## 8. StatsCard Component Redesign

**Type:** `UI / UX`

### Problem
Stat cards across admin/instructor screens were large, plain, vertical cards with no interactivity. On mobile they wrapped text badly.

### Redesign — `components/ui/StatsCard.js`

| Feature | Detail |
|---------|--------|
| Layout | Horizontal compact — icon circle left, value + label + ratio bar right |
| New props | `color`, `ratio` (0–1 progress bar), `onPress`, `isActive` |
| Filter behavior | Tapping a card sets it active — highlighted with accent border + funnel chip |
| Mobile responsive | `useWindowDimensions` — at `width <= 480`: icon `42→32px`, value font `22→16`, label `12→10`, padding `14→10` |
| Text overflow | `numberOfLines={1}` + `adjustsFontSizeToFit` + `minWidth: 0` to allow shrink |
| Backward compatible | `iconColor`, `change`, `variant` props accepted silently |

### Screens Updated
- `CourseListScreen.js`
- `ManageUsersScreen.js`
- `StudentListScreen.js`
- `FeedbackScreen.js`
- `CertificateManagementScreen.js`
- `CategoryManagementScreen.js`

---

## 9. Global Stats Fix (CourseListScreen)

**Type:** `Bug Fix`

### Problem
When a status filter was active (e.g. "Published"), stat card counts reflected only the current 20-course page — not real totals.

> Example: `All Courses: 411, Published: 20, Drafts: 0` — all wrong except "All".

### Fix
Fetch 3 independent counts in parallel using `limit: 1` (server returns `total` with minimal data):

```javascript
const [globalStats, setGlobalStats] = useState({ total: 0, published: 0, draft: 0 });

useEffect(() => {
  const base = (!isSuperInstructor && user?.id) ? { instructorId: user.id } : {};
  Promise.all([
    courseAPI.getAll({ ...base, limit: 1 }),
    courseAPI.getAll({ ...base, status: 'published', limit: 1 }),
    courseAPI.getAll({ ...base, status: 'draft',     limit: 1 }),
  ]).then(([all, pub, drft]) => {
    setGlobalStats({
      total:     all.total  ?? 0,
      published: pub.total  ?? 0,
      draft:     drft.total ?? 0,
    });
  }).catch(() => {});
}, [isSuperInstructor, user?.id]);
```

> Stat cards now always show true server-side totals regardless of active filter.

---

## 10. DashboardStatCard Redesign (Admin + Instructor Dashboards)

**Type:** `UI / UX`

### Problem
Main dashboard stat cards were plain bordered boxes with a colored top strip — generic look, no interactivity.

### Redesign

| Feature | Detail |
|---------|--------|
| Background | `iconColor + '14'` (dark) / `iconColor + '0d'` (light) tinted |
| Left accent | `borderLeftWidth: 4, borderLeftColor: iconColor` |
| Watermark | 72px ghost icon, absolute top-right, `opacity: 0.08` |
| Top row | Small icon badge (30x30) + label + chevron if tappable |
| Value | `fontSize: 28–36`, `adjustsFontSizeToFit`, `minimumFontScale: 0.6` |
| Change badge | `trending-up/down` icon + "X% vs last month" with colored border |
| Shadow | `0 4px 20px rgba(0,0,0,0.06)` on web light mode |
| Border radius | `16` (down from 20) |
| Width | No `maxWidth` cap — cards fill row equally with `flex: 1` |

### Admin Card Navigation
| Card | Navigates To |
|------|-------------|
| Total Instructors | `ManageUsers` (instructor filter) |
| Total Experts | `ManageUsers` (expert filter) |
| Total Courses | `Courses` |
| Total Students | `StudentList` |

### Instructor Card Navigation
| Card | Navigates To |
|------|-------------|
| My Courses | `Courses` |
| Students | `StudentList` |
| Experts | `ManageUsers` (expert filter) |
| Published | `Courses` |

### Files Changed
- `screens/instructor/AdminDashboard.js`
- `screens/instructor/InstructorDashboard.js`

---

## 11. Student Dashboard Stat Cards Redesign

**Type:** `UI / UX`

Replaced old EduView-style cards (colored top border, plain vertical) with the same `DashboardStatCard` design used in admin/instructor dashboards.

| Card | Color | Navigates To |
|------|-------|-------------|
| Enrolled Courses | `#6366F1` Indigo | `EnrolledCourses` |
| In Progress | `#F59E0B` Amber | `EnrolledCourses` |
| Completed | `#10B981` Green | `EnrolledCourses` |
| Certificates | `#8B5CF6` Purple | `Certificates` |

### File Changed
- `screens/student/StudentDashboard.js`

---

## 12. Header Search Bar (Replaced Date/Time Pill)

**Type:** `Feature`

### Problem
The date/time pill in the header was visually cluttered on mobile and provided no functional value.

### Implementation — `components/ui/AppHeader.js`

#### Data Fetching
```javascript
useEffect(() => {
  Promise.all([
    courseAPI.getAll({ limit: 300 }),
    categoryAPI.getAll(),
  ]).then(([cr, catR]) => {
    setAllCourses((cr.courses || []).filter(c => c.status === 'published'));
    setAllCategories(catR.categories || []);
  }).catch(() => {});
}, []);
```

#### Search Filtering
```javascript
const q = searchText.trim().toLowerCase();

const filteredCourses    = q ? allCourses.filter(c =>
  c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
).slice(0, 5) : [];

const filteredCategories = q ? allCategories.filter(c =>
  c.name?.toLowerCase().includes(q)
).slice(0, 3) : [];

const filteredNavItems   = q ? navItems.filter(n =>
  n.label?.toLowerCase().includes(q)
) : [];
```

#### Dropdown Sections
| Section | Source | Max Results |
|---------|--------|-------------|
| Courses | Name or description match | 5 |
| Categories | Name match | 3 |
| Pages | Role's nav items label match | All |

#### Navigation Per Result Type
| Result Type | Student | Instructor / Admin |
|-------------|---------|-------------------|
| Course | `CourseDetail` | `CourseDetail` |
| Category | `BrowseCourses` | `Courses` |
| Nav page | `onNavigate(route)` | `onNavigate(route)` |
| "See all" / submit | `BrowseCourses` | `Courses` |

#### Desktop / Tablet Behavior
- Compact search pill (220px) in header right section
- Focus turns border orange
- Dropdown renders outside `overflow:hidden` container in sticky wrapper
- Native: Modal-based dropdown

#### Mobile Behavior
- Search icon button shown in header
- Tap: header transforms — SKILLSPHERE hides, full-width `TextInput` expands with `autoFocus`
- Dropdown appears below header as results load
- `x` button closes and restores normal header

---

## 13. SKILLSPHERE Text — Mobile Fix

**Type:** `Bug Fix`

### Problem
After making SKILLSPHERE always visible on all screen sizes, the `LandingScreen` showed it **twice** on mobile — once from its own `leftComponent` prop and once from `AppHeader`.

### Fix
Suppress `AppHeader`'s built-in SKILLSPHERE text when a `leftComponent` is provided:

```javascript
{!leftComponent && (
  <Text style={styles.logoText}>
    SKILL<Text style={{ color: '#FF8C42' }}>SPHERE</Text>
  </Text>
)}
```

### Result
| Context | Source | Count |
|---------|--------|-------|
| Landing — mobile | `leftComponent` prop | 1 |
| Landing — desktop | AppHeader logo area | 1 |
| Logged-in — mobile | AppHeader logo area | 1 |
| Logged-in — desktop | AppHeader logo area | 1 |

---

## Files Summary

| File | Changes Applied |
|------|----------------|
| `components/ui/AppHeader.js` | Removed date/time pill, added full search system, mobile inline expand, SKILLSPHERE dedup fix |
| `components/ui/StatsCard.js` | Full redesign — horizontal compact, filter-aware, mobile-responsive |
| `screens/instructor/AdminDashboard.js` | DashboardStatCard redesign — tinted bg, accent strip, watermark, nav |
| `screens/instructor/InstructorDashboard.js` | DashboardStatCard redesign — tinted bg, accent strip, watermark, nav |
| `screens/student/StudentDashboard.js` | DashboardStatCard redesign to match admin/instructor |
| `screens/instructor/CourseListScreen.js` | Pagination, header banner, StatsCard, global stats fix |
| `screens/student/BrowseCoursesScreen.js` | Server-side pagination |
| `screens/auth/ExploreCoursesScreen.js` | Server-side pagination |
| `screens/instructor/CourseDetailScreen.js` | `getCourseById` fallback, `fetchingCourse` guard |
| `screens/student/CourseDetailScreen.js` | `getCourseById` fallback, `fetchingCourse` guard |
| `screens/student/AILearningScreen.js` | `fetchingCourse` guard, `LectureSkeleton` animated loading state |
| `screens/instructor/AddTopicsScreen.js` | `localCourse` priority flip, targeted `refreshCourse` |
| `screens/instructor/ManageUsersScreen.js` | StatsCard applied |
| `screens/instructor/StudentListScreen.js` | StatsCard applied |
| `screens/instructor/FeedbackScreen.js` | StatsCard applied |
| `screens/instructor/CertificateManagementScreen.js` | StatsCard applied |
| `screens/instructor/CategoryManagementScreen.js` | StatsCard applied |
