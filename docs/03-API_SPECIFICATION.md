# API Specification

**Version:** 1.0.0  
**Base URL:** `http://localhost:3001/api/v1`  
**Authentication:** JWT Bearer Token  
**Content Type:** `application/json`

---

## 📡 Authentication

### Token Strategy

```
┌─────────────────────────────────────────────────────────┐
│  Access Token (15 min)                                  │
│  - Stored in memory (client)                            │
│  - Sent as: Authorization: Bearer <token>               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Refresh Token (7 days)                                 │
│  - Stored in HttpOnly cookie                            │
│  - Automatic rotation on use                            │
└─────────────────────────────────────────────────────────┘
```

### Auth Flow

```
1. Login → Receive access + refresh token
2. API Request → Include access token in header
3. Token Expires → Automatic refresh using refresh token
4. Logout → Invalidate both tokens
```

---

## 🔐 Auth Endpoints

### `POST /auth/register`

Create a new user account.

**Request:**
```json
{
  "email": "tumelo@example.com",
  "password": "SecurePass123!",
  "clarity_level": "exploring"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "tumelo@example.com",
      "clarity_level": "exploring",
      "created_at": "2026-02-23T10:00:00Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
    }
  }
}
```

**Validation Rules:**
- `email`: Required, valid email format, unique
- `password`: Required, min 8 characters, must contain letter + number
- `clarity_level`: Optional, one of: `'clear'`, `'uncertain'`, `'exploring'`

**Error Responses:**
```json
// 400 Bad Request - Email already exists
{
  "success": false,
  "error": {
    "code": "EMAIL_EXISTS",
    "message": "An account with this email already exists"
  }
}

// 400 Bad Request - Weak password
{
  "success": false,
  "error": {
    "code": "WEAK_PASSWORD",
    "message": "Password must be at least 8 characters with letters and numbers"
  }
}
```

---

### `POST /auth/login`

Authenticate user and receive tokens.

**Request:**
```json
{
  "email": "tumelo@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "tumelo@example.com",
      "clarity_level": "exploring"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
    }
  }
}
```

**Error Responses:**
```json
// 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

---

### `POST /auth/refresh`

Refresh access token using refresh token.

**Request:** (Refresh token in HttpOnly cookie)
```http
POST /auth/refresh
Cookie: refresh_token=<token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "bmV3IHJlZnJlc2ggdG9rZW4gcm90YXRlZA..."
  }
}
```

**Error Responses:**
```json
// 401 Unauthorized - Invalid refresh token
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token is invalid or expired"
  }
}
```

---

### `POST /auth/logout`

Invalidate all tokens and logout.

**Request:**
```http
POST /auth/logout
Authorization: Bearer <access_token>
Cookie: refresh_token=<token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

---

### `GET /auth/me`

Get current authenticated user.

**Request:**
```http
GET /auth/me
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "tumelo@example.com",
    "clarity_level": "exploring",
    "created_at": "2026-02-23T10:00:00Z",
    "updated_at": "2026-02-23T10:00:00Z"
  }
}
```

---

## 🎭 Identity Endpoints

### `GET /identity`

Get user's current active identity.

**Request:**
```http
GET /identity
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Emerging Builder",
    "archetype": "explorer",
    "is_active": true,
    "created_at": "2026-02-23T10:05:00Z"
  }
}
```

**Response (204 No Content):** — No identity set yet
```json
{
  "success": true,
  "data": null
}
```

---

### `POST /identity`

Create or update user's identity.

**Request:**
```json
{
  "title": "Emerging Builder",
  "archetype": "explorer"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Emerging Builder",
    "archetype": "explorer",
    "is_active": true,
    "created_at": "2026-02-23T10:05:00Z"
  }
}
```

**Validation Rules:**
- `title`: Required, 3-100 characters
- `archetype`: Optional, one of: `'rebuilder'`, `'explorer'`, `'striver'`, `'builder'`

---

### `POST /identity/suggest`

Get AI-suggested identity based on onboarding answers.

