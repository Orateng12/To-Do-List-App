# Clear Domain Model

> **Comprehensive documentation of Clear's domain entities, value objects, and business logic**

---

## 🎯 Overview

This document describes the **domain model** for Clear - the conceptual framework that represents the business logic and rules.

### Domain-Driven Design Approach

Clear uses **Domain-Driven Design (DDD)** principles:

```
Strategic Design:
├── Entities (Identity, System, Habit, DailyLog)
├── Value Objects (Archetype, ClarityType, LifeDomain)
├── Aggregates (Identity aggregate root)
├── Repositories (Storage abstraction)
└── Domain Services (ClearEngine)
```

---

## 📦 Core Entities

### Entity Characteristics

- **Identity**: Unique identifier
- **Lifecycle**: Created, updated, potentially deleted
- **State**: Can change over time
- **Business Logic**: Contains domain rules

---

### 1. User Entity

**Purpose**: Represents the user of Clear

```typescript
interface User {
  id: UserId;                    // Unique identifier
  name: string;                  // Display name
  email?: string;                // Optional email
  clarityType: UserClarityType;  // Current clarity level
  onboarded: boolean;            // Onboarding completion status
}
```

**Invariants**:
- `id` must be unique
- `name` cannot be empty
- `clarityType` must be valid enum value

**Business Rules**:
- User must complete onboarding before using Clear
- Clarity type can change based on user progress

**Lifecycle**:
```
Created → Onboarding → Active → [Evolution]
```

---

### 2. Identity Entity (Aggregate Root)

**Purpose**: Represents who the user is becoming

```typescript
interface Identity {
  // Identity
  id: IdentityId;
  userId: UserId;
  
  // Core attributes
  archetype: UserArchetype;
  clarityType: UserClarityType;
  
  // Identity statement
  identityStatement: string;  // "I am someone who..."
  
  // Values and focus
  coreValues: string[];
  focusAreas: LifeDomain[];
  
  // Progress tracking
  reinforcementScore: number;  // 0-100
  level: number;               // 1-10
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

**Invariants**:
- `reinforcementScore` must be between 0 and 100
- `level` must be between 1 and 10
- `identityStatement` cannot be empty
- Must have at least one `coreValue`

**Business Rules**:

1. **Reinforcement Score Calculation**
```typescript
updateReinforcementScore(dailyLog: DailyLog): void {
  const alignment = dailyLog.reflection.identityAligned ? 10 : 0;
  const consistency = dailyLog.metrics.consistencyScore / 10;
  const momentum = dailyLog.metrics.momentumScore / 10;
  
  const delta = alignment + consistency + momentum - 5; // -5 decay
  this.reinforcementScore = clamp(0, 100, this.reinforcementScore + delta);
  
  // Level up
  const newLevel = Math.floor(this.reinforcementScore / 10) + 1;
  if (newLevel > this.level) {
    this.level = newLevel;
    this.emitEvent(new IdentityLevelIncreased(this.id, newLevel));
  }
}
```

2. **Identity Statement Generation**
```typescript
generateIdentityStatement(archetype: UserArchetype): string {
  const statements: Record<UserArchetype, string> = {
    rebuilder: "I am someone who builds consistency, one day at a time",
    explorer: "I am someone who explores with curiosity and commits to what resonates",
    striver: "I am someone who achieves ambitious goals sustainably",
    // ... etc
  };
  return statements[archetype];
}
```

**Lifecycle**:
```
Created → Active → [Reinforcement Updates] → [Level Progression]
```

**Aggregate Boundary**:
- Identity is the aggregate root
- Systems and Habits belong to Identity
- All changes to child entities go through Identity

---

### 3. System Entity

**Purpose**: A repeatable process that reinforces identity

```typescript
interface System {
  // Identity
  id: SystemId;
  userId: UserId;
  identityId: IdentityId;
  
  // Definition
  type: SystemType;
  name: string;
  description: string;
  
  // Configuration
  difficulty: SystemDifficulty;
  adaptiveLoad: number;  // 1-10
  
  // Components
  keystoneHabits: HabitId[];
  supportingHabits: HabitId[];
  
  // Rules
  rules: SystemRule[];
  milestones: SystemMilestone[];
  
  // Tracking
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  completionRate: number;  // 0-100
  
