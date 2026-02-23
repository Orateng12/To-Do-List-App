# Clear API Reference

> **Complete API documentation for Clear**

---

## 📚 API Overview

Clear provides a programmatic API for:
- Managing user identity
- Creating and tracking systems
- Managing habits
- Logging daily execution
- Calculating oblique metrics

---

## 🎯 Quick Start

```typescript
import { clearEngine } from './clear/ClearEngine';
import { clearUIRenderer } from './clear/ClearUIRenderer';

// Initialize
await clearEngine.init();
clearUIRenderer.init();

// Navigate to dashboard
clearUIRenderer.navigate('dashboard');
```

---

## 🔧 ClearEngine API

### Initialization

#### `init()`

Initialize the Clear engine.

```typescript
/**
 * Initialize the Clear engine
 * @returns Promise<void>
 * 
 * @example
 * await clearEngine.init();
 * console.log('Clear Engine initialized');
 */
async init(): Promise<void>
```

**Throws**: `Error` if initialization fails

---

### Onboarding

#### `submitSignalInput(signal)`

Submit user signals during onboarding.

```typescript
/**
 * Submit signal input during onboarding
 * 
 * @param signal - User signals including desires, frustrations, and goals
 * @returns Promise with success status and signal data
 * 
 * @example
 * const result = await clearEngine.submitSignalInput({
 *   desires: ['Find purpose', 'Build consistency'],
 *   frustrations: ['Procrastination', 'Lack of direction'],
 *   vagueGoals: ['Start a business'],
 *   pastSuccesses: ['Completed marathon'],
 *   constraints: ['2 hours per day'],
 *   peakEnergyTime: 'morning',
 *   availableHoursPerDay: 2
 * });
 * 
 * if (result.success) {
 *   console.log('Onboarding complete');
 * }
 */
async submitSignalInput(
  signal: Partial<SignalInput>
): Promise<{ 
  success: boolean; 
  data?: SignalInput; 
  error?: Error 
}>
```

**SignalInput Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| desires | string[] | No | What the user wants |
| frustrations | string[] | No | What's holding them back |
| vagueGoals | string[] | No | Things they think they want |
| pastSuccesses | string[] | No | Past achievements |
| constraints | string[] | No | Limitations (time, energy, etc.) |
| peakEnergyTime | 'morning' \| 'afternoon' \| 'evening' | Yes | When they have most energy |
| availableHoursPerDay | number | Yes | Hours available for growth |

**Returns**:

```typescript
{
  success: true,
  data: {
    id: string,
    userId: string,
    desires: string[],
    // ... other fields
  }
}
```

---

#### `analyzeArchetype(signal)`

Analyze user archetype based on signals.

```typescript
/**
 * Analyze user archetype based on signal input
 * 
 * @param signal - User signals
 * @returns Detected user archetype
 * 
 * @example
 * const archetype = clearEngine.analyzeArchetype(signalInput);
 * console.log(`You are: ${archetype}`);
 * // Output: "You are: explorer"
 */
analyzeArchetype(signal: SignalInput): UserArchetype
```

**Returns**: One of 8 archetypes:
- `'rebuilder'`
- `'explorer'`
- `'striver'`
- `'physical_transformer'`
- `'career_climber'`
- `'life_optimizer'`
- `'meaning_seeker'`
- `'balance_builder'`

---

### Identity Management

#### `createIdentity(identityData)`

Create a new user identity.

```typescript
/**
 * Create new identity
 * 
 * @param identityData - Identity configuration
 * @returns Promise with created identity
 * 
 * @example
 * const identity = await clearEngine.createIdentity({
 *   archetype: 'explorer',
 *   clarityType: 'lost',
 *   identityStatement: 'I am someone who explores with curiosity',
 *   coreValues: ['Growth', 'Curiosity'],
 *   focusAreas: ['personal_growth', 'creativity']
 * });
 * 
 * console.log(`Identity created at level ${identity.level}`);
 */
async createIdentity(
  identityData: Partial<Identity>
): Promise<Identity>
```