**Request:**
```json
{
  "interests": ["fitness", "career growth"],
  "current_situation": "unemployed",
  "goals": ["get a job", "build discipline", "buy a car"],
  "frustrations": ["lack of structure", "procrastination"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "suggested_title": "Emerging Builder",
    "suggested_archetype": "explorer",
    "confidence": 0.85,
    "reasoning": "You show interest in self-improvement and have clear material goals. Your frustration with lack of structure suggests you need external systems.",
    "starter_systems": [
      {
        "name": "90-Day Discipline System",
        "type": "general",
        "habits": ["Wake up at consistent time", "Daily movement", "Skill building block"]
      },
      {
        "name": "Career Foundation System",
        "type": "career",
        "habits": ["Apply to 3 jobs daily", "Learn in-demand skill", "Network outreach"]
      }
    ]
  }
}
```

---

### `GET /identity/history`

Get user's identity history (all past identities).

**Request:**
```http
GET /identity/history
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "title": "Aspiring Athlete",
      "archetype": "builder",
      "is_active": false,
      "created_at": "2026-01-15T08:00:00Z"
    },
    {
      "id": 1,
      "title": "Emerging Builder",
      "archetype": "explorer",
      "is_active": true,
      "created_at": "2026-02-23T10:05:00Z"
    }
  ]
}
```

---

## 🏗️ Systems Endpoints

### `GET /systems`

List all systems for authenticated user.

**Query Parameters:**
- `status`: Filter by status (`active`, `archived`, `all`)
- `type`: Filter by type (`fitness`, `career`, `skill`, `income`, `general`)

**Request:**
```http
GET /systems?status=active&type=general
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "90-Day Discipline System",
      "type": "general",
      "identity_id": 1,
      "duration_days": 90,
      "adaptive_load_level": 2,
      "is_active": true,
      "start_date": "2026-02-23",
      "created_at": "2026-02-23T10:10:00Z",
      "habits_count": 5,
      "completion_rate": 0.75
    }
  ],
  "meta": {
    "total": 1,
    "active": 1,
    "archived": 0
  }
}
```

---

### `POST /systems`

Create a new system.

**Request:**
```json
{
  "name": "90-Day Discipline System",
  "type": "general",
  "identity_id": 1,
  "duration_days": 90,
  "habits": [
    {
      "name": "Wake up at 5am",
      "type": "keystone",
      "frequency": "daily",
      "order_priority": 1
    },
    {
      "name": "30-min study block",
      "type": "keystone",
      "frequency": "daily",
      "order_priority": 2
    },
    {
      "name": "Apply to 3 jobs",
      "type": "hard_thing",
      "frequency": "daily",
      "order_priority": 3
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "90-Day Discipline System",
    "type": "general",
    "identity_id": 1,
    "duration_days": 90,
    "adaptive_load_level": 1,
    "is_active": true,
    "start_date": "2026-02-23",
    "created_at": "2026-02-23T10:10:00Z",
    "habits": [
      {
        "id": 1,
        "name": "Wake up at 5am",
        "type": "keystone",
        "frequency": "daily",
        "order_priority": 1
      },
      {
        "id": 2,
        "name": "30-min study block",
        "type": "keystone",
        "frequency": "daily",
        "order_priority": 2
      },
      {
        "id": 3,
        "name": "Apply to 3 jobs",
        "type": "hard_thing",
        "frequency": "daily",
        "order_priority": 3
      }
    ]
  }
}
```

**Validation Rules:**
- `name`: Required, 5-150 characters
- `type`: Required, one of: `'fitness'`, `'career'`, `'skill'`, `'income'`, `'general'`
- `identity_id`: Optional, must belong to authenticated user
- `duration_days`: Optional, default 90, min 7, max 365
- `habits`: Optional, 1-10 habits, each with required `name`

---

### `GET /systems/:id`

Get detailed system information.

**Request:**
```http
GET /systems/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "90-Day Discipline System",
    "type": "general",
    "identity_id": 1,
    "identity_title": "Emerging Builder",
    "duration_days": 90,
    "adaptive_load_level": 2,
    "is_active": true,
    "start_date": "2026-02-23",
    "created_at": "2026-02-23T10:10:00Z",
    "updated_at": "2026-02-23T10:10:00Z",
    "habits": [
      {
        "id": 1,
        "name": "Wake up at 5am",
        "type": "keystone",
        "frequency": "daily",
        "order_priority": 1,
        "is_active": true,
        "completion_rate": 0.80
      },
      {
        "id": 2,
        "name": "30-min study block",
        "type": "keystone",
        "frequency": "daily",
        "order_priority": 2,
        "is_active": true,
        "completion_rate": 0.65
      }
    ],
    "stats": {
      "total_days": 15,
      "completed_days": 12,
      "current_streak": 5,
      "best_streak": 8,
      "overall_completion_rate": 0.75
    }
  }
}
```

