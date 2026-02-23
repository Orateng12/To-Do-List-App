/**
 * TaskMaster v3.0 - Main Application Entry Point
 * ===============================================
 * Enterprise-grade task management with advanced features
 */

import { eventBus, EVENTS } from './core/event-bus.js';
import { CommandManager } from './patterns/command.js';
import { SubtaskManager } from './features/subtasks.js';
import { RecurringTaskManager, RecurrencePresets, getRecurrenceDescription } from './features/recurring-tasks.js';
import { AnalyticsManager, AnalyticsDashboard } from './features/analytics.js';
import { QueryExecutor, query } from './features/query-language.js';
import { DragDropManager, VirtualScrollManager, HybridRenderer } from './features/dragdrop-virtualscroll.js';
import { pluginManager, PomodoroPlugin, TemplatesPlugin, FocusModePlugin } from './core/plugins.js';

// Storage
const DB_NAME = 'TaskMasterDB';
const DB_VERSION = 2;

class TaskMasterApp {
    constructor() {
        this.tasks = [];
        this.commandManager = null;
        this.subtaskManager = null;
        this.recurringManager = null;
        this.analyticsManager = null;
        this.queryExecutor = null;
        this.dragDropManager = null;
        this.virtualScroll = null;
        this.hybridRenderer = null;
        this.analyticsDashboard = null;
        this.db = null;
        this.worker = null;
        this.initialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('🚀 TaskMaster v3.0 initializing...');

        try {
            // Initialize IndexedDB
            await this.initIndexedDB();

            // Load tasks
            await this.loadTasks();

            // Initialize managers
            this.commandManager = new CommandManager(this);
            this.subtaskManager = new SubtaskManager(this);
            this.recurringManager = new RecurringTaskManager(this);
            this.analyticsManager = new AnalyticsManager(this);
            this.queryExecutor = new QueryExecutor(this);

            // Initialize UI components
            this.dragDropManager = new DragDropManager(this);
            this.hybridRenderer = new HybridRenderer(this);
            this.hybridRenderer.init();

            // Initialize analytics dashboard
            this.analyticsDashboard = new AnalyticsDashboard(this.analyticsManager);
            this.analyticsDashboard.init('#analyticsDashboard');

            // Initialize Web Worker for background processing
            this.initWorker();

            // Register plugins
            this.initPlugins();

            // Set up event handlers
            this.setupEventHandlers();

            // Process recurring tasks
            this.recurringManager.processRecurringTasks();

            // Initial render
            this.render();

            this.initialized = true;
            console.log('✅ TaskMaster v3.0 ready!', {
                tasks: this.tasks.length,
                plugins: pluginManager.getEnabled().length
            });

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            eventBus.emit(EVENTS.TOAST_SHOW, {
                message: 'Failed to initialize application',
                type: 'error'
            });
        }
    }

    /**
     * Initialize IndexedDB
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('tasks')) {
                    const store = db.createObjectStore('tasks', { keyPath: 'id' });
                    store.createIndex('completed', 'completed', { unique: false });
                    store.createIndex('priority', 'priority', { unique: false });
                    store.createIndex('dueDate', 'dueDate', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('isRecurring', 'isRecurring', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Load tasks from IndexedDB
     */
    async loadTasks() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();

            request.onsuccess = () => {
                this.tasks = request.result || [];
                resolve(this.tasks);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save tasks to IndexedDB
     */
    async saveTasks() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');

            store.clear();
            this.tasks.forEach(task => store.put(task));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Initialize Web Worker
     */
    initWorker() {
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker('js/workers/search-worker.js');
            
            this.worker.postMessage({
                type: 'INIT',
                payload: { tasks: this.tasks }
            });

            this.worker.onmessage = (e) => {
                const { type, results, stats } = e.data;
                
                switch (type) {
                    case 'SEARCH_RESULTS':
                        eventBus.emit(EVENTS.WORKER_SEARCH_RESULTS, results);
                        break;
                    case 'STATS_RESULTS':
                        eventBus.emit(EVENTS.WORKER_STATS_RESULTS, stats);
                        break;
                }
            };
        }
    }

    /**
     * Initialize plugins
     */
    initPlugins() {
        // Register built-in plugins
        pluginManager.register(new PomodoroPlugin());
        pluginManager.register(new TemplatesPlugin());
        pluginManager.register(new FocusModePlugin());

        // Enable all plugins by default
        pluginManager.getEnabled().forEach(plugin => {
            plugin.install(this);
        });
    }

    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        // Task changes trigger save
        eventBus.on(EVENTS.TASKS_CHANGED, () => {
            this.saveTasks();
            this.hybridRenderer.render();
            
            // Update worker
            if (this.worker) {
                this.worker.postMessage({
                    type: 'UPDATE_TASKS',
                    payload: { tasks: this.tasks }
                });
            }
        });

