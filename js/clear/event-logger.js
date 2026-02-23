/**
 * Unified Event Logger - Clear Life OS
 * =====================================
 * Comprehensive behavioral event logging for
 * analytics and learning engine.
 * 
 * Features:
 * - Structured event schema
 * - Batch processing
 * - Privacy-safe logging
 * - Real-time analytics pipeline
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class UnifiedEventLogger {
    constructor() {
        // Event schema definitions
        this.eventSchemas = {
            // Habit events
            'habit.viewed': {
                required: ['habitId', 'timestamp', 'context'],
                optional: ['timeSinceReminder', 'viewDuration', 'entryPoint']
            },
            'habit.started': {
                required: ['habitId', 'timestamp', 'completionIntent'],
                optional: ['delayFromView', 'initialResistance']
            },
            'habit.completed': {
                required: ['habitId', 'timestamp', 'completionType'],
                optional: ['duration', 'moodBefore', 'moodAfter', 'difficulty']
            },
            'habit.skipped': {
                required: ['habitId', 'timestamp', 'reason'],
                optional: ['guiltLevel', 'alternativeActivity', 'rescheduleIntent']
            },
            'habit.failed': {
                required: ['habitId', 'timestamp', 'failurePoint'],
                optional: ['failureAttribution', 'emotion', 'abandonmentTime']
            },
            
            // Reflection events
            'reflection.started': {
                required: ['timestamp', 'reflectionType'],
                optional: ['promptCount', 'entryPoint']
            },
            'reflection.completed': {
                required: ['timestamp', 'duration', 'sentimentScore'],
                optional: ['insightsGenerated', 'clarityShift', 'completionRate']
            },
            'reflection.abandoned': {
                required: ['timestamp', 'completionPercentage', 'abandonmentPoint'],
                optional: ['reason', 'frictionPoint']
            },
            
            // System events
            'system.created': {
                required: ['systemId', 'templateUsed', 'timestamp'],
                optional: ['modifications', 'estimatedDifficulty', 'archetype']
            },
            'system.modified': {
                required: ['systemId', 'timestamp', 'changes'],
                optional: ['trigger', 'userInitiated', 'adaptationSource']
            },
            'system.adapted': {
                required: ['systemId', 'timestamp', 'adaptationType'],
                optional: ['reason', 'previousState', 'newState']
            },
            
            // Identity events
            'identity.assigned': {
                required: ['archetype', 'confidence', 'timestamp'],
                optional: ['secondaryArchetype', 'contradictions', 'requiresValidation']
            },
            'identity.validated': {
                required: ['validationType', 'score', 'timestamp'],
                optional: ['needsRecalibration', 'confidenceUpdated']
            },
            'identity.migrated': {
                required: ['from', 'to', 'timestamp'],
                optional: ['trigger', 'userMetrics']
            },
            
            // Engagement events
            'session.started': {
                required: ['timestamp', 'entryPoint'],
                optional: ['deviceType', 'timeOfDay']
            },
            'session.completed': {
                required: ['timestamp', 'duration', 'actionsTaken'],
                optional: ['screensViewed', 'completionRate']
            },
            'notification.received': {
                required: ['notificationId', 'type', 'timestamp'],
                optional: ['actionTaken', 'timeToAction', 'dismissed']
            },
            
            // Clarity events
            'clarity.scored': {
                required: ['score', 'timestamp'],
                optional: ['previousScore', 'shift', 'context']
            },
            'clarity.milestone': {
                required: ['milestoneType', 'timestamp'],
                optional: ['previousMilestone', 'daysToAchieve']
            }
        };
        
        // Event buffer for batch processing
        this.eventBuffer = [];
        this.bufferSize = 50;
        this.flushInterval = 30000; // 30 seconds
        
        // Storage
        this.storageKey = 'clear_event_log';
        this.maxStoredEvents = 1000;
        
        // Initialize
        this._initializeLogger();
    }

    /**
     * Initialize logger
     * @private
     */
    _initializeLogger() {
        // Set up flush interval
        setInterval(() => this._flushBuffer(), this.flushInterval);
        
        // Load any stored events
        this._loadStoredEvents();
        
        console.log('[EventLogger] Initialized');
    }

    /**
     * Log an event
     * @param {string} eventType - Event type (e.g., 'habit.completed')
     * @param {Object} eventData - Event data
     * @returns {Object} Logged event
     */
    log(eventType, eventData) {
        const schema = this.eventSchemas[eventType];
        
        if (!schema) {
            console.warn(`[EventLogger] Unknown event type: ${eventType}`);
        }
        
        // Validate required fields
        const validation = this._validateEvent(eventType, eventData, schema);
        
        const event = {
            eventId: this._generateId(),
            eventType,
            timestamp: eventData.timestamp || new Date().toISOString(),
            data: eventData,
            validated: validation.valid,
            validationErrors: validation.errors || []
        };
        
        // Add to buffer
        this.eventBuffer.push(event);
        
        // Flush if buffer is full
        if (this.eventBuffer.length >= this.bufferSize) {
            this._flushBuffer();
        }
        
        // Emit for real-time listeners
        eventBus.emit(AppEvents.EVENT_LOGGED, event);
        
        return event;
    }

    /**
     * Validate event against schema
     * @private
     */
    _validateEvent(eventType, eventData, schema) {
        if (!schema) return { valid: true };
        
        const errors = [];
        
        // Check required fields
        for (const field of schema.required) {
            if (eventData[field] === undefined || eventData[field] === null) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Flush event buffer to storage
     * @private
     */
    _flushBuffer() {
        if (this.eventBuffer.length === 0) return;
        
        const events = [...this.eventBuffer];
        this.eventBuffer = [];
        
        // Store events
        this._storeEvents(events);
        
        // Could also send to analytics backend here
        // this._sendToAnalytics(events);
        
        console.log(`[EventLogger] Flushed ${events.length} events`);
    }

    /**
     * Store events to localStorage
     * @private
     */
    _storeEvents(events) {
        try {
            const stored = this._loadStoredEvents();
            const combined = [...stored, ...events];
            
            // Keep only recent events
            const trimmed = combined.slice(-this.maxStoredEvents);
            
            localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
        } catch (error) {
            console.error('[EventLogger] Storage error:', error);
        }
    }

    /**
     * Load stored events
     * @private
     */
    _loadStoredEvents() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('[EventLogger] Load error:', error);
            return [];
        }
    }

    /**
     * Get events by type
     * @param {string} eventType - Event type to filter
     * @returns {Array} Matching events
     */
    getEventsByType(eventType) {
        const stored = this._loadStoredEvents();
        return stored.filter(e => e.eventType === eventType);
    }

    /**
     * Get events by date range
     * @param {string} startDate - Start date (ISO)
     * @param {string} endDate - End date (ISO)
     * @returns {Array} Events in range
     */
    getEventsByDateRange(startDate, endDate) {
        const stored = this._loadStoredEvents();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        return stored.filter(e => {
            const timestamp = new Date(e.timestamp).getTime();
            return timestamp >= start && timestamp <= end;
        });
    }

    /**
     * Get aggregated statistics
     * @param {string} eventType - Event type
     * @param {string} field - Field to aggregate
     * @param {string} operation - Aggregation operation
     * @returns {Object} Statistics
     */
    getAggregatedStats(eventType, field, operation = 'count') {
        const events = this.getEventsByType(eventType);
        
        if (events.length === 0) {
            return { count: 0, result: null };
        }
        
        switch (operation) {
            case 'count':
                return { count: events.length, result: events.length };
                
            case 'sum':
                const sum = events.reduce((acc, e) => acc + (e.data[field] || 0), 0);
                return { count: events.length, result: sum };
                
            case 'average':
                const avg = events.reduce((acc, e) => acc + (e.data[field] || 0), 0) / events.length;
                return { count: events.length, result: Math.round(avg * 100) / 100 };
                
            case 'min':
                const min = Math.min(...events.map(e => e.data[field] || 0));
                return { count: events.length, result: min };
                
            case 'max':
                const max = Math.max(...events.map(e => e.data[field] || 0));
                return { count: events.length, result: max };
                
            default:
                return { count: events.length, result: null };
        }
    }

    /**
     * Clear all stored events
     */
    clear() {
        localStorage.removeItem(this.storageKey);
        this.eventBuffer = [];
        eventBus.emit(AppEvents.EVENT_LOG_CLEARED);
    }

    /**
     * Export events for analysis
     * @returns {Array} All stored events
     */
    exportEvents() {
        return this._loadStoredEvents();
    }

    _generateId() {
        return 'evt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

export { UnifiedEventLogger };