**Identity Parameters**:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| archetype | UserArchetype | Yes | - |
| clarityType | UserClarityType | Yes | - |
| identityStatement | string | No | Generated |
| coreValues | string[] | No | ['Growth', 'Consistency'] |
| focusAreas | LifeDomain[] | No | ['personal_growth'] |
| reinforcementScore | number | No | 50 |
| level | number | No | 1 |

**Returns**:

```typescript
{
  id: string,
  userId: string,
  archetype: 'explorer',
  clarityType: 'lost',
  identityStatement: 'I am someone who...',
  coreValues: ['Growth', 'Curiosity'],
  focusAreas: ['personal_growth'],
  reinforcementScore: 50,
  level: 1,
  createdAt: string,
  updatedAt: string
}
```

---

#### `updateIdentity(updates)`

Update existing identity.

```typescript
/**
 * Update identity with new values
 * 
 * @param updates - Fields to update
 * @returns Promise with success status
 * 
 * @example
 * const result = await clearEngine.updateIdentity({
 *   reinforcementScore: 75,
 *   coreValues: ['Growth', 'Consistency', 'Purpose']
 * });
 * 
 * if (result.success) {
 *   console.log('Identity updated');
 * }
 */
async updateIdentity(
  updates: Partial<Identity>
): Promise<{ 
  success: boolean; 
  data?: Identity; 
  error?: Error 
}>
```

---

#### `getIdentity()`

Get current identity.

```typescript
/**
 * Get current user identity
 * 
 * @returns Current identity or null
 * 
 * @example
 * const identity = clearEngine.getIdentity();
 * if (identity) {
 *   console.log(`Level ${identity.level} ${identity.archetype}`);
 * }
 */
getIdentity(): Identity | null
```

---

#### `getArchetypeDetails(archetype)`

Get detailed information about an archetype.

```typescript
/**
 * Get archetype details including description, desires, and recommendations
 * 
 * @param archetype - Archetype type
 * @returns Archetype configuration
 * 
 * @example
 * const details = clearEngine.getArchetypeDetails('explorer');
 * console.log(details.displayName);  // "The Explorer"
 * console.log(details.description);  // "Seeking new directions..."
 * console.log(details.recommendedSystems);  // ['learning', 'creative', 'social']
 */
getArchetypeDetails(
  archetype: UserArchetype
): {
  displayName: string;
  description: string;
  coreDesires: string[];
  commonFrustrations: string[];
  recommendedSystems: string[];
  keystoneHabits: string[];
  successMetrics: string[];
}
```

---

### System Management

#### `createSystem(systemData)`

Create a new system.

```typescript
/**
 * Create a new system
 * 
 * @param systemData - System configuration
 * @returns Promise with success status and system data
 * 
 * @example
 * const result = await clearEngine.createSystem({
 *   type: 'morning_routine',
 *   name: 'Morning Routine',
 *   description: 'Start each day with intention',
 *   difficulty: 'beginner',
 *   keystoneHabits: ['habit_1', 'habit_2']
 * });
 */
async createSystem(
  systemData: Partial<System>
): Promise<{ 
  success: boolean; 
  data?: System; 
  error?: Error 
}>
```

**System Parameters**:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| type | SystemType | No | 'custom' |
| name | string | No | 'Custom System' |
| description | string | No | '' |
| difficulty | SystemDifficulty | No | 'beginner' |
| adaptiveLoad | number | No | 3 |
| keystoneHabits | HabitId[] | No | [] |
| supportingHabits | HabitId[] | No | [] |

---

#### `getSystems()`

Get all user systems.

```typescript
/**
 * Get all user systems
 * 
 * @returns Array of systems
 * 
 * @example
 * const systems = clearEngine.getSystems();
 * systems.forEach(system => {
 *   console.log(`${system.name}: ${system.currentStreak} day streak`);
 * });
 */
getSystems(): System[]
```

---

#### `updateAdaptiveLoad(systemId, load)`

Adjust system difficulty.

```typescript
/**
 * Update system adaptive load
 * 
 * @param systemId - System ID
 * @param load - New load level (1-10)
 * @returns Promise<void>
 * 
 * @example
 * await clearEngine.updateAdaptiveLoad('system_123', 5);
 * console.log('Load adjusted to medium');
 */
async updateAdaptiveLoad(
  systemId: string,
  load: number
): Promise<void>
```

