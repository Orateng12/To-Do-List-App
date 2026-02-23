/**
 * Event Bus - Pub/Sub Pattern Implementation
 * ===========================================
 * Decouples components through custom event system
 */

class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.events.has(event)) return;
        
        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
        
        // Clean up if no more listeners
        if (callbacks.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (!this.events.has(event)) return;
        
        this.events.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for "${event}":`, error);
            }
        });
    }

    /**
     * Subscribe to an event once (auto-unsubscribe after first trigger)
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name (optional, removes all if not provided)
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    listenerCount(event) {
        if (!this.events.has(event)) return 0;
        return this.events.get(event).length;
    }
}

// Export singleton instance
export const eventBus = new EventBus();

// Event constants for type safety
export const EVENTS = {
    // Task events
    TASK_ADDED: 'task:added',
    TASK_DELETED: 'task:deleted',
    TASK_UPDATED: 'task:updated',
    TASK_TOGGLED: 'task:toggled',
    TASKS_CLEARED: 'tasks:cleared',
    
    // Filter events
    FILTER_CHANGED: 'filter:changed',
    SEARCH_CHANGED: 'search:changed',
    SORT_CHANGED: 'sort:changed',
    
    // UI events
    THEME_CHANGED: 'ui:themeChanged',
    TOAST_SHOW: 'ui:toastShow',
    MODAL_OPEN: 'ui:modalOpen',
    MODAL_CLOSE: 'ui:modalClose',
    
    // Storage events
    STORAGE_SAVED: 'storage:saved',
    STORAGE_LOADED: 'storage:loaded',
    STORAGE_ERROR: 'storage:error',
    
    // Undo/Redo events
    UNDO_AVAILABLE: 'undo:available',
    REDO_AVAILABLE: 'redo:available'
};
