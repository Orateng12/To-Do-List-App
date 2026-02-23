/**
 * CRDT Implementation for TaskMaster
 * ====================================
 * Conflict-free Replicated Data Types for real-time collaboration
 * 
 * This implements a LWW (Last-Writer-Wins) Register CRDT combined with
 * an Observed-Remove Set (OR-Set) for task collections.
 * 
 * Features:
 * - Offline-first architecture
 * - Automatic conflict resolution
 * - Eventual consistency guarantee
 * - No central authority needed
 */

// ============================================
// LWW REGISTER (Last-Writer-Wins)
// ============================================
class LWWRegister {
    constructor(nodeId, initialValue = null, timestamp = 0) {
        this.nodeId = nodeId;
        this.value = initialValue;
        this.timestamp = timestamp || Date.now();
    }

    /**
     * Set a new value
     * @param {any} value - New value
     * @param {number} [timestamp] - Optional timestamp (defaults to now)
     */
    set(value, timestamp = Date.now()) {
        if (timestamp >= this.timestamp) {
            this.value = value;
            this.timestamp = timestamp;
        }
        return this;
    }

    /**
     * Get current value
     * @returns {any}
     */
    get() {
        return this.value;
    }

    /**
     * Merge with another LWW register
     * @param {LWWRegister} other - Other register to merge
     * @returns {LWWRegister} This register after merge
     */
    merge(other) {
        if (other.timestamp > this.timestamp) {
            this.value = other.value;
            this.timestamp = other.timestamp;
        } else if (other.timestamp === this.timestamp && other.nodeId > this.nodeId) {
            // Tie-breaker: use nodeId
            this.value = other.value;
        }
        return this;
    }

    /**
     * Serialize to JSON-compatible object
     * @returns {Object}
     */
    toJSON() {
        return {
            value: this.value,
            timestamp: this.timestamp,
            nodeId: this.nodeId
        };
    }

    /**
     * Deserialize from JSON
     * @param {Object} json - JSON object
     * @returns {LWWRegister}
     */
    static fromJSON(json) {
        const register = new LWWRegister(json.nodeId);
        register.value = json.value;
        register.timestamp = json.timestamp;
        return register;
    }

    /**
     * Create a clone
     * @returns {LWWRegister}
     */
    clone() {
        return LWWRegister.fromJSON(this.toJSON());
    }
}

