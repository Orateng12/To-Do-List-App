# ADR-002: Oblique Metrics Design

**Status**: Accepted

**Date**: 2024-01-15

---

## Context

Clear needs to measure user progress. The question is: **what metrics?**

Traditional productivity apps measure:
- Tasks completed
- Goals achieved
- Hours worked
- Streaks maintained

However, the **Obliquity Principle** (John Kay) suggests that goals are often best achieved indirectly.

### The Obliquity Principle

> "Happiness is the byproduct of doing other things."
> "The most successful companies don't focus primarily on profits."
> "The best athletes don't think about winning."

Applied to productivity:
- **Direct**: Track tasks → Get tasks done
- **Oblique**: Track identity → Get transformation

---

## Problem Statement

How do we measure progress in a way that:
1. Encourages sustainable behavior change?
2. Doesn't create unhealthy obsession with metrics?
3. Actually predicts long-term success?
4. Aligns with identity-first philosophy?

### Problems with Direct Metrics

1. **Goodhart's Law**
   > "When a measure becomes a target, it ceases to be a good measure."
   
   Users optimize for the metric, not the outcome.

2. **Gaming the System**
   - Create easy tasks to boost completion rate
   - Log hours without real work
   - Maintain streaks mindlessly

3. **Short-Term Thinking**
   - Focus on daily wins vs long-term growth
   - Burnout from constant optimization
   - Miss the bigger picture

4. **Identity Misalignment**
   - Tasks completed ≠ identity change
   - Can check boxes without transformation
   - External validation vs internal growth

---

## Proposed Solution

**Oblique Metrics** - measure indirect indicators of success:

```
Direct Metrics:      Tasks → Goals → Outcomes
                     ↑
                     Focus here (wrong)

Oblique Metrics:     Identity → Systems → Habits → Actions
                     ↑
                     Focus here (right)
```

### Five Oblique Metrics

#### 1. Identity Reinforcement Score (0-100)

**What**: How aligned were your actions with your desired identity?

**Calculation**:
```typescript
score = (
  (actionsAligned * 10) +
  (consistencyScore / 10) +
  (momentumScore / 10)
)
```

**Why Oblique**: 
- Doesn't measure what you did
- Measures who you're becoming
- Indirect path to transformation

#### 2. Consistency Score (0-100)

**What**: How reliably do you show up?

**Calculation**:
```typescript
score = (completedDays / 7) * 100
```

**Why Oblique**:
- Not about intensity
- About showing up
- Compounds over time

#### 3. Growth Index (0-100)

**What**: Overall progress across life domains

**Calculation**:
```typescript
index = average(
  career, finance, health, relationships,
  personal_growth, spirituality, creativity, contribution
)
```

**Why Oblique**:
- Holistic view
- Prevents single-domain obsession
- Balanced growth

#### 4. Momentum Score (0-100)

**What**: Are you accelerating or decelerating?

**Calculation**:
```typescript
recentAvg = average(last3Days.consistencyScore)
olderAvg = average(previous4Days.consistencyScore)
score = recentAvg + (recentAvg - olderAvg) * 2
```

**Why Oblique**:
- Not about current state
- About direction
- Predicts future success

#### 5. Adaptive Load (1-10)

**What**: How much challenge can you handle right now?

**Calculation**:
```typescript
if (consistency > 80%) load++
if (consistency < 40%) load--
if (energy < 4/10) burnoutRisk = 'high'
```

**Why Oblique**:
- Not pushing harder
- Pushing appropriately
- Prevents burnout

---

## Decision

**We will implement Oblique Metrics as our primary measurement system.**

### Implementation Details

#### 1. Daily Calculation

```typescript
interface DailyMetrics {
  identityReinforcement: number;  // 0-100
  consistency: number;            // 0-100
  momentum: number;               // 0-100
  adaptiveLoad: number;           // 1-10
}
```

#### 2. Weekly Aggregation

```typescript
interface WeeklyMetrics {
  trends: {
    identity: number[];   // 7 days
    consistency: number[];
    momentum: number[];
  };
  averages: {
    identity: number;
    consistency: number;
    momentum: number;
  };
}
```

#### 3. UI Presentation

**Dashboard**:
- Show current scores
- Show trends (up/down/stable)
- Don't show historical data overload

**Analytics View**:
- Weekly charts
- Domain breakdown
- Load recommendations

#### 4. Recommendations Engine

```typescript
if (identityScore < 50) {
  recommend: "Focus on one keystone habit"
}

if (consistency < 40 && load > 6) {
  recommend: "Reduce your adaptive load"
}

if (momentum === 'decreasing') {
  recommend: "Review your identity alignment"
}
```

---

## Consequences

### Positive ✅

1. **Sustainable Progress**
   - Users focus on identity, not tasks
   - Less burnout from metric chasing
   - Long-term thinking encouraged

2. **Better Outcomes**
   - Indirect measurement predicts success better
   - Identity change is lasting change
   - Holistic growth

3. **Differentiation**
   - Unique in productivity market
   - Aligns with research
   - Clear value proposition