  // State
  active: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

**Invariants**:
- `adaptiveLoad` must be between 1 and 10
- `completionRate` must be between 0 and 100
- Must have at least one keystone habit

**Business Rules**:

1. **Adaptive Load Adjustment**
```typescript
adjustLoad(consistency: number, energy: number): void {
  if (consistency > 80) {
    this.adaptiveLoad = Math.min(10, this.adaptiveLoad + 1);
  } else if (consistency < 40) {
    this.adaptiveLoad = Math.max(1, this.adaptiveLoad - 1);
  }
  
  if (energy < 4) {
    this.adaptiveLoad = Math.max(1, this.adaptiveLoad - 2);
  }
}
```

2. **Milestone Unlocking**
```typescript
checkMilestones(): void {
  for (const milestone of this.milestones) {
    if (!milestone.unlocked && this.meetsRequirement(milestone)) {
      milestone.unlocked = true;
      milestone.unlockedAt = new Date().toISOString();
      this.emitEvent(new MilestoneUnlocked(this.id, milestone.id));
    }
  }
}
```

**Types**:

```typescript
type SystemType = 
  | 'morning_routine'
  | 'evening_routine'
  | 'deep_work'
  | 'fitness'
  | 'learning'
  | 'social'
  | 'financial'
  | 'mindfulness'
  | 'creative'
  | 'custom';

type SystemDifficulty = 'beginner' | 'intermediate' | 'advanced';
```

---

### 4. Habit Entity

**Purpose**: A small, repeatable action that reinforces identity

```typescript
interface Habit {
  // Identity
  id: HabitId;
  userId: UserId;
  systemId?: SystemId;
  
  // Definition
  name: string;
  description?: string;
  category: HabitCategory;
  
  // Execution
  frequency: HabitFrequency;
  targetCount: number;
  targetDuration?: number;  // minutes
  
  // Triggers
  trigger?: string;  // "after morning coffee"
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'any';
  
  // Difficulty
  difficulty: number;  // 1-10
  
  // Tracking
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  
  // Identity linkage
  identityReinforcement: number;  // 0-100
  
  // State
  active: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

**Invariants**:
- `difficulty` must be between 1 and 10
- `identityReinforcement` must be between 0 and 100
- `targetCount` must be positive

**Business Rules**:

1. **Completion Tracking**
```typescript
complete(): void {
  this.currentStreak++;
  this.totalCompletions++;
  this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
  this.updatedAt = new Date().toISOString();
  
  this.emitEvent(new HabitCompleted(this.id, this.currentStreak));
}

breakStreak(): void {
  const previousStreak = this.currentStreak;
  this.currentStreak = 0;
  
  if (previousStreak > 0) {
    this.emitEvent(new HabitStreakBroken(this.id, previousStreak));
  }
}
```

2. **Identity Reinforcement Calculation**
```typescript
calculateIdentityReinforcement(): number {
  // Base reinforcement from category
  const baseReinforcement = this.getCategoryReinforcement();
  
  // Bonus from consistency
  const consistencyBonus = Math.min(50, this.currentStreak * 2);
  
  // Bonus from difficulty
  const difficultyBonus = this.difficulty * 3;
  
  return clamp(0, 100, baseReinforcement + consistencyBonus + difficultyBonus);
}
```

**Types**:

```typescript
type HabitFrequency = 
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom';

type HabitCategory = 
  | 'health'
  | 'productivity'
  | 'learning'
  | 'mindfulness'
  | 'relationships'
  | 'finance'
  | 'creativity'
  | 'custom';
```

---

### 5. DailyLog Entity

**Purpose**: Record of daily execution and reflection

```typescript
interface DailyLog {
  // Identity
  id: DailyLogId;
  userId: UserId;
  date: string;  // ISO date
  
  // The Hard Thing
  hardThing: {
    description: string;
    completed: boolean;
    completedAt?: string;
    difficulty: number;  // 1-10
    notes?: string;
  };
  
  // Habit completions
  habitCompletions: Array<{
    habitId: HabitId;
    completed: boolean;
    completedAt?: string;
    actualCount?: number;
    actualDuration?: number;
  }>;
  
  // System completions
  systemCompletions: Array<{
    systemId: SystemId;
    completed: boolean;
    completionPercentage: number;
  }>;
  
  // Reflection
  reflection: {
    morningIntention?: string;
    wins?: string[];
    challenges?: string[];
    learnings?: string[];
    gratitude?: string[];
    identityAligned: boolean;
    energyLevel: number;  // 1-10
    moodRating: number;   // 1-10
  };
  
