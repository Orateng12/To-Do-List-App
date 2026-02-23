/**
 * Event Bus - Publisher/Subscriber Pattern
 * ==========================================
 * Decoupled event communication system
 * Allows components to communicate without direct references
 * 
 * Features:
 * - Wildcard event matching (*, namespace.*)
 * - Event priorities
 * - Once listeners
 * - Async event handlers
 * - Event middleware
 */

class EventBus {
    constructor() {
        this.events = new Map();
        this.middleware = [];
        this.wildcardListeners = [];
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name (supports wildcards with *)
     * @param {Function} handler - Callback function
     * @param {number} priority - Higher priority = called first
     * @returns {Function} Unsubscribe function
     */
    on(event, handler, priority = 0) {
        if (event.includes('*')) {
            this.wildcardListeners.push({ event, handler, priority });
            return () => this.offWildcard(event, handler);
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener = { handler, priority, id: Symbol('listener') };
        this.events.get(event).push(listener);
        this.events.get(event).sort((a, b) => b.priority - a.priority);

        return () => this.off(event, listener.id);
    }

    /**
     * Subscribe once to an event
     * @param {string} event - Event name
     * @param {Function} handler - Callback function
     * @returns {Function} Unsubscribe function
     */
    once(event, handler, priority = 0) {
        const wrapper = (...args) => {
            this.off(event, wrapperId);
            handler(...args);
        };
        const wrapperId = Symbol('once');
        wrapper.id = wrapperId;
        return this.on(event, wrapper, priority);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Symbol} id - Listener ID
     */
    off(event, id) {
        if (this.events.has(event)) {
            this.events.set(
                this.events.get(event).filter(l => l.id !== id)
            );
        }
    }

    offWildcard(event, handler) {
        this.wildcardListeners = this.wildcardListeners.filter(
            l => !(l.event === event && l.handler === handler)
        );
    }

    /**
     * Add middleware (runs before all handlers)
     * @param {Function} fn - Middleware function (event, data, next)
     */
    use(fn) {
        this.middleware.push(fn);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {any} data - Event data
     * @returns {Promise} Resolves when all handlers complete
     */
    async emit(event, data = {}) {
        const eventObj = {
            name: event,
            data,
            timestamp: Date.now(),
            defaultPrevented: false,
            preventDefault() {
                this.defaultPrevented = true;
            }
        };

        // Run middleware
        let middlewareIndex = 0;
        const runMiddleware = () => {
            if (middlewareIndex >= this.middleware.length) {
                return Promise.resolve();
            }
            return new Promise(resolve => {
                const mw = this.middleware[middlewareIndex++];
                mw(eventObj, () => resolve(runMiddleware()));
            });
        };

        await runMiddleware();

        if (eventObj.preventDefault) {
            return;
        }

        // Collect all handlers
        const handlers = [];

        // Direct listeners
        if (this.events.has(event)) {
            handlers.push(...this.events.get(event));
        }

        // Wildcard listeners
        this.wildcardListeners.forEach(({ event: pattern, handler }) => {
            if (this.matchesPattern(event, pattern)) {
                handlers.push({ handler, priority: 0 });
            }
        });

        // Execute handlers
        const promises = handlers.map(({ handler }) => {
            try {
                const result = handler(eventObj);
                return result instanceof Promise ? result : Promise.resolve(result);
            } catch (error) {
                console.error(`Event handler error for "${event}":`, error);
                return Promise.reject(error);
            }
        });

        await Promise.allSettled(promises);
    }

    /**
     * Check if event matches wildcard pattern
     * @param {string} event - Event name
     * @param {string} pattern - Pattern with wildcards
     * @returns {boolean}
     */
    matchesPattern(event, pattern) {
        if (pattern === '*') return true;
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(event);
    }

    /**
     * Clear all listeners for an event or all events
     * @param {string} [event] - Event name (optional)
     */
    clear(event) {
        if (event) {
            this.events.delete(event);
            this.wildcardListeners = this.wildcardListeners.filter(
                l => !this.matchesPattern(event, l.event)
            );
        } else {
            this.events.clear();
            this.wildcardListeners = [];
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number}
     */
    listenerCount(event) {
        let count = this.events.has(event) ? this.events.get(event).length : 0;
        this.wildcardListeners.forEach(({ event: pattern }) => {
            if (this.matchesPattern(event, pattern)) count++;
        });
        return count;
    }
}

// Export singleton instance
export const eventBus = new EventBus();

// Predefined event types
export const AppEvents = {
    // Task events
    TASK_CREATED: 'task:created',
    TASK_UPDATED: 'task:updated',
    TASK_DELETED: 'task:deleted',
    TASK_COMPLETED: 'task:completed',
    TASK_TOGGLED: 'task:toggled',
    TASKS_LOADED: 'tasks:loaded',

    // Subtask events
    SUBTASK_ADDED: 'subtask:added',
    SUBTASK_TOGGLED: 'subtask:toggled',
    SUBTASK_DELETED: 'subtask:deleted',
    SUBTASK_UPDATED: 'subtask:updated',
    SUBTASK_REORDERED: 'subtask:reordered',
    ALL_SUBTASKS_COMPLETE: 'subtask:all_complete',

    // Recurrence events
    RECURRENCE_SET: 'recurrence:set',
    RECURRENCE_REMOVED: 'recurrence:removed',
    RECURRING_TASK_GENERATED: 'recurring:generated',

    // Notification events
    NOTIFICATIONS_ENABLED: 'notifications:enabled',
    NOTIFICATION_SENT: 'notification:sent',

    // Streak events
    STREAK_UPDATED: 'streak:updated',
    STREAK_MILESTONE: 'streak:milestone',
    STREAK_FREEZE_USED: 'streak:freeze_used',
    STREAK_FREEZE_EARNED: 'streak:freeze_earned',
    STREAKS_RESET: 'streaks:reset',

    // UI events
    UI_RENDER: 'ui:render',
    UI_THEME_CHANGED: 'ui:theme:changed',
    UI_NOTIFICATION: 'ui:notification',

    // Data events
    DATA_SAVED: 'data:saved',
    DATA_LOADED: 'data:loaded',
    DATA_SYNCED: 'data:synced',
    DATA_ERROR: 'data:error',

    // App lifecycle
    APP_INIT: 'app:init',
    APP_READY: 'app:ready',
    APP_DESTROY: 'app:destroy'
};

export { EventBus };
