# TaskMaster - Deep Dive Level 5 Documentation

## 🚀 Architecture Overview

This implementation represents the cutting edge of browser-based application architecture, combining multiple advanced patterns typically found in distributed systems.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TaskMaster Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   React/Vue  │     │   Vanilla    │     │   Mobile     │            │
│  │     UI       │     │      JS      │     │     App      │            │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘            │
│         │                    │                    │                      │
│         └────────────────────┼────────────────────┘                      │
│                              │                                           │
│                     ┌────────▼────────┐                                  │
│                     │  State Machine  │                                  │
│                     │   (XState-like) │                                  │
│                     └────────┬────────┘                                  │
│                              │                                           │
│         ┌────────────────────┼────────────────────┐                      │
│         │                    │                    │                      │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐              │
│  │    CRDT      │    │  WebSocket   │    │  GraphQL     │              │
│  │  (Offline)   │    │  (Real-time) │    │   (API)      │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                    │                    │                      │
│         └────────────────────┼────────────────────┘                      │
│                              │                                           │
│                     ┌────────▼────────┐                                  │
│                     │  IndexedDB      │                                  │
│                     │  (Persistence)  │                                  │
│                     └─────────────────┘                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Module Breakdown

### 1. CRDT (Conflict-free Replicated Data Types)

**File:** `js/crdt/crdt.js`

**Purpose:** Enable offline-first collaboration with automatic conflict resolution.

**Key Classes:**

```javascript
// LWW Register - Last-Writer-Wins for single values
const register = new LWWRegister(nodeId, initialValue);
register.set('new value', timestamp);
register.merge(otherRegister);

// OR-Set - Observed-Remove Set for collections
const set = new ORSet(nodeId);
set.add('element');
set.remove('element');
set.merge(otherSet);

// CRDT Task - Complete task document
const task = new CRDTTask(nodeId);
task.setText('Buy milk');
task.setPriority('high');
task.merge(remoteTask);

// Collaboration Manager - High-level API
const collab = new CollaborationManager();
collab.createTask({ text: 'Task', priority: 'high' });
collab.updateTask(taskId, { completed: true });
collab.on('task:synced', (task) => console.log('Synced!'));
```

**How It Works:**

1. Each client has a unique `nodeId`
2. Every field uses LWW Register with timestamps
3. Collections use OR-Set with unique tags
4. Merges are commutative, associative, and idempotent
5. Eventual consistency guaranteed

**Conflict Resolution:**

```
Client A: sets text to "Hello" at t=1000
Client B: sets text to "World" at t=1001

After merge: text = "World" (higher timestamp wins)

If timestamps equal: nodeId is tie-breaker (higher wins)
```

---

### 2. WebSocket Real-Time Sync

**File:** `js/network/websocket.js`

**Purpose:** Bi-directional real-time communication for live collaboration.

**Key Features:**

```javascript
// Automatic reconnection with exponential backoff
const ws = new WebSocketClient('wss://api.example.com/ws', {
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    reconnectDecay: 1.5,
    heartbeatInterval: 30000
});

// Message acknowledgment
await ws.send({ type: 'operation', data }, true); // requireAck = true

// Channel multiplexing
ws.join('room:123');
ws.leave('room:123');

// Event subscription
ws.on('operation:broadcast', (data) => {
    console.log('Remote operation:', data);
});

// Presence management
const presence = new PresenceManager(ws, userId);
presence.setStatus('busy');
presence.setMetadata({ currentTask: 'Editing' });
presence.on('presence:changed', ({ userId, presence }) => {
    console.log(`${userId} is now ${presence.status}`);
});
```

**Message Protocol:**

| Type | Direction | Description |
|------|-----------|-------------|
| `connect` | C→S | Join channel |
| `connected` | S→C | Channel joined |
| `sync:request` | C→S | Request sync |
| `sync:response` | S→C | Sync data |
| `operation` | C→S | Send operation |
| `operation:broadcast` | S→C | Receive operation |
| `ping` | S→C | Heartbeat |
| `pong` | C→S | Heartbeat response |

