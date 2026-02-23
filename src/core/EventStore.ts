/**
 * Event Store - Core Event Sourcing Implementation
 * =================================================
 * Immutable event log for complete audit trail and time-travel debugging
 */

import type { DomainEvent, EventStore, EventType } from '../types';

export class InMemoryEventStore implements EventStore {
  private events: DomainEvent[] = [];
  private eventIndex: Map<string, DomainEvent[]> = new Map();
  private timestampIndex: Map<string, DomainEvent[]> = new Map();

  /**
   * Append an event to the store
   */
  async append(event: DomainEvent): Promise<void> {
    // Validate event
    this.validateEvent(event);
    
    // Add to main store
    this.events.push(event);
    
    // Index by aggregate ID
    const aggregateEvents = this.eventIndex.get(event.aggregateId) || [];
    aggregateEvents.push(event);
    this.eventIndex.set(event.aggregateId, aggregateEvents);
    
    // Index by timestamp (for temporal queries)
    const dateKey = event.timestamp.slice(0, 10); // YYYY-MM-DD
    const dateEvents = this.timestampIndex.get(dateKey) || [];
    dateEvents.push(event);
    this.timestampIndex.set(dateKey, dateEvents);
    
    // Emit event for real-time updates
    this.dispatchToSubscribers(event);
    
    console.log(`[EventStore] Appended: ${event.type} for ${event.aggregateId}`);
  }

  /**
   * Get all events for an aggregate
   */
  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    return this.eventIndex.get(aggregateId) || [];
  }

  /**
   * Get events since a specific timestamp
   */
  async getEventsSince(timestamp: string): Promise<DomainEvent[]> {
    const since = new Date(timestamp).getTime();
    return this.events.filter(e => new Date(e.timestamp).getTime() >= since);
  }

  /**
   * Get all events (for reconstruction)
   */
  async getAllEvents(): Promise<DomainEvent[]> {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  async getEventsByType(type: EventType): Promise<DomainEvent[]> {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events in a time range
   */
  async getEventsInRange(start: string, end: string): Promise<DomainEvent[]> {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    
    return this.events.filter(e => {
      const eventTime = new Date(e.timestamp).getTime();
      return eventTime >= startTime && eventTime <= endTime;
    });
  }

  /**
   * Clear the event store (use with caution!)
   */
  async clear(): Promise<void> {
    this.events = [];
    this.eventIndex.clear();
    this.timestampIndex.clear();
    console.warn('[EventStore] Cleared all events');
  }

  /**
   * Get event stream for multiple aggregates
   */
  async getEventStream(aggregateIds: string[]): Promise<DomainEvent[]> {
    const events: DomainEvent[] = [];
    
    for (const id of aggregateIds) {
      const aggregateEvents = await this.getEvents(id);
      events.push(...aggregateEvents);
    }
    
    return events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Replay events to rebuild state
   */
  async replay(
    handler: (event: DomainEvent) => void | Promise<void>,
    options: { from?: string; to?: string; types?: EventType[] } = {}
  ): Promise<void> {
    let events = await this.getAllEvents();
    
    // Filter by time range
    if (options.from) {
      const fromTime = new Date(options.from).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= fromTime);
    }
    
    if (options.to) {
      const toTime = new Date(options.to).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() <= toTime);
    }
    
    // Filter by event types
    if (options.types?.length) {
      events = events.filter(e => options.types!.includes(e.type));
    }
    
    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Replay each event
    for (const event of events) {
      await handler(event);
    }
    
    console.log(`[EventStore] Replayed ${events.length} events`);
  }

  /**
   * Create a snapshot of current state
   */
  async createSnapshot(aggregateId: string): Promise<DomainEvent[]> {
    return this.getEvents(aggregateId);
  }

  /**
   * Get aggregate version (for optimistic concurrency)
   */
  async getAggregateVersion(aggregateId: string): Promise<number> {
    const events = await this.getEvents(aggregateId);
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    return lastEvent ? lastEvent.version : 0;
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: DomainEvent): void {
    const required = ['id', 'type', 'aggregateId', 'aggregateType', 'payload', 'timestamp', 'version'];
    
    for (const field of required) {
      if (!(field in event)) {
        throw new Error(`Event missing required field: ${field}`);
      }
    }
    
    if (!event.id || !event.type || !event.aggregateId) {
      throw new Error('Event must have id, type, and aggregateId');
    }
  }

  /**
   * Dispatch event to subscribers (for real-time updates)
   */
  private dispatchToSubscribers(event: DomainEvent): void {
    // In a real app, this would emit to WebSocket, Redux, etc.
    window.dispatchEvent(new CustomEvent('event-store:event', { detail: event }));
  }

  /**
   * Get statistics about the event store
   */
  getStats(): { total: number; byType: Record<string, number>; byDate: Record<string, number> } {
    const byType: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    
    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      
      const dateKey = event.timestamp.slice(0, 10);
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    }
    
    return {
      total: this.events.length,
      byType,
      byDate
    };
  }

  /**
   * Export events for backup
   */
  export(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Import events from backup
   */
  import(json: string): void {
    const events = JSON.parse(json) as DomainEvent[];
    
    for (const event of events) {
      this.validateEvent(event);
      this.events.push(event);
      
      const aggregateEvents = this.eventIndex.get(event.aggregateId) || [];
      aggregateEvents.push(event);
      this.eventIndex.set(event.aggregateId, aggregateEvents);
    }
    
    console.log(`[EventStore] Imported ${events.length} events`);
  }
}

// Singleton instance
export const eventStore = new InMemoryEventStore();
