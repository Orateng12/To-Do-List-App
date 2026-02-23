# Clear Architecture Overview

> **High-level system architecture for the Clear identity-based life operating system**

---

## 🎯 System Vision

Clear is an **identity-first life operating system** that helps users gain clarity, build momentum, and execute systems that transform their lives.

### Core Philosophy

```
Identity → Systems → Habits → Actions → Results
   ↑                                    │
   └──────────── Feedback Loop ─────────┘
```

Unlike traditional task managers that focus on outcomes, Clear focuses on **who you become**.

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │              ClearUIRenderer                       │  │
│  │  - Onboarding View                                 │  │
│  │  - Dashboard View                                  │  │
│  │  - Daily Execution View                            │  │
│  │  - Systems View                                    │  │
│  │  - Analytics View                                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Domain Layer                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │               ClearEngine                          │  │
│  │                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │  Archetype   │  │   Identity   │              │  │
│  │  │   System     │  │   Manager    │              │  │
│  │  └──────────────┘  └──────────────┘              │  │
│  │                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │    System    │  │    Habit     │              │  │
│  │  │   Manager    │  │   Manager    │              │  │
│  │  └──────────────┘  └──────────────┘              │  │
│  │                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │    Daily     │  │   Metrics    │              │  │
│  │  │  Execution   │  │   Engine     │              │  │
│  │  └──────────────┘  └──────────────┘              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Storage Abstraction                   │  │
│  │  - In-Memory (Current)                             │  │
│  │  - LocalStorage (Phase 2)                          │  │
│  │  - IndexedDB (Phase 2)                             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Core Components

### 1. ClearEngine (Domain Layer)

**Purpose**: Core business logic and state management

**Responsibilities**:
- User archetype analysis
- Identity formation and tracking
- System and habit management
- Daily execution tracking
- Oblique metrics calculation
- Adaptive load adjustment

**Key Methods**:
```typescript
// Onboarding
submitSignalInput(signal: SignalInput): Promise<Result>
analyzeArchetype(signal: SignalInput): UserArchetype

// Identity Management
createIdentity(data: Partial<Identity>): Promise<Identity>
updateIdentity(updates: Partial<Identity>): Promise<Result>

// System Management
createSystem(data: Partial<System>): Promise<Result>
updateAdaptiveLoad(systemId: string, load: number): Promise<void>

// Habit Management
createHabit(data: Partial<Habit>): Promise<Result>
completeHabit(habitId: string): Promise<Result>

// Daily Execution
logDailyExecution(log: Partial<DailyLog>): Promise<Result>

// Metrics
calculateObliqueMetrics(): Promise<ObliqueMetrics>
```

**Design Principles**:
- Pure functions where possible
- Immutable state updates
- Event sourcing ready
- Dependency injection friendly

### 2. ClearUIRenderer (Presentation Layer)

**Purpose**: UI rendering and user interaction

**Responsibilities**:
- View rendering (5 main views)
- User interaction handling
- State synchronization
- Theme management
- Notifications

**Key Methods**:
```typescript
// Lifecycle
init(): void
refresh(): void

// Navigation
navigate(view: ViewType): void
renderView(view: ViewType): void

// Rendering
renderDashboard(): void
renderDaily(): void
renderSystems(): void
renderAnalytics(): void

// Actions
completeHabit(habitId: string): Promise<void>
toggleHabit(habitId: string, index: number): void
showToast(message: string): void
```

**Design Principles**:
- Separation of concerns
- Component-based rendering
- Event-driven updates
- Responsive design

### 3. Type System (Shared)

**Purpose**: Type safety and domain modeling

**Key Interfaces**:
```typescript
// Core Entities
Identity
System
Habit
DailyLog
ObliqueMetrics

// Value Objects
UserArchetype
UserClarityType
LifeDomain
HabitCategory

// Events
ClearDomainEvent
EventType
```

**Design Principles**:
- Domain-driven design
- Type safety
- Immutability
- Clear boundaries

---

## 🔄 Data Flow

### User Journey Flow

```
1. Onboarding
   User Input → Signal Analysis → Archetype Assignment → Identity Creation
   
2. Daily Usage
   Set Hard Thing → Track Habits → Evening Reflection → Metrics Update
   
3. Weekly Review
   Metrics Calculation → Trend Analysis → Load Adjustment → Recommendations
```

### State Management Flow

```
User Action → Command → Engine → State Update → Event → UI Refresh
                                      ↓
                                   Storage
```

### Event Flow

```
┌─────────────┐
│ User Action │
└──────┬──────┘
       ↓
┌─────────────────┐
│ Command Dispatch│
└──────┬──────────┘
       ↓
┌─────────────────┐
│  Business Logic │
└──────┬──────────┘
       ↓
┌─────────────────┐
│  State Update   │
└──────┬──────────┘
       ↓
┌─────────────────┐
│  Event Emission │
└──────┬──────────┘
       ↓
┌─────────────────┐
│   UI Reaction   │
└─────────────────┘
```

---

## 🎭 Domain Model

### Core Entities

