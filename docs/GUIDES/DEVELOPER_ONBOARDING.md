# Clear Life OS - Developer Onboarding Guide

## Welcome! 👋

This guide will help you get started developing Clear Life OS, an intelligent productivity system that adapts to user clarity levels.

---

## Quick Start

### Prerequisites

- **Node.js**: v18+ 
- **npm**: v9+
- **Browser**: Chrome/Edge/Firefox (latest)
- **Editor**: VS Code recommended

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/clear-life-os.git
cd clear-life-os

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:5173
```

### Project Structure

```
clear-life-os/
├── js/
│   ├── clear/              # Clear Life OS modules
│   │   ├── archetype-engine.js
│   │   ├── identity-migration.js
│   │   ├── aspiration-detector.js
│   │   ├── atomic-systems.js
│   │   ├── conflict-detector.js
│   │   ├── event-logger.js
│   │   ├── clarity-measurement.js
│   │   ├── intervention-engine.js
│   │   ├── index.js        # Main integration
│   │   └── types.js        # Type definitions
│   ├── core/               # Core infrastructure
│   ├── features/           # Feature modules
│   └── app.js              # Application entry
├── css/                    # Styles
├── docs/                   # Documentation
└── index.html              # Main HTML
```

---

## Architecture Overview

### Core Concepts

1. **Archetypes**: User classification (clear/confused/lost)
2. **Identity Migration**: Progressive movement between archetypes
3. **Atomic Systems**: Modular habit templates
4. **Interventions**: Context-aware user support
5. **Clarity Measurement**: Outcome tracking

### Data Flow

```
User Action → Event Bus → Module Handlers → Storage
                ↓
        Analytics Engine
                ↓
        Intervention Engine
                ↓
        UI Updates
```

---

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# ...

# Run tests
npm test

# Commit with conventional commits
git commit -m "feat: add new intervention type"

# Push and create PR
git push origin feature/your-feature-name
```

### 2. Code Style

We use ESLint with strict rules:

```bash
# Lint code
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### 3. Documentation

All public APIs must be documented with JSDoc:

```javascript
/**
 * Calculate archetype from assessment
 * 
 * @param {Object} answers - User answers
 * @returns {ArchetypeAssignment} Assignment result
 */
calculateArchetype(answers) {
  // Implementation
}
```

---

## Module Guide

### Archetype Engine

**Purpose**: Assign users to archetypes based on assessment

```javascript
import { ArchetypeEngine } from './clear/archetype-engine.js';

const engine = new ArchetypeEngine();
const result = engine.calculateArchetype(answers);

console.log(result.archetype);     // 'clear' | 'confused' | 'lost'
console.log(result.confidence);    // 0.0 - 1.0
```

**Key Methods:**
- `calculateArchetype(answers)` - Calculate archetype
- `validateArchetype(type, answers)` - Validate assignment
- `getArchetypeConfig(archetypeId)` - Get configuration

### Identity Migration

**Purpose**: Track and manage archetype transitions

```javascript
import { IdentityMigrationSystem } from './clear/identity-migration.js';

const migration = new IdentityMigrationSystem(repo, archetypeEngine);
migration.initialize('confused');

const eligibility = await migration.checkMigrationEligibility(metrics);
```

**Key Methods:**
- `initialize(archetype)` - Initialize tracking
- `checkMigrationEligibility(metrics)` - Check for migration
- `executeMigration(type)` - Execute migration

### Atomic Systems

**Purpose**: Provide modular habit templates

```javascript
import { AtomicSystemTemplates } from './clear/atomic-systems.js';

const templates = new AtomicSystemTemplates();
const system = templates.createCustomizedSystem('morning_system', {
  addOns: ['movement', 'journal']
});
```

**Key Methods:**
- `getTemplate(templateId)` - Get template
- `createCustomizedSystem(id, customization)` - Create system
- `checkCompletion(system, completions)` - Check completion

### Intervention Engine

**Purpose**: Provide context-aware interventions

```javascript
import { InterventionEngine } from './clear/intervention-engine.js';