        // Form submission
        document.getElementById('taskForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTaskFromForm();
        });

        // Task list interactions
        document.getElementById('tasksContainer')?.addEventListener('click', (e) => {
            this.handleTaskClick(e);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // Search with query language
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value;
                if (query.startsWith(':')) {
                    // Advanced query mode
                    const advancedQuery = query.substring(1);
                    const result = this.queryExecutor.execute(advancedQuery);
                    eventBus.emit(EVENTS.QUERY_EXECUTED, result);
                }
            });
        }

        // Analytics refresh
        eventBus.on(EVENTS.TASKS_CHANGED, () => {
            if (this.analyticsManager) {
                const analytics = this.analyticsManager.getAnalytics();
                eventBus.emit(EVENTS.ANALYTICS_UPDATED, { stats: analytics });
            }
        });
    }

    /**
     * Add task from form
     */
    addTaskFromForm() {
        const taskInput = document.getElementById('taskInput');
        const prioritySelect = document.getElementById('prioritySelect');
        const dueDateInput = document.getElementById('dueDateInput');
        const categoryInput = document.getElementById('categoryInput');

        if (!taskInput.value.trim()) {
            eventBus.emit(EVENTS.TOAST_SHOW, {
                message: 'Please enter a task description',
                type: 'warning'
            });
            return;
        }

        const categories = categoryInput?.value
            ? categoryInput.value.split(',').map(c => c.trim().toLowerCase()).filter(Boolean)
            : [];

        const task = {
            id: this.generateId(),
            text: taskInput.value.trim(),
            completed: false,
            priority: prioritySelect?.value || 'medium',
            dueDate: dueDateInput?.value || '',
            createdAt: new Date().toISOString(),
            categories,
            subtasks: [],
            notes: '',
            tags: [],
            order: this.tasks.length
        };

        this.commandManager.addTask(task);
        this.saveTasks();

        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: 'Task added!',
            type: 'success'
        });

        taskInput.value = '';
    }

    /**
     * Handle task card clicks
     */
    handleTaskClick(e) {
        const card = e.target.closest('.task-card');
        if (!card) return;

        const taskId = card.dataset.taskId;
        const action = e.target.dataset.action;

        switch (action) {
            case 'toggle':
                this.commandManager.toggleTask(taskId);
                this.saveTasks();
                break;
            case 'delete':
                this.commandManager.deleteTask(taskId);
                this.saveTasks();
                break;
            case 'edit':
                this.openEditModal(taskId);
                break;
            case 'toggleSubtask':
                const subtaskId = e.target.closest('.subtask-item')?.dataset.subtaskId;
                if (subtaskId) {
                    this.subtaskManager.toggleSubtask(taskId, subtaskId);
                    this.saveTasks();
                }
                break;
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        // Ctrl+Z - Undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (this.commandManager.undo()) {
                this.saveTasks();
                eventBus.emit(EVENTS.TOAST_SHOW, { message: 'Undo', type: 'info' });
            }
        }

        // Ctrl+Shift+Z or Ctrl+Y - Redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            if (this.commandManager.redo()) {
                this.saveTasks();
                eventBus.emit(EVENTS.TOAST_SHOW, { message: 'Redo', type: 'info' });
            }
        }

        // Ctrl+/ - Show help
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            this.showKeyboardHelp();
        }
    }

    /**
     * Open edit modal
     */
    openEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const modal = document.getElementById('editModal');
        if (!modal) return;

        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskInput').value = task.text;
        document.getElementById('editPrioritySelect').value = task.priority;
        document.getElementById('editDueDateInput').value = task.dueDate || '';

        modal.classList.add('visible');
    }

    /**
     * Render tasks
     */
    render() {
        this.hybridRenderer.render();
        this.updateCounts();
    }

    /**
     * Update task counts
     */
    updateCounts() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const active = total - completed;

        document.getElementById('countAll')!.textContent = total;
        document.getElementById('countActive')!.textContent = active;
        document.getElementById('countCompleted')!.textContent = completed;
        document.getElementById('totalTasks')!.textContent = total;
    }

    /**
     * Show keyboard help
     */
    showKeyboardHelp() {
        const shortcuts = `
            <div class="keyboard-help">
                <h3>⌨️ Keyboard Shortcuts</h3>
                <table>
                    <tr><td><kbd>Ctrl+N</kbd></td><td>New task</td></tr>
                    <tr><td><kbd>Ctrl+Z</kbd></td><td>Undo</td></tr>
                    <tr><td><kbd>Ctrl+Y</kbd></td><td>Redo</td></tr>
                    <tr><td><kbd>Ctrl+K</kbd></td><td>Search</td></tr>
                    <tr><td><kbd>Ctrl+/</kbd></td><td>This help</td></tr>
                    <tr><td><kbd>J/K</kbd></td><td>Navigate tasks</td></tr>
                    <tr><td><kbd>Enter</kbd></td><td>Toggle task</td></tr>
                    <tr><td><kbd>E</kbd></td><td>Edit task</td></tr>
                    <tr><td><kbd>Delete</kbd></td><td>Delete task</td></tr>
                </table>
                <p class="help-query">💡 Try advanced queries: <code>:priority = high AND overdue</code></p>
            </div>
        `;

        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: 'Press Ctrl+N to add a task',
            type: 'info'
        });
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Get all tasks
     */
    getAllTasks() {
        return this.tasks;
    }

    /**
     * Get filtered tasks
     */
    getFilteredTasks(filter = 'all') {
        switch (filter) {
            case 'active':
                return this.tasks.filter(t => !t.completed);
            case 'completed':
                return this.tasks.filter(t => t.completed);
            default:
                return this.tasks;
        }
    }

    /**
     * Save to history (for command pattern)
     */
    saveToHistory() {
        // Handled by CommandManager
    }
}

// Create and export app instance
export const app = new TaskMasterApp();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Expose for debugging
window.TaskMaster = app;
