# Database Schema Specification

**Version:** 1.0.0  
**Status:** Implementation Ready  
**Database:** SQLite (Dev) → PostgreSQL (Production)

---

## 📊 Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
│─────────────────│
│ id              │◄────┐
│ email           │     │
│ password_hash   │     │
│ clarity_level   │     │
│ created_at      │     │
│ updated_at      │     │
└────────┬────────┘     │
         │              │
         │ 1:N          │ 1:N
         ▼              │
┌─────────────────┐     │
│   identities    │     │
│─────────────────│     │
│ id              │◄────┤
│ user_id         │─────┘
│ title           │
│ archetype       │
│ is_active       │
│ created_at      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│    systems      │
│─────────────────│
│ id              │◄────┐
│ user_id         │─────┤
│ identity_id     │─────┘
│ name            │
│ type            │
│ duration_days   │
│ adaptive_load   │
│ is_active       │
│ start_date      │
│ created_at      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│     habits      │
│─────────────────│
│ id              │
│ system_id       │─────┐
│ name            │     │
│ type            │     │
│ frequency       │     │
│ order_priority  │     │
│ is_active       │     │
│ created_at      │     │
└────────┬────────┘     │
         │              │
         │ 1:N          │
         ▼              │
┌─────────────────┐     │
│habit_completions│     │
│─────────────────│     │
│ id              │     │
│ habit_id        │─────┘
│ daily_log_id    │───────┐
│ completed       │       │
│ completed_at    │       │
└─────────────────┘       │
                          │
         ┌────────────────┘
         │ 1:1
         ▼
┌─────────────────┐
│   daily_logs    │
│─────────────────│
│ id              │◄────┐
│ user_id         │─────┘
│ system_id       │
│ date            │
│ hard_thing      │
│ hard_thing_done │
│ habits_completed│
│ habits_total    │
│ reflection_prompt│
│ reflection_resp │
│ mood_score      │
│ energy_score    │
│ created_at      │
│ updated_at      │
└─────────────────┘

┌─────────────────┐
│  user_metrics   │
│─────────────────│
│ id              │
│ user_id         │
│ date            │
│ discipline_score│
│ consistency_rate│
│ hard_thing_rate │
│ recovery_rate   │
│ streak_current  │
│ streak_best     │
│ created_at      │
└─────────────────┘

┌─────────────────┐
│ system_patterns │
│─────────────────│
│ id              │
│ archetype       │
│ pattern_type    │
│ pattern_data    │
│ confidence_score│
│ created_at      │
└─────────────────┘
```

---

## 📋 Table Specifications

### 1. `users`

**Purpose:** Core user authentication and profile data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique user identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User email (login credential) |
| `password_hash` | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| `clarity_level` | VARCHAR(50) | DEFAULT 'exploring' | User's self-assessed clarity: `'clear'`, `'uncertain'`, `'exploring'` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last profile update timestamp |

**Indexes:**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_clarity ON users(clarity_level);
```

**Example Row:**
```json
{
  "id": 1,
  "email": "tumelo@example.com",
  "password_hash": "$2b$12$KIXxvZ8h9N3qL2mP4rT6sO...",
  "clarity_level": "exploring",
  "created_at": "2026-02-23T10:00:00Z",
  "updated_at": "2026-02-23T10:00:00Z"
}
```

---

### 2. `identities`

**Purpose:** User's self-concept and aspirational identity. Users can have multiple identities over time.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique identity identifier |
| `user_id` | INTEGER | FOREIGN KEY → users.id, NOT NULL | Owner of this identity |
| `title` | VARCHAR(100) | NOT NULL | Identity label: e.g., "Emerging Builder", "Future Independent Operator" |
| `archetype` | VARCHAR(50) | NULL | Psychological archetype: `'rebuilder'`, `'explorer'`, `'striver'`, `'builder'` |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether this is current active identity |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When identity was adopted |

**Indexes:**
```sql
CREATE INDEX idx_identities_user ON identities(user_id);
CREATE INDEX idx_identities_active ON identities(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_identities_archetype ON identities(archetype);
```