---

### `PUT /systems/:id`

Update an existing system.

**Request:**
```json
{
  "name": "120-Day Discipline System",
  "adaptive_load_level": 3
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "120-Day Discipline System",
    "type": "general",
    "adaptive_load_level": 3,
    "updated_at": "2026-02-24T10:00:00Z"
  }
}
```

---

### `DELETE /systems/:id`

Archive (soft delete) a system.

**Request:**
```http
DELETE /systems/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "is_active": false,
    "archived_at": "2026-02-24T10:00:00Z"
  },
  "message": "System archived successfully"
}
```

---

### `POST /systems/:id/habits`

Add a habit to an existing system.

**Request:**
```json
{
  "name": "Evening reflection",
  "type": "supporting",
  "frequency": "daily",
  "order_priority": 4
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "system_id": 1,
    "name": "Evening reflection",
    "type": "supporting",
    "frequency": "daily",
    "order_priority": 4,
    "is_active": true,
    "created_at": "2026-02-24T10:00:00Z"
  }
}
```

---

### `GET /systems/:id/today`

Get today's execution plan for a system.

**Request:**
```http
GET /systems/1/today
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "date": "2026-02-23",
    "system": {
      "id": 1,
      "name": "90-Day Discipline System",
      "adaptive_load_level": 2
    },
    "hard_thing_suggestion": "What uncomfortable action moves your life forward today?",
    "habits": [
      {
        "id": 1,
        "name": "Wake up at 5am",
        "type": "keystone",
        "order_priority": 1,
        "completed": false
      },
      {
        "id": 2,
        "name": "30-min study block",
        "type": "keystone",
        "order_priority": 2,
        "completed": true,
        "completed_at": "2026-02-23T06:30:00Z"
      },
      {
        "id": 3,
        "name": "Apply to 3 jobs",
        "type": "hard_thing",
        "order_priority": 3,
        "completed": false
      }
    ],
    "reflection_prompt": "Did your actions today match your identity as an Emerging Builder?"
  }
}
```

---

## 📅 Daily Execution Endpoints

### `GET /daily/today`

Get or create today's daily log.

**Request:**
```http
GET /daily/today
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "date": "2026-02-23",
    "system_id": 1,
    "system_name": "90-Day Discipline System",
    "hard_thing": null,
    "hard_thing_completed": false,
    "habits_completed": 2,
    "habits_total": 4,
    "reflection_prompt": "Did your actions today match your identity?",
    "reflection_response": null,
    "mood_score": null,
    "energy_score": null,
    "created_at": "2026-02-23T00:00:00Z",
    "updated_at": "2026-02-23T12:00:00Z"
  }
}
```

---

### `PUT /daily/:id`

Update daily log (partial updates allowed).

**Request:**
```json
{
  "hard_thing": "Apply to 3 jobs",
  "hard_thing_completed": true,
  "mood_score": 4,
  "energy_score": 3
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "date": "2026-02-23",
    "hard_thing": "Apply to 3 jobs",
    "hard_thing_completed": true,
    "habits_completed": 3,
    "habits_total": 4,
    "mood_score": 4,
    "energy_score": 3,
    "updated_at": "2026-02-23T20:00:00Z"
  }
}
```

---

### `POST /daily/:id/habits/:habitId/complete`

Mark a specific habit as completed.

**Request:**
```http
POST /daily/1/habits/2/complete
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "habit_id": 2,
    "daily_log_id": 1,
    "completed": true,
    "completed_at": "2026-02-23T06:30:00Z"
  }
}
```

---

### `POST /daily/:id/complete`

Mark the day as complete (final submission).

**Request:**
```json
{
  "reflection_response": "Yes, I showed up even when I didn't feel like it. The hard thing was uncomfortable but I did it first.",
  "mood_score": 4,
  "energy_score": 3
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "date": "2026-02-23",
    "hard_thing_completed": true,
    "habits_completed": 4,
    "habits_total": 4,
    "reflection_response": "Yes, I showed up even when I didn't feel like it. The hard thing was uncomfortable but I did it first.",
    "mood_score": 4,
    "energy_score": 3,
    "day_complete": true,
    "completed_at": "2026-02-23T21:00:00Z"
  },
  "message": "Day completed! Great work."
}
```

---