// ============================================
// OR-SET (Observed-Remove Set)
// ============================================
class ORSet {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.elements = new Map(); // element -> Set of unique tags
        this.tombstones = new Map(); // element -> Set of removed tags
        this.counter = 0;
    }

    /**
     * Generate unique tag
     * @private
     * @returns {string}
     */
    _generateTag() {
        return `${this.nodeId}:${++this.counter}:${Date.now()}`;
    }

    /**
     * Add element to set
     * @param {string} element - Element to add
     * @returns {string} The tag assigned to this addition
     */
    add(element) {
        const tag = this._generateTag();
        
        if (!this.elements.has(element)) {
            this.elements.set(element, new Set());
        }
        this.elements.get(element).add(tag);
        
        return tag;
    }

    /**
     * Remove element from set
     * @param {string} element - Element to remove
     */
    remove(element) {
        if (!this.elements.has(element)) return;
        
        if (!this.tombstones.has(element)) {
            this.tombstones.set(element, new Set());
        }
        
        // Mark all current tags as tombstoned
        const tags = this.elements.get(element);
        tags.forEach(tag => this.tombstones.get(element).add(tag));
        
        // Clear the element's tags
        this.elements.delete(element);
    }

    /**
     * Check if element is in set
     * @param {string} element - Element to check
     * @returns {boolean}
     */
    has(element) {
        if (!this.elements.has(element)) return false;
        
        const tags = this.elements.get(element);
        const tombstones = this.tombstones.get(element) || new Set();
        
        // Element exists if it has any non-tombstoned tags
        for (const tag of tags) {
            if (!tombstones.has(tag)) return true;
        }
        return false;
    }

    /**
     * Get all elements
     * @returns {string[]}
     */
    values() {
        const result = [];
        for (const [element, tags] of this.elements) {
            const tombstones = this.tombstones.get(element) || new Set();
            for (const tag of tags) {
                if (!tombstones.has(tag)) {
                    result.push(element);
                    break;
                }
            }
        }
        return result;
    }

    /**
     * Merge with another OR-Set
     * @param {ORSet} other - Other set to merge
     * @returns {ORSet} This set after merge
     */
    merge(other) {
        // Merge elements
        for (const [element, tags] of other.elements) {
            if (!this.elements.has(element)) {
                this.elements.set(element, new Set());
            }
            tags.forEach(tag => this.elements.get(element).add(tag));
        }
        
        // Merge tombstones
        for (const [element, tags] of other.tombstones) {
            if (!this.tombstones.has(element)) {
                this.tombstones.set(element, new Set());
            }
            tags.forEach(tag => this.tombstones.get(element).add(tag));
        }
        
        // Update counter
        const otherMaxCounter = Math.max(...[...other.elements.values()]
            .flatMap(tags => [...tags])
            .map(tag => parseInt(tag.split(':')[1] || '0')));
        this.counter = Math.max(this.counter, otherMaxCounter);
        
        return this;
    }

    /**
     * Serialize to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            nodeId: this.nodeId,
            counter: this.counter,
            elements: Array.from(this.elements.entries())
                .map(([elem, tags]) => [elem, [...tags]]),
            tombstones: Array.from(this.tombstones.entries())
                .map(([elem, tags]) => [elem, [...tags]])
        };
    }

    /**
     * Deserialize from JSON
     * @param {Object} json - JSON object
     * @returns {ORSet}
     */
    static fromJSON(json) {
        const set = new ORSet(json.nodeId);
        set.counter = json.counter;
        set.elements = new Map(json.elements.map(([elem, tags]) => [elem, new Set(tags)]));
        set.tombstones = new Map(json.tombstones.map(([elem, tags]) => [elem, new Set(tags)]));
        return set;
    }

    /**
     * Get size
     * @returns {number}
     */
    get size() {
        return this.values().length;
    }

    /**
     * Create a clone
     * @returns {ORSet}
     */
    clone() {
        return ORSet.fromJSON(this.toJSON());
    }
}

// ============================================
// CRDT TASK DOCUMENT
// ============================================
class CRDTTask {
    constructor(nodeId, taskId = null) {
        this.nodeId = nodeId;
        this.taskId = taskId || `task:${Date.now()}:${nodeId}`;
        
        // Each field is a LWW Register
        this.text = new LWWRegister(nodeId, '');
        this.priority = new LWWRegister(nodeId, 'medium');
        this.dueDate = new LWWRegister(nodeId, null);
        this.completed = new LWWRegister(nodeId, false);
        this.notes = new LWWRegister(nodeId, '');
        
        // Metadata
        this.createdAt = Date.now();
        this.updatedAt = new LWWRegister(nodeId, this.createdAt);
        
        // Tags for collaborative editing
        this.tags = new ORSet(nodeId);
    }

    /**
     * Update text field
     * @param {string} value - New text
     * @param {number} [timestamp] - Optional timestamp
     */
    setText(value, timestamp = Date.now()) {
        this.text.set(value, timestamp);
        this.updatedAt.set(Date.now(), timestamp);
        return this;
    }

    /**
     * Update priority
     * @param {string} value - New priority
     * @param {number} [timestamp] - Optional timestamp
     */
    setPriority(value, timestamp = Date.now()) {
        this.priority.set(value, timestamp);
        this.updatedAt.set(Date.now(), timestamp);
        return this;
    }

    /**
     * Update due date
     * @param {string|null} value - New due date
     * @param {number} [timestamp] - Optional timestamp
     */
    setDueDate(value, timestamp = Date.now()) {
        this.dueDate.set(value, timestamp);
        this.updatedAt.set(Date.now(), timestamp);
        return this;
    }

    /**
     * Toggle/set completed status
     * @param {boolean} value - Completed status
     * @param {number} [timestamp] - Optional timestamp
     */
    setCompleted(value, timestamp = Date.now()) {
        this.completed.set(value, timestamp);
        this.updatedAt.set(Date.now(), timestamp);
        return this;
    }

    /**
     * Update notes
     * @param {string} value - New notes
     * @param {number} [timestamp] - Optional timestamp
     */
    setNotes(value, timestamp = Date.now()) {
        this.notes.set(value, timestamp);
        this.updatedAt.set(Date.now(), timestamp);
        return this;
    }

