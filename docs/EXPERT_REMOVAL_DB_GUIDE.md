# Expert Removal — cPanel SQL Guide

## Order
```
1. Run Section A in phpMyAdmin  (BEFORE uploading new code)
2. Upload files, npm install, restart Node app
3. Run Section B in phpMyAdmin  (AFTER app restarts)
4. Run Section C to verify
```

---

## Section A — Before Deploy

### A0 — Preview Expert Users
```sql
SELECT id, name, email, createdAt FROM users WHERE role = 'expert';
```

### A0b — Preview Expert Data Across Tables
```sql
SELECT 'enrollments'      AS tbl, COUNT(*) AS rows FROM enrollments      WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'progress',                 COUNT(*) FROM progress                 WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'certificates',             COUNT(*) FROM certificates             WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'quiz_results',             COUNT(*) FROM quiz_results             WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'feedbacks',                COUNT(*) FROM feedbacks                WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'todos',                    COUNT(*) FROM todos                    WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'notifications',            COUNT(*) FROM notifications            WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'discussion_posts',         COUNT(*) FROM discussion_posts         WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'ai_chat_sessions',         COUNT(*) FROM ai_chat_sessions         WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'ai_tutor_sessions',        COUNT(*) FROM ai_tutor_sessions        WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'ai_student_memories',      COUNT(*) FROM ai_student_memories      WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'ai_student_progress',      COUNT(*) FROM ai_student_progress      WHERE userId IN (SELECT id FROM users WHERE role = 'expert')
UNION ALL
SELECT 'daily_activities',         COUNT(*) FROM daily_activities         WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A1 — Delete Enrollments
```sql
DELETE FROM enrollments WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A2 — Delete Progress
```sql
DELETE FROM progress WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A3 — Delete Certificates
```sql
DELETE FROM certificates WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A4 — Delete Quiz Results
```sql
DELETE FROM quiz_results WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A5 — Delete Feedbacks
```sql
DELETE FROM feedbacks WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A6 — Delete Todos
```sql
DELETE FROM todos WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A7 — Delete Notifications
```sql
DELETE FROM notifications WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A8 — Delete Discussion Posts
```sql
DELETE FROM discussion_posts WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A9 — Delete AI Chat Sessions
```sql
DELETE FROM ai_chat_sessions WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A10 — Delete AI Tutor Sessions
```sql
DELETE FROM ai_tutor_sessions WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A11 — Delete AI Student Memories
```sql
DELETE FROM ai_student_memories WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A12 — Delete AI Student Progress
```sql
DELETE FROM ai_student_progress WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A13 — Delete Daily Activities
```sql
DELETE FROM daily_activities WHERE userId IN (SELECT id FROM users WHERE role = 'expert');
```

### A14 — Delete Expert Users
```sql
DELETE FROM users WHERE role = 'expert';
```

### A15 — Delete Legacy Feedbacks with No userId (Optional)
```sql
DELETE FROM feedbacks WHERE userId IS NULL;
```

---

## Section B — After Deploy

### B1 — Check feedbacks Table Structure First
```sql
DESCRIBE feedbacks;
```

**Two possible outcomes:**

**Case A — `expertName` exists, `studentName` does NOT exist** (fresh deploy):
```sql
ALTER TABLE feedbacks CHANGE expertName studentName VARCHAR(255) NOT NULL;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS userId INT NULL;
```

**Case B — Both `expertName` and `studentName` exist** (Sequelize already added `studentName`):
```sql
ALTER TABLE feedbacks DROP COLUMN expertName;
```
`userId` is already present in this case — skip the ADD COLUMN step.

### B3 — Add Foreign Key on feedbacks.userId
```sql
ALTER TABLE feedbacks
  ADD CONSTRAINT fk_feedback_userId
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL;
```

### B4 — Remove expert from Role ENUM
```sql
ALTER TABLE users
  MODIFY COLUMN role ENUM('student', 'instructor', 'admin') NOT NULL DEFAULT 'student';
```

---

## Section C — Verify

### C1 — No Expert Users Remain
```sql
SELECT COUNT(*) AS expert_count FROM users WHERE role = 'expert';
```

### C2 — feedbacks Table Structure
```sql
DESCRIBE feedbacks;
```

### C3 — Role ENUM Has No expert
```sql
SHOW COLUMNS FROM users LIKE 'role';
```

### C4 — Feedback Row Count
```sql
SELECT COUNT(*) AS total_feedback FROM feedbacks;
```

### C5 — No Orphaned Rows
```sql
SELECT COUNT(*) FROM enrollments  WHERE userId NOT IN (SELECT id FROM users);
SELECT COUNT(*) FROM progress     WHERE userId NOT IN (SELECT id FROM users);
SELECT COUNT(*) FROM certificates WHERE userId NOT IN (SELECT id FROM users);
SELECT COUNT(*) FROM quiz_results WHERE userId NOT IN (SELECT id FROM users);
```

---

## Rollback

### Restore ENUM
```sql
ALTER TABLE users MODIFY COLUMN role ENUM('student','expert','instructor','admin') NOT NULL DEFAULT 'student';
```

### Restore Column Name
```sql
-- Only if expertName was renamed (Case A). If it was dropped (Case B), data is gone.
ALTER TABLE feedbacks CHANGE studentName expertName VARCHAR(255) NOT NULL;
```