  // Metrics
  metrics: {
    consistencyScore: number;
    identityReinforcementScore: number;
    momentumScore: number;
  };
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

**Invariants**:
- `date` must be unique per user
- `energyLevel` and `moodRating` must be 1-10
- `hardThing.difficulty` must be 1-10

**Business Rules**:

1. **Metrics Calculation**
```typescript
calculateMetrics(): void {
  // Consistency: Did you do your hard thing + habits?
  const hardThingDone = this.hardThing.completed ? 1 : 0;
  const habitRate = this.habitCompletions.filter(h => h.completed).length / 
                    Math.max(1, this.habitCompletions.length);
  this.metrics.consistencyScore = Math.round((hardThingDone + habitRate) / 2 * 100);
  
  // Identity: Did you act like who you want to be?
  this.metrics.identityReinforcementScore = this.reflection.identityAligned ? 
    Math.max(70, this.metrics.consistencyScore) : 
    Math.min(30, this.metrics.consistencyScore);
  
  // Momentum: Recent trend
  const recentLogs = this.getRecentLogs(3);
  const olderLogs = this.getRecentLogs(7, 3);
  const recentAvg = average(recentLogs.map(l => l.metrics.consistencyScore));
  const olderAvg = average(olderLogs.map(l => l.metrics.consistencyScore));
  this.metrics.momentumScore = Math.min(100, Math.round(recentAvg + (recentAvg - olderAvg) * 2));
}
```

---

## 🔷 Value Objects

### Value Object Characteristics

- **No identity**: Defined by attributes, not ID
- **Immutable**: Cannot be changed, only replaced
- **Self-validating**: Enforce invariants on creation
- **Behavior-rich**: Contain business logic

---

### 1. UserArchetype

**Purpose**: Categorizes user's current life situation and goals

```typescript
type UserArchetype = 
  | 'rebuilder'           // Rebuilding after setback
  | 'explorer'            // Seeking new direction
  | 'striver'             // Ambitious, goal-oriented
  | 'physical_transformer' // Focus on health/fitness
  | 'career_climber'      // Career-focused
  | 'life_optimizer'      // Wants to optimize everything
  | 'meaning_seeker'      // Searching for purpose
  | 'balance_builder';    // Seeking work-life balance
```

**Behavior**:

```typescript
class Archetype {
  constructor(
    public readonly type: UserArchetype,
    public readonly displayName: string,
    public readonly description: string,
    public readonly coreDesires: string[],
    public readonly commonFrustrations: string[],
    public readonly recommendedSystems: SystemType[],
    public readonly keystoneHabits: HabitId[],
    public readonly successMetrics: string[]
  ) {}
  
  static fromType(type: UserArchetype): Archetype {
    const configs: Record<UserArchetype, ArchetypeConfig> = {
      rebuilder: {
        displayName: 'The Rebuilder',
        description: 'Rebuilding after a setback, ready to start fresh',
        coreDesires: ['Fresh start', 'Stability', 'Confidence restoration'],
        // ... etc
      },
      // ... other archetypes
    };
    
    return new Archetype(type, ...configs[type]);
  }
}
```

---

### 2. UserClarityType

**Purpose**: Indicates user's level of clarity about their path

```typescript
type UserClarityType = 
  | 'clear_path'      // Knows what they want
  | 'confused_trying' // Thinks they know, needs guidance
  | 'lost';           // Doesn't know what they want
```

**Behavior**:

```typescript
class ClarityType {
  constructor(
    public readonly type: UserClarityType,
    public readonly guidanceLevel: 'minimal' | 'moderate' | 'high',
    public readonly recommendedApproach: string
  ) {}
  
  static determine(signal: SignalInput): ClarityType {
    if (signal.desires.length > 0 && signal.desires.every(d => d.length > 10)) {
      return new ClarityType('clear_path', 'minimal', 'Focus on execution');
    }
    
    if (signal.vagueGoals.length > 0) {
      return new ClarityType('confused_trying', 'moderate', 'Refine direction');
    }
    
    return new ClarityType('lost', 'high', 'Explore and experiment');
  }
}
```

---

### 3. LifeDomain

**Purpose**: Represents different areas of life

```typescript
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

**Behavior**:

```typescript
class Domain {
  constructor(
    public readonly name: LifeDomain,
    public readonly displayName: string,
    public readonly icon: string,
    public readonly color: string,
    public readonly description: string
  ) {}
  
