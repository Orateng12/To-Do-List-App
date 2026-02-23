# Architecture Decision Records (ADRs)

## Overview

This directory contains Architecture Decision Records (ADRs) for Clear Life OS. Each ADR documents a significant architectural decision, its context, and consequences.

---

## ADR Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [001](#adr-001) | Archetype-Based User Segmentation | Accepted | 2026-02-23 |
| [002](#adr-002) | Event-Driven Architecture | Accepted | 2026-02-23 |
| [003](#adr-003) | localStorage for MVP Storage | Accepted | 2026-02-23 |
| [004](#adr-004) | Atomic System Templates | Accepted | 2026-02-23 |
| [005](#adr-005) | Confidence Scoring for Archetypes | Accepted | 2026-02-23 |

---

## ADR-001: Archetype-Based User Segmentation

### Status

**Accepted** - 2026-02-23

### Context

Users come to Clear Life OS with vastly different levels of clarity and readiness. A one-size-fits-all approach fails to address the specific needs of:
- **Clear** users who know their direction
- **Confused** users who have direction but struggle with consistency
- **Lost** users who are uncertain about direction

Without proper segmentation, we risk:
- Overwhelming lost users with complex systems
- Frustrating clear users with overly simplistic flows
- Missing opportunities for targeted interventions

### Decision

Implement a three-tier archetype system with:
1. **Onboarding Assessment**: 12 questions across 4 categories (identity, systems, friction, readiness)
2. **Confidence Scoring**: 0.0-1.0 confidence in archetype assignment
3. **Differentiated Experience**: Each archetype receives customized:
   - Onboarding flow length
   - System complexity
   - Reflection frequency
   - Notification strategy

### Consequences

#### Positive
- Personalized user experience from day 1
- Better matching of system complexity to user readiness
- Foundation for progressive migration (lost → confused → clear)
- Enables targeted interventions

#### Negative
- Increased complexity in onboarding flow
- Requires validation mechanism to ensure accuracy
- Risk of users feeling "labeled" by archetype

#### Risks
- **Misclassification**: Users assigned wrong archetype
  - *Mitigation*: Confidence scoring + validation at days 3, 7, 14
- **Static Assignment**: Users stuck in initial archetype
  - *Mitigation*: Identity migration system with automatic triggers

### References

- Atomic Habits (James Clear) - Identity-based habits
- Tiny Habits (BJ Fogg) - Ability threshold concept

---

## ADR-002: Event-Driven Architecture

### Status

**Accepted** - 2026-02-23

### Context

Clear Life OS has multiple modules that need to communicate:
- Archetype engine needs to notify UI of assignments
- Intervention engine needs to react to habit completions
- Analytics needs to track all user actions
- Identity migration needs to monitor user metrics

Tight coupling between modules would:
- Make testing difficult
- Prevent independent module evolution
- Create circular dependencies

### Decision

Implement event-driven architecture using Pub/Sub pattern:

```javascript
// Event emission
eventBus.emit(AppEvents.HABIT_COMPLETED, { habitId, completionType });

// Event subscription
eventBus.on(AppEvents.HABIT_COMPLETED, (data) => {
  // Handle completion
});
```

**Event Categories:**
- `task:*` - Task lifecycle events
- `habit:*` - Habit completion events
- `identity:*` - Identity/archetype events
- `system:*` - System modification events
- `clarity:*` - Clarity measurement events
- `intervention:*` - Intervention events

### Consequences

#### Positive
- Loose coupling between modules
- Easy to add new features without modifying existing code
- Centralized event logging for analytics
- Simplified testing (mock event bus)

#### Negative
- Harder to trace event flow
- Potential for event spam
- Requires discipline in event naming

#### Risks
- **Event Explosion**: Too many events fired
  - *Mitigation*: Event batching, debouncing
- **Memory Leaks**: Event listeners not cleaned up
  - *Mitigation*: WeakRef pattern, cleanup on destroy

### References

- Pub/Sub Pattern
- Event Bus Pattern

---

## ADR-003: localStorage for MVP Storage

### Status

**Accepted** - 2026-02-23

### Context

For MVP launch, we need a storage solution that:
- Works without backend infrastructure
- Supports offline usage
- Is simple to implement and test
- Can be migrated to IndexedDB or backend later

Options considered:
1. **localStorage** - Simple, synchronous API
2. **IndexedDB** - More powerful, async API
3. **Session Storage** - Cleared on tab close (not suitable)

### Decision

Use **localStorage** for MVP with clear migration path:

```javascript
// Storage abstraction
class StorageAdapter {
  get(key) { return JSON.parse(localStorage.getItem(key)); }
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
}

// Future migration
class IndexedDBAdapter {
  // Same interface, different implementation
}
```

**Data Categories:**
- User state (archetype, current day)
- Event logs (batched)
- Clarity scores (daily)
- Migration history
- Habit streaks

### Consequences

#### Positive
- Zero setup required
- Works offline
- Simple API
- Easy to debug (DevTools)

#### Negative
- Synchronous API (blocks main thread)
- 5-10MB storage limit
- String-only storage (requires serialization)
- No querying capability

#### Risks
- **Storage Limits**: User data exceeds quota
  - *Mitigation*: Event log rotation (keep last 1000)
- **Performance**: Large JSON.parse operations
  - *Mitigation*: Batch operations, web workers for large data

### Migration Path

```
Phase 1 (MVP): localStorage
Phase 2 (Growth): IndexedDB for events, localStorage for state
Phase 3 (Scale): Backend sync with local cache
```

### References

- Web Storage API
- IndexedDB API

---

## ADR-004: Atomic System Templates

### Status

**Accepted** - 2026-02-23

### Context

Users need pre-built habit systems, but rigid templates fail when:
- User can only complete part of the system
- User wants to customize components
- User needs to scale difficulty up or down

Monolithic templates create all-or-nothing thinking that leads to abandonment.

### Decision

Implement **Atomic System Templates** with:

1. **Keystone Habit**: Required minimum component
2. **Optional Add-ons**: Selectable components
3. **Completion Rules**: Multiple success levels

```javascript
{
  keystone: { name: 'Mindful Start', minDuration: 2 },
  addOns: [
    { name: 'Movement', levels: [5, 10, 20] },
    { name: 'Journaling', levels: [2, 5, 10] }
  ],
  completionRules: {
    minimum: 'keystone only = success',
    standard: 'keystone + 1 add-on',
    bonus: 'all components'
  }
}
```

### Consequences

#### Positive
- Flexible completion criteria
- Easy to scale difficulty
- Reduces all-or-nothing thinking
- Supports progressive overload

#### Negative
- More complex template structure
- Requires UI to show completion levels
- Harder to track "true" completion

#### Risks
- **Analysis Paralysis**: Too many choices
  - *Mitigation*: Smart defaults, guided selection
- **Minimum Becomes Standard**: Users always do minimum
  - *Mitigation*: Gamification, streak bonuses for standard/bonus

### References

- Atomic Habits - Keystone habits
- Tiny Habits - Celebration of small wins

---

## ADR-005: Confidence Scoring for Archetypes

### Status

**Accepted** - 2026-02-23

### Context

Archetype assignment based on questionnaire has inherent uncertainty:
- Users may answer inconsistently
- Users may aspirationally answer
- Users may misunderstand questions

Binary assignment (clear/confused/lost) without confidence leads to:
- False confidence in incorrect assignments
- No mechanism for flagging uncertain assignments
- Poor user experience when assignment feels wrong

### Decision

Implement **Confidence Scoring** with three factors:

```javascript
confidence = distanceFromThreshold - contradictionPenalty - variancePenalty
```

**Factors:**
1. **Distance From Threshold**: How far from archetype boundary
2. **Contradiction Penalty**: Inconsistent answers reduce confidence
3. **Variance Penalty**: High variance across categories reduces confidence

**Thresholds:**
- `confidence >= 0.65`: Proceed with assignment
- `confidence < 0.65`: Flag for validation

### Consequences

#### Positive
- Identifies uncertain assignments
- Enables targeted validation
- Provides transparency to users
- Reduces misclassification impact

#### Negative
- More complex scoring logic
- Requires explanation to users
- Additional validation flow needed

#### Risks
- **Gaming**: Users learn to answer "correctly"
  - *Mitigation*: Question rotation, behavioral validation
- **False Low Confidence**: Good assignments flagged
  - *Mitigation*: Tune thresholds based on data

### Validation Flow

```
Day 3: "How well does your archetype describe you?"
  ↓
If score < threshold → Recalibration offered
  ↓
Day 7: "Has the system felt appropriate?"
  ↓
Day 14: "Should we adjust your system?"
```

### References

- Psychometric testing - Confidence intervals
- Survey methodology - Validation questions

---

## Creating New ADRs

When proposing a new architectural decision:

1. Copy this template
2. Fill in all sections
3. Submit as PR to docs/ARCHITECTURE/decisions/
4. Discuss in team review
5. Update status after decision

### Template

```markdown
# ADR-XXX: Title

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

What is the issue motivating this decision?

## Decision

What change are we proposing?

## Consequences

### Positive
- Good outcomes

### Negative
- Trade-offs

### Risks
- Potential problems

## References

- Related documents
```