**Example Row:**
```json
{
  "id": 1,
  "user_id": 1,
  "title": "Emerging Builder",
  "archetype": "explorer",
  "is_active": true,
  "created_at": "2026-02-23T10:05:00Z"
}
```

---

### 3. `systems`

**Purpose:** Repeatable behavior frameworks (not projects — systems).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique system identifier |
| `user_id` | INTEGER | FOREIGN KEY → users.id, NOT NULL | Owner of this system |
| `identity_id` | INTEGER | FOREIGN KEY → identities.id, SET NULL | Linked identity (optional) |
| `name` | VARCHAR(150) | NOT NULL | System name: e.g., "90-Day Discipline System" |
| `type` | VARCHAR(50) | DEFAULT 'general' | System category: `'fitness'`, `'career'`, `'skill'`, `'income'`, `'general'` |
| `duration_days` | INTEGER | DEFAULT 90 | Intended system duration |
| `adaptive_load_level` | INTEGER | DEFAULT 1, CHECK(1-5) | Difficulty level (auto-adjusted) |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether system is currently active |
| `start_date` | DATE | NULL | System start date |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When system was created |

**Indexes:**
```sql
CREATE INDEX idx_systems_user ON systems(user_id);
CREATE INDEX idx_systems_active ON systems(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_systems_type ON systems(type);
CREATE INDEX idx_systems_identity ON systems(identity_id);
```

**Example Row:**
```json
{
  "id": 1,
  "user_id": 1,
  "identity_id": 1,
  "name": "90-Day Discipline System",
  "type": "general",
  "duration_days": 90,
  "adaptive_load_level": 2,
  "is_active": true,
  "start_date": "2026-02-23",
  "created_at": "2026-02-23T10:10:00Z"
}
```

---

### 4. `habits`

**Purpose:** Recurring actions within systems.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique habit identifier |
| `system_id` | INTEGER | FOREIGN KEY → systems.id, CASCADE DELETE, NOT NULL | Parent system |
| `name` | VARCHAR(200) | NOT NULL | Habit name: e.g., "Wake up at 5am", "30-min study block" |
| `type` | VARCHAR(50) | DEFAULT 'keystone' | Habit type: `'keystone'`, `'supporting'`, `'hard_thing'` |
| `frequency` | VARCHAR(20) | DEFAULT 'daily' | Frequency: `'daily'`, `'weekly'`, `'custom'` |
| `order_priority` | INTEGER | DEFAULT 0 | Display order (lower = higher priority) |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether habit is active |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When habit was created |

**Indexes:**
```sql
CREATE INDEX idx_habits_system ON habits(system_id);
CREATE INDEX idx_habits_type ON habits(type);
CREATE INDEX idx_habits_active ON habits(system_id, is_active) WHERE is_active = TRUE;
```

**Example Row:**
```json
{
  "id": 1,
  "system_id": 1,
  "name": "Wake up at 5am",
  "type": "keystone",
  "frequency": "daily",
  "order_priority": 1,
  "is_active": true,
  "created_at": "2026-02-23T10:15:00Z"
}
```

---

### 5. `daily_logs`

