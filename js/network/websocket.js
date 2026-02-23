/**
 * WebSocket Real-Time Sync Layer
 * ===============================
 * Bi-directional real-time communication for collaborative features
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Message queuing during offline
 * - Heartbeat/ping-pong for connection health
 * - Multiplexed channels
 * - Message acknowledgment
 */

// ============================================
// MESSAGE PROTOCOL
// ============================================
const MessageType = {
    // Connection
    CONNECT: 'connect',
    CONNECTED: 'connected',
    DISCONNECT: 'disconnect',
    PING: 'ping',
    PONG: 'pong',
    
    // Sync
    SYNC_REQUEST: 'sync:request',
    SYNC_RESPONSE: 'sync:response',
    SYNC_DELTA: 'sync:delta',
    
    // Operations
    OPERATION: 'operation',
    OPERATION_ACK: 'operation:ack',
    OPERATION_BROADCAST: 'operation:broadcast',
    
    // Presence
    PRESENCE_UPDATE: 'presence:update',
    PRESENCE_LEAVE: 'presence:leave',
    
    // Errors
    ERROR: 'error',
    RECONNECT: 'reconnect'
};

// ============================================
// WEBSOCKET CLIENT
// ============================================
class WebSocketClient {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: 1000,
            maxReconnectInterval: 30000,
            reconnectDecay: 1.5,
            heartbeatInterval: 30000,
            messageTimeout: 10000,
            ...options
        };
        
        this.ws = null;
        this.messageQueue = [];
        this.pendingAcks = new Map();
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.isConnected = false;
        this.listeners = new Map();
        this.channels = new Set();
        
        // Bind methods
        this._onOpen = this._onOpen.bind(this);
        this._onClose = this._onClose.bind(this);
        this._onError = this._onError.bind(this);
        this._onMessage = this._onMessage.bind(this);
    }

    /**
     * Connect to server
     */
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        console.log('[WS] Connecting to', this.url);
        this.ws = new WebSocket(this.url);
        
        this.ws.addEventListener('open', this._onOpen);
        this.ws.addEventListener('close', this._onClose);
        this.ws.addEventListener('error', this._onError);
        this.ws.addEventListener('message', this._onMessage);
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        this._clearReconnect();
        this._clearHeartbeat();
        
        if (this.ws) {
            this._send({ type: MessageType.DISCONNECT });
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
    }

    /**
     * Send a message
     * @param {Object} message - Message to send
     * @param {boolean} requireAck - Whether to require acknowledgment
     * @returns {Promise} Resolves when acknowledged (if required)
     */
    send(message, requireAck = false) {
        const enrichedMessage = {
            ...message,
            timestamp: Date.now(),
            id: this._generateId()
        };

        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            this._transmit(enrichedMessage);
        } else {
            this.messageQueue.push(enrichedMessage);
        }

        if (requireAck) {
            return new Promise((resolve, reject) => {
                this.pendingAcks.set(enrichedMessage.id, { resolve, reject });
                
                setTimeout(() => {
                    if (this.pendingAcks.has(enrichedMessage.id)) {
                        this.pendingAcks.delete(enrichedMessage.id);
                        reject(new Error('Message acknowledgment timeout'));
                    }
                }, this.options.messageTimeout);
            });
        }

        return Promise.resolve();
    }

    /**
     * Transmit message to server
     * @private
     * @param {Object} message - Message to transmit
     */
    _transmit(message) {
        try {
            this.ws.send(JSON.stringify(message));
        } catch (e) {
            console.error('[WS] Send error:', e);
            this.messageQueue.push(message);
        }
    }

    /**
     * Subscribe to message type
     * @param {string} type - Message type
     * @param {Function} handler - Message handler
     * @returns {Function} Unsubscribe function
     */
    on(type, handler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(handler);
        
        return () => {
            this.listeners.get(type)?.delete(handler);
        };
    }

    /**
     * Join a channel
     * @param {string} channel - Channel name
     */
    join(channel) {
        this.channels.add(channel);
        this.send({
            type: MessageType.CONNECT,
            channel
        });
    }

    /**
     * Leave a channel
     * @param {string} channel - Channel name
     */
    leave(channel) {
        this.channels.delete(channel);
        this.send({
            type: MessageType.DISCONNECT,
            channel
        });
    }

    /**
     * Handle connection open
     * @private
     */
    _onOpen() {
        console.log('[WS] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Join channels
        this.channels.forEach(channel => {
            this._transmit({ type: MessageType.CONNECT, channel });
        });
        
        // Flush message queue
        this._flushQueue();
        
        // Start heartbeat
        this._startHeartbeat();
        
        // Emit connected event
        this._emit(MessageType.CONNECTED, { timestamp: Date.now() });
    }

    /**
     * Handle connection close
     * @private
     * @param {CloseEvent} event - Close event
     */
    _onClose(event) {
        console.log('[WS] Disconnected', event.code, event.reason);
        this.isConnected = false;
        this._clearHeartbeat();
        
        // Reject pending acks
        this.pendingAcks.forEach((_, id) => {
            const pending = this.pendingAcks.get(id);
            if (pending) {
                pending.reject(new Error('Connection closed'));
                this.pendingAcks.delete(id);
            }
        });
        
        // Emit disconnect event
        this._emit(MessageType.DISCONNECT, { code: event.code, reason: event.reason });
        
        // Schedule reconnect
        this._scheduleReconnect();
    }

    /**
     * Handle connection error
     * @private
     * @param {Event} event - Error event
     */
    _onError(event) {
        console.error('[WS] Error:', event);
        this._emit(MessageType.ERROR, { error: event });
    }

    /**
     * Handle incoming message
     * @private
     * @param {MessageEvent} event - Message event
     */
    _onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('[WS] Received:', message.type);
            
            // Handle acknowledgment
            if (message.type === MessageType.OPERATION_ACK && message.messageId) {
                const pending = this.pendingAcks.get(message.messageId);
                if (pending) {
                    pending.resolve(message);
                    this.pendingAcks.delete(message.messageId);
                }
            }
            
            // Handle ping
            if (message.type === MessageType.PING) {
                this._transmit({ type: MessageType.PONG, timestamp: Date.now() });
            }
            
            // Emit message
            this._emit(message.type, message);
            
        } catch (e) {
            console.error('[WS] Parse error:', e);
        }
    }

    /**
     * Flush message queue
     * @private
     */
    _flushQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this._transmit(message);
        }
    }

    /**
     * Schedule reconnection
     * @private
     */
    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        const delay = Math.min(
            this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.reconnectAttempts),
            this.options.maxReconnectInterval
        );
        
        this.reconnectAttempts++;
        
        console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    /**
     * Clear reconnection timer
     * @private
     */
    _clearReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Start heartbeat
     * @private
     */
    _startHeartbeat() {
        this._clearHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this._transmit({ type: MessageType.PING, timestamp: Date.now() });
            }
        }, this.options.heartbeatInterval);
    }

    /**
     * Clear heartbeat timer
     * @private
     */
    _clearHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Emit event to listeners
     * @private
     * @param {string} type - Event type
     * @param {any} data - Event data
     */
    _emit(type, data) {
        this.listeners.get(type)?.forEach(handler => {
            try {
                handler(data);
            } catch (e) {
                console.error(`[WS] Listener error for "${type}":`, e);
            }
        });
    }

    /**
     * Generate unique ID
     * @private
     * @returns {string}
     */
    _generateId() {
        return `${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get connection stats
     * @returns {Object}
     */
    getStats() {
        return {
            isConnected: this.isConnected,
            queueLength: this.messageQueue.length,
            pendingAcks: this.pendingAcks.size,
            reconnectAttempts: this.reconnectAttempts,
            channels: [...this.channels]
        };
    }
}

// ============================================
// SYNC MANAGER
// ============================================
class SyncManager {
    constructor(wsClient, crdtManager) {
        this.ws = wsClient;
        this.crdt = crdtManager;
        this.pendingOperations = new Map();
        this.lastSyncTime = null;
        this.syncInProgress = false;
        
        this._setupListeners();
    }

    /**
     * Setup WebSocket listeners
     * @private
     */
    _setupListeners() {
        // Handle sync responses
        this.ws.on(MessageType.SYNC_RESPONSE, (data) => {
            this._handleSyncResponse(data);
        });
        
        // Handle broadcast operations
        this.ws.on(MessageType.OPERATION_BROADCAST, (data) => {
            this._handleRemoteOperation(data);
        });
        
        // Handle connection events
        this.ws.on(MessageType.CONNECTED, () => {
            this._performFullSync();
        });
        
        this.ws.on(MessageType.DISCONNECT, () => {
            this.lastSyncTime = null;
        });
    }

    /**
     * Perform full sync with server
     * @private
     */
    async _performFullSync() {
        if (this.syncInProgress) return;
        
        this.syncInProgress = true;
        
        try {
            const localState = this.crdt.store.exportState();
            
            await this.ws.send({
                type: MessageType.SYNC_REQUEST,
                state: localState
            }, true);
            
        } catch (e) {
            console.error('[Sync] Full sync failed:', e);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Handle sync response from server
     * @private
     * @param {Object} data - Sync response data
     */
    _handleSyncResponse(data) {
        if (data.state) {
            const changes = this.crdt.mergeRemoteState(data.state);
            console.log('[Sync] Merged', changes.length, 'changes from server');
            this.lastSyncTime = Date.now();
        }
    }

    /**
     * Handle remote operation
     * @private
     * @param {Object} data - Operation data
     */
    _handleRemoteOperation(data) {
        const { operation, sourceId } = data;
        
        // Don't apply our own operations
        if (sourceId === this.crdt.nodeId) return;
        
        try {
            switch (operation.type) {
                case 'CREATE':
                    this.crdt.store.createTask(operation.data);
                    break;
                case 'UPDATE':
                    this.crdt.updateTask(operation.taskId, operation.updates);
                    break;
                case 'DELETE':
                    this.crdt.deleteTask(operation.taskId);
                    break;
            }
        } catch (e) {
            console.error('[Sync] Error applying remote operation:', e);
        }
    }

    /**
     * Broadcast local operation
     * @param {string} type - Operation type
     * @param {Object} data - Operation data
     */
    broadcastOperation(type, data) {
        const operation = {
            type,
            ...data,
            timestamp: Date.now(),
            sourceId: this.crdt.nodeId
        };
        
        this.ws.send({
            type: MessageType.OPERATION,
            operation
        });
        
        this.ws.send({
            type: MessageType.OPERATION_BROADCAST,
            operation
        });
    }

    /**
     * Get sync status
     * @returns {Object}
     */
    getStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            pendingOperations: this.pendingOperations.size,
            wsStats: this.ws.getStats()
        };
    }
}

// ============================================
// PRESENCE MANAGER
// ============================================
class PresenceManager {
    constructor(wsClient, userId) {
        this.ws = wsClient;
        this.userId = userId;
        this.presence = {
            status: 'online',
            lastSeen: Date.now(),
            metadata: {}
        };
        this.peers = new Map();
        this.heartbeatInterval = null;
        
        this._setupListeners();
        this._startHeartbeat();
    }

    /**
     * Setup listeners
     * @private
     */
    _setupListeners() {
        this.ws.on(MessageType.PRESENCE_UPDATE, (data) => {
            this._handlePresenceUpdate(data);
        });
        
        this.ws.on(MessageType.PRESENCE_LEAVE, (data) => {
            this._handlePresenceLeave(data);
        });
    }

    /**
     * Start presence heartbeat
     * @private
     */
    _startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.updatePresence({ lastSeen: Date.now() });
        }, 30000);
    }

    /**
     * Update presence
     * @param {Object} updates - Presence updates
     */
    updatePresence(updates) {
        Object.assign(this.presence, updates);
        
        this.ws.send({
            type: MessageType.PRESENCE_UPDATE,
            userId: this.userId,
            presence: this.presence
        });
    }

    /**
     * Set status
     * @param {string} status - Status (online, away, busy, offline)
     */
    setStatus(status) {
        this.updatePresence({ status });
    }

    /**
     * Set metadata
     * @param {Object} metadata - Metadata to set
     */
    setMetadata(metadata) {
        this.updatePresence({ metadata });
    }

    /**
     * Handle presence update from peer
     * @private
     * @param {Object} data - Presence data
     */
    _handlePresenceUpdate(data) {
        const { userId, presence } = data;
        this.peers.set(userId, { ...presence, lastUpdate: Date.now() });
        
        // Emit event
        this.ws._emit('presence:changed', { userId, presence });
    }

    /**
     * Handle peer leaving
     * @private
     * @param {Object} data - Leave data
     */
    _handlePresenceLeave(data) {
        const { userId } = data;
        const peer = this.peers.get(userId);
        if (peer) {
            peer.status = 'offline';
            this.peers.set(userId, peer);
        }
        
        this.ws._emit('presence:left', { userId });
    }

    /**
     * Get peer presence
     * @param {string} userId - User ID
     * @returns {Object|null}
     */
    getPeerPresence(userId) {
        return this.peers.get(userId) || null;
    }

    /**
     * Get all peers
     * @returns {Object}
     */
    getAllPeers() {
        return Object.fromEntries(this.peers);
    }

    /**
     * Destroy presence manager
     */
    destroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.ws.send({
            type: MessageType.PRESENCE_LEAVE,
            userId: this.userId
        });
    }
}

// Export
export { WebSocketClient, SyncManager, PresenceManager, MessageType };
