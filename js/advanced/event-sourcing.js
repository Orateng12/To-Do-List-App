/**
 * Event Sourcing Implementation
 * ==============================
 * Complete audit trail with event replay capabilities
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Event Types
 */
export const DomainEvents = {
    // Task lifecycle
    TASK_CREATED: 'task.created',
    TASK_UPDATED: 'task.updated',
    TASK_COMPLETED: 'task.completed',
    TASK_DELETED: 'task.deleted',
    
    // Subtask events
    SUBTASK_ADDED: 'subtask.added',
    SUBTASK_COMPLETED: 'subtask.completed',
    SUBTASK_REMOVED: 'subtask.removed',
    
    // Metadata
    TASK_PRIORITY_CHANGED: 'task.priorityChanged',
    TASK_DUEDATE_CHANGED: 'task.dueDateChanged',
    TASK_CATEGORY_ADDED: 'task.categoryAdded',
    TASK_CATEGORY_REMOVED: 'task.categoryRemoved',
    
    // Bulk operations
    TASKS_CLEARED: 'tasks.cleared',
    TASKS_IMPORTED: 'tasks.imported',
    
    // System events
    SNAPSHOT_CREATED: 'system.snapshot',
    PROJECTION_REBUILT: 'system.projectionRebuilt'
};

/**
 * Domain Event - Base class for all events
 */
export class DomainEvent {
    constructor(type, aggregateId, data, metadata = {}) {
        this.id = this.generateId();
        this.type = type;
        this.aggregateId = aggregateId;
        this.data = data;
        this.metadata = {
            timestamp: Date.now(),
            userId: metadata.userId || 'system',
            sessionId: metadata.sessionId || this.generateSessionId(),
            correlationId: metadata.correlationId || this.generateId(),
            causationId: metadata.causationId || null,
            version: metadata.version || 1,
            ...metadata
        };
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    generateSessionId() {
        return `sess_${Date.now().toString(36)}`;
    }

    /**
     * Serialize event
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            aggregateId: this.aggregateId,
            data: this.data,
            metadata: this.metadata
        };
    }

    /**
     * Deserialize event
     */
    static fromJSON(json) {
        const event = new DomainEvent(
            json.type,
            json.aggregateId,
            json.data,
            json.metadata
        );
        event.id = json.id;
        return event;
    }
}

/**
 * Event Store - Persists and retrieves events
 */
export class EventStore {
    constructor(dbName = 'TaskMasterEvents') {
        this.dbName = dbName;
        this.db = null;
        this.streams = new Map(); // aggregateId -> events[]
        this.subscriptions = new Map(); // streamName -> callbacks[]
        this.checkpoint = 0; // Last processed event position
    }

    /**
     * Initialize IndexedDB for event storage
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Events store
                if (!db.objectStoreNames.contains('events')) {
                    const store = db.createObjectStore('events', { keyPath: 'position' });
                    store.createIndex('aggregateId', 'aggregateId', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('timestamp', 'metadata.timestamp', { unique: false });
                }

                // Checkpoints
                if (!db.objectStoreNames.contains('checkpoints')) {
                    db.createObjectStore('checkpoints', { keyPath: 'id' });
                }

                // Snapshots
                if (!db.objectStoreNames.contains('snapshots')) {
                    db.createObjectStore('snapshots', { keyPath: 'aggregateId' });
                }
            };
        });
    }

    /**
     * Append event to stream
     */
    async append(aggregateId, event) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');

