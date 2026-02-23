# Architecture Overview

**Project:** Self-Mastery OS  
**Tagline:** "Build yourself. Daily."  
**Version:** 1.0.0  
**Status:** Foundation Phase

---

## 🎯 System Purpose

A **digital mentor for the unguided** — helping people without clarity or mentors build identity through structured daily execution.

### Core Philosophy (Obliquity Principle)

```
Direct Approach (WRONG):     Complete tasks → Achieve goals → Success
                             │
                             ▼
Indirect Approach (RIGHT):   Build identity → Execute systems → Success (byproduct)
```

We don't optimize for task completion.  
We optimize for **identity formation** and **consistent execution**.

---

## 🏗 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│                         (React + TypeScript)                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   Onboarding    │  │   Daily         │  │   Progress      │         │
│  │   Flow          │  │   Execution     │  │   Dashboard     │         │
│  │                 │  │   Screen        │  │                 │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  State: Zustand (client) + React Query (server cache)                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS / JSON
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                     │
│                       (Node.js + Express)                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  Auth    │  │ Identity │  │ Systems  │  │  Daily   │               │
│  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│                                                                         │
│  Middleware: JWT Auth │ Request Validation │ Error Handling            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SQL (Parameterized)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                    │
│                         (SQLite → PostgreSQL)                           │
│                                                                         │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌────────────┐    │
│  │  users  │ │identities│ │ systems │ │  habits   │ │ daily_logs │    │
│  └─────────┘ └──────────┘ └─────────┘ └───────────┘ └────────────┘    │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐                 │
│  │habit_complete│ │ user_metrics │ │ system_patterns │                 │
│  └─────────────┘ └──────────────┘ └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### 1. User Onboarding Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Landing │ ──▶ │  Sign Up │ ──▶ │ Clarity  │ ──▶ │ Identity │
│   Page   │     │   Form   │     │ Assessment│     │ Creation │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                          │               │
                                          ▼               ▼
                                   ┌──────────────────────────┐
                                   │   Suggested Identity     │
                                   │   "Emerging Builder"     │
                                   └──────────────────────────┘
```

### 2. Daily Execution Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  App     │ ──▶ │  Fetch   │ ──▶ │  Render  │ ──▶ │  User    │
│  Open    │     │  Today   │     │  Screen  │     │  Action  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                          │               │
                                          ▼               ▼
                                   ┌──────────────────────────┐
                                   │   Complete Hard Thing    │
                                   │   + Habits + Reflection  │
                                   └──────────────────────────┘
```

### 3. Adaptive Learning Loop

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │ ──▶ │   Pattern    │ ──▶ │   System     │
│   Executes   │     │   Analysis   │     │   Adjustment │
└──────────────┘     └──────────────┘     └──────────────┘
        │                                       │
        │                                       ▼
        │                              ┌──────────────┐
        │                              │   Optimal    │
        │                              │   Load Level │
        │                              └──────────────┘
        │                                       │
        └───────────────────────────────────────┘
                    (Feedback Loop)
