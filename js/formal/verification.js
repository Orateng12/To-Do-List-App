/**
 * Formal Verification for State Transitions
 * ===========================================
 * Model checking and invariant verification
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Temporal Logic Operators (LTL - Linear Temporal Logic)
 */
export const LTL = {
    // X φ - Next (φ is true in the next state)
    next: (state, formula) => {
        if (!state.history || state.history.length < 2) return false;
        return formula(state.history[state.history.length - 2]);
    },

    // G φ - Globally (φ is always true)
    globally: (history, formula) => {
        return history.every(formula);
    },

    // F φ - Finally (φ is eventually true)
    finally: (history, formula) => {
        return history.some(formula);
    },

    // φ U ψ - Until (φ is true until ψ becomes true)
    until: (history, phi, psi) => {
        let phiHolds = true;
        for (const state of history) {
            if (psi(state)) return true;
            if (!phi(state)) {
                phiHolds = false;
                break;
            }
        }
        return phiHolds;
    },

    // φ W ψ - Weak Until (φ is true until ψ, or φ is always true)
    weakUntil: (history, phi, psi) => {
        for (const state of history) {
            if (psi(state)) return true;
            if (!phi(state)) return false;
        }
        return true;
    },

    // φ R ψ - Release (ψ is true until φ, or always)
    release: (history, phi, psi) => {
        for (let i = 0; i < history.length; i++) {
            if (phi(history[i])) return true;
            if (!psi(history[i])) return false;
        }
        return true;
    }
};

/**
 * Invariant Definition
 */
export class Invariant {
    constructor(name, condition, description = '') {
        this.name = name;
        this.condition = condition;
        this.description = description;
        this.violations = [];
    }

    /**
     * Check invariant against state
     */
    check(state) {
        try {
            const result = this.condition(state);
            if (!result) {
                this.violations.push({
                    timestamp: Date.now(),
                    state: JSON.parse(JSON.stringify(state))
                });
            }
            return result;
        } catch (error) {
            console.error(`Invariant ${this.name} error:`, error);
            return false;
        }
    }

    /**
     * Get violation count
     */
    getViolationCount() {
        return this.violations.length;
    }

    /**
     * Clear violations
     */
    clearViolations() {
        this.violations = [];
    }
}

/**
 * State Machine Verifier
 */
export class StateVerifier {
    constructor() {
        this.invariants = [];
        this.stateHistory = [];
        this.maxHistory = 1000;
        this.properties = {
            safety: [],  // Nothing bad happens
            liveness: [], // Something good eventually happens
            fairness: []  // Every request gets a response
        };
    }

    /**
     * Add invariant
     */
    addInvariant(name, condition, description = '') {
        const invariant = new Invariant(name, condition, description);
        this.invariants.push(invariant);
        return invariant;
    }

    /**
     * Add safety property (G φ - always true)
     */
    addSafetyProperty(name, formula, description = '') {
        this.properties.safety.push({ name, formula, description });
    }

    /**
     * Add liveness property (F φ - eventually true)
     */
    addLivenessProperty(name, formula, description = '') {
        this.properties.liveness.push({ name, formula, description });
    }

    /**
     * Record state
     */
    recordState(state) {
        const stateRecord = {
            ...state,
            timestamp: Date.now(),
            stateNumber: this.stateHistory.length
        };

        this.stateHistory.push(stateRecord);

        // Limit history size
        if (this.stateHistory.length > this.maxHistory) {
            this.stateHistory = this.stateHistory.slice(-this.maxHistory);
        }

        // Check invariants
        const violations = [];
        this.invariants.forEach(invariant => {
            if (!invariant.check(stateRecord)) {
                violations.push(invariant.name);
            }
        });

        if (violations.length > 0) {
            eventBus.emit(EVENTS.VERIFICATION_VIOLATION, {
                type: 'invariant',
                violations,
                state: stateRecord
            });
        }

        return stateRecord;
    }

    /**
     * Verify all invariants
     */
    verifyInvariants() {
        const results = {
            total: this.invariants.length,
            violated: 0,
            invariants: []
        };

        this.invariants.forEach(invariant => {
            const currentState = this.stateHistory[this.stateHistory.length - 1];
            const holds = invariant.check(currentState);
            
            results.invariants.push({
                name: invariant.name,
                description: invariant.description,
                holds,
                violationCount: invariant.getViolationCount()
            });

            if (!holds) {
                results.violated++;
            }
        });

        return results;
    }

    /**
     * Verify temporal properties
     */
    verifyTemporalProperties() {
        const results = {
            safety: [],
            liveness: [],
            fairness: []
        };

        // Verify safety properties (should always hold)
        this.properties.safety.forEach(prop => {
            const holds = LTL.globally(this.stateHistory, prop.formula);
            results.safety.push({
                name: prop.name,
                description: prop.description,
                holds
            });
        });

        // Verify liveness properties (should eventually hold)
        this.properties.liveness.forEach(prop => {
            const holds = LTL.finally(this.stateHistory, prop.formula);
            results.liveness.push({
                name: prop.name,
                description: prop.description,
                holds
            });
        });

        return results;
    }

