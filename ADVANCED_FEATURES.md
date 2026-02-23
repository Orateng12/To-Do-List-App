# TaskMaster v7.0 - Advanced Features Documentation

## 🎉 What's New in v7.0

This version introduces **7 major feature categories** that transform TaskMaster from a simple to-do list into a complete productivity ecosystem.

---

## 📋 Table of Contents

1. [Task Dependencies & Blocking](#1-task-dependencies--blocking)
2. [Time Blocking & Auto-Scheduling](#2-time-blocking--auto-scheduling)
3. [Energy & Mood Tracking](#3-energy--mood-tracking)
4. [Bulk Operations & Quick Actions](#4-bulk-operations--quick-actions)
5. [Smart Templates](#5-smart-templates)
6. [Archive System](#6-archive-system)
7. [Dependency Graph Visualization](#7-dependency-graph-visualization)

---

## 1. Task Dependencies & Blocking

### Overview
Create relationships between tasks to model real-world workflows where some tasks must be completed before others can begin.

### Dependency Types
| Type | Description | Example |
|------|-------------|---------|
| `blocks` (FS) | Finish-to-Start: Task A must finish before Task B starts | "Write report" → "Submit report" |
| `starts` (SS) | Start-to-Start: Task A must start before Task B starts | "Setup meeting" → "Run meeting" |
| `finishes` (FF) | Finish-to-Finish: Task A must finish before Task B finishes | "Coding" → "Testing" |
| `precedes` | With lag time: Task A finishes X days before Task B starts | "Send invitation" → 3 days → "Event" |

### API Usage

```javascript
import { DependencyManager } from './js/dependencies/dependency-manager.js';

const depManager = new DependencyManager(taskRepository);

// Add dependency
await depManager.addDependency(
    'task-a-id',  // predecessor
    'task-b-id',  // successor
    depManager.DEPENDENCY_TYPES.BLOCKS,
    0  // lag days
);

// Check if task can start
const canStart = await depManager.canStart('task-b-id');
console.log(canStart); 
// { canStart: false, blockingCount: 1, blockingTasks: [...] }

// Get blocking tasks
const blocking = await depManager.getBlockingTasks('task-b-id');

// Get blocked tasks
const blocked = await depManager.getBlockedTasks('task-a-id');

// Calculate critical path
const criticalPath = await depManager.calculateCriticalPath(allTasks);
```

### Features
- ✅ Circular dependency detection
- ✅ Automatic blocking status updates
- ✅ Critical path calculation
- ✅ Dependency graph data export
- ✅ Affected tasks analysis

### Events
```javascript
eventBus.on('dependency:added', ({ predecessor, successor, type }) => {
    console.log('Dependency created');
});

eventBus.on('dependency:removed', ({ predecessor, successor }) => {
    console.log('Dependency removed');
});
```

---

## 2. Time Blocking & Auto-Scheduling

### Overview
Assign tasks to specific time slots and let AI automatically schedule your day based on priorities, dependencies, and energy levels.

### Features

#### Create Time Blocks
```javascript
import { TimeBlockingScheduler } from './js/time-blocking/time-blocking.js';

const scheduler = new TimeBlockingScheduler(taskRepository, depManager);

// Create a time block for a task
await scheduler.createTimeBlock(
    'task-id',
    new Date('2024-01-25T09:00:00'),
    60  // minutes
);
```

#### Auto-Schedule
```javascript
// Auto-schedule for next week
const schedule = await scheduler.autoSchedule(
    new Date(),  // start
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),  // end
    {
        workHours: { start: 9, end: 17, breakStart: 12, breakEnd: 13 },
        bufferMinutes: 15,
        considerEnergy: true,
        energyLevel: 70,
        maxTasksPerDay: 6
    }
);

// Apply schedule to tasks
await scheduler.applySchedule(schedule);
```

#### Find Optimal Time
```javascript
const optimalTime = await scheduler.findOptimalTime('task-id');
console.log(optimalTime);
// { suggestedStart: Date, suggestedEnd: Date, duration: 45, confidence: 'high' }
```

#### Check Conflicts
```javascript
const conflicts = await scheduler.getConflicts(
    'task-id',
    new Date('2024-01-25T14:00:00'),
    60
);
```

#### Daily Schedule
```javascript
const dailySchedule = await scheduler.getDailySchedule(new Date());
console.log(dailySchedule.blocks);
```

### Events
```javascript
eventBus.on('timeblock:created', ({ task, timeBlock }) => {});
eventBus.on('timeblock:updated', ({ task, block }) => {});
eventBus.on('schedule:generated', (result) => {});
```

---

## 3. Energy & Mood Tracking

### Overview
Track your energy and mood throughout the day to get personalized task recommendations based on your mental state.

### Energy Levels (1-10)
| Level | Description | Best For |
|-------|-------------|----------|
| 1-3 | Low energy | Admin tasks, emails, routine work |
| 4-6 | Average energy | Regular tasks, meetings |
| 7-10 | High energy | Deep work, creative tasks, problem-solving |

### Mood Categories
- 🎯 Focused
- 💡 Creative
- ⚡ Energetic
- 😌 Calm
- 😰 Stressed
- 😴 Tired
- 🔥 Motivated
- 😐 Neutral

### API Usage

```javascript
import { EnergyMoodTracker } from './js/energy/energy-tracker.js';

const tracker = new EnergyMoodTracker(taskRepository, db);

// Log energy
await tracker.logEnergy(7, 'Feeling great today!');

// Log mood
await tracker.logMood('focused', 4, 'In the zone');

// Log combined
await tracker.logCombined(8, 'motivated', 5, 'Ready to crush it!');

// Get current state
const state = await tracker.getCurrentState();
console.log(state);
// { energy: 7, mood: 'focused', moodIntensity: 4, energyTrend: 'increasing' }

// Get recommendations
const recommendations = await tracker.getRecommendations(state);
console.log(recommendations.bestMatch);

// Get analytics
const analytics = await tracker.getAnalytics(30);
console.log(analytics.hourlyPatterns);
console.log(analytics.peakHours);
console.log(analytics.insights);

// Get optimal times
const optimalTimes = await tracker.getOptimalTimes();
console.log(optimalTimes.deepWork.hours);
```

### Task Matching
```javascript
// Check if current state matches task requirements
const match = await tracker.checkTaskMatch('task-id');
console.log(match);
/*
{
    energyMatch: true,
    currentEnergy: 7,
    requiredEnergy: 5,
    moodMatch: true,
    currentMood: 'focused',
    idealMoods: ['focused', 'energetic'],
    recommendation: 'Perfect time to tackle this task!',
    confidence: 0.85
}
*/
```

### Events
```javascript
eventBus.on('energy:logged', ({ entry }) => {});
eventBus.on('mood:logged', ({ entry }) => {});
eventBus.on('recommendations:generated', ({ state, recommendations }) => {});
```

---

## 4. Bulk Operations & Quick Actions

### Overview
Select multiple tasks and perform batch operations efficiently with right-click context menus and keyboard shortcuts.

### Multi-Select

```javascript
import { BulkOperationsManager } from './js/bulk-ops/bulk-operations.js';

const bulkOps = new BulkOperationsManager(taskRepository, ui);

// Toggle selection
bulkOps.toggleSelection('task-id');

// Select range
bulkOps.selectRange('first-task-id', 'last-task-id', allVisibleIds);

// Select all
bulkOps.selectAll(allVisibleIds);

// Clear selection
bulkOps.clearSelection();

// Get selected
const selected = bulkOps.getSelected();
```

### Batch Operations

```javascript
// Complete multiple tasks
await bulkOps.batchComplete();

// Delete multiple tasks
await bulkOps.batchDelete();

// Set priority for multiple tasks
await bulkOps.batchSetPriority('high');

// Add category to multiple tasks
await bulkOps.batchSetCategory('work');

// Export selected tasks
await bulkOps.batchExport('json');  // or 'csv', 'txt'
```

### Context Menu
Right-click on any task card to access:
- ✓ Complete
- ↩ Mark Incomplete
- 🔴/🟡/🟢 Set Priority
- ☑ Select All Visible
- ⇄ Invert Selection
- 📄 Export as JSON/CSV
- 🗑 Delete

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Shift + Click` | Select range |
| `Ctrl + Click` | Toggle selection |
| `Ctrl + A` | Select all visible |
| `Escape` | Clear selection |
| `Delete` | Delete selected |
| `Enter` | Complete selected |

### Events
```javascript
eventBus.on('selection:changed', ({ selected, count }) => {});
eventBus.on('selection:mode_changed', ({ enabled }) => {});
eventBus.on('batch:complete', ({ completed, count }) => {});
eventBus.on('batch:delete', ({ deleted, count }) => {});
```

---

## 5. Smart Templates

### Overview
Create tasks instantly from pre-built or custom templates for common workflows and routines.

### Pre-Built Templates

| Template | Category | Tasks |
|----------|----------|-------|
| 🌅 Morning Routine | Productivity | 6 tasks |
| 🌙 Evening Routine | Productivity | 5 tasks |
| 🚀 Project Launch | Work | 7 tasks |
| 📋 Meeting Preparation | Work | 6 tasks |
| 📊 Weekly Review | Productivity | 7 tasks |
| 📚 Study Session | Education | 6 tasks |
| 🧹 Deep Cleaning | Personal | 7 tasks |
| 💼 Job Application | Career | 6 tasks |
| ✈️ Travel Preparation | Personal | 7 tasks |
| 🎯 Goal Setting | Productivity | 6 tasks |

### API Usage

```javascript
import { TemplatesManager } from './js/templates/templates-manager.js';

const templates = new TemplatesManager(taskRepository, db);

// Get all templates
const allTemplates = await templates.getAllTemplates();

// Get by category
const workTemplates = await templates.getTemplatesByCategory('work');

// Apply template
await templates.applyTemplate('morning-routine', {
    dueDateOffset: 0,
    startDate: new Date(),
    spreadDays: 0,  // All tasks same day
    prefix: ''  // No prefix
});

// Create custom template from tasks
const template = await templates.createFromTasks(
    'My Custom Workflow',
    ['task-1', 'task-2', 'task-3'],
    'work'
);

// Create custom template from scratch
await templates.createCustomTemplate({
    name: 'My Template',
    category: 'custom',
    description: 'Custom workflow',
    icon: '⭐',
    tasks: [
        { text: 'Step 1', priority: 'high', estimatedDuration: 30 },
        { text: 'Step 2', priority: 'medium', estimatedDuration: 45 }
    ]
});

// Get suggestions
const suggestions = await templates.getSuggestions({
    hour: 8,  // Morning
    dayOfWeek: 1  // Monday
});

// Export template
const exportData = await templates.exportTemplate('template-id');

// Import template
await templates.importTemplate(exportData);
```

### Events
```javascript
eventBus.on('template:created', ({ template }) => {});
eventBus.on('template:applied', ({ template, createdTasks }) => {});
eventBus.on('template:imported', ({ template }) => {});
```

---

## 6. Archive System

### Overview
Soft-delete tasks instead of permanently removing them. Archive completed tasks automatically and restore when needed.

### API Usage

```javascript
import { ArchiveManager } from './js/archive/archive-manager.js';

const archive = new ArchiveManager(taskRepository, db);

// Archive a task
await archive.archiveTask('task-id');

// Restore a task
await archive.restoreTask('task-id');

// Get archived tasks
const archived = await archive.getArchivedTasks({
    search: 'project',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    priority: 'high'
});

// Bulk archive
await archive.bulkArchive(['task-1', 'task-2', 'task-3']);

// Bulk restore
await archive.bulkRestore(['task-1', 'task-2']);

// Permanently delete
await archive.permanentlyDelete('task-id');

// Clear all archived (older than X days)
await archive.clearAllArchived({ olderThanDays: 90 });

// Auto-archive old completed tasks
const stats = await archive.autoArchive();
console.log(stats);
// { archivedCount: 5, deletedCount: 2, ... }

// Get statistics
const archiveStats = await archive.getStats();
console.log(archiveStats);
/*
{
    totalArchived: 15,
    byPriority: { high: 3, medium: 7, low: 5 },
    byAge: { today: 2, thisWeek: 5, thisMonth: 8, older: 0 },
    completedVsIncomplete: { completed: 12, incomplete: 3 },
    storageSizeKB: 45.2
}
*/

// Export archive
const exportData = await archive.exportArchive('json');

// Search archived
const results = await archive.search('project', {
    searchIn: ['text', 'notes', 'categories']
});
```

### Auto-Archive Settings
```javascript
// Configure auto-archive
archive.AUTO_ARCHIVE_DAYS = 30;  // Archive completed tasks after 30 days
archive.ARCHIVE_RETENTION_DAYS = 365;  // Delete archived after 1 year
```

### Events
```javascript
eventBus.on('archive:task_archived', ({ task }) => {});
eventBus.on('archive:task_restored', ({ task }) => {});
eventBus.on('archive:auto_archive_complete', (stats) => {});
```

---

## 7. Dependency Graph Visualization

### Overview
Interactive force-directed graph visualization showing task dependencies, blocking relationships, and critical path.

### Features
- 🕸️ Force-directed layout with physics simulation
- 🎨 Color-coded nodes (completed, blocked, can start)
- ⚡ Critical path highlighting
- 🔍 Zoom and pan controls
- 📱 Touch support
- 💡 Interactive tooltips

### Usage

```javascript
import { DependencyGraphVisualizer } from './js/dependencies/graph-visualizer.js';

const container = document.getElementById('graphContainer');
const visualizer = new DependencyGraphVisualizer(container, depManager);

// Initialize
await visualizer.init(tasks);

// Refresh data
await visualizer.refresh(newTasks);

// Destroy
visualizer.destroy();
```

### Controls
| Button | Action | Shortcut |
|--------|--------|----------|
| + | Zoom In | `+` / `=` |
| − | Zoom Out | `-` |
| ⟲ | Reset View | `0` |
| ⚡ | Toggle Critical Path | `C` |
| ⬡ | Re-layout | `L` |

### Interactions
- **Drag node**: Reposition manually
- **Click node**: Select and view details
- **Double-click**: Open task details
- **Right-click**: Context menu
- **Drag canvas**: Pan view
- **Scroll**: Zoom in/out

### Events
```javascript
eventBus.on('graph:node_selected', ({ node }) => {});
eventBus.on('graph:node_context_menu', ({ node, x, y }) => {});
eventBus.on('graph:node_dblclick', ({ node }) => {});
```

### Node Colors
| Color | Status |
|-------|--------|
| 🟢 Green | Completed |
| 🔴 Red | Blocked (dependencies not met) |
| 🟡 Yellow | Can Start (all dependencies complete) |
| 🔵 Blue | Normal (no dependencies) |
| 🟠 Orange | Critical Path |

---

## 🎯 Integration Guide

### Quick Start

```javascript
// In your main app file
import { AdvancedFeaturesManager } from './js/advanced-features.js';

// After initializing taskRepository and ui
const features = new AdvancedFeaturesManager(taskRepository, ui);
await features.initialize();

// Access individual managers
features.dependencyManager
features.timeBlockingScheduler
features.energyTracker
features.bulkOps
features.templates
features.archive
```

### UI Integration

Add these elements to your HTML for full feature access:

```html
<!-- Selection Toolbar -->
<div class="selection-toolbar" id="selectionToolbar"></div>

<!-- Energy Tracker Widget -->
<div class="energy-tracker-widget" id="energyTrackerWidget"></div>

<!-- Templates Panel -->
<div class="templates-panel" id="templatesPanel"></div>

<!-- Archive View -->
<div class="archive-view" id="archiveView"></div>

<!-- Dependency Graph Modal -->
<div class="modal" id="dependencyGraphModal"></div>
```

---

## 📊 Performance Considerations

| Feature | Memory | CPU | Recommendations |
|---------|--------|-----|-----------------|
| Dependencies | Low | Medium | Limit to 100 dependent tasks |
| Time Blocking | Low | Low | Safe for all use cases |
| Energy Tracking | Medium | Low | Archive old logs periodically |
| Bulk Operations | Low | Medium | Batch operations < 100 items |
| Templates | Low | Low | Safe for all use cases |
| Archive | Medium | Low | Use search for large archives |
| Graph Visualizer | High | High | Limit to 50 nodes for smooth animation |

---

## 🔧 Configuration

```javascript
const CONFIG = {
    // Auto-archive
    AUTO_ARCHIVE_ENABLED: true,
    AUTO_ARCHIVE_INTERVAL: 24 * 60 * 60 * 1000,  // 24 hours
    
    // Energy tracking
    ENERGY_REMINDER_INTERVAL: 4 * 60 * 60 * 1000,  // 4 hours
    
    // Templates
    TEMPLATE_SUGGESTIONS_ENABLED: true,
    
    // Graph visualizer
    GRAPH_MAX_NODES: 100,
    GRAPH_ANIMATION_FPS: 60
};
```

---

## 🐛 Troubleshooting

### Dependencies
- **Circular dependency error**: Check your task relationships
- **Tasks not showing as blocked**: Ensure dependencies are saved correctly

### Time Blocking
- **Schedule not generating**: Check work hours and task durations
- **Conflicts not detected**: Verify existing time blocks

### Energy Tracking
- **No recommendations**: Log energy/mood for at least 3 days
- **Analytics empty**: Need more data points

### Bulk Operations
- **Selection not working**: Check event listeners are bound
- **Context menu not showing**: Ensure right-click isn't blocked

### Templates
- **Template not applying**: Verify task repository is accessible
- **Custom templates missing**: Check storage permissions

### Archive
- **Tasks not archiving**: Check auto-archive settings
- **Restore not working**: Verify task ID exists

### Graph Visualizer
- **Graph not rendering**: Check canvas support
- **Performance issues**: Reduce number of nodes

---

## 📈 Future Enhancements

Planned for v8.0:
- [ ] Recurring task dependencies
- [ ] Team collaboration features
- [ ] Advanced analytics dashboard
- [ ] Mobile-optimized UI
- [ ] Calendar integration (Google, Outlook)
- [ ] AI-powered task suggestions
- [ ] Voice commands for bulk operations
- [ ] Template marketplace

---

**TaskMaster v7.0 - From Simple To-Do to Complete Productivity System**

*Built with ❤️ using vanilla JavaScript and advanced CS concepts*