```
┌──────────────────────────────────────────────────────────┐
│                         User                              │
│  - id: UserId                                            │
│  - name: string                                          │
│  - clarityType: UserClarityType                          │
│  - onboarded: boolean                                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ 1:1
                     ↓
┌──────────────────────────────────────────────────────────┐
│                       Identity                            │
│  - id: IdentityId                                        │
│  - archetype: UserArchetype                              │
│  - identityStatement: string                             │
│  - coreValues: string[]                                  │
│  - reinforcementScore: number (0-100)                    │
│  - level: number (1-10)                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ 1:N
         ┌───────────┴───────────┐
         │                       │
         ↓                       ↓
┌─────────────────┐     ┌─────────────────┐
│     System      │     │     Habit       │
│  - id: SystemId │     │  - id: HabitId  │
│  - type: string │     │  - name: string │
│  - load: number │     │  - frequency:   │
│  - streak: num  │     │  - streak: num  │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ↓
            ┌─────────────────┐
            │    DailyLog     │
            │  - date: string │
            │  - hardThing:   │
            │  - reflections: │
            │  - metrics:     │
            └─────────────────┘
```

### Value Objects

```typescript
// User Archetypes (8 types)
type UserArchetype = 
  | 'rebuilder'
  | 'explorer'
  | 'striver'
  | 'physical_transformer'
  | 'career_climber'
  | 'life_optimizer'
  | 'meaning_seeker'
  | 'balance_builder';

// Clarity Levels
type UserClarityType = 
  | 'clear_path'
  | 'confused_trying'
  | 'lost';

// Life Domains
type LifeDomain = 
  | 'career'
  | 'finance'
  | 'health'
  | 'relationships'
  | 'personal_growth'
  | 'spirituality'
  | 'creativity'
  | 'contribution';
```

---

## 📊 Oblique Metrics Architecture

### Metrics Hierarchy

```
ObliqueMetrics
├── Identity Reinforcement
│   ├── Score (0-100)
│   ├── Trend (up/down/stable)
│   └── Breakdown
│       ├── Actions Aligned
│       ├── Identity Statements
│       └── Values Lived
├── Consistency
│   ├── Score (0-100)
│   ├── Streak (days)
│   ├── Completion Rate (%)
│   ├── Habit Adherence (%)
│   └── Weekly Trend (7 days)
├── Growth
│   ├── Index (0-100)
│   ├── Weekly Trend
│   └── Domain Scores (8 domains)
├── Momentum
│   ├── Score (0-100)
│   ├── Acceleration
│   └── Hard Thing Rate
└── Adaptive Load
    ├── Current Load (1-10)
    ├── Recommended Load
    ├── Burnout Risk
    └── Recovery Needed
```

### Calculation Flow

```
DailyLog Collection
       ↓
Metrics Aggregation (7-day window)
       ↓
Score Calculation
├── Consistency Score = (completedDays / 7) * 100
├── Identity Score = (alignedActions / total) * 100
├── Momentum Score = recentAvg + (recentAvg - olderAvg) * 2
└── Adaptive Load = f(consistency, energy, burnout)
       ↓
Trend Analysis
       ↓
Recommendations Generation
```

---

## 🔧 Architectural Patterns

### 1. Domain-Driven Design (DDD)

**Applied Patterns**:
- **Entities**: Identity, System, Habit, DailyLog
- **Value Objects**: Archetype, ClarityType, LifeDomain
- **Aggregates**: Identity aggregate root
- **Repositories**: Storage abstraction (future)
- **Domain Services**: ClearEngine

**Benefits**:
- Clear business logic boundaries
- Ubiquitous language
- Testable domain logic
- Maintainable codebase

### 2. Command Pattern

**Implementation**:
```typescript
interface Command<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload: T;
  metadata: CommandMetadata;
  timestamp: string;
}

// Usage
commandBus.execute({
  type: 'CLEAR_CREATE_SYSTEM',
  payload: { type: 'morning_routine', difficulty: 'beginner' }
});
```

**Benefits**:
- Decoupled invocation
- Undo/redo capability
- Command logging
- Async execution support

### 3. Event Sourcing (Prepared)

**Event Structure**:
```typescript
interface ClearDomainEvent {
  id: string;
  type: ClearEventType;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  metadata: {
    userId: UserId;
    timestamp: string;
  };
  timestamp: string;
  version: number;
}
```

**Event Types**:
- IDENTITY_CREATED
- IDENTITY_UPDATED
- SYSTEM_CREATED
- HABIT_COMPLETED
- DAILY_LOG_CREATED

**Benefits** (when fully implemented):
- Complete audit trail
- Time-travel debugging
- Multiple projections
- Event replay capability

### 4. Dependency Injection

**Current Implementation**:
```typescript
class ClearEngine {
  constructor(
    private storage: StorageAdapter,
    private eventBus: EventBus
  ) {}
}
```

**Benefits**:
- Testable components
- Swappable implementations
- Clear dependencies
- Loose coupling

---

## 🎨 Design Decisions

### 1. Identity-First Architecture

**Decision**: Focus on identity formation rather than task completion

