# Clear Life OS - Documentation Architecture

## Overview

This document defines the documentation architecture for Clear Life OS, ensuring consistency, discoverability, and maintainability across all documentation artifacts.

---

## Documentation Structure

```
docs/
├── README.md                    # Documentation index
├── ARCHITECTURE/
│   ├── overview.md              # System overview
│   ├── decisions/               # Architecture Decision Records (ADRs)
│   │   ├── 001-archetype-system.md
│   │   ├── 002-event-driven-design.md
│   │   └── 003-storage-strategy.md
│   └── diagrams/                # Architecture diagrams
├── API/
│   ├── reference/               # API reference documentation
│   │   ├── archetype-engine.md
│   │   ├── identity-migration.md
│   │   └── ...
│   └── examples/                # Usage examples
├── GUIDES/
│   ├── getting-started.md       # Quick start guide
│   ├── onboarding.md            # Developer onboarding
│   ├── integration.md           # Integration guide
│   └── migration.md             # Migration guides
├── CONCEPTS/
│   ├── archetypes.md            # Archetype system explained
│   ├── identity-migration.md    # Identity migration explained
│   ├── atomic-systems.md        # Atomic systems explained
│   └── clarity-measurement.md   # Clarity measurement explained
├── TESTING/
│   ├── strategy.md              # Testing strategy
│   ├── unit-tests.md            # Unit testing guide
│   └── integration-tests.md     # Integration testing guide
├── OPERATIONS/
│   ├── deployment.md            # Deployment guide
│   ├── monitoring.md            # Monitoring guide
│   └── troubleshooting.md       # Troubleshooting guide
└── STANDARDS/
    ├── coding-standards.md      # Code style guide
    ├── documentation-standards.md # Documentation standards
    └── jsdoc-standards.md       # JSDoc standards
```

---

## Documentation Standards

### 1. Markdown Conventions

```markdown
# H1 - Document Title (one per document)

## H2 - Major Sections

### H3 - Subsections

#### H4 - Minor subsections (use sparingly)

- Bullet lists for options
- Numbered lists for sequences

**Bold** for emphasis
`inline code` for technical terms

```javascript
// Code blocks with language specification
const example = 'code';
```

> Blockquotes for notes and warnings

| Tables | For | Data |
|--------|-----|------|
| Cell   | Cell| Cell |
```

### 2. JSDoc Standards

```javascript
/**
 * @fileoverview Brief description of the file
 * @module module-name
 */

/**
 * Class description
 * 
 * @class ClassName
 * @description Detailed description
 * 
 * @param {Type} paramName - Parameter description
 * 
 * @returns {Type} Return description
 * 
 * @example
 * const instance = new ClassName();
 * 
 * @fires EventType#event-name
 * 
 * @throws {ErrorType} Error description
 */
```

### 3. API Documentation Template

```markdown
# Module Name

## Overview

Brief description of the module's purpose.

## Installation

```javascript
import { ModuleName } from './path/to/module.js';
```

## API Reference

### `methodName(param1, param2)`

Description of what the method does.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| param1 | `string` | Description |
| param2 | `number` | Description |

**Returns:** `Type` - Description of return value

**Throws:** `ErrorType` - When error occurs

**Example:**

```javascript
const result = module.methodName('value', 42);
```

**Events:**

| Event | Description |
|-------|-------------|
| `event:name` | Fired when something happens |
```

### 4. Architecture Decision Record (ADR) Template

```markdown
# ADR-XXX: Title

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive
- Good outcome 1
- Good outcome 2

### Negative
- Trade-off 1
- Trade-off 2

### Risks
- Risk 1
- Risk 2

## References

- Link to related documents
```

---

## Code Documentation Standards

### 1. File Header

```javascript
/**
 * @fileoverview Brief description of module purpose
 * @module clear/module-name
 * @version 1.0.0
 * @author Clear Life OS Team
 * @license MIT
 */
```

### 2. Class Documentation

```javascript
/**
 * ClassName - Brief description
 * 
 * @class
 * @description Detailed description of class purpose
 * and functionality.
 * 
 * @param {Type} paramName - Constructor parameter description
 * 
 * @example
 * const instance = new ClassName(param);
 * instance.method();
 */
class ClassName {
    // Implementation
}
```