const engine = new InterventionEngine(repo, archetypeEngine);

// Check critical window
const interventions = engine.checkCriticalWindowInterventions(day, state);

// Get adaptive suggestion
const suggestion = await engine.getAdaptiveSuggestion(metrics);
```

**Key Methods:**
- `checkCriticalWindowInterventions(day, state)` - Day 1-3 interventions
- `checkRecoveryFlows(state)` - Missed day recovery
- `getAdaptiveSuggestion(metrics)` - Adaptive suggestions

---

## Testing Guide

### Unit Tests

```javascript
// tests/archetype-engine.test.js
import { ArchetypeEngine } from '../js/clear/archetype-engine.js';

describe('ArchetypeEngine', () => {
  it('should calculate archetype with high confidence', () => {
    const engine = new ArchetypeEngine();
    const answers = createConsistentAnswers('clear');
    
    const result = engine.calculateArchetype(answers);
    
    expect(result.archetype).toBe('clear');
    expect(result.confidence).toBeGreaterThan(0.65);
  });
});
```

### Integration Tests

```javascript
// tests/integration.test.js
import { ClearLifeOS } from '../js/clear/index.js';

describe('ClearLifeOS Integration', () => {
  it('should complete full onboarding flow', async () => {
    const clearOS = new ClearLifeOS(repo);
    await clearOS.initialize();
    
    const result = clearOS.completeOnboarding(answers);
    
    expect(result.archetype.archetype).toBeDefined();
    expect(result.config).toBeDefined();
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test:coverage

# Run specific test file
npm test -- archetype-engine.test.js
```

---

## Debugging

### Browser DevTools

```javascript
// Enable debug logging
localStorage.setItem('clear_debug', 'true');

// Access Clear Life OS instance
window.clearOS.getProgress().then(console.log);
```

### Event Logging

```javascript
// Listen to all events
eventBus.on('*', (event) => {
  console.log('Event:', event.name, event.data);
});

// Listen to specific events
eventBus.on(AppEvents.HABIT_COMPLETED, (data) => {
  console.log('Habit completed:', data);
});
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Archetype not saving | Check localStorage permissions |
| Events not firing | Verify event bus initialization |
| Interventions not showing | Check day number and triggers |
| Clarity scores missing | Verify daily recording |

---

## Deployment

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

### Environment Variables

```bash
# .env
CLEAR_LOG_LEVEL=info
CLEAR_ANALYTICS_ENABLED=true
CLEAR_STORAGE_KEY=clear_prod
```

---

## Contributing

### Pull Request Process

1. Fork repository
2. Create feature branch
3. Make changes with tests
4. Run linting and tests
5. Update documentation
6. Create PR with description
7. Address review feedback
8. Merge after approval

### Commit Convention

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Format code
refactor: Refactor code
test: Add tests
chore: Update dependencies
```

### Code Review Checklist

- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log in production code
- [ ] Error handling implemented
- [ ] JSDoc comments present

---

## Resources

### Documentation

- [API Reference](/docs/API/reference/)
- [Architecture](/docs/ARCHITECTURE/)
- [Concepts](/docs/CONCEPTS/)
- [Testing](/docs/TESTING/)

### External

- [JSDoc Documentation](https://jsdoc.app/)
- [Event Bus Pattern](https://www.red-gate.com/simple-talk/dotnet/net-programming/design-patterns-the-event-bag-pattern/)
- [Atomic Habits (Book)](https://jamesclear.com/atomic-habits)

---

## Getting Help

- **Slack**: #clear-life-os-dev
- **GitHub Issues**: Bug reports and feature requests
- **Email**: dev@clearlifeos.example.com

---

## Next Steps

1. ✅ Complete setup
2. ✅ Run development server
3. ✅ Read architecture overview
4. ✅ Review module guides
5. ✅ Write first test
6. ✅ Create first PR

Welcome to the team! 🚀