**Constraints**:
- `load` must be between 1 and 10

---

### Habit Management

#### `createHabit(habitData)`

Create a new habit.

```typescript
/**
 * Create a new habit
 * 
 * @param habitData - Habit configuration
 * @returns Promise with success status and habit data
 * 
 * @example
 * const result = await clearEngine.createHabit({
 *   name: 'Morning Movement',
 *   category: 'health',
 *   frequency: 'daily',
 *   targetCount: 1,
 *   targetDuration: 15,  // minutes
 *   trigger: 'after waking up',
 *   timeOfDay: 'morning',
 *   difficulty: 5
 * });
 */
async createHabit(
  habitData: Partial<Habit>
): Promise<{ 
  success: boolean; 
  data?: Habit; 
  error?: Error 
}>
```

**Habit Parameters**:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| name | string | No | 'New Habit' |
| description | string | No | - |
| category | HabitCategory | No | 'custom' |
| frequency | HabitFrequency | No | 'daily' |
| targetCount | number | No | 1 |
| targetDuration | number | No | - |
| trigger | string | No | - |
| timeOfDay | string | No | 'any' |
| difficulty | number | No | 5 |
| identityReinforcement | number | No | 50 |

---

#### `completeHabit(habitId)`

Mark a habit as complete.

```typescript
/**
 * Complete a habit
 * 
 * @param habitId - Habit ID
 * @returns Promise with success status and updated habit
 * 
 * @example
 * const result = await clearEngine.completeHabit('habit_123');
 * if (result.success) {
 *   console.log(`Streak: ${result.data.currentStreak} days`);
 * }
 */
async completeHabit(
  habitId: string
): Promise<{ 
  success: boolean; 
  data?: Habit; 
  error?: Error 
}>
```

**Side Effects**:
- Increments `currentStreak`
- Increments `totalCompletions`
- Updates `bestStreak` if applicable
- Emits `HabitCompleted` event

---

#### `getHabits()`

Get all user habits.

```typescript
/**
 * Get all user habits
 * 
 * @returns Array of habits
 * 
 * @example
 * const habits = clearEngine.getHabits();
 * const activeHabits = habits.filter(h => h.active);
 * console.log(`${activeHabits.length} active habits`);
 */
getHabits(): Habit[]
```

---

### Daily Execution

#### `logDailyExecution(logData)`

Log daily execution and reflection.

```typescript
/**
 * Log daily execution including hard thing, habits, and reflection
 * 
 * @param logData - Daily log data
 * @returns Promise with success status and log data
 * 
 * @example
 * const result = await clearEngine.logDailyExecution({
 *   date: '2024-01-15',
 *   hardThing: {
 *     description: 'Finish project proposal',
 *     completed: true,
 *     difficulty: 7
 *   },
 *   habitCompletions: [
 *     { habitId: 'habit_1', completed: true },
 *     { habitId: 'habit_2', completed: false }
 *   ],
 *   reflection: {
 *     identityAligned: true,
 *     energyLevel: 8,
 *     moodRating: 7,
 *     wins: ['Completed hard thing'],
 *     gratitude: ['Good health', 'Supportive friends']
 *   }
 * });
 */
async logDailyExecution(
  logData: Partial<DailyLog>
): Promise<{ 
  success: boolean; 
  data?: DailyLog; 
  error?: Error 
}>
```

**DailyLog Parameters**:

| Field | Type | Required |
|-------|------|----------|
| date | string | No (defaults to today) |
| hardThing | HardThing | No |
| habitCompletions | HabitCompletion[] | No |
| systemCompletions | SystemCompletion[] | No |
| reflection | Reflection | No |
| metrics | Metrics | No (calculated) |

**HardThing Object**:

```typescript
{
  description: string;
  completed: boolean;
  completedAt?: string;
  difficulty: number;  // 1-10
  notes?: string;
}
```

**Reflection Object**:

```typescript
{
  morningIntention?: string;
  wins?: string[];
  challenges?: string[];
  learnings?: string[];
  gratitude?: string[];
  identityAligned: boolean;
  energyLevel: number;  // 1-10
  moodRating: number;   // 1-10
}
```

---

#### `getDailyLogByDate(date)`

Get daily log for a specific date.

