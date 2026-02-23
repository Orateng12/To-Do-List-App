/**
 * Real-time Cloud Sync Module
 * ============================
 * WebSocket-based synchronization with conflict resolution
 */

import type { Task, DomainEvent, SyncState } from '../types';

export interface SyncMessage {
  type: SyncMessageType;
  payload: unknown;
  timestamp: string;
  clientId: string;
  sequence: number;
}

export type SyncMessageType =
  | 'CONNECT'
  | 'DISCONNECT'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'EVENT_BROADCAST'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'ACKNOWLEDGMENT'
  | 'HEARTBEAT';

export interface SyncConfig {
  serverUrl: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  syncBatchSize: number;
}

export interface ConflictResolution {
  localVersion: Task;
  remoteVersion: Task;
  resolution: 'local' | 'remote' | 'merge';
  mergedVersion?: Task;
}

export class CloudSyncEngine {
  private config: SyncConfig = {
    serverUrl: 'wss://sync.taskmaster.pro',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    syncBatchSize: 100
  };

  private state: SyncState = {
    status: 'offline',
    pendingChanges: 0,
    lastSyncAt: undefined
  };

  private ws: WebSocket | null = null;
  private clientId: string;
  private sequence: number = 0;
  private pendingEvents: DomainEvent[] = [];
  private reconnectAttempts: number = 0;
  private heartbeatTimer: number | null = null;
  private eventListeners: Map<string, Array<(data: unknown) => void>> = new Map();
  private lastSyncTimestamp: string | null = null;

  constructor() {
    this.clientId = this.generateClientId();
  }

  /**
   * Initialize sync engine
   */
  initialize(config?: Partial<SyncConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Load pending events from storage
    this.loadPendingEvents();

    // Connect when online
    if (navigator.onLine) {
      this.connect();
    }

    // Listen for online/offline events
    window.addEventListener('online', () => this.connect());
    window.addEventListener('offline', () => this.disconnect());
  }

