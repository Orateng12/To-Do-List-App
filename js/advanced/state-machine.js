/**
 * State Machine for Task Workflows
 * ==================================
 * Finite State Machine with guards, actions, and transitions
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Task States
 */
export const TaskState = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    IN_PROGRESS: 'in_progress',
    BLOCKED: 'blocked',
    REVIEW: 'review',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
    DELETED: 'deleted'
};

/**
 * Task Events (triggers)
 */
export const TaskEvent = {
    CREATE: 'create',
    START: 'start',
    PROGRESS: 'progress',
    BLOCK: 'block',
    UNBLOCK: 'unblock',
    SUBMIT_REVIEW: 'submit_review',
    APPROVE: 'approve',
    REJECT: 'reject',
    COMPLETE: 'complete',
    REOPEN: 'reopen',
    ARCHIVE: 'archive',
    UNARCHIVE: 'unarchive',
    DELETE: 'delete',
    RESTORE: 'restore'
};

/**
 * State Machine Configuration
 */
export class StateMachineConfig {
    constructor() {
        this.states = new Map();
        this.transitions = [];
        this.guards = new Map();
        this.actions = new Map();
    }

    /**
     * Define a state
     */
    state(name, options = {}) {
        this.states.set(name, {
            name,
            initial: options.initial || false,
            final: options.final || false,
            entry: options.entry || null,
            exit: options.exit || null,
            metadata: options.metadata || {}
        });
        return this;
    }

    /**
     * Define a transition
     */
    transition(from, event, to, options = {}) {
        this.transitions.push({
            from,
            event,
            to,
            guard: options.guard || null,
            action: options.action || null,
            metadata: options.metadata || {}
        });
        return this;
    }

    /**
     * Register a guard function
     */
    guard(name, fn) {
        this.guards.set(name, fn);
        return this;
    }

    /**
     * Register an action function
     */
    action(name, fn) {
        this.actions.set(name, fn);
        return this;
    }
}

/**
 * State Machine Instance
 */
export class StateMachine {
    constructor(config, context = {}) {
        this.config = config;
        this.currentState = null;
        this.context = context;
        this.history = [];
        this.listeners = new Set();

        // Find initial state
        const initialState = Array.from(config.states.values()).find(s => s.initial);
        if (initialState) {
            this.currentState = initialState.name;
        }
    }

    /**
     * Get current state
     */
    getState() {
        return this.currentState;
    }

    /**
     * Check if in specific state
     */
    isInState(state) {
        return this.currentState === state;
    }