  static all(): Domain[] {
    return [
      new Domain('career', 'Career', '💼', '#3b82f6', 'Professional growth'),
      new Domain('finance', 'Finance', '💰', '#10b981', 'Financial health'),
      new Domain('health', 'Health', '💪', '#ef4444', 'Physical wellbeing'),
      // ... etc
    ];
  }
}
```

---

## 🔄 Domain Events

### Event Structure

```typescript
interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  metadata: {
    userId: UserId;
    timestamp: string;
    correlationId?: string;
  };
  timestamp: string;
  version: number;
}
```

### Key Events

```typescript
// Identity Events
class IdentityCreated implements DomainEvent { /* ... */ }
class IdentityUpdated implements DomainEvent { /* ... */ }
class IdentityLevelIncreased implements DomainEvent { /* ... */ }

// System Events
class SystemCreated implements DomainEvent { /* ... */ }
class SystemActivated implements DomainEvent { /* ... */ }
class MilestoneUnlocked implements DomainEvent { /* ... */ }

// Habit Events
class HabitCreated implements DomainEvent { /* ... */ }
class HabitCompleted implements DomainEvent { /* ... */ }
class HabitStreakBroken implements DomainEvent { /* ... */ }

// Daily Execution Events
class DailyLogCreated implements DomainEvent { /* ... */ }
class HardThingCompleted implements DomainEvent { /* ... */ }
class ReflectionSubmitted implements DomainEvent { /* ... */ }
```

---

## 📊 Aggregate Relationships

```
┌─────────────────────────────────────────────────────────┐
│                      User                               │
│  - id                                                   │
│  - clarityType                                          │
└────────────────────┬────────────────────────────────────┘
                     │ 1:1
                     ↓
┌─────────────────────────────────────────────────────────┐
│                    Identity (Aggregate Root)            │
│  - id                                                   │
│  - archetype                                            │
│  - reinforcementScore                                   │
│  - level                                                │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Systems (Child Entities)                         │  │
│  │  - System 1                                       │  │
│  │  - System 2                                       │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Habits (Child Entities)                    │  │  │
│  │  │  - Habit 1                                  │  │  │
│  │  │  - Habit 2                                  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                     │
                     │ 1:N
                     ↓
            ┌─────────────────┐
            │    DailyLogs    │
            │  (Entities)     │
            └─────────────────┘
```

---

## 🎯 Domain Services

### ClearEngine

**Purpose**: Orchestrates domain logic across aggregates

**Responsibilities**:
- Archetype analysis
- Identity formation
- System/habit recommendations
- Metrics calculation
- Adaptive load adjustment

**Methods**:

```typescript
interface ClearEngine {
  // Onboarding
  submitSignalInput(signal: SignalInput): Promise<Result<SignalInput>>;
  analyzeArchetype(signal: SignalInput): UserArchetype;
  determineClarityType(signal: SignalInput): UserClarityType;
  
  // Identity
  createIdentity(data: Partial<Identity>): Promise<Identity>;
  updateIdentity(updates: Partial<Identity>): Promise<Result<Identity>>;
  
  // Systems
  createSystem(data: Partial<System>): Promise<Result<System>>;
  getRecommendedSystems(archetype: UserArchetype): SystemType[];
  
  // Habits
  createHabit(data: Partial<Habit>): Promise<Result<Habit>>;
  getKeystoneHabits(archetype: UserArchetype): HabitId[];
  
  // Daily Execution
  logDailyExecution(log: Partial<DailyLog>): Promise<Result<DailyLog>>;
  
  // Metrics
  calculateObliqueMetrics(): Promise<ObliqueMetrics>;
  calculateAdaptiveLoad(logs: DailyLog[]): AdaptiveLoadResult;
}
```

---

## 📜 Business Rules Summary

### Identity Rules

1. Identity statement must be in format "I am someone who..."
2. Reinforcement score updates daily based on alignment
3. Level increases every 10 points of reinforcement
4. Archetype can change if user signals shift significantly

### System Rules

1. Every system must have at least one keystone habit
2. Adaptive load adjusts based on consistency
3. Milestones unlock automatically when requirements met
4. Systems can be active or inactive

### Habit Rules

1. Habits belong to systems (optional)
2. Streaks break after 2 missed days (grace period)
3. Identity reinforcement increases with streak length
4. Difficulty affects reinforcement bonus

### DailyLog Rules

1. One log per user per day
2. Hard thing must be set before end of day
3. Reflection submitted within 24 hours
4. Metrics calculated on log completion

---

## 🔗 Related Documents

- [Architecture Overview](../overview.md)
- [API Reference](../../api/README.md)
- [Psychology Framework](../../psychology/README.md)
- [ADR-001: Identity-First](../adr/001-identity-first.md)

---

**The domain model is the heart of Clear's business logic.**

✨ *Clear - The engine that turns clarity into action and action into success.*
