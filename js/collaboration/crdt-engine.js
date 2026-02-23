/**
 * CRDT-Based Real-Time Collaboration Engine
 * ===========================================
 * 
 * Implements Conflict-Free Replicated Data Types for distributed task synchronization
 * allowing multiple users to collaborate on shared task lists without conflicts.
 * 
 * Features:
 * - LWW (Last-Writer-Wins) Register for simple values
 * - OR-Set (Observed-Remove Set) for collections
 * - Vector clocks for causality tracking
 * - Operation transformation
 * - Peer-to-peer sync via WebRTC
 * - WebSocket fallback for client-server
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

// ============================================
// VECTOR CLOCK - Causality Tracking
// ============================================
class VectorClock {
    constructor(nodeId, initial = {}) {
        this.nodeId = nodeId;
        this.clock = { ...initial };
    }

    increment() {
        this.clock[this.nodeId] = (this.clock[this.nodeId] || 0) + 1;
        return this.clone();
    }

    merge(other) {
        const merged = new VectorClock(this.nodeId, { ...this.clock });
        for (const [nodeId, time] of Object.entries(other.clock)) {
            merged.clock[nodeId] = Math.max(merged.clock[nodeId] || 0, time);
        }
        return merged;
    }

    happensBefore(other) {
        let atLeastOneLess = false;
        for (const nodeId of new Set([...Object.keys(this.clock), ...Object.keys(other.clock)])) {
            const thisTime = this.clock[nodeId] || 0;
            const otherTime = other.clock[nodeId] || 0;
            if (thisTime > otherTime) return false;
            if (thisTime < otherTime) atLeastOneLess = true;
        }
        return atLeastOneLess;
    }

    concurrent(other) {
        return !this.happensBefore(other) && !other.happensBefore(this);
    }

    clone() {
        return new VectorClock(this.nodeId, { ...this.clock });
    }

    toJSON() {
        return { nodeId: this.nodeId, clock: this.clock };
    }

    static fromJSON(json) {
        return new VectorClock(json.nodeId, json.clock);
    }
}

// ============================================
// LWW REGISTER - Last-Writer-Wins for Values
// ============================================
class LWWRegister {
    constructor(nodeId, value = null, timestamp = 0) {
        this.nodeId = nodeId;
        this.value = value;
        this.timestamp = timestamp;
    }

    set(value, timestamp = Date.now()) {
        if (timestamp > this.timestamp) {
            this.value = value;
            this.timestamp = timestamp;
        }
        return this;
    }

    merge(other) {
        if (other.timestamp > this.timestamp) {
            this.value = other.value;
            this.timestamp = other.timestamp;
        } else if (other.timestamp === this.timestamp && other.nodeId > this.nodeId) {
            // Tie-breaker: higher nodeId wins
            this.value = other.value;
        }
        return this;
    }

    toJSON() {
        return { nodeId: this.nodeId, value: this.value, timestamp: this.timestamp };
    }

    static fromJSON(json) {
        return new LWWRegister(json.nodeId, json.value, json.timestamp);
    }
}

// ============================================
// OR-SET - Observed-Remove Set for Collections
// ============================================
class ORSet {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.elements = new Map(); // element -> Set of unique tags
        this.tombstones = new Map(); // element -> Set of removed tags
        this.counter = 0;
    }

    add(element) {
        const tag = `${this.nodeId}:${++this.counter}`;
        if (!this.elements.has(element)) {
            this.elements.set(element, new Set());
        }
        this.elements.get(element).add(tag);
        return this;
    }

    remove(element) {
        if (this.elements.has(element)) {
            const tags = this.elements.get(element);
            if (!this.tombstones.has(element)) {
                this.tombstones.set(element, new Set());
            }
            for (const tag of tags) {
                this.tombstones.get(element).add(tag);
            }
            this.elements.delete(element);
        }
        return this;
    }

    has(element) {
        if (!this.elements.has(element)) return false;
        const tags = this.elements.get(element);
        const removed = this.tombstones.get(element) || new Set();
        for (const tag of tags) {
            if (!removed.has(tag)) return true;
        }
        return false;
    }

    values() {
        const result = [];
        for (const [element, tags] of this.elements) {
            const removed = this.tombstones.get(element) || new Set();
            for (const tag of tags) {
                if (!removed.has(tag)) {
                    result.push(element);
                    break;
                }
            }
        }
        return result;
    }

    merge(other) {
        // Merge elements
        for (const [element, tags] of other.elements) {
            if (!this.elements.has(element)) {
                this.elements.set(element, new Set());
            }
            for (const tag of tags) {
                this.elements.get(element).add(tag);
            }
        }

        // Merge tombstones
        for (const [element, tags] of other.tombstones) {
            if (!this.tombstones.has(element)) {
                this.tombstones.set(element, new Set());
            }
            for (const tag of tags) {
                this.tombstones.get(element).add(tag);
            }
        }

        return this;
    }

    toJSON() {
        return {
            nodeId: this.nodeId,
            elements: Array.from(this.elements.entries()).map(([k, v]) => [k, Array.from(v)]),
            tombstones: Array.from(this.tombstones.entries()).map(([k, v]) => [k, Array.from(v)]),
            counter: this.counter
        };
    }

    static fromJSON(json) {
        const set = new ORSet(json.nodeId);
        set.elements = new Map(json.elements.map(([k, v]) => [k, new Set(v)]));
        set.tombstones = new Map(json.tombstones.map(([k, v]) => [k, new Set(v)]));
        set.counter = json.counter;
        return set;
    }
}

// ============================================
// TASK CRDT - Composite CRDT for Tasks
// ============================================
class TaskCRDT {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.vectorClock = new VectorClock(nodeId);
        
        // Task properties as LWW registers
        this.text = new LWWRegister(nodeId);
        this.completed = new LWWRegister(nodeId, false);
        this.priority = new LWWRegister(nodeId, 'medium');
        this.dueDate = new LWWRegister(nodeId, null);
        this.categories = new ORSet(nodeId);
        
        // Metadata
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
    }

    update(field, value, timestamp = Date.now()) {
        this.vectorClock.increment();
        this.updatedAt = timestamp;

        switch (field) {
            case 'text': this.text.set(value, timestamp); break;
            case 'completed': this.completed.set(value, timestamp); break;
            case 'priority': this.priority.set(value, timestamp); break;
            case 'dueDate': this.dueDate.set(value, timestamp); break;
            case 'categories': 
                this.categories = new ORSet(this.nodeId);
                value.forEach(cat => this.categories.add(cat));
                break;
        }

        return this;
    }

    addCategory(category) {
        this.vectorClock.increment();
        this.categories.add(category);
        this.updatedAt = Date.now();
        return this;
    }

    removeCategory(category) {
        this.vectorClock.increment();
        this.categories.remove(category);
        this.updatedAt = Date.now();
        return this;
    }

    merge(other) {
        this.vectorClock = this.vectorClock.merge(other.vectorClock);
        this.text.merge(other.text);
        this.completed.merge(other.completed);
        this.priority.merge(other.priority);
        this.dueDate.merge(other.dueDate);
        this.categories.merge(other.categories);
        this.updatedAt = Math.max(this.updatedAt, other.updatedAt);
        return this;
    }

    toTask(id) {
        return {
            id,
            text: this.text.value,
            completed: this.completed.value,
            priority: this.priority.value,
            dueDate: this.dueDate.value,
            categories: this.categories.values(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            _crdt: this.toJSON()
        };
    }

    toJSON() {
        return {
            nodeId: this.nodeId,
            vectorClock: this.vectorClock.toJSON(),
            text: this.text.toJSON(),
            completed: this.completed.toJSON(),
            priority: this.priority.toJSON(),
            dueDate: this.dueDate.toJSON(),
            categories: this.categories.toJSON(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(json) {
        const crdt = new TaskCRDT(json.nodeId);
        crdt.vectorClock = VectorClock.fromJSON(json.vectorClock);
        crdt.text = LWWRegister.fromJSON(json.text);
        crdt.completed = LWWRegister.fromJSON(json.completed);
        crdt.priority = LWWRegister.fromJSON(json.priority);
        crdt.dueDate = LWWRegister.fromJSON(json.dueDate);
        crdt.categories = ORSet.fromJSON(json.categories);
        crdt.createdAt = json.createdAt;
        crdt.updatedAt = json.updatedAt;
        return crdt;
    }
}

// ============================================
// REPLICATION MANAGER - Sync & Conflict Resolution
// ============================================
class ReplicationManager {
    constructor(nodeId, storage) {
        this.nodeId = nodeId;
        this.storage = storage;
        this.tasks = new Map(); // taskId -> TaskCRDT
        this.peers = new Map(); // peerId -> peer info
        this.pendingOps = [];
        this.subscribers = new Set();
    }

    /**
     * Create a new task
     */
    createTask(taskData) {
        const id = this._generateId();
        const crdt = new TaskCRDT(this.nodeId);
        
        crdt.update('text', taskData.text || '');
        crdt.update('priority', taskData.priority || 'medium');
        crdt.update('completed', taskData.completed || false);
        if (taskData.dueDate) crdt.update('dueDate', taskData.dueDate);
        if (taskData.categories) {
            taskData.categories.forEach(cat => crdt.addCategory(cat));
        }

        this.tasks.set(id, crdt);
        this._persist();
        this._notify('task:created', { id, task: crdt.toTask(id) });

        return crdt.toTask(id);
    }

    /**
     * Update a task field
     */
    updateTask(id, field, value) {
        const crdt = this.tasks.get(id);
        if (!crdt) throw new Error('Task not found');

        crdt.update(field, value);
        this._persist();
        this._notify('task:updated', { id, field, value, task: crdt.toTask(id) });

        return crdt.toTask(id);
    }

    /**
     * Delete a task
     */
    deleteTask(id) {
        this.tasks.delete(id);
        this._persist();
        this._notify('task:deleted', { id });
    }

    /**
     * Get all tasks as plain objects
     */
    getAllTasks() {
        return Array.from(this.tasks.entries()).map(([id, crdt]) => crdt.toTask(id));
    }

    /**
     * Get a single task
     */
    getTask(id) {
        const crdt = this.tasks.get(id);
        return crdt ? crdt.toTask(id) : null;
    }

    /**
     * Receive and merge remote state
     */
    receiveState(remoteState) {
        const { type, data } = remoteState;

        if (type === 'full-sync') {
            return this._handleFullSync(data);
        } else if (type === 'delta') {
            return this._handleDelta(data);
        } else if (type === 'operation') {
            return this._handleOperation(data);
        }

        return { accepted: false, reason: 'Unknown type' };
    }

    /**
     * Generate delta for sync
     */
    getDelta(sinceVectorClock) {
        const delta = [];
        const since = sinceVectorClock ? VectorClock.fromJSON(sinceVectorClock) : null;

        for (const [id, crdt] of this.tasks) {
            if (!since || crdt.vectorClock.concurrent(since) || crdt.vectorClock.happensBefore(since) === false) {
                delta.push({
                    id,
                    crdt: crdt.toJSON()
                });
            }
        }

        return {
            type: 'delta',
            data: {
                nodeId: this.nodeId,
                vectorClock: this._getMergedVectorClock().toJSON(),
                tasks: delta
            }
        };
    }

    /**
     * Get full state for new peers
     */
    getFullState() {
        return {
            type: 'full-sync',
            data: {
                nodeId: this.nodeId,
                vectorClock: this._getMergedVectorClock().toJSON(),
                tasks: Array.from(this.tasks.entries()).map(([id, crdt]) => ({
                    id,
                    crdt: crdt.toJSON()
                }))
            }
        };
    }

    /**
     * Subscribe to changes
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Add peer for replication
     */
    addPeer(peerId, peerInfo) {
        this.peers.set(peerId, peerInfo);
        this._notify('peer:added', { peerId, peerInfo });
    }

    /**
     * Remove peer
     */
    removePeer(peerId) {
        this.peers.delete(peerId);
        this._notify('peer:removed', { peerId });
    }

    // ==================== Private Methods ====================

    _handleFullSync(data) {
        let changes = 0;

        for (const { id, crdt: remoteCrdtJson } of data.tasks) {
            const remoteCrdt = TaskCRDT.fromJSON(remoteCrdtJson);
            const localCrdt = this.tasks.get(id);

            if (localCrdt) {
                localCrdt.merge(remoteCrdt);
            } else {
                this.tasks.set(id, remoteCrdt);
            }
            changes++;
        }

        this._persist();
        this._notify('sync:complete', { changes, type: 'full' });

        return { accepted: true, changes };
    }

    _handleDelta(data) {
        let changes = 0;

        for (const { id, crdt: remoteCrdtJson } of data.tasks) {
            const remoteCrdt = TaskCRDT.fromJSON(remoteCrdtJson);
            const localCrdt = this.tasks.get(id);

            if (localCrdt) {
                if (localCrdt.vectorClock.concurrent(remoteCrdt.vectorClock)) {
                    // Concurrent updates - merge!
                    localCrdt.merge(remoteCrdt);
                    changes++;
                } else if (remoteCrdt.vectorClock.happensBefore(localCrdt.vectorClock) === false) {
                    // Remote is newer
                    localCrdt.merge(remoteCrdt);
                    changes++;
                }
            } else {
                this.tasks.set(id, remoteCrdt);
                changes++;
            }
        }

        this._persist();
        this._notify('sync:complete', { changes, type: 'delta' });

        return { accepted: true, changes };
    }

    _handleOperation(op) {
        // Operation-based sync (for real-time collaboration)
        const { taskId, operation, value, timestamp, nodeId } = op;
        
        let crdt = this.tasks.get(taskId);
        if (!crdt && operation !== 'delete') {
            crdt = new TaskCRDT(nodeId);
            this.tasks.set(taskId, crdt);
        }

        if (!crdt) return { accepted: false, reason: 'Task not found' };

        switch (operation) {
            case 'update':
                crdt.update(op.field, value, timestamp);
                break;
            case 'addCategory':
                crdt.addCategory(value);
                break;
            case 'removeCategory':
                crdt.removeCategory(value);
                break;
            case 'delete':
                this.tasks.delete(taskId);
                break;
        }

        this._persist();
        this._notify('operation:applied', op);

        return { accepted: true };
    }

    _getMergedVectorClock() {
        const merged = new VectorClock(this.nodeId);
        for (const [, crdt] of this.tasks) {
            merged.merge(crdt.vectorClock);
        }
        return merged;
    }

    _persist() {
        const state = {
            nodeId: this.nodeId,
            tasks: Array.from(this.tasks.entries()).map(([id, crdt]) => ({
                id,
                crdt: crdt.toJSON()
            }))
        };
        this.storage.saveSetting('crdt_state', state);
    }

    _notify(event, data) {
        for (const callback of this.subscribers) {
            try {
                callback(event, data);
            } catch (e) {
                console.error('CRDT subscriber error:', e);
            }
        }
        eventBus.emit(`crdt:${event}`, data);
    }

    _generateId() {
        return `${this.nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================
// WEBRTC PEER MANAGER - P2P Sync
// ============================================
class WebRTCPeerManager {
    constructor(replicationManager, config = {}) {
        this.replication = replicationManager;
        this.config = {
            iceServers: config.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
            ...config
        };
        this.peers = new Map();
        this.dataChannels = new Map();
        this.pcMap = new Map();
    }

    /**
     * Create offer for new peer
     */
    async createOffer() {
        const pc = new RTCPeerConnection({ iceServers: this.config.iceServers });
        const peerId = this._generatePeerId();

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this._notify('ice-candidate', { peerId, candidate: e.candidate });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                this._notify('peer:connected', { peerId });
            } else if (pc.connectionState === 'disconnected') {
                this.peers.delete(peerId);
                this._notify('peer:disconnected', { peerId });
            }
        };

        const channel = pc.createDataChannel('taskmaster-sync');
        this._setupDataChannel(channel, peerId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.peers.set(peerId, { pc, type: 'offer' });
        this.pcMap.set(peerId, pc);

        return { peerId, offer: pc.localDescription };
    }

    /**
     * Answer an offer
     */
    async answerOffer(offer, peerId) {
        const pc = new RTCPeerConnection({ iceServers: this.config.iceServers });

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this._notify('ice-candidate', { peerId, candidate: e.candidate });
            }
        };

        pc.ondatachannel = (e) => {
            this._setupDataChannel(e.channel, peerId);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                this._notify('peer:connected', { peerId });
            }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.peers.set(peerId, { pc, type: 'answer' });
        this.pcMap.set(peerId, pc);

        return { peerId, answer: pc.localDescription };
    }

    /**
     * Add ICE candidate
     */
    async addIceCandidate(peerId, candidate) {
        const pc = this.pcMap.get(peerId);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    /**
     * Send state to peer
     */
    sendToPeer(peerId, state) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(JSON.stringify(state));
        }
    }

    /**
     * Broadcast to all peers
     */
    broadcast(state) {
        for (const [peerId] of this.dataChannels) {
            this.sendToPeer(peerId, state);
        }
    }

    /**
     * Close all connections
     */
    close() {
        for (const pc of this.pcMap.values()) {
            pc.close();
        }
        this.pcMap.clear();
        this.peers.clear();
        this.dataChannels.clear();
    }

    // ==================== Private Methods ====================

    _setupDataChannel(channel, peerId) {
        channel.onopen = () => {
            this.dataChannels.set(peerId, channel);
            
            // Send full sync on connect
            const fullState = this.replication.getFullState();
            channel.send(JSON.stringify(fullState));
        };

        channel.onmessage = (e) => {
            try {
                const state = JSON.parse(e.data);
                const result = this.replication.receiveState(state);
                
                // Send delta back if we received a full sync
                if (state.type === 'full-sync' && result.accepted) {
                    const delta = this.replication.getDelta(state.data.vectorClock);
                    channel.send(JSON.stringify(delta));
                }
            } catch (err) {
                console.error('Data channel message error:', err);
            }
        };

        channel.onerror = (e) => {
            console.error('Data channel error:', e);
        };
    }

    _notify(event, data) {
        eventBus.emit(`webrtc:${event}`, data);
    }

    _generatePeerId() {
        return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
}

// ============================================
// COLLABORATION MANAGER - Main Entry Point
// ============================================
class CollaborationManager {
    constructor(taskRepository, storage) {
        this.taskRepository = taskRepository;
        this.storage = storage;
        this.nodeId = this._generateNodeId();
        
        this.replication = new ReplicationManager(this.nodeId, storage);
        this.webrtc = new WebRTCPeerManager(this.replication);
        
        this.collaborationMode = false;
        this.roomId = null;
        this.userId = null;
    }

    /**
     * Initialize collaboration
     */
    async initialize() {
        // Load persisted state
        const savedState = await this.storage.getSetting('crdt_state');
        if (savedState) {
            this.replication.receiveState({
                type: 'full-sync',
                data: savedState
            });
        }

        // Subscribe to CRDT changes
        this.replication.subscribe((event, data) => {
            this._onCRDTEvent(event, data);
        });

        // Subscribe to WebRTC events
        eventBus.on('webrtc:peer:connected', () => {
            this._notify('collaboration:peer-connected');
        });

        console.log(`[Collaboration] Initialized with node ID: ${this.nodeId}`);
    }

    /**
     * Enable collaboration mode
     */
    enableCollaboration(roomId) {
        this.collaborationMode = true;
        this.roomId = roomId;
        this.userId = this.nodeId;
        
        this._notify('collaboration:enabled', { roomId, userId: this.userId });
    }

    /**
     * Disable collaboration
     */
    disableCollaboration() {
        this.collaborationMode = false;
        this.webrtc.close();
        this._notify('collaboration:disabled');
    }

    /**
     * Create collaboration invite
     */
    async createInvite() {
        const { peerId, offer } = await this.webrtc.createOffer();
        
        // Generate shareable link/code
        const inviteCode = btoa(JSON.stringify({
            roomId: this.roomId,
            peerId,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            }
        }));

        return { inviteCode, peerId };
    }

    /**
     * Join collaboration via invite
     */
    async joinViaInvite(inviteCode) {
        try {
            const invite = JSON.parse(atob(inviteCode));
            const { peerId, answer } = await this.webrtc.answerOffer(invite.offer, invite.peerId);
            
            this.enableCollaboration(invite.roomId);
            
            return { peerId, answer };
        } catch (e) {
            throw new Error('Invalid invite code');
        }
    }

    /**
     * Exchange ICE candidates
     */
    async exchangeICE(peerId, candidate) {
        await this.webrtc.addIceCandidate(peerId, candidate);
    }

    /**
     * Get collaboration status
     */
    getStatus() {
        return {
            enabled: this.collaborationMode,
            nodeId: this.nodeId,
            roomId: this.roomId,
            userId: this.userId,
            peerCount: this.webrtc.peers.size,
            taskCount: this.replication.getAllTasks().length
        };
    }

    /**
     * Get all tasks (CRDT-merged)
     */
    getAllTasks() {
        return this.replication.getAllTasks();
    }

    /**
     * Create task (will be synced)
     */
    createTask(taskData) {
        return this.replication.createTask(taskData);
    }

    /**
     * Update task (will be synced)
     */
    updateTask(id, field, value) {
        return this.replication.updateTask(id, field, value);
    }

    /**
     * Delete task (will be synced)
     */
    deleteTask(id) {
        this.replication.deleteTask(id);
    }

    /**
     * Subscribe to collaboration events
     */
    onEvent(event, callback) {
        return eventBus.on(`collaboration:${event}`, callback);
    }

    // ==================== Private Methods ====================

    _onCRDTEvent(event, data) {
        this._notify(event, data);

        // Broadcast to peers
        if (this.collaborationMode) {
            const delta = this.replication.getDelta();
            this.webrtc.broadcast(delta);
        }
    }

    _notify(event, data) {
        eventBus.emit(`collaboration:${event}`, data);
    }

    _generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
}

// Export
export { 
    CollaborationManager,
    ReplicationManager,
    WebRTCPeerManager,
    TaskCRDT,
    VectorClock,
    LWWRegister,
    ORSet
};