  /**
   * Connect to sync server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.updateState({ status: 'syncing' });

    try {
      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.onopen = () => {
        console.log('[CloudSync] Connected to server');
        this.reconnectAttempts = 0;
        this.updateState({ status: 'idle' });
        this.startHeartbeat();
        this.sendSyncRequest();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as SyncMessage;
        this.handleMessage(message);
      };

      this.ws.onclose = () => {
        console.log('[CloudSync] Disconnected');
        this.updateState({ status: 'offline' });
        this.stopHeartbeat();
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[CloudSync] Error:', error);
        this.updateState({ status: 'error', error: 'Connection failed' });
      };
    } catch (error) {
      console.error('[CloudSync] Failed to connect:', error);
      this.updateState({ status: 'error', error: 'Connection failed' });
      this.reconnect();
    }
  }

  /**
   * Disconnect from sync server
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateState({ status: 'offline' });
  }

  /**
   * Broadcast event to other clients
   */
  broadcastEvent(event: DomainEvent): void {
    // Add to pending events
    this.pendingEvents.push(event);
    this.updateState({ pendingChanges: this.pendingEvents.length });

    // Save to storage for offline sync
    this.savePendingEvents();

    // Send if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'EVENT_BROADCAST',
        payload: { event },
        timestamp: new Date().toISOString(),
        clientId: this.clientId,
        sequence: this.sequence++
      });
    }
  }

  /**
   * Request sync from server
   */
  sendSyncRequest(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    this.send({
      type: 'SYNC_REQUEST',
      payload: {
        lastSyncTimestamp: this.lastSyncTimestamp,
        pendingEvents: this.pendingEvents,
        clientId: this.clientId
      },
      timestamp: new Date().toISOString(),
      clientId: this.clientId,
      sequence: this.sequence++
    });
  }

  /**
   * Handle incoming sync message
   */
  private handleMessage(message: SyncMessage): void {
    console.log('[CloudSync] Received:', message.type);

    switch (message.type) {
      case 'SYNC_RESPONSE':
        this.handleSyncResponse(message.payload as { events: DomainEvent[]; timestamp: string });
        break;

      case 'EVENT_BROADCAST':
        this.handleRemoteEvent(message.payload as { event: DomainEvent; clientId: string });
        break;

      case 'CONFLICT_DETECTED':
        this.handleConflict(message.payload as ConflictResolution);
        break;

      case 'ACKNOWLEDGMENT':
        this.handleAcknowledgment(message.payload as { sequence: number });
        break;

      case 'HEARTBEAT':
        // Respond to heartbeat
        break;
    }

    // Notify listeners
    const listeners = this.eventListeners.get(message.type) || [];
    listeners.forEach(listener => listener(message.payload));
  }

  /**
   * Handle sync response from server
   */
  private handleSyncResponse(payload: { events: DomainEvent[]; timestamp: string }): void {
    const { events, timestamp } = payload;

    // Apply remote events
    events.forEach(event => {
      if (event.metadata.clientId !== this.clientId) {
        this.applyRemoteEvent(event);
      }
    });

    // Clear acknowledged pending events
    this.pendingEvents = [];
    this.updateState({ pendingChanges: 0 });

    // Update sync timestamp
    this.lastSyncTimestamp = timestamp;
    this.updateState({ 
      status: 'idle', 
      lastSyncAt: new Date().toISOString() 
    });

    // Notify sync complete
    this.emit('sync:complete', { eventsCount: events.length });
  }

  /**
   * Handle remote event from another client
   */
  private handleRemoteEvent(payload: { event: DomainEvent; clientId: string }): void {
    const { event, clientId } = payload;

    // Don't process own events
    if (clientId === this.clientId) return;

    // Check for conflicts
    if (this.hasConflict(event)) {
      this.resolveConflict(event);
    } else {
      this.applyRemoteEvent(event);
    }
  }

  /**
   * Apply remote event to local state
   */
  private applyRemoteEvent(event: DomainEvent): void {
    // Emit event for local processing
    this.emit('remote:event', event);
  }

  /**
   * Handle conflict detection
   */
  private handleConflict(resolution: ConflictResolution): void {
    console.log('[CloudSync] Conflict detected:', resolution);
    
    // Auto-resolve using last-write-wins strategy
    const mergedVersion = resolution.remoteVersion;
    
    this.emit('conflict:resolved', {
      resolution: 'remote',
      version: mergedVersion
    });
  }

  /**
   * Handle acknowledgment from server
   */
  private handleAcknowledgment(payload: { sequence: number }): void {
    const { sequence } = payload;
    
    // Remove acknowledged events from pending
    this.pendingEvents = this.pendingEvents.slice(
      this.pendingEvents.findIndex(e => e.metadata.sequence === sequence)
    );
    
    this.updateState({ pendingChanges: this.pendingEvents.length });
  }

  /**
   * Check if event conflicts with local state
   */
  private hasConflict(event: DomainEvent): boolean {
    // Check if we have a newer version locally
    const localEvents = this.pendingEvents.filter(
      e => e.aggregateId === event.aggregateId
    );
    
    return localEvents.some(
      e => new Date(e.timestamp).getTime() > new Date(event.timestamp).getTime()
    );
  }

  /**
   * Resolve conflict
   */
  private resolveConflict(remoteEvent: DomainEvent): void {
    // Simple last-write-wins strategy
    // In production, implement more sophisticated conflict resolution
    this.emit('conflict:detected', {
      local: this.pendingEvents.find(e => e.aggregateId === remoteEvent.aggregateId),
      remote: remoteEvent
    });
  }

  /**
   * Reconnect to server
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[CloudSync] Max reconnect attempts reached');
      this.updateState({ status: 'error', error: 'Connection failed' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[CloudSync] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'HEARTBEAT',
          payload: { clientId: this.clientId },
          timestamp: new Date().toISOString(),
          clientId: this.clientId,
          sequence: this.sequence++
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send message to server
   */
  private send(message: SyncMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Update sync state
   */
  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('state:change', this.state);
  }

  /**
   * Load pending events from storage
   */
  private loadPendingEvents(): void {
    try {
      const stored = localStorage.getItem('taskmaster-pending-events');
      if (stored) {
        this.pendingEvents = JSON.parse(stored);
        this.updateState({ pendingChanges: this.pendingEvents.length });
      }
    } catch (error) {
      console.error('[CloudSync] Failed to load pending events:', error);
    }
  }

  /**
   * Save pending events to storage
   */
  private savePendingEvents(): void {
    try {
      localStorage.setItem('taskmaster-pending-events', JSON.stringify(this.pendingEvents));
    } catch (error) {
      console.error('[CloudSync] Failed to save pending events:', error);
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event emitter methods
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
    
    return () => {
      const updated = (this.eventListeners.get(event) || []).filter(l => l !== callback);
      this.eventListeners.set(event, updated);
    };
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Force sync
   */
  forceSync(): void {
    this.sendSyncRequest();
  }
}

// Singleton instance
export const cloudSyncEngine = new CloudSyncEngine();