```typescript
/**
 * Get daily log by date
 * 
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns Daily log or undefined
 * 
 * @example
 * const today = new Date().toISOString().split('T')[0];
 * const log = clearEngine.getDailyLogByDate(today);
 * if (log) {
 *   console.log(`Hard thing: ${log.hardThing.description}`);
 * }
 */
getDailyLogByDate(date: string): DailyLog | undefined
```

---

#### `getDailyLogs()`

Get all daily logs.

```typescript
/**
 * Get all daily logs
 * 
 * @returns Array of daily logs
 * 
 * @example
 * const logs = clearEngine.getDailyLogs();
 * const thisWeek = logs.filter(l => 
 *   new Date(l.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
 * );
 * console.log(`${thisWeek.length} days logged this week`);
 */
getDailyLogs(): DailyLog[]
```

---

### Oblique Metrics

#### `calculateObliqueMetrics()`

Calculate current oblique metrics.

```typescript
/**
 * Calculate oblique metrics based on recent daily logs
 * 
 * @returns Promise with success status and metrics
 * 
 * @example
 * const result = await clearEngine.calculateObliqueMetrics();
 * if (result.success && result.data) {
 *   console.log(`Identity Reinforcement: ${result.data.identityReinforcement.score}%`);
 *   console.log(`Consistency: ${result.data.consistency.score}%`);
 *   console.log(`Momentum: ${result.data.momentum.score}`);
 * }
 */
async calculateObliqueMetrics(): Promise<{ 
  success: boolean; 
  data?: ObliqueMetrics; 
  error?: Error 
}>
```

**Returns ObliqueMetrics**:

```typescript
{
  userId: string;
  date: string;
  identityReinforcement: {
    score: number;        // 0-100
    trend: 'up' | 'down' | 'stable';
    breakdown: {
      actionsAligned: number;
      identityStatements: number;
      valuesLived: number;
    };
  };
  consistency: {
    score: number;        // 0-100
    streak: number;
    completionRate: number;
    habitAdherence: number;
    weeklyTrend: number[];
  };
  growth: {
    index: number;        // 0-100
    weeklyTrend: number[];
    areas: Record<LifeDomain, number>;
  };
  momentum: {
    score: number;        // 0-100
    acceleration: 'increasing' | 'stable' | 'decreasing';
    hardThingCompletionRate: number;
  };
  adaptiveLoad: {
    currentLoad: number;      // 1-10
    recommendedLoad: number;  // 1-10
    burnoutRisk: 'low' | 'medium' | 'high';
    recoveryNeeded: boolean;
    adjustmentReason: string;
  };
  createdAt: string;
}
```

---

## 🎨 ClearUIRenderer API

### Initialization

#### `init()`

Initialize the UI renderer.

```typescript
/**
 * Initialize the UI renderer
 * Sets up DOM elements and event listeners
 * 
 * @returns void
 * 
 * @example
 * clearUIRenderer.init();
 */
init(): void
```

---

### Navigation

#### `navigate(view)`

Navigate to a different view.

```typescript
/**
 * Navigate to a view
 * 
 * @param view - View name
 * 
 * @example
 * clearUIRenderer.navigate('dashboard');
 * clearUIRenderer.navigate('daily');
 * clearUIRenderer.navigate('systems');
 * clearUIRenderer.navigate('analytics');
 */
navigate(
  view: 'onboarding' | 'dashboard' | 'daily' | 'systems' | 'analytics'
): void
```

---

#### `refresh()`

Refresh current view.

```typescript
/**
 * Refresh current view
 * Re-renders the current view with latest data
 * 
 * @example
 * clearUIRenderer.refresh();
 */
refresh(): void
```

---

### Actions

#### `completeHabit(habitId)`

Complete a habit from the UI.

```typescript
/**
 * Complete a habit and refresh UI
 * 
 * @param habitId - Habit ID
 * @returns Promise<void>
 * 
 * @example
 * await clearUIRenderer.completeHabit('habit_123');
 */
async completeHabit(habitId: string): Promise<void>
```

---

#### `toggleHabit(habitId, index)`

Toggle habit completion status.