    /**
     * Check if can fire event
     */
    can(event) {
        const transition = this.findTransition(event);
        if (!transition) return false;

        // Check guard
        if (transition.guard) {
            const guardFn = this.config.guards.get(transition.guard);
            if (guardFn && !guardFn(this.context, this.currentState)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Fire an event
     */
    async fire(event, data = {}) {
        const transition = this.findTransition(event);
        
        if (!transition) {
            throw new Error(`No transition for event "${event}" from state "${this.currentState}"`);
        }

        // Check guard
        if (transition.guard) {
            const guardFn = this.config.guards.get(transition.guard);
            if (guardFn && !guardFn(this.context, this.currentState)) {
                throw new Error(`Guard "${transition.guard}" failed`);
            }
        }

        const fromState = this.currentState;

        // Exit action
        const fromStateDef = this.config.states.get(fromState);
        if (fromStateDef && fromStateDef.exit) {
            const exitFn = this.config.actions.get(fromStateDef.exit);
            if (exitFn) await exitFn(this.context, data);
        }

        // Transition action
        if (transition.action) {
            const actionFn = this.config.actions.get(transition.action);
            if (actionFn) await actionFn(this.context, data);
        }

        // Update state
        this.currentState = transition.to;

        // Entry action
        const toStateDef = this.config.states.get(transition.to);
        if (toStateDef && toStateDef.entry) {
            const entryFn = this.config.actions.get(toStateDef.entry);
            if (entryFn) await entryFn(this.context, data);
        }

        // Record history
        this.history.push({
            from: fromState,
            event,
            to: this.currentState,
            timestamp: Date.now(),
            data
        });

        // Notify listeners
        this.notify({
            type: 'transition',
            from: fromState,
            event,
            to: this.currentState,
            data
        });

        eventBus.emit(EVENTS.STATE_CHANGED, {
            state: this.currentState,
            event,
            context: this.context
        });

        return this.currentState;
    }

    /**
     * Find applicable transition
     */
    findTransition(event) {
        return this.config.transitions.find(
            t => t.from === this.currentState && t.event === event
        );
    }

    /**
     * Get available events
     */
    getAvailableEvents() {
        return this.config.transitions
            .filter(t => t.from === this.currentState)
            .map(t => t.event);
    }

    /**
     * Get state history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify listeners
     */
    notify(data) {
        this.listeners.forEach(cb => {
            try {
                cb(data);
            } catch (error) {
                console.error('State machine listener error:', error);
            }
        });
    }

    /**
     * Get state info
     */
    getInfo() {
        const stateDef = this.config.states.get(this.currentState);
        return {
            state: this.currentState,
            isFinal: stateDef?.final || false,
            availableEvents: this.getAvailableEvents(),
            historyLength: this.history.length,
            context: this.context
        };
    }
}

/**
 * Task State Machine Factory
 */
export function createTaskStateMachine(taskData = {}) {
    const config = new StateMachineConfig();

    // Define states
    config
        .state(TaskState.DRAFT, { initial: true })
        .state(TaskState.ACTIVE)
        .state(TaskState.IN_PROGRESS)
        .state(TaskState.BLOCKED)
        .state(TaskState.REVIEW)
        .state(TaskState.COMPLETED, { final: true })
        .state(TaskState.ARCHIVED)
        .state(TaskState.DELETED, { final: true });

    // Define transitions
    config
        // From DRAFT
        .transition(TaskState.DRAFT, TaskEvent.START, TaskState.ACTIVE)
        .transition(TaskState.DRAFT, TaskEvent.DELETE, TaskState.DELETED)
        
        // From ACTIVE
        .transition(TaskState.ACTIVE, TaskEvent.PROGRESS, TaskState.IN_PROGRESS)
        .transition(TaskState.ACTIVE, TaskEvent.BLOCK, TaskState.BLOCKED)
        .transition(TaskState.ACTIVE, TaskEvent.COMPLETE, TaskState.COMPLETED)
        .transition(TaskState.ACTIVE, TaskEvent.ARCHIVE, TaskState.ARCHIVED)
        .transition(TaskState.ACTIVE, TaskEvent.DELETE, TaskState.DELETED)
        
        // From IN_PROGRESS
        .transition(TaskState.IN_PROGRESS, TaskEvent.BLOCK, TaskState.BLOCKED)
        .transition(TaskState.IN_PROGRESS, TaskEvent.SUBMIT_REVIEW, TaskState.REVIEW)
        .transition(TaskState.IN_PROGRESS, TaskEvent.COMPLETE, TaskState.COMPLETED)
        .transition(TaskState.IN_PROGRESS, TaskEvent.ARCHIVE, TaskState.ARCHIVED)
        
        // From BLOCKED
        .transition(TaskState.BLOCKED, TaskEvent.UNBLOCK, TaskState.ACTIVE)
        .transition(TaskState.BLOCKED, TaskEvent.DELETE, TaskState.DELETED)
        
        // From REVIEW
        .transition(TaskState.REVIEW, TaskEvent.APPROVE, TaskState.COMPLETED)
        .transition(TaskState.REVIEW, TaskEvent.REJECT, TaskState.IN_PROGRESS)
        
        // From COMPLETED
        .transition(TaskState.COMPLETED, TaskEvent.REOPEN, TaskState.ACTIVE)
        .transition(TaskState.COMPLETED, TaskEvent.ARCHIVE, TaskState.ARCHIVED)
        
        // From ARCHIVED
        .transition(TaskState.ARCHIVED, TaskEvent.UNARCHIVE, TaskState.ACTIVE)
        .transition(TaskState.ARCHIVED, TaskEvent.DELETE, TaskState.DELETED)
        
        // From DELETED (restore)
        .transition(TaskState.DELETED, TaskEvent.RESTORE, TaskState.DRAFT);

    // Define guards
    config
        .guard('hasPermission', (context) => {
            return context.user?.role === 'admin' || context.user?.id === context.ownerId;
        })
        .guard('hasSubtasks', (context) => {
            return context.subtasks && context.subtasks.length > 0;
        })
        .guard('allSubtasksComplete', (context) => {
            return context.subtasks?.every(s => s.completed) || false;
        })
        .guard('notOverdue', (context) => {
            if (!context.dueDate) return true;
            return new Date(context.dueDate) >= new Date();
        });

    // Define actions
    config
        .action('notifyStart', (context) => {
            eventBus.emit(EVENTS.TASK_STARTED, { taskId: context.id });
        })
        .action('notifyComplete', (context) => {
            eventBus.emit(EVENTS.TASK_COMPLETED, { 
                taskId: context.id,
                completedAt: new Date().toISOString()
            });
        })
        .action('notifyBlock', (context, data) => {
            eventBus.emit(EVENTS.TASK_BLOCKED, { 
                taskId: context.id,
                reason: data.reason
            });
        })
        .action('setCompletedAt', (context) => {
            context.completedAt = new Date().toISOString();
        })
        .action('logTransition', (context, data) => {
            console.log(`Task ${context.id}: ${data.from} -> ${data.to}`);
        });

    // Create state machine with context
    const context = {
        id: taskData.id,
        ownerId: taskData.ownerId,
        subtasks: taskData.subtasks || [],
        dueDate: taskData.dueDate,
        user: taskData.user,
        ...taskData
    };

    return new StateMachine(config, context);
}

/**
 * State Machine Manager - Manages multiple state machines
 */
export class StateMachineManager {
    constructor() {
        this.machines = new Map();
    }

    /**
     * Create and register a state machine
     */
    create(taskId, taskData) {
        const machine = createTaskStateMachine(taskData);
        this.machines.set(taskId, machine);
        return machine;
    }

    /**
     * Get state machine for task
     */
    get(taskId) {
        return this.machines.get(taskId);
    }

    /**
     * Get state for task
     */
    getState(taskId) {
        const machine = this.machines.get(taskId);
        return machine ? machine.getState() : null;
    }

    /**
     * Fire event on task state machine
     */
    async fire(taskId, event, data) {
        const machine = this.machines.get(taskId);
        if (!machine) {
            throw new Error(`No state machine for task ${taskId}`);
        }
        return await machine.fire(event, data);
    }

    /**
     * Get all states
     */
    getAllStates() {
        const states = {};
        this.machines.forEach((machine, taskId) => {
            states[taskId] = machine.getState();
        });
        return states;
    }

    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            total: this.machines.size,
            byState: {}
        };

        this.machines.forEach(machine => {
            const state = machine.getState();
            stats.byState[state] = (stats.byState[state] || 0) + 1;
        });

        return stats;
    }
}

// Export singleton manager
export const stateMachineManager = new StateMachineManager();