### 3. Method Documentation

```javascript
/**
 * methodName - Brief description
 * 
 * @description Detailed description of what the method does,
 * including edge cases and special behavior.
 * 
 * @param {Type} paramName - Parameter description
 * @param {Type} [optionalParam] - Optional parameter description
 * @param {Type} [defaultParam='default'] - Parameter with default
 * 
 * @returns {Type} Return value description
 * 
 * @throws {ErrorType} When error condition occurs
 * 
 * @fires EventType#eventName - When event is triggered
 * 
 * @example
 * const result = instance.methodName('value');
 * console.log(result);
 */
methodName(paramName, optionalParam, defaultParam = 'default') {
    // Implementation
}
```

### 4. Type Definitions

```javascript
/**
 * @typedef {Object} TypeName
 * @property {Type} property1 - Description
 * @property {Type} property2 - Description
 * @property {Type} [optionalProperty] - Optional description
 */

/**
 * @typedef {'clear' | 'confused' | 'lost'} ArchetypeType
 * @description User archetype classification
 */

/**
 * @typedef {Object} CompletionResult
 * @property {boolean} success - Whether completion succeeded
 * @property {string} habitId - Habit identifier
 * @property {'minimum' | 'standard' | 'bonus'} level - Completion level
 * @property {number} streak - Current streak count
 */
```

---

## Documentation Generation

### JSDoc Configuration

```json
{
  "tags": {
    "allowUnknownTags": true,
    "dictionaries": ["jsdoc", "closure"]
  },
  "source": {
    "include": ["js/clear"],
    "includePattern": ".+\\.js(doc|x)?$",
    "excludePattern": "(^|\\/|\\\\)_"
  },
  "plugins": ["plugins/markdown"],
  "templates": {
    "cleverLinks": false,
    "monospaceLinks": false,
    "default": {
      "outputSourceFiles": true
    }
  },
  "opts": {
    "destination": "./docs/api-reference",
    "recurse": true,
    "template": "node_modules/docdash"
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "docs:generate": "jsdoc -c jsdoc.conf.json",
    "docs:serve": "npx http-server ./docs/api-reference",
    "docs:watch": "nodemon --exec 'npm run docs:generate' --watch js/clear"
  }
}
```

---

## Quality Standards

### Documentation Checklist

Before merging any documentation:

- [ ] Clear and concise title
- [ ] Overview section present
- [ ] All public APIs documented
- [ ] Examples provided for complex operations
- [ ] Edge cases mentioned
- [ ] Error conditions documented
- [ ] Events fired listed
- [ ] Return types specified
- [ ] Code examples tested
- [ ] Links verified
- [ ] Spelling and grammar checked

### Code Review for Documentation

Reviewers should verify:

1. **Completeness**: All public interfaces documented
2. **Accuracy**: Examples work as described
3. **Clarity**: Language is clear and unambiguous
4. **Consistency**: Follows documentation standards
5. **Discoverability**: Proper cross-referencing

---

## Version Control

### Documentation Versioning

- Documentation version matches code version
- Changelog includes documentation updates
- Deprecated APIs marked with deprecation date
- Migration guides for breaking changes

### File Naming

- Lowercase with hyphens: `module-name.md`
- No spaces or special characters
- Descriptive but concise names

---

## Maintenance

### Review Cycle

- **Weekly**: Check for broken links
- **Monthly**: Review for accuracy
- **Quarterly**: Major documentation audit
- **Per-release**: Update API reference

### Ownership

- Each module has documentation owner
- Documentation reviewed in PR process
- Community contributions welcomed

---

## Tools & Resources

### Recommended Tools

- **Editor**: VS Code with JSDoc extensions
- **Diagram**: Draw.io, Mermaid.js
- **API Testing**: Postman, Insomnia
- **Documentation**: JSDoc, Markdownlint

### Resources

- [JSDoc Documentation](https://jsdoc.app/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Architecture Decision Records](https://adr.github.io/)

---

## Contact

For documentation questions or contributions:
- Email: docs@clearlifeos.example.com
- GitHub Issues: Documentation tag
- Slack: #documentation channel