**Purpose:** Daily execution tracking — the core behavioral record.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique log identifier |
| `user_id` | INTEGER | FOREIGN KEY → users.id, CASCADE DELETE, NOT NULL | User who executed |
| `system_id` | INTEGER | FOREIGN KEY → systems.id, SET NULL | Primary system for the day (optional) |
| `date` | DATE | NOT NULL | The date this log represents |
| `hard_thing` | TEXT | NULL | The one uncomfortable action for today |
| `hard_thing_completed` | BOOLEAN | DEFAULT FALSE | Whether hard thing was done |
| `habits_completed` | INTEGER | DEFAULT 0 | Count of habits completed |
| `habits_total` | INTEGER | DEFAULT 0 | Total habits for the day |
| `reflection_prompt` | TEXT | NULL | Daily reflection question |
| `reflection_response` | TEXT | NULL | User's reflection answer |
| `mood_score` | INTEGER | CHECK(1-5), NULL | User's mood (1=low, 5=high) |
| `energy_score` | INTEGER | CHECK(1-5), NULL | User's energy level |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When log was created |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX idx_daily_logs_date ON daily_logs(date);
CREATE INDEX idx_daily_logs_system ON daily_logs(system_id);
```

**Constraints:**
- UNIQUE constraint on `(user_id, date)` — one log per user per day

**Example Row:**
```json
{
  "id": 1,
  "user_id": 1,
  "system_id": 1,
  "date": "2026-02-23",
  "hard_thing": "Apply to 3 jobs",
  "hard_thing_completed": true,
  "habits_completed": 3,
  "habits_total": 4,
  "reflection_prompt": "Did your actions match your identity today?",
  "reflection_response": "Yes, I showed up even when I didn't feel like it.",
  "mood_score": 4,
  "energy_score": 3,
  "created_at": "2026-02-23T06:00:00Z",
  "updated_at": "2026-02-23T20:00:00Z"
}
```

---

### 6. `habit_completions`

**Purpose:** Granular tracking of individual habit completions within daily logs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique completion identifier |
| `habit_id` | INTEGER | FOREIGN KEY → habits.id, CASCADE DELETE, NOT NULL | Habit that was completed |
| `daily_log_id` | INTEGER | FOREIGN KEY → daily_logs.id, CASCADE DELETE, NOT NULL | Daily log this belongs to |
| `completed` | BOOLEAN | DEFAULT FALSE | Whether habit was completed |
| `completed_at` | TIMESTAMP | NULL | When completion was recorded |

**Indexes:**
```sql
CREATE INDEX idx_habit_completions_habit ON habit_completions(habit_id);
CREATE INDEX idx_habit_completions_log ON habit_completions(daily_log_id);
CREATE INDEX idx_habit_completions_daily ON habit_completions(daily_log_id, habit_id);
```

**Example Row:**
```json
{
  "id": 1,
  "habit_id": 1,
  "daily_log_id": 1,
  "completed": true,
  "completed_at": "2026-02-23T06:30:00Z"
}
```

---

### 7. `user_metrics`

**Purpose:** Aggregated daily metrics for fast dashboard queries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique metric identifier |
| `user_id` | INTEGER | FOREIGN KEY → users.id, CASCADE DELETE, NOT NULL | User this metric belongs to |
| `date` | DATE | NOT NULL | The date this metric represents |
| `discipline_score` | INTEGER | DEFAULT 0, CHECK(0-100) | Overall discipline score (0-100) |
| `consistency_rate` | REAL | DEFAULT 0, CHECK(0.0-1.0) | Habit completion rate |
| `hard_thing_rate` | REAL | DEFAULT 0, CHECK(0.0-1.0) | Hard thing completion rate |
| `recovery_rate` | REAL | DEFAULT 0, CHECK(0.0-1.0) | Speed of recovery after missed days |
| `streak_current` | INTEGER | DEFAULT 0 | Current day streak |
| `streak_best` | INTEGER | DEFAULT 0 | Best historical streak |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When metric was calculated |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_user_metrics_user_date ON user_metrics(user_id, date);
CREATE INDEX idx_user_metrics_date ON user_metrics(date);
```

**Example Row:**
```json
{
  "id": 1,
  "user_id": 1,
  "date": "2026-02-23",
  "discipline_score": 75,
  "consistency_rate": 0.75,
  "hard_thing_rate": 1.0,
  "recovery_rate": 0.8,
  "streak_current": 5,
  "streak_best": 12,
  "created_at": "2026-02-23T23:59:00Z"
}
```

---

### 8. `system_patterns`

**Purpose:** Learned patterns from successful users for adaptive recommendations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique pattern identifier |
| `archetype` | VARCHAR(50) | NOT NULL | User archetype this pattern applies to |
| `pattern_type` | VARCHAR(50) | NULL | Pattern category: `'successful_habit'`, `'optimal_load'`, `'recovery_pattern'` |
| `pattern_data` | JSON | NOT NULL | Pattern data structure |
| `confidence_score` | REAL | CHECK(0.0-1.0) | Confidence in this pattern |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When pattern was discovered |