**Rationale**:
- Research shows identity-based change is more sustainable
- Tasks are outputs; identity is outcome
- Aligns with Atomic Habits methodology

**Trade-offs**:
- + More meaningful progress tracking
- + Better long-term user retention
- - Harder to measure initially
- - Requires user education

**Status**: ✅ Accepted (ADR-001)

### 2. Oblique Metrics

**Decision**: Track indirect measures rather than direct outcomes

**Rationale**:
- Obliquity principle (John Kay)
- Identity reinforcement predicts success better than tasks
- Prevents gamification of productivity

**Metrics Chosen**:
- Identity Reinforcement (not tasks completed)
- Consistency (not hours worked)
- Momentum (not goals achieved)

**Status**: ✅ Accepted (ADR-002)

### 3. Archetype-Based Personalization

**Decision**: Classify users into 8 archetypes for personalized guidance

**Rationale**:
- Reduces choice paralysis
- Provides relevant recommendations
- Creates user identity/community

**Trade-offs**:
- + Personalized experience
- + Clear guidance
- - Risk of stereotyping
- - Requires accurate classification

**Status**: ✅ Accepted (ADR-003)

### 4. Adaptive Load

**Decision**: Dynamically adjust challenge level based on performance

**Rationale**:
- Prevents burnout
- Maintains optimal challenge
- Adapts to user capacity

**Algorithm**:
```typescript
if (consistency > 80%) increase load
if (consistency < 40%) decrease load
if (energy < 4/10) flag burnout risk
```

**Status**: ✅ Accepted (ADR-004)

### 5. TypeScript-First

**Decision**: 100% TypeScript with strict type checking

**Rationale**:
- Type safety prevents bugs
- Self-documenting code
- Better IDE support
- Easier refactoring

**Trade-offs**:
- + Fewer runtime errors
- + Better developer experience
- - More verbose
- - Compilation step required

**Status**: ✅ Accepted (ADR-005)

### 6. Zero Framework Dependencies

**Decision**: No React, Vue, or Angular

**Rationale**:
- Smaller bundle size
- Full control over implementation
- No framework lock-in
- Better performance

**Trade-offs**:
- + 43KB total (gzipped)
- + No framework updates
- - More code to maintain
- - Manual DOM management

**Status**: ✅ Accepted (ADR-006)

---

## 📁 Code Organization

### Current Structure

```
src/
├── clear-main.ts              # Application entry point
├── clear/
│   ├── ClearEngine.ts         # Core domain logic
│   └── ClearUIRenderer.ts     # UI rendering
├── types/
│   ├── index.ts              # TaskMaster types (legacy)
│   └── clear-types.ts        # Clear types
└── [legacy TaskMaster code]
```

### Target Structure (Phase 2)

```
src/
├── clear-main.ts
├── clear/
│   ├── application/          # Application layer
│   │   ├── ClearApp.ts
│   │   └── commands/
│   ├── domain/              # Domain layer
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── services/
│   │   └── events/
│   ├── infrastructure/      # Infrastructure layer
│   │   ├── storage/
│   │   ├── events/
│   │   └── di/
│   └── ui/                  # UI layer
│       ├── ClearUIRenderer.ts
│       ├── components/
│       └── views/
└── types/
    └── clear/
```

---

## 🔮 Evolution Plan

### Phase 1: Foundation (Current) ✅

- ✅ Core engine
- ✅ UI renderer
- ✅ Type system
- ✅ Basic documentation

### Phase 2: Persistence (Next)

- [ ] LocalStorage implementation
- [ ] IndexedDB implementation
- [ ] Storage abstraction layer
- [ ] Data migration support

### Phase 3: Modules

- [ ] Career module
- [ ] Finance module
- [ ] Fitness module
- [ ] Module API

### Phase 4: Intelligence

- [ ] ML-powered recommendations
- [ ] Pattern recognition
- [ ] Predictive analytics
- [ ] A/B testing framework

---

## 📈 Quality Attributes

### Performance

**Targets**:
- Initial load: < 2 seconds
- UI interactions: < 100ms
- Metrics calculation: < 500ms

**Current Status**:
- Bundle size: 43KB (gzipped)
- No runtime framework overhead
- Efficient algorithms

### Scalability

**Current**: Single user, client-side only

**Future**:
- Multi-user support
- Cloud sync
- Real-time collaboration

### Maintainability

**Strategies**:
- TypeScript for type safety
- Domain-driven design
- Comprehensive documentation
- Test coverage (future)

### Security

**Current**:
- Client-side only (minimal attack surface)
- No sensitive data stored

**Future**:
- End-to-end encryption
- Secure authentication
- Data privacy compliance

---

## 🔗 Related Documents

- **[ADR Index](./adr/README.md)** - Architecture decisions
- **[Domain Model](./domain/README.md)** - Detailed domain model
- **[API Reference](../api/README.md)** - API documentation
- **[Psychology Framework](../psychology/README.md)** - Research backing

---

**This architecture is designed for clarity, maintainability, and scale.**

✨ *Clear - The engine that turns clarity into action and action into success.*