```

---

## 🗂 Project Structure (Monorepo)

```
self-mastery-os/
│
├── docs/                           # Documentation (this folder)
│   ├── 01-ARCHITECTURE_OVERVIEW.md
│   ├── 02-DATABASE_SCHEMA.md
│   ├── 03-API_SPECIFICATION.md
│   ├── 04-FRONTEND_ARCHITECTURE.md
│   └── 05-DEPLOYMENT_GUIDE.md
│
├── packages/
│   │
│   ├── frontend/                   # React Application
│   │   ├── src/
│   │   │   ├── components/         # UI Components
│   │   │   │   ├── common/         # Reusable UI (Button, Input, Card)
│   │   │   │   ├── onboarding/     # Onboarding flow components
│   │   │   │   ├── identity/       # Identity selection/creation
│   │   │   │   ├── system/         # System builder & management
│   │   │   │   ├── daily/          # Daily execution screen
│   │   │   │   └── metrics/        # Progress & analytics
│   │   │   │
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useSystem.ts
│   │   │   │   ├── useDailyLog.ts
│   │   │   │   └── useMetrics.ts
│   │   │   │
│   │   │   ├── stores/             # Zustand state stores
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── systemStore.ts
│   │   │   │   └── uiStore.ts
│   │   │   │
│   │   │   ├── lib/                # Utilities & helpers
│   │   │   │   ├── api.ts          # API client (axios/fetch)
│   │   │   │   ├── utils.ts        # General utilities
│   │   │   │   └── constants.ts    # App constants
│   │   │   │
│   │   │   ├── pages/              # Page components
│   │   │   │   ├── OnboardingPage.tsx
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── SystemPage.tsx
│   │   │   │   └── ProgressPage.tsx
│   │   │   │
│   │   │   ├── types/              # TypeScript types
│   │   │   │   ├── index.ts
│   │   │   │   └── api.ts
│   │   │   │
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   │
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── backend/                    # Node.js API
│       ├── src/
│       │   ├── routes/             # Route handlers
│       │   │   ├── auth.routes.ts
│       │   │   ├── identity.routes.ts
│       │   │   ├── systems.routes.ts
│       │   │   ├── daily.routes.ts
│       │   │   └── metrics.routes.ts
│       │   │
│       │   ├── controllers/        # Business logic
│       │   │   ├── auth.controller.ts
│       │   │   ├── identity.controller.ts
│       │   │   ├── systems.controller.ts
│       │   │   ├── daily.controller.ts
│       │   │   └── metrics.controller.ts
│       │   │
│       │   ├── services/           # Core business services
│       │   │   ├── auth.service.ts
│       │   │   ├── identity.service.ts
│       │   │   ├── systems.service.ts
│       │   │   ├── daily.service.ts
│       │   │   ├── metrics.service.ts
│       │   │   └── adaptive.service.ts
│       │   │
│       │   ├── db/                 # Database layer
│       │   │   ├── index.ts        # DB connection
│       │   │   ├── schema.sql      # Full schema
│       │   │   ├── migrations/     # Schema migrations
│       │   │   └── queries/        # SQL query builders
│       │   │       ├── users.queries.ts
│       │   │       ├── identities.queries.ts
│       │   │       ├── systems.queries.ts
│       │   │       └── daily.queries.ts
│       │   │
│       │   ├── middleware/         # Express middleware
│       │   │   ├── auth.middleware.ts
│       │   │   ├── error.middleware.ts
│       │   │   ├── validation.middleware.ts
│       │   │   └── rateLimit.middleware.ts
│       │   │
│       │   ├── validators/         # Request validation schemas
│       │   │   ├── auth.validator.ts
│       │   │   ├── system.validator.ts
│       │   │   └── daily.validator.ts
│       │   │
│       │   ├── types/              # TypeScript types
│       │   │   ├── express.d.ts
│       │   │   └── index.ts
│       │   │
│       │   ├── config/             # Configuration
│       │   │   ├── index.ts
│       │   │   ├── database.ts
│       │   │   └── jwt.ts
│       │   │
│       │   ├── utils/              # Utilities
│       │   │   ├── password.ts
│       │   │   ├── token.ts
│       │   │   └── logger.ts
│       │   │
│       │   └── index.ts            # Entry point
│       │
│       ├── tests/                  # Test files
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       │
│       ├── prisma/                 # (Optional: if using Prisma)
│       │   └── schema.prisma
│       │
│       ├── .env.example
│       ├── .env
│       ├── tsconfig.json
│       └── package.json
│
├── scripts/                        # Utility scripts
│   ├── seed.ts                     # Database seeding
│   ├── migrate.ts                  # Migration runner
│   └── backup.ts                   # Database backup
│
├── .gitignore
├── README.md
├── TECHNICAL_FOUNDATION.md
└── docker-compose.yml              # (Future: containerization)
```

---

## 🔐 Security Architecture

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │ ──▶ │   API    │ ──▶ │   DB     │ ──▶ │  Client  │
│          │     │          │     │          │     │          │
│  Login   │     │  Verify  │     │  Query   │     │  Set JWT │
│  Request │     │  Password│     │  User    │     │  Cookie  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Token Strategy

| Token Type | Lifetime | Storage | Purpose |
|------------|----------|---------|---------|
| Access Token | 15 min | Memory (client) | API requests |
| Refresh Token | 7 days | HttpOnly Cookie | Token renewal |

### Security Measures

```yaml
Authentication:
  - JWT with RS256 signing
  - Refresh token rotation
  - Session invalidation on logout

Password:
  - bcrypt (12 rounds)
  - Minimum 8 characters
  - Rate limiting on login attempts

API:
  - Rate limiting (100 req/min)
  - Input validation (Zod schemas)
  - SQL injection prevention (parameterized queries)
  - CORS (whitelisted origins)

Data:
  - HTTPS only
  - Encrypted at rest (production)
  - Regular backups
```

---

## 📈 Scalability Path

### Phase 1: MVP (Current)
```
Single Server
├── Node.js API
├── SQLite Database
└── Static Frontend
```

### Phase 2: Growth (1000+ users)
```
┌─────────────────┐
│   Load Balancer │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ API 1 │ │ API 2 │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
   ┌──────────┐
   │PostgreSQL│
   └──────────┘
```

### Phase 3: Scale (10000+ users)
```
┌─────────────────┐
│   CDN (Static)  │
└─────────────────┘
         │
┌─────────────────┐
│   Load Balancer │
└────────┬────────┘
         │
    ┌────┴────┬────┐
    ▼         ▼    ▼
┌───────┐ ┌───────┐ ┌───────┐
│ API 1 │ │ API 2 │ │ API 3 │
└───┬───┘ └───┬───┘ └───┬───┘
    │         │         │
    └────┬────┴────┬────┘
         │         │
         ▼         ▼
   ┌──────────┐ ┌──────┐
   │PostgreSQL│ │Redis │
   │  (Pool)  │ │Cache │
   └──────────┘ └──────┘
```

---

## 🎨 Design Principles

### 1. Identity First
Every screen reinforces **who the user is becoming**, not what they completed.

### 2. Adaptive Load
System difficulty adjusts to user capacity — never overwhelming, never underwhelming.

### 3. Recovery Over Perfection
Missed days trigger **Rebuild Mode**, not punishment.

### 4. Oblique Metrics
Track **discipline**, **consistency**, **recovery** — not task count.

### 5. Minimal Cognitive Load
One primary action per screen. No clutter. No decision fatigue.

---

## 📋 Next Steps

1. **[Database Schema](./02-DATABASE_SCHEMA.md)** — Deep dive into tables, relationships, indexes
2. **[API Specification](./03-API_SPECIFICATION.md)** — Endpoint details, request/response schemas
3. **[Frontend Architecture](./04-FRONTEND_ARCHITECTURE.md)** — Component hierarchy, state management
4. **[Deployment Guide](./05-DEPLOYMENT_GUIDE.md)** — Environment setup, CI/CD, monitoring

---

**Last Updated:** 2026-02-23  
**Maintained By:** Development Team