**Indexes:**
```sql
CREATE INDEX idx_system_patterns_archetype ON system_patterns(archetype);
CREATE INDEX idx_system_patterns_type ON system_patterns(pattern_type);
```

**Example Row:**
```json
{
  "id": 1,
  "archetype": "explorer",
  "pattern_type": "successful_habit",
  "pattern_data": {
    "habit_name": "Morning movement",
    "completion_rate": 0.85,
    "optimal_time": "06:00-08:00"
  },
  "confidence_score": 0.78,
  "created_at": "2026-02-20T12:00:00Z"
}
```

---

## 🔗 Relationship Rules

### Cascade Behaviors

| Relationship | On Delete | On Update |
|--------------|-----------|-----------|
| `users` → `identities` | CASCADE | CASCADE |
| `users` → `systems` | CASCADE | CASCADE |
| `users` → `daily_logs` | CASCADE | CASCADE |
| `users` → `user_metrics` | CASCADE | CASCADE |
| `identities` → `systems` | SET NULL | CASCADE |
| `systems` → `habits` | CASCADE | CASCADE |
| `systems` → `daily_logs` | SET NULL | CASCADE |
| `habits` → `habit_completions` | CASCADE | CASCADE |
| `daily_logs` → `habit_completions` | CASCADE | CASCADE |

---

## 📜 Full SQL Schema (SQLite)

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- CORE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    clarity_level VARCHAR(50) DEFAULT 'exploring' CHECK(clarity_level IN ('clear', 'uncertain', 'exploring')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL,
    archetype VARCHAR(50) CHECK(archetype IN ('rebuilder', 'explorer', 'striver', 'builder')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    identity_id INTEGER,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) DEFAULT 'general' CHECK(type IN ('fitness', 'career', 'skill', 'income', 'general')),
    duration_days INTEGER DEFAULT 90,
    adaptive_load_level INTEGER DEFAULT 1 CHECK(adaptive_load_level BETWEEN 1 AND 5),
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) DEFAULT 'keystone' CHECK(type IN ('keystone', 'supporting', 'hard_thing')),
    frequency VARCHAR(20) DEFAULT 'daily' CHECK(frequency IN ('daily', 'weekly', 'custom')),
    order_priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    system_id INTEGER,
    date DATE NOT NULL,
    hard_thing TEXT,
    hard_thing_completed BOOLEAN DEFAULT FALSE,
    habits_completed INTEGER DEFAULT 0,
    habits_total INTEGER DEFAULT 0,
    reflection_prompt TEXT,
    reflection_response TEXT,
    mood_score INTEGER CHECK(mood_score BETWEEN 1 AND 5),
    energy_score INTEGER CHECK(energy_score BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE SET NULL,
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS habit_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    daily_log_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    discipline_score INTEGER DEFAULT 0 CHECK(discipline_score BETWEEN 0 AND 100),
    consistency_rate REAL DEFAULT 0 CHECK(consistency_rate BETWEEN 0.0 AND 1.0),
    hard_thing_rate REAL DEFAULT 0 CHECK(hard_thing_rate BETWEEN 0.0 AND 1.0),
    recovery_rate REAL DEFAULT 0 CHECK(recovery_rate BETWEEN 0.0 AND 1.0),
    streak_current INTEGER DEFAULT 0,
    streak_best INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS system_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archetype VARCHAR(50) NOT NULL,
    pattern_type VARCHAR(50),
    pattern_data JSON NOT NULL,
    confidence_score REAL CHECK(confidence_score BETWEEN 0.0 AND 1.0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_clarity ON users(clarity_level);

CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(user_id);
CREATE INDEX IF NOT EXISTS idx_identities_archetype ON identities(archetype);

CREATE INDEX IF NOT EXISTS idx_systems_user ON systems(user_id);
CREATE INDEX IF NOT EXISTS idx_systems_type ON systems(type);
CREATE INDEX IF NOT EXISTS idx_systems_identity ON systems(identity_id);

CREATE INDEX IF NOT EXISTS idx_habits_system ON habits(system_id);
CREATE INDEX IF NOT EXISTS idx_habits_type ON habits(type);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);

CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_log ON habit_completions(daily_log_id);

CREATE INDEX IF NOT EXISTS idx_user_metrics_user_date ON user_metrics(user_id, date);

CREATE INDEX IF NOT EXISTS idx_system_patterns_archetype ON system_patterns(archetype);

-- ============================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_daily_logs_timestamp 
AFTER UPDATE ON daily_logs
BEGIN
    UPDATE daily_logs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- VIEWS (Common queries)
-- ============================================

-- Active systems with habit counts
CREATE VIEW IF NOT EXISTS active_systems_summary AS
SELECT 
    s.id,
    s.name,
    s.type,
    s.adaptive_load_level,
    COUNT(h.id) as habit_count,
    COUNT(CASE WHEN h.type = 'keystone' THEN 1 END) as keystone_count
FROM systems s
LEFT JOIN habits h ON s.id = h.system_id AND h.is_active = TRUE
WHERE s.is_active = TRUE
GROUP BY s.id;

-- User streak calculation
CREATE VIEW IF NOT EXISTS user_streaks AS
SELECT 
    user_id,
    COUNT(*) as consecutive_days
FROM (
    SELECT 
        user_id,
        date,
        date - date('now', '-' || (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC)) || ' days') as streak_group
    FROM daily_logs
    WHERE hard_thing_completed = TRUE
) streak_data
GROUP BY user_id, streak_group
ORDER BY user_id, streak_group DESC;
```

---

## 🔄 Migration Strategy (SQLite → PostgreSQL)

### Key Differences

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Boolean | `BOOLEAN` (0/1) | `BOOLEAN` (true/false) |
| Auto-increment | `AUTOINCREMENT` | `SERIAL` or `GENERATED` |
| JSON | `JSON` (text) | `JSONB` (binary) |
| Timestamps | `TIMESTAMP` | `TIMESTAMPTZ` |

### PostgreSQL Conversion Script

```sql
-- PostgreSQL version of users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    clarity_level VARCHAR(50) DEFAULT 'exploring',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_clarity_level CHECK (clarity_level IN ('clear', 'uncertain', 'exploring'))
);

