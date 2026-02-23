/**
 * WebSocket Client for Real-Time Sync
 * ====================================
 * Browser client for collaboration
 */

import { eventBus, EVENTS } from '../core/event-bus.js';
import { createCRDTStore } from '../crdt/crdt.js';

/**
 * Sync Client States
 */
export const SyncState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    ERROR: 'error'
};

/**
 * WebSocket Sync Client
 */
export class SyncClient {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: options.reconnectInterval || 3000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            heartbeatInterval: options.heartbeatInterval || 30000,
            ...options
        };

        this.state = SyncState.DISCONNECTED;
        this.ws = null;
        this.clientId = null;
        this.userId = null;
        this.rooms = new Set();
        this.crdtStore = createCRDTStore();
        this.reconnectAttempts = 0;
        this.messageQueue = [];
        this.pendingAcks = new Map();
        this.lastHeartbeat = Date.now();
        
        this.setupCRDTSync();
    }

    /**
     * Connect to server
     */
    connect(userId = null) {
        if (this.state === SyncState.CONNECTED || this.state === SyncState.CONNECTING) {
            return;
        }

        this.userId = userId || this.generateUserId();
        this.setState(SyncState.CONNECTING);

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => this.onOpen();
            this.ws.onmessage = (event) => this.onMessage(event);
            this.ws.onclose = () => this.onClose();
            this.ws.onerror = (error) => this.onError(error);

        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.setState(SyncState.ERROR);
            this.scheduleReconnect();
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.ws) {
            // Leave all rooms
            this.rooms.forEach(roomId => {
                this.send({ type: 'leave', rooms: [roomId] });
            });
            this.rooms.clear();

            this.ws.close();
            this.ws = null;
        }

        this.setState(SyncState.DISCONNECTED);
    }

    /**
     * Join a room (collaboration space)
     */
    joinRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.add(roomId);
            this.send({
                type: 'join',
                roomId,
                userId: this.userId
            });
        }
    }

    /**
     * Leave a room
     */
    leaveRoom(roomId) {
        if (this.rooms.has(roomId)) {
            this.rooms.delete(roomId);
            this.send({
                type: 'leave',
                rooms: [roomId]
            });
        }
    }

    /**
     * Sync task data
     */
    syncTask(roomId, operations) {
        const version = this.crdtStore.vectorClock.getTimestamp();
        
        this.send({
            type: 'sync',
            roomId,
            operations,
            version
        });

        // Track pending ack
        const ackId = `${roomId}:${version}`;
        this.pendingAcks.set(ackId, {
            operations,
            timestamp: Date.now()
        });

        // Timeout for ack
        setTimeout(() => {
            if (this.pendingAcks.has(ackId)) {
                console.warn('Sync ack timeout:', ackId);
                this.pendingAcks.delete(ackId);
            }
        }, 5000);
    }

    /**
     * Broadcast CRDT state
     */
    broadcastCRDT(roomId) {
        const state = this.crdtStore.exportState();
        this.send({
            type: 'crdt',
            roomId,
            state
        });
    }

    /**
     * Send message
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            // Queue for later
            this.messageQueue.push(message);
        }
    }

    /**
     * Handle connection open
     */
    onOpen() {
        console.log('WebSocket connected');
        this.setState(SyncState.CONNECTED);
        this.reconnectAttempts = 0;

        // Join rooms
        this.rooms.forEach(roomId => {
            this.send({
                type: 'join',
                roomId,
                userId: this.userId
            });
        });

        // Flush message queue
        while (this.messageQueue.length > 0) {
            this.send(this.messageQueue.shift());
        }

        // Start heartbeat
        this.startHeartbeat();

        eventBus.emit(EVENTS.SYNC_CONNECTED, { clientId: this.clientId });
    }

    /**
     * Handle incoming message
     */
    onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'connected':
                    this.clientId = data.clientId;
                    console.log('Assigned client ID:', this.clientId);
                    break;

                case 'joined':
                    console.log('Joined room:', data.roomId);
                    // Merge remote document state
                    if (data.document) {
                        this.mergeRemoteDocument(data.roomId, data.document);
                    }
                    eventBus.emit(EVENTS.SYNC_JOINED, { 
                        roomId: data.roomId, 
                        clients: data.clients 
                    });
                    break;

                case 'sync':
                    // Apply remote operations
                    this.applyRemoteOperations(data.roomId, data.operations);
                    break;

                case 'sync_ack':
                    // Clear pending ack
                    const ackId = `${data.roomId}:${data.version}`;
                    this.pendingAcks.delete(ackId);
                    break;

                case 'crdt_state':
                    // Merge CRDT state
                    this.mergeCRDTState(data.roomId, data.state);
                    break;

                case 'user_joined':
                    eventBus.emit(EVENTS.SYNC_USER_JOINED, {
                        roomId: data.roomId,
                        userId: data.userId,
                        clientId: data.clientId
                    });
                    break;

                case 'user_left':
                    eventBus.emit(EVENTS.SYNC_USER_LEFT, {
                        roomId: data.roomId,
                        userId: data.userId,
                        clientId: data.clientId
                    });
                    break;

                case 'presence':
                    eventBus.emit(EVENTS.SYNC_PRESENCE, {
                        roomId: data.roomId,
                        clients: data.clients
                    });
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Message handling error:', error);
        }
    }

    /**
     * Handle connection close
     */
    onClose() {
        console.log('WebSocket disconnected');
        this.setState(SyncState.DISCONNECTED);
        this.stopHeartbeat();

        // Attempt reconnect
        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    /**
     * Handle connection error
     */
    onError(error) {
        console.error('WebSocket error:', error);
        this.setState(SyncState.ERROR);
        eventBus.emit(EVENTS.SYNC_ERROR, { error });
    }

    /**
     * Schedule reconnect
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(
            this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
            30000
        );

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.setState(SyncState.RECONNECTING);

        setTimeout(() => {
            this.connect(this.userId);
        }, delay);
    }

    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.send({ type: 'heartbeat', timestamp: Date.now() });
            this.lastHeartbeat = Date.now();
        }, this.options.heartbeatInterval);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Set connection state
     */
    setState(state) {
        this.state = state;
        eventBus.emit(EVENTS.SYNC_STATE_CHANGED, { state });
    }

    /**
     * Generate user ID
     */
    generateUserId() {
        return `user_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Setup CRDT synchronization
     */
    setupCRDTSync() {
        // Subscribe to local CRDT changes
        this.crdtStore.subscribe((event, data) => {
            if (this.state === SyncState.CONNECTED) {
                // Broadcast to room
                const roomId = 'default'; // Could be task-specific
                this.broadcastCRDT(roomId);
            }
        });
    }

    /**
     * Merge remote document
     */
    mergeRemoteDocument(roomId, document) {
        // Apply document to local state
        Object.entries(document).forEach(([key, value]) => {
            // Merge logic here
        });
    }

    /**
     * Apply remote operations
     */
    applyRemoteOperations(roomId, operations) {
        operations.forEach(op => {
            // Apply operation to local state
        });
    }

    /**
     * Merge CRDT state
     */
    mergeCRDTState(roomId, remoteState) {
        const localState = this.crdtStore.exportState();
        
        // Merge states
        this.crdtStore.mergeRemote(remoteState);
    }

    /**
     * Get sync stats
     */
    getStats() {
        return {
            state: this.state,
            clientId: this.clientId,
            userId: this.userId,
            rooms: Array.from(this.rooms),
            reconnectAttempts: this.reconnectAttempts,
            pendingAcks: this.pendingAcks.size,
            crdtStats: this.crdtStore.getStats()
        };
    }
}

/**
 * Create sync client
 */
export function createSyncClient(url, userId = null) {
    const client = new SyncClient(url);
    client.connect(userId);
    return client;
}
