/**
 * WebSocket Real-Time Sync Server
 * ================================
 * Node.js server for real-time collaboration
 */

// Server-side code (for reference - run with Node.js)
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class TaskMasterServer {
    constructor(port = 8080) {
        this.port = port;
        this.clients = new Map(); // clientId -> { ws, userId, rooms }
        this.rooms = new Map(); // roomId -> Set(clientId)
        this.documents = new Map(); // docId -> { content, version, history }
        
        this.wss = new WebSocket.Server({ port });
        this.setupServer();
        
        console.log(`TaskMaster Sync Server running on port ${port}`);
    }

    setupServer() {
        this.wss.on('connection', (ws) => {
            const clientId = uuidv4();
            this.clients.set(clientId, {
                ws,
                userId: null,
                rooms: new Set(),
                connectedAt: Date.now()
            });

            console.log(`Client connected: ${clientId}`);

            // Send connection confirmation
            this.send(ws, {
                type: 'connected',
                clientId,
                timestamp: Date.now()
            });

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(clientId, data);
                } catch (error) {
                    console.error('Message parse error:', error);
                    this.send(ws, { type: 'error', message: 'Invalid message format' });
                }
            });

            ws.on('close', () => {
                this.handleDisconnect(clientId);
            });

            ws.on('error', (error) => {
                console.error(`Client ${clientId} error:`, error);
            });
        });
    }

    handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        switch (data.type) {
            case 'join':
                this.handleJoin(clientId, data);
                break;
            case 'leave':
                this.handleLeave(clientId, data);
                break;
            case 'sync':
                this.handleSync(clientId, data);
                break;
            case 'broadcast':
                this.handleBroadcast(clientId, data);
                break;
            case 'presence':
                this.handlePresence(clientId, data);
                break;
            case 'crdt':
                this.handleCRDT(clientId, data);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleJoin(clientId, data) {
        const { roomId, userId } = data;
        const client = this.clients.get(clientId);

        if (!client) return;

        client.userId = userId;
        client.rooms.add(roomId);

        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(clientId);

        // Initialize document if needed
        if (!this.documents.has(roomId)) {
            this.documents.set(roomId, {
                content: {},
                version: 0,
                history: [],
                clients: new Set()
            });
        }

        // Send current document state
        const doc = this.documents.get(roomId);
        this.send(clientId, {
            type: 'joined',
            roomId,
            document: doc.content,
            version: doc.version,
            clients: this.getRoomClients(roomId)
        });

        // Notify others
        this.broadcastToRoom(roomId, {
            type: 'user_joined',
            roomId,
            userId,
            clientId
        }, clientId);
    }

    handleLeave(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        data.rooms.forEach(roomId => {
            this.removeClientFromRoom(clientId, roomId);
        });
    }

    handleSync(clientId, data) {
        const { roomId, operations, version } = data;
        const doc = this.documents.get(roomId);

        if (!doc) return;

        // Apply operations
        operations.forEach(op => {
            this.applyOperation(doc, op);
        });

        doc.version++;
        doc.history.push({
            operations,
            clientId,
            timestamp: Date.now()
        });

        // Keep history bounded
        if (doc.history.length > 1000) {
            doc.history = doc.history.slice(-500);
        }

        // Broadcast to other clients
        this.broadcastToRoom(roomId, {
            type: 'sync',
            roomId,
            operations,
            version: doc.version,
            clientId
        }, clientId);

        // Acknowledge to sender
        this.send(clientId, {
            type: 'sync_ack',
            roomId,
            version: doc.version
        });
    }

    handleCRDT(clientId, data) {
        const { roomId, state } = data;
        
        // Forward CRDT state to all other clients in room
        this.broadcastToRoom(roomId, {
            type: 'crdt_state',
            roomId,
            state,
            clientId,
            timestamp: Date.now()
        }, clientId);
    }

    handleBroadcast(clientId, data) {
        const { roomId, message } = data;
        
        this.broadcastToRoom(roomId, {
            type: 'broadcast',
            roomId,
            message,
            clientId,
            timestamp: Date.now()
        });
    }

    handlePresence(clientId, data) {
        const { roomId } = data;
        const client = this.clients.get(clientId);

        if (!client || !this.rooms.has(roomId)) return;

        // Send presence info to requester
        this.send(clientId, {
            type: 'presence',
            roomId,
            clients: this.getRoomClients(roomId)
        });
    }

    applyOperation(doc, op) {
        // Simple operational transform
        const { type, path, value } = op;

        const parts = path.split('.');
        let current = doc.content;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        const lastPart = parts[parts.length - 1];

        switch (type) {
            case 'set':
                current[lastPart] = value;
                break;
            case 'delete':
                delete current[lastPart];
                break;
            case 'update':
                if (current[lastPart] && typeof current[lastPart] === 'object') {
                    Object.assign(current[lastPart], value);
                } else {
                    current[lastPart] = value;
                }
                break;
        }
    }

    handleDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.rooms.forEach(roomId => {
            this.removeClientFromRoom(clientId, roomId);
        });

        this.clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
    }

    removeClientFromRoom(clientId, roomId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.rooms.delete(roomId);
        
        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(clientId);
            
            if (room.size === 0) {
                this.rooms.delete(roomId);
            } else {
                // Notify others
                this.broadcastToRoom(roomId, {
                    type: 'user_left',
                    roomId,
                    clientId,
                    userId: client.userId
                });
            }
        }
    }

    getRoomClients(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return [];

        return Array.from(room).map(clientId => {
            const client = this.clients.get(clientId);
            return {
                clientId,
                userId: client?.userId,
                connectedAt: client?.connectedAt
            };
        });
    }

    send(target, message) {
        if (typeof target === 'string') {
            const client = this.clients.get(target);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        } else if (target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify(message));
        }
    }

    broadcastToRoom(roomId, message, excludeClientId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.forEach(clientId => {
            if (clientId !== excludeClientId) {
                this.send(clientId, message);
            }
        });
    }

    getStats() {
        return {
            clients: this.clients.size,
            rooms: this.rooms.size,
            documents: this.documents.size,
            uptime: Date.now() - this.startTime
        };
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new TaskMasterServer(process.env.PORT || 8080);
}

module.exports = TaskMasterServer;