---

### 3. GraphQL API Layer

**File:** `js/api/graphql.js`

**Purpose:** Type-safe API client with intelligent caching.

**Key Features:**

```javascript
// Create client
const client = new GraphQLClient('https://api.example.com/graphql', {
    cacheEnabled: true,
    defaultTimeout: 10000,
    retryAttempts: 3
});

// Set auth token
client.setToken('jwt-token-here');

// Execute query
const tasks = await client.query(Queries.GetTasks, {
    filter: { completed: false },
    sort: { field: 'createdAt', direction: 'desc' }
});

// Execute mutation with optimistic update
await client.mutate(Mutations.UpdateTask, {
    id: 'task-123',
    input: { completed: true }
}, {
    optimisticResponse: {
        updateTask: { id: 'task-123', completed: true }
    },
    invalidateCache: ['tasks', 'task:task-123']
});

// Subscribe to query updates
const unsubscribe = client.subscribe(Queries.GetTasks, {}, (data) => {
    console.log('Tasks updated:', data);
});

// High-level Task API
const taskAPI = new TaskAPI(client);
const tasks = await taskAPI.getTasks();
await taskAPI.createTask({ text: 'New task', priority: 'high' });
await taskAPI.toggleTask('task-123');
```

**Caching Strategy:**

1. Query results cached by query + variables
2. Cache invalidation on mutations
3. Optimistic updates for instant UI feedback
4. Request deduplication (same query = single request)

---

### 4. State Machine

**File:** `js/app-deep-dive.js`

**Purpose:** Predictable state management with explicit transitions.

**State Diagram:**

```
                    ┌─────────────┐
                    │ initializing│
                    └──────┬──────┘
                           │ INITIALIZED
                           ▼
                    ┌─────────────┐
              ┌─────│   ready     │─────┐
              │     └──────┬──────┘     │
         SYNC_START        │         ERROR
              │            │             │
              ▼            │             ▼
       ┌─────────────┐     │      ┌─────────────┐
       │   syncing   │     │      │    error    │
       └──────┬──────┘     │      └──────┬──────┘
              │            │             │
    SYNC_COMPLETE    OFFLINE       CLEAR_ERROR
              │            │             │
              └────────────┴─────────────┘
                           │
                        OFFLINE
                           │
                           ▼
                    ┌─────────────┐
                    │   offline   │
                    └──────┬──────┘
                           │ ONLINE
                           │
                           └─────────────┐
```

**Usage:**

```javascript
const machine = new StateMachine({
    initial: 'idle',
    context: { count: 0 },
    states: {
        idle: {
            on: {
                START: { 
                    target: 'running',
                    actions: ['logStart']
                }
            }
        },
        running: {
            entry: 'onEnter',
            on: {
                STOP: 'idle'
            }
        }
    },
    actions: {
        logStart: (ctx) => console.log('Started with', ctx.count)
    }
});

machine.send('START');
machine.subscribe(({ from, to, context }) => {
    console.log(`Transitioned from ${from} to ${to}`);
});
```

---

### 5. Event Bus (Pub/Sub)

**File:** `js/core/event-bus.js`

**Purpose:** Decoupled communication between components.

**Features:**

```javascript
// Basic pub/sub
eventBus.on('task:created', (data) => {
    console.log('Task created:', data);
});

eventBus.emit('task:created', { id: '123', text: 'Hello' });

// Wildcard matching
eventBus.on('task:*', (data, event) => {
    console.log(`Task event: ${event.name}`);
});

eventBus.on('*', (data, event) => {
    console.log(`Any event: ${event.name}`);
});

// Middleware
eventBus.use((event, next) => {
    console.log('Event before handlers:', event.name);
    next();
});

// Once listener
eventBus.once('sync:complete', () => {
    console.log('Sync completed once');
});

// Priority (higher = called first)
eventBus.on('task:created', handler1, 10);
eventBus.on('task:created', handler2, 5);
```

