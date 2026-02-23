# 📘 Self-Mastery OS - Complete Documentation Index

**Tagline:** Build yourself. Daily.  
**Version:** 1.0.0  
**Status:** Foundation Complete

---

## 🎯 Start Here

### New to the Project?

1. **[README.md](../README.md)** — Project overview, vision, and quick introduction
2. **[SETUP.md](../SETUP.md)** — 5-minute setup guide to get running
3. **[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)** — What's complete, what's next

### Understanding the Philosophy

This project is built on the principle of **Obliquity** from John Kay's book:

> Complex goals are best achieved indirectly.

Instead of "complete more tasks," we help users "become the kind of person who completes hard things naturally."

---

## 📚 Technical Documentation

### For Developers

| Document | Purpose | Read This When... |
|----------|---------|-------------------|
| **[01-ARCHITECTURE_OVERVIEW.md](./01-ARCHITECTURE_OVERVIEW.md)** | System design, data flow, project structure | Starting development, understanding the big picture |
| **[02-DATABASE_SCHEMA.md](./02-DATABASE_SCHEMA.md)** | Database tables, relationships, queries | Working with data, adding features |
| **[03-API_SPECIFICATION.md](./03-API_SPECIFICATION.md)** | API endpoints, request/response formats | Building frontend, testing backend |
| **[04-FRONTEND_ARCHITECTURE.md](./04-FRONTEND_ARCHITECTURE.md)** | Components, state management, types | Building UI, adding pages |
| **[05-DEPLOYMENT_GUIDE.md](./05-DEPLOYMENT_GUIDE.md)** | Environment setup, CI/CD, monitoring | Ready to deploy, scaling |

### Quick Reference

```
Architecture: docs/01-ARCHITECTURE_OVERVIEW.md
Database:     docs/02-DATABASE_SCHEMA.md
API:          docs/03-API_SPECIFICATION.md
Frontend:     docs/04-FRONTEND_ARCHITECTURE.md
Deployment:   docs/05-DEPLOYMENT_GUIDE.md
```

---

## 🗂 Project Structure

```
self-mastery-os/
│
├── docs/                           # All documentation
│   ├── 01-ARCHITECTURE_OVERVIEW.md
│   ├── 02-DATABASE_SCHEMA.md
│   ├── 03-API_SPECIFICATION.md
│   ├── 04-FRONTEND_ARCHITECTURE.md
│   └── 05-DEPLOYMENT_GUIDE.md
│
├── packages/
│   ├── backend/                    # Node.js API
│   │   ├── src/
│   │   │   ├── controllers/       # Request handlers
│   │   │   ├── routes/            # Route definitions
│   │   │   ├── services/          # Business logic
│   │   │   ├── middleware/        # Auth, validation, error handling
│   │   │   ├── db/                # Database connection & schema
│   │   │   ├── utils/             # Helpers (token, password)
│   │   │   └── index.ts           # Entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                   # React Application
│       ├── src/
│       │   ├── components/        # UI components
│       │   ├── pages/             # Route pages
│       │   ├── stores/            # State management (Zustand)
│       │   ├── lib/               # API client, utilities
│       │   ├── types/             # TypeScript types
│       │   ├── App.tsx            # Root component
│       │   ├── main.tsx           # Entry point
│       │   └── index.css          # Global styles
│       ├── package.json
│       └── vite.config.ts
│
├── README.md                       # Project overview
├── SETUP.md                        # Quick start guide
├── TECHNICAL_FOUNDATION.md         # Initial technical spec
└── IMPLEMENTATION_STATUS.md        # Current progress
```

---

## 🚀 Quick Start Commands