-- Add index
CREATE INDEX idx_users_email ON users(email);
```

---

## 📊 Sample Queries

### Get Today's Execution Plan

```sql
SELECT 
    h.id,
    h.name,
    h.type,
    h.order_priority,
    COALESCE(hc.completed, FALSE) as completed
FROM habits h
JOIN systems s ON h.system_id = s.id
LEFT JOIN daily_logs dl ON dl.id = (
    SELECT id FROM daily_logs 
    WHERE user_id = s.user_id AND date = DATE('now')
)
LEFT JOIN habit_completions hc ON hc.habit_id = h.id AND hc.daily_log_id = dl.id
WHERE s.user_id = :user_id 
  AND s.is_active = TRUE 
  AND h.is_active = TRUE
ORDER BY h.order_priority ASC;
```

### Calculate Weekly Consistency

```sql
SELECT 
    DATE('now', '-' || (6 - CAST(strftime('%w', 'now') AS INTEGER)) || ' days') as week_start,
    COUNT(*) as total_days,
    SUM(CASE WHEN hard_thing_completed = TRUE THEN 1 ELSE 0 END) as hard_thing_days,
    AVG(CAST(habits_completed AS FLOAT) / NULLIF(habits_total, 0)) as avg_habit_rate
FROM daily_logs
WHERE user_id = :user_id
  AND date >= DATE('now', '-7 days');
```

### Get User's Best Streak

```sql
SELECT MAX(streak_best) as best_streak
FROM user_metrics
WHERE user_id = :user_id;
```

---

**Next:** [API Specification](./03-API_SPECIFICATION.md)

**Last Updated:** 2026-02-23