### `GET /daily/history`

Get daily log history with optional date range.

**Query Parameters:**
- `start_date`: Start of date range (ISO format)
- `end_date`: End of date range (ISO format)
- `limit`: Number of records (default 30, max 90)

**Request:**
```http
GET /daily/history?start_date=2026-02-01&end_date=2026-02-23&limit=30
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2026-02-23",
      "hard_thing": "Apply to 3 jobs",
      "hard_thing_completed": true,
      "habits_completed": 4,
      "habits_total": 4,
      "mood_score": 4,
      "energy_score": 3
    },
    {
      "id": 2,
      "date": "2026-02-22",
      "hard_thing": "Update resume",
      "hard_thing_completed": true,
      "habits_completed": 3,
      "habits_total": 4,
      "mood_score": 3,
      "energy_score": 3
    }
  ],
  "meta": {
    "total": 23,
    "hard_thing_completion_rate": 0.87,
    "habit_completion_rate": 0.78,
    "average_mood": 3.5,
    "average_energy": 3.2
  }
}
```

---

## 📊 Metrics Endpoints

### `GET /metrics/summary`

Get overall metrics summary.

**Request:**
```http
GET /metrics/summary
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "discipline_score": 75,
    "consistency_rate": 0.78,
    "hard_thing_rate": 0.87,
    "recovery_rate": 0.80,
    "streak_current": 5,
    "streak_best": 12,
    "total_days_tracked": 23,
    "total_hard_things_completed": 20,
    "total_habits_completed": 72,
    "average_mood": 3.5,
    "average_energy": 3.2
  }
}
```

**Metric Calculations:**
```typescript
discipline_score = (hard_thing_rate * 0.4 + consistency_rate * 0.4 + recovery_rate * 0.2) * 100
consistency_rate = habits_completed / habits_total
hard_thing_rate = days_hard_thing_done / total_days
recovery_rate = 1 - (missed_days_after_miss / total_miss_opportunities)
```

---

### `GET /metrics/weekly`

Get weekly trend data for charts.

**Query Parameters:**
- `weeks`: Number of weeks (default 4, max 12)

**Request:**
```http
GET /metrics/weekly?weeks=4
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "weeks": [
      {
        "week_start": "2026-02-17",
        "week_end": "2026-02-23",
        "discipline_score": 75,
        "consistency_rate": 0.78,
        "hard_thing_rate": 0.86,
        "days_active": 6
      },
      {
        "week_start": "2026-02-10",
        "week_end": "2026-02-16",
        "discipline_score": 68,
        "consistency_rate": 0.70,
        "hard_thing_rate": 0.71,
        "days_active": 5
      }
    ]
  }
}
```

---

### `GET /metrics/streak`

Get current and best streak information.

**Request:**
```http
GET /metrics/streak
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "streak_current": 5,
    "streak_best": 12,
    "streak_type": "hard_thing",
    "last_completed_date": "2026-02-23",
    "next_milestone": 7,
    "days_until_milestone": 2
  }
}
```

---

## 🔄 Adaptive Engine Endpoints (Future)

### `POST /adaptive/adjust`

Trigger adaptive load adjustment based on performance.

**Request:**
```http
POST /adaptive/adjust
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "system_id": 1,
    "previous_load_level": 2,
    "new_load_level": 3,
    "reason": "Consistent 80%+ completion rate for 14 days",
    "recommendations": [
      "Add one more keystone habit",
      "Increase hard thing difficulty"
    ]
  }
}
```

---

## ❌ Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional validation errors
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Valid token but insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate email) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Validation Error Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

---

## 🚦 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/*` | 10 requests | 1 minute |
| `/api/*` (general) | 100 requests | 1 minute |
| `/api/daily/*` | 200 requests | 1 minute |

**Rate Limit Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1645632000
```

**Rate Limit Exceeded Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "retry_after": 60
  }
}
```

---

## 🔧 Request/Response Middleware

### Request Headers (Required)

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Response Headers (Standard)

```http
Content-Type: application/json
X-Request-Id: <unique-id>
X-Response-Time: <ms>
```

---

## 📝 Next Steps

1. **[Frontend Architecture](./04-FRONTEND_ARCHITECTURE.md)** — Component design, state management
2. **[Deployment Guide](./05-DEPLOYMENT_GUIDE.md)** — Environment setup, CI/CD

**Last Updated:** 2026-02-23