    /**
     * Add a tag
     * @param {string} tag - Tag to add
     */
    addTag(tag) {
        this.tags.add(tag);
        this.updatedAt.set(Date.now());
        return this;
    }

    /**
     * Remove a tag
     * @param {string} tag - Tag to remove
     */
    removeTag(tag) {
        this.tags.remove(tag);
        this.updatedAt.set(Date.now());
        return this;
    }

    /**
     * Get current state as plain object
     * @returns {Object}
     */
    getState() {
        return {
            id: this.taskId,
            text: this.text.get(),
            priority: this.priority.get(),
            dueDate: this.dueDate.get(),
            completed: this.completed.get(),
            notes: this.notes.get(),
            tags: this.tags.values(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt.get()
        };
    }

    /**
     * Merge with another CRDT task
     * @param {CRDTTask} other - Other task to merge
     * @returns {CRDTTask} This task after merge
     */
    merge(other) {
        this.text.merge(other.text);
        this.priority.merge(other.priority);
        this.dueDate.merge(other.dueDate);
        this.completed.merge(other.completed);
        this.notes.merge(other.notes);
        this.updatedAt.merge(other.updatedAt);
        this.tags.merge(other.tags);
        return this;
    }

    /**
     * Serialize to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            nodeId: this.nodeId,
            taskId: this.taskId,
            createdAt: this.createdAt,
            text: this.text.toJSON(),
            priority: this.priority.toJSON(),
            dueDate: this.dueDate.toJSON(),
            completed: this.completed.toJSON(),
            notes: this.notes.toJSON(),
            updatedAt: this.updatedAt.toJSON(),
            tags: this.tags.toJSON()
        };
    }

    /**
     * Deserialize from JSON
     * @param {Object} json - JSON object
     * @returns {CRDTTask}
     */
    static fromJSON(json) {
        const task = new CRDTTask(json.nodeId, json.taskId);
        task.createdAt = json.createdAt;
        task.text = LWWRegister.fromJSON(json.text);
        task.priority = LWWRegister.fromJSON(json.priority);
        task.dueDate = LWWRegister.fromJSON(json.dueDate);
        task.completed = LWWRegister.fromJSON(json.completed);
        task.notes = LWWRegister.fromJSON(json.notes);
        task.updatedAt = LWWRegister.fromJSON(json.updatedAt);
        task.tags = ORSet.fromJSON(json.tags);
        return task;
    }

    /**
     * Create a clone
     * @returns {CRDTTask}
     */
    clone() {
        return CRDTTask.fromJSON(this.toJSON());
    }
}

// ============================================
// CRDT DOCUMENT STORE
// ============================================
class CRDTDocumentStore {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.documents = new Map(); // taskId -> CRDTTask
        this.vectorClock = new Map(); // nodeId -> counter
        this.operationLog = [];
    }

    /**
     * Create a new task
     * @param {Object} initialData - Initial task data
     * @returns {CRDTTask}
     */
    createTask(initialData = {}) {
        const task = new CRDTTask(this.nodeId);
        
        if (initialData.text) task.setText(initialData.text);
        if (initialData.priority) task.setPriority(initialData.priority);
        if (initialData.dueDate) task.setDueDate(initialData.dueDate);
        
        this.documents.set(task.taskId, task);
        this._incrementClock();
        this._logOperation('CREATE', task.taskId);
        
        return task;
    }

    /**
     * Get a task by ID
     * @param {string} taskId - Task ID
     * @returns {CRDTTask|null}
     */
    getTask(taskId) {
        return this.documents.get(taskId) || null;
    }

    /**
     * Get all tasks
     * @returns {CRDTTask[]}
     */
    getAllTasks() {
        return Array.from(this.documents.values());
    }

    /**
     * Delete a task
     * @param {string} taskId - Task ID
     */
    deleteTask(taskId) {
        this.documents.delete(taskId);
        this._incrementClock();
        this._logOperation('DELETE', taskId);
    }

