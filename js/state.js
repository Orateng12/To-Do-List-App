/**
 * State Manager - Central State Management with Undo/Redo
 * ========================================================
 * Handles all task operations with history tracking
 */

import { eventBus, EVENTS } from './event-bus.js';

class StateManager {
    constructor() {
        this.tasks = [];
        this.history = [];
        this.historyIndex = -1;
        this.MAX_HISTORY = 50;
        
        // Current filter/sort state
        this.filter = 'all';
        this.searchQuery = '';
        this.sortBy = 'createdAt';
        this.sortOrder = 'desc';
        
        // Categories
        this.categories = [];
    }

    /**
     * Initialize state with tasks
     * @param {Array} tasks - Initial tasks array
     */
    init(tasks) {
        this.tasks = tasks;
        this.history = [JSON.stringify(tasks)];
        this.historyIndex = 0;
        this.extractCategories();
    }

    /**
     * Save state to history (for undo/redo)
     */
    saveToHistory() {
        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Add current state
        this.history.push(JSON.stringify(this.tasks));
        this.historyIndex++;

        // Limit history size
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
            this.historyIndex--;
        }

        this.emitUndoRedoEvents();
    }

    /**
     * Undo last action
     * @returns {boolean} Success status
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.tasks = JSON.parse(this.history[this.historyIndex]);
            this.extractCategories();
            this.emitUndoRedoEvents();
            eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'undo' });
            return true;
        }
        return false;
    }

    /**
     * Redo last undone action
     * @returns {boolean} Success status
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.tasks = JSON.parse(this.history[this.historyIndex]);
            this.extractCategories();
            this.emitUndoRedoEvents();
            eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'redo' });
            return true;
        }
        return false;
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Emit undo/redo availability events
     */
    emitUndoRedoEvents() {
        eventBus.emit(EVENTS.UNDO_AVAILABLE, { available: this.canUndo() });
        eventBus.emit(EVENTS.REDO_AVAILABLE, { available: this.canRedo() });
    }

    /**
     * Create a new task
     * @param {string} text - Task description
     * @param {Object} options - Task options
     * @returns {Object} Created task
     */
    createTask(text, options = {}) {
        const trimmedText = text.trim();
        if (!trimmedText) {
            throw new Error('Task description cannot be empty');
        }

        const task = {
            id: this.generateId(),
            text: trimmedText,
            completed: false,
            priority: options.priority || 'medium',
            dueDate: options.dueDate || '',
            recurrence: options.recurrence || 'none',
            createdAt: new Date().toISOString(),
            categories: options.categories || [],
            subtasks: options.subtasks || [],
            notes: options.notes || '',
            tags: options.tags || [],
            estimatedMinutes: options.estimatedMinutes || 0
        };

        return task;
    }

    /**
     * Add a task to the list
     * @param {string} text - Task description
     * @param {Object} options - Task options
     */
    addTask(text, options = {}) {
        const task = this.createTask(text, options);
        this.saveToHistory();
        this.tasks.unshift(task);
        eventBus.emit(EVENTS.TASK_ADDED, { task });
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'add' });
        this.extractCategories();
    }

    /**
     * Delete a task
     * @param {string} id - Task ID
     */
    deleteTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return null;

        this.saveToHistory();
        this.tasks = this.tasks.filter(t => t.id !== id);
        eventBus.emit(EVENTS.TASK_DELETED, { task, id });
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'delete' });
        this.extractCategories();
        
        return task;
    }

    /**
     * Toggle task completion
     * @param {string} id - Task ID
     */
    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        this.saveToHistory();
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;
        
        // Handle recurrence - create next instance when completing a recurring task
        if (task.completed && task.recurrence && task.recurrence !== 'none') {
            this.createNextRecurringTask(task);
        }
        
        eventBus.emit(EVENTS.TASK_TOGGLED, { task });
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'toggle' });
    }

    /**
     * Create the next instance of a recurring task
     * @param {Object} task - The completed task
     */
    createNextRecurringTask(task) {
        const newTask = {
            ...task,
            id: this.generateId(),
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
        };

        // Calculate next due date based on recurrence
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            switch (task.recurrence) {
                case 'daily':
                    dueDate.setDate(dueDate.getDate() + 1);
                    break;
                case 'weekly':
                    dueDate.setDate(dueDate.getDate() + 7);
                    break;
                case 'monthly':
                    dueDate.setMonth(dueDate.getMonth() + 1);
                    break;
                case 'yearly':
                    dueDate.setFullYear(dueDate.getFullYear() + 1);
                    break;
            }
            newTask.dueDate = dueDate.toISOString().split('T')[0];
        }

        // Insert after the current task
        const index = this.tasks.findIndex(t => t.id === task.id);
        this.tasks.splice(index + 1, 0, newTask);
    }

    /**
     * Update a task
     * @param {string} id - Task ID
     * @param {Object} updates - Fields to update
     */
    updateTask(id, updates) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        this.saveToHistory();
        Object.assign(task, updates);
        eventBus.emit(EVENTS.TASK_UPDATED, { task, updates });
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'update' });
        this.extractCategories();
    }

    /**
     * Add a subtask to a task
     * @param {string} taskId - Parent task ID
     * @param {string} text - Subtask text
     */
    addSubtask(taskId, text) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (!task.subtasks) {
            task.subtasks = [];
        }

        this.saveToHistory();
        task.subtasks.push({
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        });

        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'subtaskAdded' });
    }

    /**
     * Toggle subtask completion
     * @param {string} taskId - Parent task ID
     * @param {number} index - Subtask index
     */
    toggleSubtask(taskId, index) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || !task.subtasks[index]) return;

        this.saveToHistory();
        task.subtasks[index].completed = !task.subtasks[index].completed;

        // Auto-complete parent task if all subtasks are complete
        const allComplete = task.subtasks.every(s => s.completed);
        if (allComplete && !task.completed) {
            task.completed = true;
            task.completedAt = new Date().toISOString();
        }

        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'subtaskToggled' });
    }

    /**
     * Delete a subtask
     * @param {string} taskId - Parent task ID
     * @param {number} index - Subtask index
     */
    deleteSubtask(taskId, index) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || !task.subtasks[index]) return;

        this.saveToHistory();
        task.subtasks.splice(index, 1);

        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'subtaskDeleted' });
    }

    /**
     * Clear all completed tasks
     * @returns {Array} Deleted tasks
     */
    clearCompleted() {
        const completedTasks = this.tasks.filter(t => t.completed);
        if (completedTasks.length === 0) return [];

        this.saveToHistory();
        this.tasks = this.tasks.filter(t => !t.completed);
        eventBus.emit(EVENTS.TASKS_CLEARED, { tasks: completedTasks });
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'clearCompleted' });
        this.extractCategories();

        return completedTasks;
    }

    /**
     * Set filter
     * @param {string} filter - Filter type
     */
    setFilter(filter) {
        this.filter = filter;
        eventBus.emit(EVENTS.FILTER_CHANGED, { filter });
    }

    /**
     * Set search query
     * @param {string} query - Search query
     */
    setSearchQuery(query) {
        this.searchQuery = query.toLowerCase().trim();
        eventBus.emit(EVENTS.SEARCH_CHANGED, { query: this.searchQuery });
    }

    /**
     * Set sort options
     * @param {string} sortBy - Field to sort by
     * @param {string} order - Sort order (asc/desc)
     */
    setSort(sortBy, order = 'desc') {
        this.sortBy = sortBy;
        this.sortOrder = order;
        eventBus.emit(EVENTS.SORT_CHANGED, { sortBy, order });
    }

    /**
     * Get filtered and sorted tasks
     * @returns {Array} Filtered tasks
     */
    getFilteredTasks() {
        let filtered = [...this.tasks];

        // Apply filter
        if (this.filter === 'active') {
            filtered = filtered.filter(t => !t.completed);
        } else if (this.filter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        }

        // Apply search
        if (this.searchQuery) {
            filtered = filtered.filter(t => 
                t.text.toLowerCase().includes(this.searchQuery) ||
                t.categories.some(c => c.toLowerCase().includes(this.searchQuery)) ||
                (t.notes && t.notes.toLowerCase().includes(this.searchQuery))
            );
        }

        // Apply sort
        filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (this.sortBy) {
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
                    break;
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) comparison = 0;
                    else if (!a.dueDate) comparison = 1;
                    else if (!b.dueDate) comparison = -1;
                    else comparison = new Date(a.dueDate) - new Date(b.dueDate);
                    break;
                case 'createdAt':
                default:
                    comparison = new Date(b.createdAt) - new Date(a.createdAt);
            }

            return this.sortOrder === 'asc' ? -comparison : comparison;
        });

        return filtered;
    }

    /**
     * Get task statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const active = total - completed;
        const overdue = this.tasks.filter(t => 
            !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
        ).length;
        const highPriority = this.tasks.filter(t => 
            !t.completed && t.priority === 'high'
        ).length;

        return {
            total,
            completed,
            active,
            overdue,
            highPriority,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    /**
     * Extract unique categories from tasks
     */
    extractCategories() {
        const categorySet = new Set();
        this.tasks.forEach(task => {
            (task.categories || []).forEach(cat => categorySet.add(cat));
        });
        this.categories = Array.from(categorySet).sort();
        eventBus.emit(EVENTS.CATEGORIES_CHANGED, { categories: this.categories });
    }

    /**
     * Add a category
     * @param {string} category - Category name
     */
    addCategory(category) {
        const normalized = category.trim().toLowerCase();
        if (normalized && !this.categories.includes(normalized)) {
            this.categories.push(normalized);
            eventBus.emit(EVENTS.CATEGORIES_CHANGED, { categories: this.categories });
        }
    }

    /**
     * Remove a category from all tasks
     * @param {string} category - Category name
     */
    removeCategory(category) {
        this.saveToHistory();
        this.tasks.forEach(task => {
            task.categories = (task.categories || []).filter(c => c !== category);
        });
        this.categories = this.categories.filter(c => c !== category);
        eventBus.emit(EVENTS.CATEGORIES_CHANGED, { categories: this.categories });
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'categoryRemoved' });
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Get all tasks (for export)
     * @returns {Array} All tasks
     */
    getAllTasks() {
        return this.tasks;
    }

    /**
     * Replace all tasks (for import)
     * @param {Array} tasks - New tasks array
     */
    replaceAllTasks(tasks) {
        this.saveToHistory();
        this.tasks = tasks;
        this.extractCategories();
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'import' });
    }

    /**
     * Reorder tasks (drag and drop)
     * @param {string} draggedId - ID of dragged task
     * @param {string} targetId - ID of target task
     */
    reorderTasks(draggedId, targetId) {
        if (draggedId === targetId) return;

        const draggedIndex = this.tasks.findIndex(t => t.id === draggedId);
        const targetIndex = this.tasks.findIndex(t => t.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        this.saveToHistory();
        
        // Remove dragged task and insert at new position
        const [draggedTask] = this.tasks.splice(draggedIndex, 1);
        this.tasks.splice(targetIndex, 0, draggedTask);

        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks: this.tasks, reason: 'reorder' });
    }
}

// Export singleton instance
export const stateManager = new StateManager();