            // Get next position
            const countRequest = store.count();
            countRequest.onsuccess = () => {
                const position = countRequest.result + 1;
                event.position = position;
                event.streamPosition = (this.streams.get(aggregateId)?.length || 0) + 1;

                const putRequest = store.put(event);
                putRequest.onsuccess = () => {
                    // Update in-memory stream
                    if (!this.streams.has(aggregateId)) {
                        this.streams.set(aggregateId, []);
                    }
                    this.streams.get(aggregateId).push(event);

                    // Notify subscriptions
                    this.notifySubscribers(aggregateId, event);
                    
                    // Emit global event
                    eventBus.emit(EVENTS.EVENT_STORED, { event, position });

                    resolve(event);
                };
                putRequest.onerror = () => reject(putRequest.error);
            };
            countRequest.onerror = () => reject(countRequest.error);
        });
    }

    /**
     * Get events for aggregate
     */
    async getEvents(aggregateId, fromVersion = 0) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const index = store.index('aggregateId');
            const request = index.getAll(aggregateId);

            request.onsuccess = () => {
                const events = request.result
                    .filter(e => e.streamPosition > fromVersion)
                    .sort((a, b) => a.streamPosition - b.streamPosition);
                resolve(events);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all events since position
     */
    async getEventsSince(position) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const request = store.getAll();

            request.onsuccess = () => {
                const events = request.result
                    .filter(e => e.position > position)
                    .sort((a, b) => a.position - b.position);
                resolve(events);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all events for multiple aggregates
     */
    async getEventsForAggregates(aggregateIds) {
        const allEvents = [];
        for (const id of aggregateIds) {
            const events = await this.getEvents(id);
            allEvents.push(...events);
        }
        return allEvents.sort((a, b) => a.position - b.position);
    }

    /**
     * Save snapshot for aggregate
     */
    async saveSnapshot(aggregateId, state, version) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['snapshots'], 'readwrite');
            const store = transaction.objectStore('snapshots');

            const snapshot = {
                aggregateId,
                state,
                version,
                timestamp: Date.now()
            };

            const request = store.put(snapshot);
            request.onsuccess = () => resolve(snapshot);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get latest snapshot
     */
    async getSnapshot(aggregateId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['snapshots'], 'readonly');
            const store = transaction.objectStore('snapshots');
            const request = store.get(aggregateId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Subscribe to stream
     */
    subscribe(streamName, callback) {
        if (!this.subscriptions.has(streamName)) {
            this.subscriptions.set(streamName, []);
        }
        this.subscriptions.get(streamName).push(callback);

        return () => {
            const callbacks = this.subscriptions.get(streamName);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        };
    }

    /**
     * Notify subscribers
     */
    notifySubscribers(streamName, event) {
        const callbacks = this.subscriptions.get(streamName) || [];
        callbacks.forEach(cb => {
            try {
                cb(event);
            } catch (error) {
                console.error('Subscription error:', error);
            }
        });
    }

    /**
     * Get event count
     */
    async getEventCount() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get statistics
     */
    async getStats() {
        const count = await this.getEventCount();
        return {
            totalEvents: count,
            streams: this.streams.size,
            checkpoint: this.checkpoint,
            timestamp: Date.now()
        };
    }
}

/**
 * Aggregate - Base class for event-sourced aggregates
 */
export class Aggregate {
    constructor(id) {
        this.id = id;
        this.version = 0;
        this.uncommittedEvents = [];
        this.state = {};
    }

    /**
     * Apply event to state
     */
    apply(event) {
        const handler = this[`on${this.capitalize(event.type)}`];
        if (handler) {
            handler.call(this, event.data);
        }
        this.version++;
    }

    /**
     * Raise new event
     */
    raise(type, data) {
        const event = new DomainEvent(type, this.id, data);
        this.apply(event);
        this.uncommittedEvents.push(event);
        return event;
    }

    /**
     * Get uncommitted events
     */
    getUncommittedEvents() {
        return [...this.uncommittedEvents];
    }

    /**
     * Mark events as committed
     */
    markCommitted() {
        this.uncommittedEvents = [];
    }

    /**
     * Load from history
     */
    loadFromHistory(events) {
        events.forEach(event => this.apply(event));
        this.markCommitted();
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

/**
 * Task Aggregate
 */
export class TaskAggregate extends Aggregate {
    constructor(id) {
        super(id);
        this.state = {
            text: '',
            completed: false,
            priority: 'medium',
            dueDate: null,
            notes: '',
            categories: [],
            subtasks: [],
            createdAt: null,
            updatedAt: null
        };
    }

    create(text, options = {}) {
        if (this.version > 0) {
            throw new Error('Task already exists');
        }

        this.raise(DomainEvents.TASK_CREATED, {
            text,
            priority: options.priority || 'medium',
            dueDate: options.dueDate || null,
            categories: options.categories || [],
            createdAt: new Date().toISOString()
        });
    }

    updateText(text) {
        if (this.state.completed) {
            throw new Error('Cannot update completed task');
        }
        this.raise(DomainEvents.TASK_UPDATED, { text, updatedAt: new Date().toISOString() });
    }

    complete() {
        this.raise(DomainEvents.TASK_COMPLETED, {
            completedAt: new Date().toISOString()
        });
    }

    uncomplete() {
        this.raise(DomainEvents.TASK_UPDATED, {
            completed: false,
            completedAt: null,
            updatedAt: new Date().toISOString()
        });
    }

    delete() {
        this.raise(DomainEvents.TASK_DELETED, {
            deletedAt: new Date().toISOString()
        });
    }

    setPriority(priority) {
        this.raise(DomainEvents.TASK_PRIORITY_CHANGED, {
            priority,
            updatedAt: new Date().toISOString()
        });
    }

    setDueDate(dueDate) {
        this.raise(DomainEvents.TASK_DUEDATE_CHANGED, {
            dueDate,
            updatedAt: new Date().toISOString()
        });
    }

    addCategory(category) {
        this.raise(DomainEvents.TASK_CATEGORY_ADDED, {
            category,
            updatedAt: new Date().toISOString()
        });
    }

    removeCategory(category) {
        this.raise(DomainEvents.TASK_CATEGORY_REMOVED, {
            category,
            updatedAt: new Date().toISOString()
        });
    }

    addSubtask(subtask) {
        this.raise(DomainEvents.SUBTASK_ADDED, {
            subtask,
            updatedAt: new Date().toISOString()
        });
    }

    // Event handlers
    onTaskCreated(data) {
        this.state.text = data.text;
        this.state.completed = false;
        this.state.priority = data.priority;
        this.state.dueDate = data.dueDate;
        this.state.categories = data.categories || [];
        this.state.createdAt = data.createdAt;
        this.state.updatedAt = data.createdAt;
    }

    onTaskUpdated(data) {
        if (data.text !== undefined) this.state.text = data.text;
        if (data.completed !== undefined) this.state.completed = data.completed;
        this.state.updatedAt = data.updatedAt;
    }

    onTaskCompleted(data) {
        this.state.completed = true;
        this.state.completedAt = data.completedAt;
        this.state.updatedAt = data.completedAt;
    }

    onTaskDeleted() {
        this.state.deleted = true;
    }

    onTaskPriorityChanged(data) {
        this.state.priority = data.priority;
        this.state.updatedAt = data.updatedAt;
    }

    onTaskDueDateChanged(data) {
        this.state.dueDate = data.dueDate;
        this.state.updatedAt = data.updatedAt;
    }

    onTaskCategoryAdded(data) {
        if (!this.state.categories.includes(data.category)) {
            this.state.categories.push(data.category);
        }
        this.state.updatedAt = data.updatedAt;
    }

    onTaskCategoryRemoved(data) {
        this.state.categories = this.state.categories.filter(c => c !== data.category);
        this.state.updatedAt = data.updatedAt;
    }

    onSubtaskAdded(data) {
        this.state.subtasks.push(data.subtask);
        this.state.updatedAt = data.updatedAt;
    }
}

/**
 * Projection - Builds read models from events
 */
export class Projection {
    constructor(name) {
        this.name = name;
        this.state = {};
        this.handlers = {};
    }

    /**
     * Register event handler
     */
    on(eventType, handler) {
        this.handlers[eventType] = handler;
        return this;
    }

    /**
     * Apply event to projection
     */
    apply(event) {
        const handler = this.handlers[event.type];
        if (handler) {
            this.state = handler(this.state, event.data, event);
        }
        return this;
    }

    /**
     * Apply multiple events
     */
    applyAll(events) {
        events.forEach(event => this.apply(event));
        return this;
    }

    /**
     * Get state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Reset state
     */
    reset() {
        this.state = {};
        return this;
    }
}

/**
 * Task Projections
 */
export function createTaskProjections() {
    // All tasks projection
    const allTasks = new Projection('allTasks')
        .on(DomainEvents.TASK_CREATED, (state, data, event) => ({
            ...state,
            [event.aggregateId]: {
                id: event.aggregateId,
                text: data.text,
                completed: false,
                priority: data.priority,
                dueDate: data.dueDate,
                categories: data.categories,
                createdAt: data.createdAt,
                updatedAt: data.createdAt
            }
        }))
        .on(DomainEvents.TASK_UPDATED, (state, data, event) => ({
            ...state,
            [event.aggregateId]: {
                ...state[event.aggregateId],
                text: data.text || state[event.aggregateId].text,
                updatedAt: data.updatedAt
            }
        }))
        .on(DomainEvents.TASK_COMPLETED, (state, data, event) => ({
            ...state,
            [event.aggregateId]: {
                ...state[event.aggregateId],
                completed: true,
                completedAt: data.completedAt,
                updatedAt: data.completedAt
            }
        }))
        .on(DomainEvents.TASK_DELETED, (state, data, event) => {
            const newState = { ...state };
            delete newState[event.aggregateId];
            return newState;
        });

    // Completed tasks count projection
    const statsProjection = new Projection('taskStats')
        .on(DomainEvents.TASK_CREATED, (state) => ({
            ...state,
            total: (state.total || 0) + 1
        }))
        .on(DomainEvents.TASK_COMPLETED, (state) => ({
            ...state,
            completed: (state.completed || 0) + 1
        }))
        .on(DomainEvents.TASK_DELETED, (state) => ({
            ...state,
            total: Math.max(0, (state.total || 0) - 1),
            completed: Math.max(0, (state.completed || 0) - 1)
        }));

    return { allTasks, statsProjection };
}

/**
 * Event Sourcing Repository
 */
export class EventSourcingRepository {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.aggregates = new Map();
        this.projections = createTaskProjections();
    }

    /**
     * Get or create aggregate
     */
    getAggregate(taskId) {
        if (!this.aggregates.has(taskId)) {
            this.aggregates.set(taskId, new TaskAggregate(taskId));
        }
        return this.aggregates.get(taskId);
    }

    /**
     * Load aggregate from history
     */
    async loadAggregate(taskId) {
        const aggregate = this.getAggregate(taskId);
        const events = await this.eventStore.getEvents(taskId);
        aggregate.loadFromHistory(events);
        return aggregate;
    }

    /**
     * Save aggregate events
     */
    async saveAggregate(aggregate) {
        const events = aggregate.getUncommittedEvents();
        for (const event of events) {
            await this.eventStore.append(aggregate.id, event);
        }
        aggregate.markCommitted();
    }

    /**
     * Rebuild projections from events
     */
    async rebuildProjections() {
        const allEvents = await this.eventStore.getEventsSince(0);
        this.projections.allTasks.reset().applyAll(allEvents);
        this.projections.statsProjection.reset().applyAll(allEvents);
        
        eventBus.emit(EVENTS.PROJECTION_REBUILT, {
            eventCount: allEvents.length,
            tasks: this.projections.allTasks.getState()
        });
    }

    /**
     * Get all tasks from projection
     */
    getAllTasks() {
        return Object.values(this.projections.allTasks.getState());
    }

    /**
     * Get stats from projection
     */
    getStats() {
        return this.projections.statsProjection.getState();
    }
}