```typescript
/**
 * Toggle habit completion for daily log
 * 
 * @param habitId - Habit ID
 * @param index - Index in habit completions array
 * 
 * @example
 * clearUIRenderer.toggleHabit('habit_123', 0);
 */
toggleHabit(habitId: string, index: number): void
```

---

#### `showToast(message)`

Show a toast notification.

```typescript
/**
 * Show toast notification
 * 
 * @param message - Message to display
 * 
 * @example
 * clearUIRenderer.showToast('Habit completed! 🔥');
 * clearUIRenderer.showToast('Reflection saved');
 */
showToast(message: string): void
```

---

## 📝 Examples

### Complete Onboarding Flow

```typescript
import { clearEngine } from './clear/ClearEngine';
import { clearUIRenderer } from './clear/ClearUIRenderer';

// Initialize
await clearEngine.init();
clearUIRenderer.init();

// Submit onboarding signals
const result = await clearEngine.submitSignalInput({
  desires: ['Find my purpose', 'Build consistent habits'],
  frustrations: ['Procrastination', 'Lack of direction'],
  vagueGoals: ['Maybe start a business'],
  pastSuccesses: ['Ran a marathon', 'Learned Spanish'],
  constraints: ['2 hours per day', 'Limited energy in evenings'],
  peakEnergyTime: 'morning',
  availableHoursPerDay: 2
});

if (result.success) {
  // Get identity
  const identity = clearEngine.getIdentity();
  console.log(`Welcome, ${identity.archetype}!`);
  
  // Navigate to dashboard
  clearUIRenderer.navigate('dashboard');
}
```

---

### Daily Usage Flow

```typescript
// Morning: Set hard thing
const today = new Date().toISOString().split('T')[0];

await clearEngine.logDailyExecution({
  date: today,
  hardThing: {
    description: 'Finish project proposal',
    difficulty: 7
  },
  habitCompletions: [
    { habitId: 'habit_1', completed: false },
    { habitId: 'habit_2', completed: false }
  ],
  reflection: {
    identityAligned: false,
    energyLevel: 5,
    moodRating: 5
  }
});

// Evening: Complete hard thing and reflect
const log = clearEngine.getDailyLogByDate(today);

if (log) {
  log.hardThing.completed = true;
  log.hardThing.completedAt = new Date().toISOString();
  log.habitCompletions[0].completed = true;
  log.reflection = {
    identityAligned: true,
    energyLevel: 8,
    moodRating: 7,
    wins: ['Completed hard thing!'],
    gratitude: ['Good day', 'Progress made']
  };
  
  await clearEngine.logDailyExecution(log);
}

// Calculate metrics
const metrics = await clearEngine.calculateObliqueMetrics();
console.log(`Identity Reinforcement: ${metrics.data.identityReinforcement.score}%`);
```

---

### Weekly Review

```typescript
// Get all logs from this week
const logs = clearEngine.getDailyLogs();
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);

const thisWeek = logs.filter(l => 
  new Date(l.date) >= weekAgo
);

// Calculate stats
const completionRate = thisWeek.filter(l => l.hardThing.completed).length / 
                       thisWeek.length * 100;

const avgEnergy = thisWeek.reduce((acc, l) => acc + l.reflection.energyLevel, 0) / 
                  thisWeek.length;

// Get metrics
const metrics = await clearEngine.calculateObliqueMetrics();

console.log(`Week Review:`);
console.log(`- Completion Rate: ${completionRate.toFixed(0)}%`);
console.log(`- Average Energy: ${avgEnergy.toFixed(1)}/10`);
console.log(`- Identity Score: ${metrics.data.identityReinforcement.score}`);
console.log(`- Momentum: ${metrics.data.momentum.acceleration}`);

// Adjust load if needed
if (metrics.data.adaptiveLoad.recommendedAdjustment === 'decrease') {
  console.log('Consider reducing your load this week');
}
```

---

## 🔗 Related Documents

- [Architecture Overview](../architecture/overview.md)
- [Domain Model](../architecture/domain/README.md)
- [Quick Start Guide](../../CLEAR_QUICKSTART.md)
- [Type Definitions](../../src/types/clear-types.ts)

---

**This API is stable for v1.0. Breaking changes will be documented in changelog.**

✨ *Clear - The engine that turns clarity into action and action into success.*
