/**
 * Rule Engine for Task Automation
 * =================================
 * Condition-action rules with priority and conflict resolution
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Rule Definition
 */
export class Rule {
    constructor(name, options = {}) {
        this.id = this.generateId();
        this.name = name;
        this.description = options.description || '';
        this.priority = options.priority || 0;
        this.enabled = options.enabled ?? true;
        this.conditions = options.conditions || [];
        this.actions = options.actions || [];
        this.metadata = options.metadata || {};
        this.triggerCount = 0;
        this.lastTriggered = null;
    }

    generateId() {
        return `rule_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Add condition
     */
    when(conditionFn) {
        this.conditions.push(conditionFn);
        return this;
    }

    /**
     * Add action
     */
    then(actionFn) {
        this.actions.push(actionFn);
        return this;
    }

    /**
     * Check if all conditions match
     */
    matches(context) {
        if (!this.enabled) return false;
        return this.conditions.every(condition => condition(context));
    }

    /**
     * Execute all actions
     */
    async execute(context) {
        this.triggerCount++;
        this.lastTriggered = Date.now();

        const results = [];
        for (const action of this.actions) {
            try {
                const result = await action(context);
                results.push({ success: true, result });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Serialize rule
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            priority: this.priority,
            enabled: this.enabled,
            conditionCount: this.conditions.length,
            actionCount: this.actions.length,
            triggerCount: this.triggerCount,
            lastTriggered: this.lastTriggered
        };
    }
}

/**
 * Condition Builders
 */
export const Conditions = {
    // Task property conditions
    hasPriority: (priority) => (task) => task.priority === priority,
    hasAnyPriority: (priorities) => (task) => priorities.includes(task.priority),
    isOverdue: () => (task) => {
        if (!task.dueDate || task.completed) return false;
        return new Date(task.dueDate) < new Date();
    },
    isDueToday: () => (task) => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate).toDateString() === new Date().toDateString();
    },
    isDueTomorrow: () => (task) => {
        if (!task.dueDate) return false;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return new Date(task.dueDate).toDateString() === tomorrow.toDateString();
    },
    isDueThisWeek: () => (task) => {
        if (!task.dueDate) return false;
        const now = new Date();
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const dueDate = new Date(task.dueDate);
        return dueDate >= now && dueDate <= weekFromNow;
    },
    hasCategory: (category) => (task) => {
        return task.categories?.includes(category) || false;
    },
    hasAnyCategory: (categories) => (task) => {
        return categories.some(cat => task.categories?.includes(cat)) || false;
    },
    hasSubtasks: () => (task) => {
        return task.subtasks && task.subtasks.length > 0;
    },
    allSubtasksComplete: () => (task) => {
        if (!task.subtasks || task.subtasks.length === 0) return false;
        return task.subtasks.every(s => s.completed);
    },
    someSubtasksComplete: () => (task) => {
        if (!task.subtasks || task.subtasks.length === 0) return false;
        return task.subtasks.some(s => s.completed);
    },
    textContains: (text) => (task) => {
        return task.text.toLowerCase().includes(text.toLowerCase());
    },
    textMatches: (regex) => (task) => {
        return regex.test(task.text);
    },
    isCompleted: () => (task) => task.completed,
    isNotCompleted: () => (task) => !task.completed,
    createdAfter: (date) => (task) => new Date(task.createdAt) > new Date(date),
    createdBefore: (date) => (task) => new Date(task.createdAt) < new Date(date),
    modifiedAfter: (date) => (task) => new Date(task.updatedAt) > new Date(date),
    
    // Compound conditions
    and: (...conditions) => (task) => conditions.every(c => c(task)),
    or: (...conditions) => (task) => conditions.some(c => c(task)),
    not: (condition) => (task) => !condition(task),
    
    // Custom condition
    custom: (fn) => fn
};

/**
 * Action Builders
 */
export const Actions = {
    // Task modification actions
    setPriority: (priority) => async (task, api) => {
        await api.updateTask(task.id, { priority });
        return { action: 'setPriority', taskId: task.id, priority };
    },
    addCategory: (category) => async (task, api) => {
        const categories = [...(task.categories || []), category];
        await api.updateTask(task.id, { categories });
        return { action: 'addCategory', taskId: task.id, category };
    },
    removeCategory: (category) => async (task, api) => {
        const categories = (task.categories || []).filter(c => c !== category);
        await api.updateTask(task.id, { categories });
        return { action: 'removeCategory', taskId: task.id, category };
    },
    setDueDate: (dueDate) => async (task, api) => {
        await api.updateTask(task.id, { dueDate });
        return { action: 'setDueDate', taskId: task.id, dueDate };
    },
    extendDueDate: (days) => async (task, api) => {
        const currentDue = task.dueDate ? new Date(task.dueDate) : new Date();
        currentDue.setDate(currentDue.getDate() + days);
        await api.updateTask(task.id, { dueDate: currentDue.toISOString().split('T')[0] });
        return { action: 'extendDueDate', taskId: task.id, days };
    },
    markComplete: () => async (task, api) => {
        await api.completeTask(task.id);
        return { action: 'markComplete', taskId: task.id };
    },
    markIncomplete: () => async (task, api) => {
        await api.uncompleteTask(task.id);
        return { action: 'markIncomplete', taskId: task.id };
    },
    addNote: (note) => async (task, api) => {
        const notes = task.notes ? `${task.notes}\n${note}` : note;
        await api.updateTask(task.id, { notes });
        return { action: 'addNote', taskId: task.id, note };
    },
    
    // Notification actions
    notify: (message) => async (task, api) => {
        eventBus.emit(EVENTS.TOAST_SHOW, { message, type: 'info' });
        return { action: 'notify', message };
    },
    notifySuccess: (message) => async (task, api) => {
        eventBus.emit(EVENTS.TOAST_SHOW, { message, type: 'success' });
        return { action: 'notifySuccess', message };
    },
    notifyWarning: (message) => async (task, api) => {
        eventBus.emit(EVENTS.TOAST_SHOW, { message, type: 'warning' });
        return { action: 'notifyWarning', message };
    },
    
    // Task creation actions
    createSubtask: (text) => async (task, api) => {
        await api.addSubtask(task.id, text);
        return { action: 'createSubtask', taskId: task.id, text };
    },
    createRelatedTask: (text, options = {}) => async (task, api) => {
        const newTask = {
            text,
            ...options,
            categories: [...(task.categories || []), ...(options.categories || [])]
        };
        await api.createTask(newTask);
        return { action: 'createRelatedTask', text, options };
    },
    
    // External actions
    log: (message) => async (task, api) => {
        console.log(`[Rule Engine] ${message}`, { task });
        return { action: 'log', message };
    },
    webhook: (url, dataFn) => async (task, api) => {
        const data = dataFn ? dataFn(task) : { task };
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return { action: 'webhook', url };
    },
    
    // Custom action
    custom: (fn) => fn
};

/**
 * Rule Engine - Manages and executes rules
 */
export class RuleEngine {
    constructor() {
        this.rules = [];
        this.api = null;
        this.isProcessing = false;
        this.executionLog = [];
        this.subscriptions = [];
    }

    /**
     * Set task API
     */
    setTaskApi(api) {
        this.api = api;
        return this;
    }

    /**
     * Add a rule
     */
    addRule(rule) {
        this.rules.push(rule);
        // Sort by priority (higher first)
        this.rules.sort((a, b) => b.priority - a.priority);
        return this;
    }

    /**
     * Create and add a rule
     */
    createRule(name, options = {}) {
        const rule = new Rule(name, options);
        return this.addRule(rule);
    }

    /**
     * Remove a rule
     */
    removeRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
    }

    /**
     * Enable a rule
     */
    enableRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) rule.enabled = true;
    }

    /**
     * Disable a rule
     */
    disableRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) rule.enabled = false;
    }

    /**
     * Process a task through all rules
     */
    async processTask(task) {
        if (!this.api) {
            throw new Error('Task API not set');
        }

        if (this.isProcessing) {
            return { skipped: true, reason: 'Already processing' };
        }

        this.isProcessing = true;
        const results = [];

        try {
            const context = { task, timestamp: Date.now() };
            const matchingRules = this.rules.filter(rule => rule.matches(context));

            for (const rule of matchingRules) {
                try {
                    const actionResults = await rule.execute({
                        ...context,
                        api: this.api
                    });
                    
                    results.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        actions: actionResults
                    });

                    this.logExecution(rule.id, task.id, actionResults);
                } catch (error) {
                    console.error(`Rule "${rule.name}" failed:`, error);
                    results.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        error: error.message
                    });
                }
            }
        } finally {
            this.isProcessing = false;
        }

        return { processed: true, results };
    }

    /**
     * Process all tasks
     */
    async processAllTasks(tasks) {
        const results = [];
        for (const task of tasks) {
            const result = await this.processTask(task);
            results.push({ taskId: task.id, ...result });
        }
        return results;
    }

    /**
     * Log execution
     */
    logExecution(ruleId, taskId, actionResults) {
        this.executionLog.push({
            ruleId,
            taskId,
            timestamp: Date.now(),
            actionResults
        });

        // Keep log size manageable
        if (this.executionLog.length > 1000) {
            this.executionLog = this.executionLog.slice(-500);
        }
    }

    /**
     * Get execution log
     */
    getExecutionLog(limit = 100) {
        return this.executionLog.slice(-limit);
    }

    /**
     * Get all rules
     */
    getRules() {
        return this.rules.map(r => r.toJSON());
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalRules: this.rules.length,
            enabledRules: this.rules.filter(r => r.enabled).length,
            totalExecutions: this.executionLog.length,
            rulesByTrigger: this.rules.map(r => ({
                name: r.name,
                triggerCount: r.triggerCount,
                lastTriggered: r.lastTriggered
            }))
        };
    }

    /**
     * Clear execution log
     */
    clearLog() {
        this.executionLog = [];
    }

    /**
     * Auto-setup common automation rules
     */
    setupDefaultRules() {
        // Rule: Auto-prioritize overdue high-priority tasks
        this.createRule('Overdue High Priority Alert', {
            priority: 10,
            description: 'Alert when high priority task is overdue'
        })
        .when(Conditions.and(
            Conditions.hasPriority('high'),
            Conditions.isOverdue(),
            Conditions.isNotCompleted()
        ))
        .then(Actions.notifyWarning('High priority task is overdue!'));

        // Rule: Auto-complete when all subtasks done
        this.createRule('Auto-complete with Subtasks', {
            priority: 5,
            description: 'Mark task complete when all subtasks are done'
        })
        .when(Conditions.allSubtasksComplete())
        .then(Actions.markComplete())
        .then(Actions.notifySuccess('Task auto-completed (all subtasks done)'));

        // Rule: Extend due date for overdue tasks
        this.createRule('Extend Overdue Tasks', {
            priority: 3,
            description: 'Add 1 day to overdue tasks'
        })
        .when(Conditions.and(
            Conditions.isOverdue(),
            Conditions.isNotCompleted()
        ))
        .then(Actions.extendDueDate(1))
        .then(Actions.log('Extended overdue task by 1 day'));

        // Rule: Add "urgent" category for tasks due today
        this.createRule('Tag Today Tasks', {
            priority: 7,
            description: 'Add urgent category to tasks due today'
        })
        .when(Conditions.isDueToday())
        .then(Actions.addCategory('urgent'));

        // Rule: Create review subtask for high priority
        this.createRule('High Priority Review', {
            priority: 4,
            description: 'Add review subtask for high priority tasks'
        })
        .when(Conditions.hasPriority('high'))
        .then(Actions.createSubtask('Review before submission'));

        return this;
    }

    /**
     * Subscribe to task events for automatic processing
     */
    subscribeToEvents() {
        const subscription = eventBus.on(EVENTS.TASK_UPDATED, (data) => {
            if (data.task) {
                this.processTask(data.task);
            }
        });
        
        this.subscriptions.push(subscription);
        return () => {
            this.subscriptions.forEach(unsub => unsub());
            this.subscriptions = [];
        };
    }
}

/**
 * Create rule engine with default setup
 */
export function createRuleEngine(api) {
    const engine = new RuleEngine();
    engine.setTaskApi(api);
    engine.setupDefaultRules();
    return engine;
}