---

### 6. Dependency Injection

**File:** `js/core/di-container.js`

**Purpose:** Inversion of control for testable, modular code.

**Usage:**

```javascript
// Register services
container.registerClass('Database', Database);
container.registerFactory('logger', () => new Logger({ level: 'debug' }));
container.registerValue('config', { apiUrl: '...' });

// With dependencies
container.registerClass('TaskService', TaskService, ['Database', 'logger']);
container.registerClass('SyncService', SyncService, ['TaskService', 'config']);

// Resolve
const taskService = container.get('TaskService');
const syncService = container.get('SyncService');

// Singleton vs transient
container.register('cache', () => new Map(), { singleton: true });
container.register('request', () => new Request(), { singleton: false });

// Child containers
const child = container.createChild();
child.registerValue('featureFlag', true);
// Can still resolve parent services
const taskService = child.get('TaskService');
```

---

## 🔧 Configuration

**File:** `js/app-deep-dive.js`

```javascript
const CONFIG = {
    FEATURES: {
        CRDT_ENABLED: true,        // Enable offline collaboration
        WEBSOCKET_ENABLED: true,   // Enable real-time sync
        GRAPHQL_ENABLED: false,    // Enable GraphQL API
        WASM_ENABLED: false,       // Enable WebAssembly (future)
        BLOCKCHAIN_ENABLED: false, // Enable blockchain verification (future)
        PUSH_NOTIFICATIONS: true   // Enable push notifications
    },
    
    ENDPOINTS: {
        WEBSOCKET: 'wss://api.taskmaster.com/ws',
        GRAPHQL: 'https://api.taskmaster.com/graphql',
        SYNC: 'https://api.taskmaster.com/sync'
    },
    
    TIMING: {
        DEBOUNCE_DELAY: 150,
        HEARTBEAT_INTERVAL: 30000,
        SYNC_INTERVAL: 60000
    }
};
```

---

## 📊 Debug API

Access everything via browser console:

```javascript
// Global app instance
window.TaskMasterApp

// Core services
TaskMasterApp.app              // Main application
TaskMasterApp.app.collaboration // CRDT collaboration
TaskMasterApp.app.ws           // WebSocket client
TaskMasterApp.app.gql          // GraphQL client
TaskMasterApp.app.stateMachine // State machine

// Debug utilities
TaskMasterApp.app.getStats()   // Application statistics
TaskMasterApp.eventBus         // Event bus
TaskMasterApp.db               // IndexedDB wrapper

// Example: Monitor state changes
TaskMasterApp.app.stateMachine.subscribe(console.log);

// Example: Monitor all events
TaskMasterApp.eventBus.on('*', (data, event) => {
    console.log('Event:', event.name, data);
});
```

---

## 🚀 Getting Started

### 1. Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
    <title>TaskMaster Deep Dive</title>
</head>
<body>
    <script type="module">
        import { app } from './js/app-deep-dive.js';
        
        // App auto-initializes on DOMContentLoaded
        
        // Access app methods
        setTimeout(() => {
            const task = app.createTask({
                text: 'My first task',
                priority: 'high'
            });
            console.log('Created:', task);
        }, 1000);
    </script>
</body>
</html>
```

### 2. With WebSocket Backend

```javascript
// The WebSocket server should handle:
ws.on('connection', (socket) => {
    // Join room
    socket.on('connect', ({ channel }) => {
        socket.join(channel);
    });
    
    // Sync request
    socket.on('sync:request', async (state) => {
        const serverState = await getServerState();
        socket.emit('sync:response', serverState);
    });
    
    // Broadcast operations
    socket.on('operation', (op) => {
        socket.to(op.channel).emit('operation:broadcast', op);
    });
});
```

---

## 🏗️ Server Requirements

### Minimal WebSocket Server (Node.js)

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const state = new Map(); // room -> state

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        
        switch (msg.type) {
            case 'connect':
                ws.join(msg.channel);
                break;
                
            case 'sync:request':
                const roomState = state.get(msg.channel) || {};
                ws.send(JSON.stringify({
                    type: 'sync:response',
                    state: roomState
                }));
                break;
                
            case 'operation':
                // Store operation
                // Broadcast to others
                ws.to(msg.channel).emit('message', JSON.stringify({
                    type: 'operation:broadcast',
                    operation: msg.operation
                }));
                break;
        }
    });
});
```