    /**
     * Merge a remote task
     * @param {CRDTTask} remoteTask - Remote task to merge
     * @returns {CRDTTask} Merged task
     */
    mergeTask(remoteTask) {
        const localTask = this.documents.get(remoteTask.taskId);
        
        if (localTask) {
            localTask.merge(remoteTask);
        } else {
            this.documents.set(remoteTask.taskId, remoteTask.clone());
        }
        
        this._updateVectorClock(remoteTask.nodeId);
        this._logOperation('MERGE', remoteTask.taskId);
        
        return this.documents.get(remoteTask.taskId);
    }

    /**
     * Export state for sync
     * @returns {Object}
     */
    exportState() {
        return {
            nodeId: this.nodeId,
            vectorClock: Object.fromEntries(this.vectorClock),
            documents: Array.from(this.documents.values()).map(t => t.toJSON()),
            operationLog: this.operationLog.slice(-100) // Last 100 operations
        };
    }

    /**
     * Import state from remote
     * @param {Object} state - Remote state
     * @returns {CRDTTask[]} Array of merged tasks
     */
    importState(state) {
        const mergedTasks = [];
        
        // Merge vector clock
        Object.entries(state.vectorClock).forEach(([nodeId, counter]) => {
            this._updateVectorClock(nodeId, counter);
        });
        
        // Merge documents
        for (const taskJson of state.documents) {
            const remoteTask = CRDTTask.fromJSON(taskJson);
            const merged = this.mergeTask(remoteTask);
            mergedTasks.push(merged);
        }
        
        return mergedTasks;
    }

    /**
     * Increment local vector clock
     * @private
     */
    _incrementClock() {
        const current = this.vectorClock.get(this.nodeId) || 0;
        this.vectorClock.set(this.nodeId, current + 1);
    }

    /**
     * Update vector clock from remote
     * @private
     * @param {string} nodeId - Remote node ID
     * @param {number} [counter] - Remote counter value
     */
    _updateVectorClock(nodeId, counter = null) {
        const localCounter = this.vectorClock.get(nodeId) || 0;
        const remoteCounter = counter || 1;
        this.vectorClock.set(nodeId, Math.max(localCounter, remoteCounter));
    }

    /**
     * Log an operation
     * @private
     * @param {string} type - Operation type
     * @param {string} taskId - Task ID
     */
    _logOperation(type, taskId) {
        this.operationLog.push({
            type,
            taskId,
            nodeId: this.nodeId,
            timestamp: Date.now(),
            vectorClock: Object.fromEntries(this.vectorClock)
        });
        
        // Keep log bounded
        if (this.operationLog.length > 1000) {
            this.operationLog = this.operationLog.slice(-500);
        }
    }

    /**
     * Get pending operations since a vector clock
     * @param {Object} sinceClock - Vector clock to compare against
     * @returns {Array}
     */
    getOperationsSince(sinceClock = {}) {
        return this.operationLog.filter(op => {
            const opNodeClock = op.vectorClock[op.nodeId] || 0;
            const sinceNodeClock = sinceClock[op.nodeId] || 0;
            return opNodeClock > sinceNodeClock;
        });
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return {
            taskCount: this.documents.size,
            nodeId: this.nodeId,
            vectorClock: Object.fromEntries(this.vectorClock),
            operationLogSize: this.operationLog.length
        };
    }
}

// ============================================
// COLLABORATION MANAGER
// ============================================
class CollaborationManager {
    constructor(nodeId = null) {
        this.nodeId = nodeId || this._generateNodeId();
        this.store = new CRDTDocumentStore(this.nodeId);
        this.peers = new Map();
        this.eventListeners = new Map();
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        
        // Listen to online/offline events
        window.addEventListener('online', () => this._handleOnline());
        window.addEventListener('offline', () => this._handleOffline());
    }

