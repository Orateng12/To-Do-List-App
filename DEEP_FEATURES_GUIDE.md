# TaskMaster v8.0 - Deep Features Documentation

## 🚀 The Ultimate Productivity Platform

TaskMaster has evolved into a **complete productivity ecosystem** with cutting-edge features including real-time collaboration, AI-powered insights, extensible plugin architecture, and advanced analytics.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Feature Deep Dives](#feature-deep-dives)
4. [API Reference](#api-reference)
5. [Plugin Development Guide](#plugin-development-guide)
6. [Performance Guide](#performance-guide)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Installation

```javascript
// In your main app file
import { initDeepFeatures } from './js/deep-features.js';

// After initializing taskRepository and ui
const deepFeatures = await initDeepFeatures(taskRepository, ui, {
    collaboration: { enabled: true },
    ai: { enabled: true },
    plugins: { enabled: true },
    analytics: { enabled: true },
    advanced: { enabled: true }
});

// That's it! All features are now active.
```

### Basic Usage

```javascript
// Create task with AI analysis
const task = await deepFeatures.createTask({
    text: 'Complete project report by Friday',
    priority: 'high'
});
// AI automatically categorizes, predicts duration, and suggests optimal time

// Get analytics
const analytics = await deepFeatures.getAnalytics({ dateRange: 'month' });

// Enable collaboration
const invite = await deepFeatures.enableCollaboration('my-room');

// Access plugins
const pluginManager = deepFeatures.getPluginManager();
await pluginManager.enablePlugin('task-tags');

// Access advanced features
const advanced = deepFeatures.getAdvancedFeatures();
await advanced.templates.applyTemplate('morning-routine');
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      TaskMaster Core                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Task      │  │    State    │  │     UI      │              │
│  │ Repository  │  │   Manager   │  │  Renderer   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   Deep Features Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   CRDT      │  │   AI/ML     │  │   Plugin    │              │
│  │Collaboration│  │  Pipeline   │  │   System    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Analytics  │  │  Advanced   │  │   Unified   │              │
│  │  Dashboard  │  │  Features   │  │Integration  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Storage Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  IndexedDB  │  │  LocalStor  │  │   Plugin    │              │
│  │   (Tasks)   │  │  (Settings) │  │   Storage   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Deep Dives

### 1. CRDT Collaboration Engine

**Location:** `js/collaboration/crdt-engine.js`

#### What is CRDT?

Conflict-Free Replicated Data Types (CRDT) allow multiple users to edit shared data simultaneously without conflicts. Changes automatically merge using mathematical guarantees.

#### Key Concepts

| Concept | Description |
|---------|-------------|
| **Vector Clock** | Tracks causality between operations |
| **LWW Register** | Last-Writer-Wins for simple values |
| **OR-Set** | Observed-Remove Set for collections |
| **Task CRDT** | Composite CRDT for task objects |

#### Usage

```javascript
import { CollaborationManager } from './collaboration/crdt-engine.js';

const collab = new CollaborationManager(taskRepository, storage);
await collab.initialize();

// Enable collaboration
collab.enableCollaboration('room-123');

// Create invite
const { inviteCode, peerId } = await collab.createInvite();
// Share inviteCode with collaborator

// Join via invite
await collab.joinViaInvite(inviteCode);

// Get status
const status = collab.getStatus();
// { enabled: true, nodeId: '...', roomId: '...', peerCount: 2 }
```

#### Events

```javascript
eventBus.on('collaboration:peer-connected', ({ peerId }) => {
    console.log('Peer connected:', peerId);
});

eventBus.on('collaboration:sync:complete', ({ changes }) => {
    console.log('Synced', changes, 'changes');
});
```

#### WebRTC Configuration

```javascript
const collab = new CollaborationManager(taskRepository, storage, {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
});
```

---

### 2. AI/ML Pipeline

**Location:** `js/ai-ml/ai-pipeline.js`

#### Components

| Component | Purpose |
|-----------|---------|
| **FeatureExtractor** | Convert tasks to ML features |
| **DurationPredictor** | Neural network for time estimates |
| **SmartCategorizer** | Multi-label classification |
| **PriorityRecommender** | Rule-based + ML priority |
| **CompletionPredictor** | Success probability |
| **PatternRecognizer** | Behavioral analytics |

#### Usage

```javascript
import { AIManager } from './ai-ml/ai-pipeline.js';

const ai = new AIManager(taskRepository, storage);
await ai.initialize();

// Analyze a task
const analysis = await ai.analyzeTask({
    text: 'Write quarterly report',
    priority: 'high',
    dueDate: '2024-02-01'
});

console.log(analysis);
/*
{
    category: [{ category: 'work', confidence: 0.92 }],
    priority: { priority: 'high', confidence: 0.88 },
    duration: { duration: 120, confidence: 0.75, minDuration: 90, maxDuration: 150 },
    completionProbability: { probability: 0.82, factors: [...] }
}
*/

// Get smart suggestions for all tasks
const suggestions = await ai.getSmartSuggestions();

// Get behavioral insights
const insights = await ai.getInsights();
```

#### Training

The DurationPredictor automatically trains on historical data:

```javascript
// Manual training
const trainingData = historicalTasks.map(t => ({
    features: ai.featureExtractor.extractFeatures(t),
    duration: t.actualDuration // Time taken to complete
}));

ai.durationPredictor.train(trainingData, epochs: 100);
```

#### Feature Extraction

The FeatureExtractor creates 30+ features:

```javascript
const features = ai.featureExtractor.extractFeatures(task);
/*
{
    textLength: 45,
    wordCount: 8,
    hasNumbers: 0,
    hasDate: 1,
    hasTime: 0,
    categoryScores: { work: 3, personal: 0, health: 0, ... },
    priorityScores: { high: 4, medium: 1, low: 0 },
    hasSubtasks: 0,
    subtaskCount: 0,
    hasDueDate: 1,
    daysUntilDue: 5,
    ...
}
*/
```

---

### 3. Plugin System

**Location:** `js/plugins/plugin-system.js`

#### Built-in Plugins

| Plugin | ID | Description |
|--------|-----|-------------|
| Custom Fields | `custom-fields` | Add custom fields to tasks |
| Task Tags | `task-tags` | Hashtag-style tagging |
| Task Comments | `task-comments` | Add comments to tasks |
| Recurring Tasks | `recurring-tasks` | Advanced recurrence |

#### Creating a Plugin

```javascript
import { Plugin, PluginHooks } from './plugins/plugin-system.js';

class MyPlugin extends Plugin {
    constructor() {
        super();
        this.id = 'my-plugin';
        this.name = 'My Plugin';
        this.version = '1.0.0';
        this.description = 'Does amazing things';
        this.author = 'Your Name';
    }

    async initialize(ctx) {
        await super.initialize(ctx);

        // Register hook
        ctx.registerHook(PluginHooks.TASK_AFTER_CREATE, async (data) => {
            console.log('Task created:', data.task);
            // Modify task if needed
            data.task.customField = 'value';
        });

        // Register command
        ctx.registerCommand('doSomething', async (args) => {
            this.ctx.showToast('Did something!', 'success');
            return { success: true };
        }, {
            description: 'Does something amazing',
            args: ['param1', 'param2']
        });

        // Subscribe to events
        ctx.on('task:created', (data) => {
            console.log('Task created:', data);
        });

        // Get/set settings
        const settings = await ctx.getSettings({ option1: 'default' });
        await ctx.saveSettings({ option1: 'new value' });
    }

    getSettingsUI() {
        return `
            <div class="plugin-settings">
                <h4>My Plugin Settings</h4>
                <label>
                    <input type="text" id="option1" />
                    Option 1
                </label>
            </div>
        `;
    }
}

export default MyPlugin;
```

#### Loading Plugins

```javascript
// Load from URL
await pluginManager.loadPluginFromURL('/plugins/my-plugin.js');

// Load from code
const pluginCode = `
    class CustomPlugin extends Plugin {
        // ... plugin code
    }
    return CustomPlugin;
`;
await pluginManager.loadPluginFromCode(pluginCode, 'custom-plugin');

// Register class
await pluginManager.registerPlugin(MyPlugin);

// Enable/disable
await pluginManager.enablePlugin('my-plugin');
await pluginManager.disablePlugin('my-plugin');

// Get plugin
const plugin = pluginManager.getPlugin('my-plugin');

// Get plugin API
const api = pluginManager.getPluginAPI('my-plugin');
```

#### Plugin Hooks Reference

```javascript
PluginHooks = {
    // Task lifecycle
    TASK_BEFORE_CREATE: 'task:beforeCreate',
    TASK_AFTER_CREATE: 'task:afterCreate',
    TASK_BEFORE_UPDATE: 'task:beforeUpdate',
    TASK_AFTER_UPDATE: 'task:afterUpdate',
    TASK_BEFORE_DELETE: 'task:beforeDelete',
    TASK_AFTER_DELETE: 'task:afterDelete',
    TASK_BEFORE_COMPLETE: 'task:beforeComplete',
    TASK_AFTER_COMPLETE: 'task:afterComplete',

    // UI hooks
    UI_BEFORE_RENDER: 'ui:beforeRender',
    UI_AFTER_RENDER: 'ui:afterRender',
    UI_TASK_CARD_RENDER: 'ui:taskCardRender',

    // App lifecycle
    APP_INIT: 'app:init',
    APP_READY: 'app:ready',

    // Data hooks
    DATA_BEFORE_SAVE: 'data:beforeSave',
    DATA_AFTER_SAVE: 'data:afterSave'
};
```

---

### 4. Analytics Dashboard

**Location:** `js/analytics/analytics-dashboard.js`

#### Usage

```javascript
import { AnalyticsDashboard } from './analytics/analytics-dashboard.js';

const dashboard = new AnalyticsDashboard(taskRepository, '#analyticsContainer');

// Render full dashboard
await dashboard.render({ dateRange: 'month' });

// Get raw analytics
const analytics = await dashboard.engine.getAnalytics('all');

// Get completion trends
const trends = await dashboard.engine.getCompletionTrends(30);

// Get heatmap data
const heatmap = await dashboard.engine.getHeatmapData();

// Export report
const report = await dashboard.exportReport('json');
```

#### Chart Types

```javascript
import { ChartRenderer } from './analytics/analytics-dashboard.js';

const renderer = new ChartRenderer();

// Bar chart
const barChart = renderer.renderBarChart(
    [{ label: 'Work', value: 10 }, { label: 'Personal', value: 5 }],
    { width: 400, height: 200 }
);

// Line chart
const lineChart = renderer.renderLineChart(
    trends.map(t => ({ label: t.date, value: t.completed })),
    { color: '#6366f1' }
);

// Donut chart
const donutChart = renderer.renderDonutChart(
    [{ name: 'High', value: 5 }, { name: 'Medium', value: 10 }, { name: 'Low', value: 3 }],
    { colors: ['#ef4444', '#f59e0b', '#22c55e'] }
);

// Heatmap
const heatmap = renderer.renderHeatmap(data, { cellSize: 15 });

// Render to container
renderer.render('#container', barChart);
```

#### Analytics Metrics

| Metric | Description |
|--------|-------------|
| `overview` | Total, completed, pending, overdue |
| `trends` | Monthly completion trends |
| `categories` | Category breakdown with rates |
| `priorities` | Priority distribution |
| `timeAnalysis` | Peak hours and days |
| `productivity` | Avg completion time, consistency |
| `goals` | Goal progress tracking |

---

### 5. Advanced Features

See `ADVANCED_FEATURES.md` for complete documentation on:
- Task Dependencies & Blocking
- Time Blocking & Auto-Scheduling
- Energy & Mood Tracking
- Bulk Operations
- Smart Templates
- Archive System
- Dependency Graph Visualization

---

## API Reference

### DeepFeaturesManager

```javascript
class DeepFeaturesManager {
    // Initialize all features
    async initialize(config: Object): Promise<void>

    // Get status
    getStatus(): Object

    // Enable/disable feature
    async setFeatureEnabled(feature: string, enabled: boolean): Promise<void>

    // CRUD operations (with AI and CRDT integration)
    async createTask(taskData: Object): Promise<Task>
    async updateTask(taskId: string, updates: Object): Promise<Task>
    async deleteTask(taskId: string): Promise<void>
    getAllTasks(): Array<Task>

    // Analytics
    async getAnalytics(options: Object): Promise<Object>
    async renderAnalyticsDashboard(container: Element, options: Object): Promise<string>

    // AI
    async getAISuggestions(): Promise<Array>

    // Collaboration
    async enableCollaboration(roomId: string): Promise<Object>
    async joinCollaboration(inviteCode: string): Promise<Object>

    // Access managers
    getPluginManager(): PluginManager
    getAdvancedFeatures(): AdvancedFeaturesManager

    // Cleanup
    async destroy(): Promise<void>
}
```

### Configuration Schema

```javascript
{
    collaboration: {
        enabled: boolean,
        autoSync: boolean,
        syncInterval: number  // ms
    },
    ai: {
        enabled: boolean,
        autoCategorize: boolean,
        smartSuggestions: boolean,
        durationPrediction: boolean,
        minTrainingData: number
    },
    plugins: {
        enabled: boolean,
        sandboxMode: boolean,
        allowedBuiltins: string[]
    },
    analytics: {
        enabled: boolean,
        autoTrack: boolean,
        dashboardContainer: string|null
    },
    advanced: {
        dependencies: boolean,
        timeBlocking: boolean,
        energyTracking: boolean,
        bulkOperations: boolean,
        templates: boolean,
        archive: boolean
    }
}
```

---

## Plugin Development Guide

### Plugin Structure

```
my-plugin/
├── index.js          # Main plugin file
├── styles.css        # Plugin styles
├── components/       # UI components
│   └── MyComponent.js
└── utils/           # Helper functions
    └── helpers.js
```

### Example: Complete Plugin

```javascript
// my-plugin/index.js
import { Plugin, PluginHooks } from '../plugins/plugin-system.js';

export default class TaskTimerPlugin extends Plugin {
    constructor() {
        super();
        this.id = 'task-timer';
        this.name = 'Task Timer';
        this.version = '1.0.0';
        this.description = 'Track time spent on tasks';
        this.author = 'Your Name';
        this.publicAPI = {
            startTimer: this.startTimer.bind(this),
            stopTimer: this.stopTimer.bind(this),
            getTimeSpent: this.getTimeSpent.bind(this)
        };
    }

    async initialize(ctx) {
        await super.initialize(ctx);
        this.timers = new Map();
        this.totalTime = await ctx.getSettings({ time: {} });

        // Hook into task completion
        ctx.registerHook(PluginHooks.TASK_BEFORE_COMPLETE, async (data) => {
            if (this.timers.has(data.task.id)) {
                this.stopTimer(data.task.id);
            }
        });

        // Add UI button
        ctx.injectUI('task-actions', `
            <button class="timer-btn" data-action="toggle-timer">
                ⏱️ Start Timer
            </button>
        `);

        // Handle timer clicks
        ctx.on('plugin:ui:click', async (e) => {
            if (e.action === 'toggle-timer') {
                this.toggleTimer(e.taskId);
            }
        });
    }

    toggleTimer(taskId) {
        if (this.timers.has(taskId)) {
            this.stopTimer(taskId);
        } else {
            this.startTimer(taskId);
        }
    }

    startTimer(taskId) {
        this.timers.set(taskId, Date.now());
        this.ctx.showToast('Timer started', 'info');
    }

    stopTimer(taskId) {
        const startTime = this.timers.get(taskId);
        const elapsed = Date.now() - startTime;
        
        if (!this.totalTime.time[taskId]) {
            this.totalTime.time[taskId] = 0;
        }
        this.totalTime.time[taskId] += elapsed;
        this.ctx.saveSettings(this.totalTime);
        
        this.timers.delete(taskId);
        this.ctx.showToast(`Timer stopped: ${Math.round(elapsed/60000)} min`, 'success');
    }

    getTimeSpent(taskId) {
        return this.totalTime.time[taskId] || 0;
    }

    getSettingsUI() {
        return `
            <div class="plugin-settings">
                <h4>Task Timer Settings</h4>
                <p>Track time spent on each task</p>
                <button id="clearTimerData" class="btn-danger">Clear All Timer Data</button>
            </div>
        `;
    }
}
```

### Plugin Best Practices

1. **Always clean up** in `destroy()`
2. **Use sandboxed APIs** only
3. **Handle errors gracefully**
4. **Provide settings UI** for configuration
5. **Document your plugin** thoroughly
6. **Version your plugin** properly
7. **Test thoroughly** before release

---

## Performance Guide

### Optimization Tips

| Feature | Recommendation |
|---------|----------------|
| CRDT | Limit to 100 concurrent tasks |
| AI Training | Train on max 1000 samples |
| Analytics | Cache results for 5 minutes |
| Plugins | Limit to 10 active plugins |
| Graph Visualizer | Max 50 nodes for smooth animation |

### Memory Management

```javascript
// Clean up old data periodically
setInterval(async () => {
    // Archive old completed tasks
    await archiveManager.autoArchive();
    
    // Clear old analytics cache
    analyticsCache.clear();
    
    // Prune plugin logs
    await storage.saveSetting('plugin_logs', []);
}, 24 * 60 * 60 * 1000);
```

### Lazy Loading

```javascript
// Load features on demand
const deepFeatures = new DeepFeaturesManager(taskRepository, ui);

// Only initialize what you need
await deepFeatures.initialize({
    ai: { enabled: true },
    analytics: { enabled: false }, // Load later
    plugins: { enabled: false }    // Load later
});

// Load analytics when needed
await deepFeatures.setFeatureEnabled('analytics', true);
```

---

## Troubleshooting

### Common Issues

#### Collaboration Not Syncing

```javascript
// Check WebRTC support
if (!window.RTCPeerConnection) {
    console.error('WebRTC not supported');
}

// Check ICE servers
const status = collab.getStatus();
console.log('Peer count:', status.peerCount);

// Force re-sync
collab.webrtc.broadcast(collab.replication.getFullState());
```

#### AI Not Making Predictions

```javascript
// Check training data
const tasks = await taskRepository.getAll();
const historicalData = tasks.filter(t => t.completed && t.actualDuration);
console.log('Training samples:', historicalData.length);

// Need at least 10 samples
if (historicalData.length < 10) {
    console.warn('Not enough training data');
}

// Retrain manually
ai.durationPredictor.train(trainingData, epochs: 200);
```

#### Plugin Not Loading

```javascript
// Check for syntax errors
try {
    await pluginManager.loadPluginFromURL('/plugin.js');
} catch (e) {
    console.error('Plugin load error:', e.message);
}

// Check plugin ID
const plugin = pluginManager.getPlugin('my-plugin');
if (!plugin) {
    console.error('Plugin not found');
}
```

#### Analytics Not Rendering

```javascript
// Check container exists
const container = document.querySelector('#analyticsContainer');
if (!container) {
    console.error('Container not found');
}

// Check data
const analytics = await dashboard.engine.getAnalytics();
console.log('Analytics data:', analytics);
```

---

## Security Considerations

### Plugin Sandboxing

```javascript
// Plugins run in sandboxed environment
const sandbox = {
    ctx,  // Limited context
    hooks: PluginHooks,
    fetch: window.fetch,  // Safe
    console: { log, warn, error },  // No direct console access
    // NO access to:
    // - window
    // - document
    // - localStorage directly
    // - eval
};
```

### Data Privacy

```javascript
// Enable encryption for sensitive data
const config = {
    encryption: {
        enabled: true,
        algorithm: 'AES-256-GCM'
    }
};
```

---

## Contributing

### Adding New Features

1. Create module in appropriate directory
2. Export from `deep-features.js`
3. Add to `DeepFeaturesManager`
4. Update documentation
5. Add tests

### Code Style

```javascript
// Use ES6 modules
import { eventBus } from './core/event-bus.js';

// JSDoc comments
/**
 * Description
 * @param {Type} param - Description
 * @returns {Type} Description
 */

// Error handling
try {
    // Operation
} catch (e) {
    console.error('[Feature] Error:', e);
    throw e;
}
```

---

**TaskMaster v8.0 - The Ultimate Productivity Platform**

*Built with ❤️ using cutting-edge web technologies*