---

## 📈 Performance Considerations

### Memory Management

```javascript
// Limit operation log size
CRDTDocumentStore._logOperation() {
    if (this.operationLog.length > 1000) {
        this.operationLog = this.operationLog.slice(-500);
    }
}

// Bounded message queue
WebSocketClient._flushQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
        // Process queue
    }
    // Auto-clear if too large
    if (this.messageQueue.length > 1000) {
        this.messageQueue = this.messageQueue.slice(-500);
    }
}

// Cache size limits
GraphQLClient {
    constructor(options) {
        this.options = {
            cacheMaxSize: 1000,
            cacheMaxAge: 5 * 60 * 1000
        };
    }
}
```

### Network Optimization

1. **Debounced sync** - Batch changes before syncing
2. **Delta sync** - Only send changes, not full state
3. **Request deduplication** - Same query = single request
4. **Exponential backoff** - Graceful reconnection

---

## 🔐 Security Considerations

### Current Implementation

- Input sanitization (escapeHtml)
- XSS prevention
- CORS headers (server-side)

### Recommended Additions

```javascript
// 1. End-to-End Encryption
class EncryptedStorage {
    async encrypt(data, key) {
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const cryptoKey = await crypto.subtle.importKey(...);
        return crypto.subtle.encrypt('AES-GCM', cryptoKey, encoded);
    }
}

// 2. Authentication
const client = new GraphQLClient(endpoint);
client.setToken(await getAuthToken());

// 3. Rate limiting (client-side)
const rateLimited = throttle(async () => {
    await api.createTask(data);
}, 1000); // Max 1 request per second
```

---

## 🧪 Testing Strategy

### Unit Tests

```javascript
import { LWWRegister, ORSet } from './crdt/crdt.js';

describe('LWWRegister', () => {
    it('should accept higher timestamp', () => {
        const reg = new LWWRegister('node1', 'a', 1000);
        reg.set('b', 2000);
        expect(reg.get()).toBe('b');
    });
    
    it('should merge correctly', () => {
        const reg1 = new LWWRegister('node1', 'a', 1000);
        const reg2 = new LWWRegister('node2', 'b', 2000);
        reg1.merge(reg2);
        expect(reg1.get()).toBe('b');
    });
});

describe('ORSet', () => {
    it('should track additions and removals', () => {
        const set = new ORSet('node1');
        set.add('a');
        expect(set.has('a')).toBe(true);
        set.remove('a');
        expect(set.has('a')).toBe(false);
    });
});
```

### Integration Tests

```javascript
describe('Collaboration', () => {
    it('should sync between two clients', async () => {
        const client1 = new CollaborationManager('node1');
        const client2 = new CollaborationManager('node2');
        
        client1.createTask({ text: 'Task 1' });
        const state = client1.store.exportState();
        client2.store.importState(state);
        
        expect(client2.getAllTasks().length).toBe(1);
    });
});
```

---

## 📚 Further Reading

1. **CRDTs**: [crdt.tech](https://crdt.tech)
2. **Distributed Systems**: "Designing Data-Intensive Applications" by Martin Kleppmann
3. **State Machines**: "XState documentation" (xstate.js.org)
4. **GraphQL**: "GraphQL in Action" by Samer Buna
5. **WebSocket**: RFC 6455

---

## 🎯 Next Steps

1. **Add WebAssembly** for computationally intensive operations
2. **Implement blockchain verification** for audit trails
3. **Add ML models** for task suggestions
4. **Build mobile apps** with React Native
5. **Create desktop apps** with Electron/Tauri

---

**Built with ❤️ for the Deep Dive**