    /**
     * Generate unique node ID
     * @private
     * @returns {string}
     */
    _generateNodeId() {
        return `node:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Subscribe to events
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Unsubscribe function
     */
    on(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(handler);
        
        return () => {
            this.eventListeners.get(event)?.delete(handler);
        };
    }

    /**
     * Emit event
     * @private
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    _emit(event, data) {
        this.eventListeners.get(event)?.forEach(handler => {
            try {
                handler(data);
            } catch (e) {
                console.error(`[CRDT] Event handler error for "${event}":`, e);
            }
        });
    }

    /**
     * Create a new task
     * @param {Object} data - Task data
     * @returns {CRDTTask}
     */
    createTask(data) {
        const task = this.store.createTask(data);
        this._emit('task:created', task.getState());
        this._queueSync();
        return task;
    }

    /**
     * Update a task
     * @param {string} taskId - Task ID
     * @param {Object} updates - Updates to apply
     * @returns {CRDTTask|null}
     */
    updateTask(taskId, updates) {
        const task = this.store.getTask(taskId);
        if (!task) return null;
        
        const timestamp = Date.now();
        
        if (updates.text !== undefined) task.setText(updates.text, timestamp);
        if (updates.priority !== undefined) task.setPriority(updates.priority, timestamp);
        if (updates.dueDate !== undefined) task.setDueDate(updates.dueDate, timestamp);
        if (updates.completed !== undefined) task.setCompleted(updates.completed, timestamp);
        if (updates.notes !== undefined) task.setNotes(updates.notes, timestamp);
        
        this._emit('task:updated', task.getState());
        this._queueSync();
        return task;
    }

    /**
     * Delete a task
     * @param {string} taskId - Task ID
     */
    deleteTask(taskId) {
        this.store.deleteTask(taskId);
        this._emit('task:deleted', { taskId });
        this._queueSync();
    }

    /**
     * Get all tasks
     * @returns {Object[]}
     */
    getAllTasks() {
        return this.store.getAllTasks().map(t => t.getState());
    }

    /**
     * Merge remote state
     * @param {Object} remoteState - Remote state to merge
     * @returns {Object[]} Array of changed tasks
     */
    mergeRemoteState(remoteState) {
        const changedTasks = this.store.importState(remoteState);
        changedTasks.forEach(task => {
            this._emit('task:synced', task.getState());
        });
        return changedTasks.map(t => t.getState());
    }

    /**
     * Queue a sync operation
     * @private
     */
    _queueSync() {
        if (!this.isOnline) return;
        
        this.syncQueue.push({
            state: this.store.exportState(),
            timestamp: Date.now()
        });
        
        // Debounce sync
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => this._performSync(), 1000);
    }

    /**
     * Perform sync with peers
     * @private
     */
    async _performSync() {
        if (this.syncQueue.length === 0 || !this.isOnline) return;
        
        const latestState = this.syncQueue.pop();
        this.syncQueue = [];
        
        // Broadcast to all peers
        for (const [peerId, peer] of this.peers) {
            try {
                const response = await this._syncWithPeer(peer, latestState.state);
                if (response) {
                    this.mergeRemoteState(response);
                }
            } catch (e) {
                console.error(`[CRDT] Sync failed with peer ${peerId}:`, e);
            }
        }
        
        this._emit('sync:complete', { timestamp: Date.now() });
    }

    /**
     * Sync with a single peer
     * @private
     * @param {Object} peer - Peer connection
     * @param {Object} localState - Local state
     * @returns {Promise<Object>} Remote state
     */
    async _syncWithPeer(peer, localState) {
        // This would be implemented based on transport (WebSocket, WebRTC, etc.)
        if (peer.send) {
            peer.send(JSON.stringify({
                type: 'sync:request',
                state: localState
            }));
        }
        return null; // Response handled asynchronously
    }

    /**
     * Handle online event
     * @private
     */
    _handleOnline() {
        this.isOnline = true;
        this._emit('connection:online', {});
        this._performSync();
    }

    /**
     * Handle offline event
     * @private
     */
    _handleOffline() {
        this.isOnline = false;
        this._emit('connection:offline', {});
    }

    /**
     * Add a peer for sync
     * @param {string} peerId - Peer ID
     * @param {Object} peer - Peer connection object
     */
    addPeer(peerId, peer) {
        this.peers.set(peerId, peer);
        this._emit('peer:connected', { peerId });
        
        // Initial sync with new peer
        this._queueSync();
    }

    /**
     * Remove a peer
     * @param {string} peerId - Peer ID
     */
    removePeer(peerId) {
        this.peers.delete(peerId);
        this._emit('peer:disconnected', { peerId });
    }

    /**
     * Get node ID
     * @returns {string}
     */
    getNodeId() {
        return this.nodeId;
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.store.getStats(),
            peerCount: this.peers.size,
            isOnline: this.isOnline,
            pendingSyncs: this.syncQueue.length
        };
    }
}

// Export
export { LWWRegister, ORSet, CRDTTask, CRDTDocumentStore, CollaborationManager };