    /**
     * Model checking - explore all possible states
     */
    async modelCheck(initialState, transitions, maxDepth = 10) {
        const visited = new Set();
        const violations = [];
        const paths = [];

        const stateKey = (state) => JSON.stringify(state);

        const explore = async (state, path, depth) => {
            if (depth > maxDepth) return;
            
            const key = stateKey(state);
            if (visited.has(key)) return;
            
            visited.add(key);
            path.push(state);

            // Check invariants
            this.invariants.forEach(invariant => {
                if (!invariant.check(state)) {
                    violations.push({
                        invariant: invariant.name,
                        path: [...path],
                        state
                    });
                }
            });

            // Get possible next states
            const nextStates = transitions(state);
            
            for (const nextState of nextStates) {
                await explore(nextState, [...path], depth + 1);
            }

            paths.push([...path]);
        };

        await explore(initialState, [], 0);

        return {
            statesExplored: visited.size,
            pathsFound: paths.length,
            violations,
            maxDepth
        };
    }

    /**
     * Deadlock detection
     */
    detectDeadlock(currentState, transitions) {
        const nextStates = transitions(currentState);
        
        if (nextStates.length === 0) {
            return {
                isDeadlock: true,
                state: currentState,
                timestamp: Date.now()
            };
        }

        return { isDeadlock: false };
    }

    /**
     * Livelock detection (cycle without progress)
     */
    detectLivelock(windowSize = 10) {
        if (this.stateHistory.length < windowSize) {
            return { isLivelock: false };
        }

        const recentStates = this.stateHistory.slice(-windowSize);
        const stateHashes = recentStates.map(s => JSON.stringify(s));
        
        // Check if all states in window are the same
        const allSame = stateHashes.every(h => h === stateHashes[0]);
        
        if (allSame) {
            return {
                isLivelock: true,
                state: recentStates[0],
                windowSize
            };
        }

        return { isLivelock: false };
    }

    /**
     * Generate verification report
     */
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            stateHistorySize: this.stateHistory.length,
            invariants: this.verifyInvariants(),
            temporalProperties: this.verifyTemporalProperties(),
            statistics: {
                maxHistory: this.maxHistory,
                invariantCount: this.invariants.length,
                safetyProperties: this.properties.safety.length,
                livenessProperties: this.properties.liveness.length
            }
        };
    }

    /**
     * Export verifier state
     */
    export() {
        return {
            invariants: this.invariants.map(i => ({
                name: i.name,
                description: i.description,
                violations: i.violations
            })),
            stateHistory: this.stateHistory,
            properties: this.properties
        };
    }
}

/**
 * Task State Verifier - Specialized for task workflows
 */
export class TaskStateVerifier extends StateVerifier {
    constructor() {
        super();
        this.setupDefaultInvariants();
    }

    /**
     * Setup default invariants for tasks
     */
    setupDefaultInvariants() {
        // Invariant: Completed tasks cannot be edited
        this.addInvariant(
            'completed_immutable',
            (state) => {
                if (state.task?.completed && state.action === 'UPDATE') {
                    return false;
                }
                return true;
            },
            'Completed tasks cannot be modified'
        );

        // Invariant: Priority must be valid
        this.addInvariant(
            'valid_priority',
            (state) => {
                const validPriorities = ['low', 'medium', 'high'];
                if (state.task?.priority && !validPriorities.includes(state.task.priority)) {
                    return false;
                }
                return true;
            },
            'Priority must be low, medium, or high'
        );

        // Invariant: Due date cannot be in the past for new tasks
        this.addInvariant(
            'valid_due_date',
            (state) => {
                if (state.action === 'CREATE' && state.task?.dueDate) {
                    const dueDate = new Date(state.task.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return dueDate >= today;
                }
                return true;
            },
            'New tasks cannot have past due dates'
        );

        // Invariant: Task text cannot be empty
        this.addInvariant(
            'non_empty_text',
            (state) => {
                if (state.task?.text && state.task.text.trim().length === 0) {
                    return false;
                }
                return true;
            },
            'Task text cannot be empty'
        );

        // Invariant: Subtasks completion rate <= 100%
        this.addInvariant(
            'valid_subtask_completion',
            (state) => {
                if (state.task?.subtasks) {
                    const completed = state.task.subtasks.filter(s => s.completed).length;
                    return completed <= state.task.subtasks.length;
                }
                return true;
            },
            'Subtask completion cannot exceed 100%'
        );
    }

    /**
     * Add safety properties
     */
    setupSafetyProperties() {
        // G (completed → ¬deletable)
        this.addSafetyProperty(
            'completed_protected',
            (state) => !(state.task?.completed && state.action === 'DELETE'),
            'Completed tasks cannot be deleted'
        );

        // G (priority_change → valid_priority)
        this.addSafetyProperty(
            'priority_validity',
            (state) => {
                if (state.action === 'SET_PRIORITY') {
                    return ['low', 'medium', 'high'].includes(state.newPriority);
                }
                return true;
            },
            'Priority changes must be valid'
        );
    }

    /**
     * Add liveness properties
     */
    setupLivenessProperties() {
        // F (created → (completed ∨ deleted))
        this.addLivenessProperty(
            'eventual_completion',
            (state) => state.task?.completed || state.task?.deleted,
            'Tasks eventually complete or delete'
        );
    }

    /**
     * Record task state transition
     */
    recordTaskTransition(taskId, action, oldState, newState) {
        return this.recordState({
            taskId,
            action,
            oldState,
            newState,
            timestamp: Date.now()
        });
    }
}

/**
 * Create task state verifier
 */
export function createTaskVerifier() {
    const verifier = new TaskStateVerifier();
    verifier.setupSafetyProperties();
    verifier.setupLivenessProperties();
    return verifier;
}