4. **Healthier Relationship with Productivity**
   - Not about grinding
   - About alignment
   - Rest is valued

### Negative ❌

1. **Harder to Understand**
   - Users expect simple metrics
   - Oblique metrics require explanation
   - More cognitive load

2. **Less Immediate Gratification**
   - Can't see "100 tasks completed!"
   - Progress is subtler
   - Requires patience

3. **Complex Implementation**
   - Multiple metrics to calculate
   - Trends to track
   - Recommendations to generate

### Risks ⚠️

1. **User Confusion**
   - Risk: Users don't understand metrics
   - Mitigation: Clear explanations, examples, tooltips

2. **Perceived Arbitrariness**
   - Risk: Scores feel made up
   - Mitigation: Transparent calculation, user control

3. **Metric Obsession**
   - Risk: Users obsess over oblique metrics
   - Mitigation: Reminders that metrics are tools, not goals

---

## Alternatives Considered

### 1. Traditional Metrics

**Metrics**: Tasks completed, goals achieved, hours logged

**Pros**:
- Simple to understand
- Easy to implement
- Immediate gratification

**Cons**:
- Encourages gaming
- Short-term thinking
- Doesn't predict success

**Rejected Because**: Reinforces wrong behaviors

### 2. Single Metric (North Star)

**Metric**: One score (e.g., "Life Score")

**Pros**:
- Simple
- Focused
- Easy to track

**Cons**:
- Oversimplifies complexity
- Can be gamed
- Misses nuance

**Rejected Because**: Too reductive for human growth

### 3. No Metrics (Anti-Metrics)

**Approach**: Qualitative only, no scores

**Pros**:
- No metric obsession
- Focus on feeling
- Intuitive

**Cons**:
- No feedback loop
- Hard to track progress
- Users want data

**Rejected Because**: Users benefit from feedback

### 4. Hybrid (Direct + Oblique)

**Metrics**: Both task completion and identity scores

**Pros**:
- Best of both worlds
- Transition for users

**Cons**:
- Confusing
- Diluted focus
- Mixed messages

**Rejected Because**: Loses clarity of purpose

---

## Validation

### Success Metrics

1. **User Understanding**
   - Target: > 80% can explain metrics
   - Measure: Survey responses

2. **Metric Accuracy**
   - Target: Metrics correlate with self-reported progress
   - Measure: Correlation analysis

3. **Behavioral Change**
   - Target: Users report identity shift
   - Measure: "I am someone who..." statements

4. **Retention**
   - Target: > 60% at 30 days
   - Measure: Active users

### Validation Methods

1. **User Interviews**
   - Weekly interviews with new users
   - Ask: "What do the metrics mean?"
   - Ask: "How do you use them?"

2. **A/B Testing**
   - Test different metric presentations
   - Measure understanding and engagement

3. **Correlation Studies**
   - Track metric scores vs self-reported success
   - Validate predictive power

4. **Long-term Follow-up**
   - Check in at 30, 60, 90 days
   - Measure sustained change

---

## Implementation Notes

### Calculation Timing

- **Daily**: End of day (after reflection)
- **Weekly**: Sunday evening aggregation
- **Real-time**: Adaptive load adjustments

### UI Guidelines

**Do**:
- Show trends, not just numbers
- Use colors (green/yellow/red)
- Provide context ("vs last week")
- Offer recommendations

**Don't**:
- Overwhelm with data
- Show all historical data
- Make metrics the focus
- Encourage metric optimization

### Wording

**Use**:
- "Identity Reinforcement" (not "Identity Score")
- "Consistency" (not "Completion Rate")
- "Momentum" (not "Performance")
- "Adaptive Load" (not "Difficulty")

**Avoid**:
- "Productivity Score"
- "Efficiency Rating"
- "Performance Index"
- Any judgment language

---

## Research Backing

### Obliquity

**John Kay** (2010):
> "The most successful companies don't focus primarily on profits."
> "Happiness is the byproduct of doing other things."

Applied to Clear:
> "Productivity is the byproduct of identity alignment."

### Goodhart's Law

**Charles Goodhart** (1975):
> "When a measure becomes a target, it ceases to be a good measure."

Why oblique metrics resist this:
- Measure indirect indicators
- Focus on process, not outcome
- Encourage alignment, not optimization

### Self-Determination Theory

**Deci & Ryan** (1985):
> "Intrinsic motivation > Extrinsic motivation"

Oblique metrics support:
- Autonomy (self-directed)
- Competence (skill building)
- Relatedness (identity alignment)

---

## References

- Kay, John. *Obliquity: Why Our Goals Are Best Achieved Indirectly*. 2010.
- Clear, James. *Atomic Habits*. 2018.
- Deci, Edward & Ryan, Richard. *Intrinsic Motivation and Self-Determination in Human Behavior*. 1985.
- Goodhart, Charles. "Problems of Monetary Management: The UK Experience". 1975.

---

**Oblique metrics are the compass, not the destination.**

✨ *Clear - The engine that turns clarity into action and action into success.*