```bash
# Install all dependencies
npm run install:all

# Set up environment
cd packages/backend && cp .env.example .env
cd ../frontend && cp .env.example .env

# Initialize database
cd packages/backend && npm run db:init

# Start development
cd ../.. && npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001/api/v1
- Health: http://localhost:3001/api/health

---

## 🎓 Learning Path

### Beginner (New to Project)

1. Read [README.md](../README.md) — Understand the vision
2. Follow [SETUP.md](../SETUP.md) — Get it running
3. Browse [01-ARCHITECTURE_OVERVIEW.md](./01-ARCHITECTURE_OVERVIEW.md) — See the big picture
4. Explore the code — Start with `packages/frontend/src/pages/`

### Intermediate (Ready to Contribute)

1. Read [02-DATABASE_SCHEMA.md](./02-DATABASE_SCHEMA.md) — Understand data model
2. Read [03-API_SPECIFICATION.md](./03-API_SPECIFICATION.md) — Learn API patterns
3. Pick a feature from [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)
4. Implement and test

### Advanced (Building Features)

1. Review [04-FRONTEND_ARCHITECTURE.md](./04-FRONTEND_ARCHITECTURE.md) — Component patterns
2. Review [05-DEPLOYMENT_GUIDE.md](./05-DEPLOYMENT_GUIDE.md) — Deployment strategy
3. Check [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) — Current priorities
4. Build, test, submit PR

---

## 🔑 Key Concepts

### Identity-First Design

Users don't start with tasks. They start with:

> "Who am I becoming?"

Example identities:
- "Emerging Builder"
- "Future Independent Operator"
- "Physical Transformer"

### Systems Over Goals

Not projects — **systems**. Repeatable behavior frameworks.

Example:
```
90-Day Discipline System
├── Wake up at 5am (Keystone)
├── 30-min study block (Keystone)
├── Apply to 3 jobs (Hard Thing)
└── Evening reflection (Supporting)
```

### Oblique Metrics

Instead of "tasks completed":
- **Discipline Score** (0-100)
- **Consistency Rate** (%)
- **Hard Thing Rate** (%)
- **Recovery Rate** (%)

### Adaptive Load

System adjusts difficulty based on performance:
- 80%+ completion → Increase challenge
- <50% completion → Reduce load
- Missed days → Recovery mode

---

## 📞 Getting Help

### Documentation Issues

- Can't find what you need? Check the [INDEX.md](./INDEX.md)
- Confused about architecture? See [01-ARCHITECTURE_OVERVIEW.md](./01-ARCHITECTURE_OVERVIEW.md)
- Setup problems? Review [SETUP.md](../SETUP.md)

### Code Issues

- Backend error? Check `packages/backend/src/`
- Frontend error? Check `packages/frontend/src/`
- Database error? Review `packages/backend/src/db/schema.sql`

### Feature Requests

- Check [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) for roadmap
- Review [README.md](../README.md) for vision alignment
- Open issue with clear description

---

## 🎯 Current Priorities

### Phase 1: Authentication (In Progress)

- [x] Backend auth endpoints
- [x] Frontend auth pages
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Token refresh implementation

### Phase 2: Identity & Onboarding

- [x] Identity endpoints
- [ ] Onboarding flow UI
- [ ] Identity suggestion logic
- [ ] Identity creation

### Phase 3: System Builder

- [x] System endpoints
- [ ] System builder UI
- [ ] Habit builder
- [ ] System list view

---

## 📊 Project Stats

| Metric | Count |
|--------|-------|
| Documentation Pages | 5 core + extras |
| API Endpoints | 25+ |
| Database Tables | 8 |
| Frontend Pages | 8 |
| TypeScript Types | 15+ |
| Total Files | 40+ |

---

## 🔮 Roadmap

### Q1 2026 — Foundation
- ✅ Architecture design
- ✅ Database schema
- ✅ API specification
- ⏳ Core implementation

### Q2 2026 — Core Features
- Identity system
- System builder
- Daily execution
- Metrics dashboard

### Q3 2026 — Intelligence
- Adaptive load engine
- Pattern detection
- AI suggestions

### Q4 2026 — Modules
- Career module
- Fitness module
- ApplyMate integration

---

## 🤝 Contributing

1. Read the docs first
2. Understand the philosophy (Obliquity)
3. Start small (bug fixes, small features)
4. Test thoroughly
5. Submit PR with clear description

---

## 📄 License

MIT License — see [LICENSE](../LICENSE) for details.

---

## 💭 Final Thought

> "We don't rise to the level of our goals. We fall to the level of our systems."

This isn't a to-do app.  
This is a **Self-Mastery Operating System**.

**Build yourself. Daily.**

---

**Last Updated:** 2026-02-23  
**Maintained By:** Development Team  
**Contact:** See [README.md](../README.md)
