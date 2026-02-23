/**
 * TaskMaster - Enterprise Edition
 * =================================
 * 
 * Architecture Patterns Implemented:
 * - Event Bus (Pub/Sub)
 * - Dependency Injection
 * - Command Pattern (Undo/Redo)
 * - Repository Pattern (Data Access)
 * - Web Workers (Background Processing)
 * - IndexedDB (Advanced Storage)
 * - Service Worker (PWA Offline)
 * - Observer Pattern (Reactive UI)
 * 
 * Features:
 * - Real-time analytics
 * - ML-based priority prediction
 * - Encrypted storage option
 * - Background sync
 * - Offline-first architecture
 */

// ============================================
// IMPORTS (ES Modules)
// ============================================
import { eventBus, AppEvents } from './core/event-bus.js';
import { container } from './core/di-container.js';
import { db } from './core/storage.js';
import { EnhancedUIController, EmptyStateManager, InlineEditManager } from './ui-enhanced.js';
import { SubtasksManager } from './features/subtasks.js';
import { RecurringTasksManager } from './features/recurring-tasks.js';
import { NotificationsManager } from './features/notifications.js';
import { StreaksManager } from './features/streaks.js';
import { SwipeActionsManager } from './features/swipe-actions.js';
import { DragDropManager } from './features/drag-drop.js';
import { NaturalLanguageParser } from './features/natural-language-parser.js';
import { AnalyticsEngine, DashboardRenderer } from './features/analytics.js';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    DEBOUNCE_DELAY: 150,
    ANIMATION_DURATION: 300,
    UNDO_TIMEOUT: 5000,
    UNDO_STACK_SIZE: 50,
    WORKER_ENABLED: true,
    ENCRYPTION_ENABLED: false,
    ANALYTICS_ENABLED: true
};

// ============================================
// WORKER MANAGER
// ============================================
class WorkerManager {
    constructor() {
        this.worker = null;
        this.pendingRequests = new Map();
        this.requestId = 0;
    }

    initialize() {
        if (CONFIG.WORKER_ENABLED && typeof Worker !== 'undefined') {
            this.worker = new Worker('/js/workers/task-worker.js');
            this.worker.onmessage = (e) => this._handleMessage(e);
            this.worker.onerror = (e) => console.error('[Worker] Error:', e);
            console.log('[Worker] Initialized');
        }
    }

    _handleMessage(e) {
        const { type, id, result, error, progress } = e.data;

        if (type === 'PROGRESS' && progress) {
            eventBus.emit('worker:progress', progress);
            return;
        }

        const pending = this.pendingRequests.get(id);
        if (pending) {
            this.pendingRequests.delete(id);
            if (type === 'ERROR') {
                pending.reject(new Error(error));
            } else {
                pending.resolve(result);
            }
        }
    }

    async send(type, payload) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, { resolve, reject, timestamp: Date.now() });

            this.worker.postMessage({ type, payload, id });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Worker request timeout'));
                }
            }, 30000);
        });
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

const workerManager = new WorkerManager();

// ============================================
// COMMAND HISTORY (Undo/Redo)
// ============================================
class CommandHistory {
    constructor(maxSize = CONFIG.UNDO_STACK_SIZE) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
    }

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = [];

        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }

        eventBus.emit('command:executed', { 
            command: command.name, 
            undoCount: this.undoStack.length 
        });
    }

    undo() {
        const command = this.undoStack.pop();
        if (!command) return false;
        command.undo();
        this.redoStack.push(command);
        eventBus.emit('command:undone', { redoCount: this.redoStack.length });
        return true;
    }

    redo() {
        const command = this.redoStack.pop();
        if (!command) return false;
        command.execute();
        this.undoStack.push(command);
        eventBus.emit('command:redone', { undoCount: this.undoStack.length });
        return true;
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

const commandHistory = new CommandHistory();

// ============================================
// REPOSITORY PATTERN
// ============================================
class TaskRepository {
    constructor() {
        this.memoryCache = new Map();
        this.useIndexedDB = true;
    }

    async initialize() {
        if (this.useIndexedDB) {
            try {
                await db.open();
                console.log('[Repository] IndexedDB initialized');
            } catch (e) {
                console.warn('[Repository] IndexedDB not available, using memory storage');
                this.useIndexedDB = false;
            }
        }
    }

    async getAll() {
        if (this.useIndexedDB) {
            const tasks = await db.getAllTasks();
            tasks.forEach(t => this.memoryCache.set(t.id, t));
            return tasks;
        }
        return Array.from(this.memoryCache.values());
    }

    async getById(id) {
        if (this.memoryCache.has(id)) {
            return this.memoryCache.get(id);
        }

        if (this.useIndexedDB) {
            const task = await db.getTask(id);
            if (task) {
                this.memoryCache.set(id, task);
            }
            return task;
        }

        return null;
    }

    async save(task) {
        this.memoryCache.set(task.id, task);

        if (this.useIndexedDB) {
            await db.saveTask(task);
        }

        eventBus.emit(AppEvents.TASK_UPDATED, { task });
        return task;
    }

    async create(taskData) {
        const task = {
            id: this._generateId(),
            ...taskData,
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: null
        };

        this.memoryCache.set(task.id, task);

        if (this.useIndexedDB) {
            await db.saveTask(task);
        }

        eventBus.emit(AppEvents.TASK_CREATED, { task });
        return task;
    }

    async delete(id) {
        const task = this.memoryCache.get(id);
        this.memoryCache.delete(id);

        if (this.useIndexedDB) {
            await db.deleteTask(id);
        }

        eventBus.emit(AppEvents.TASK_DELETED, { task, id });
        return task;
    }

    async query(filters = {}) {
        if (this.useIndexedDB) {
            return db.queryTasks(filters);
        }

        let results = Array.from(this.memoryCache.values());

        if (filters.completed !== undefined) {
            results = results.filter(t => t.completed === filters.completed);
        }
        if (filters.priority) {
            results = results.filter(t => t.priority === filters.priority);
        }
        if (filters.search) {
            const query = filters.search.toLowerCase();
            results = results.filter(t => t.text.toLowerCase().includes(query));
        }

        return results;
    }

    async bulkSave(tasks) {
        if (this.useIndexedDB) {
            await db.saveTasksBatch(tasks);
        }
        tasks.forEach(t => this.memoryCache.set(t.id, t));
        eventBus.emit(AppEvents.DATA_SAVED, { count: tasks.length });
    }

    async clear() {
        this.memoryCache.clear();
        if (this.useIndexedDB) {
            await db.clearTasks();
        }
        eventBus.emit(AppEvents.DATA_SYNCED, { action: 'clear' });
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

const taskRepository = new TaskRepository();

// ============================================
// ANALYTICS SERVICE
// ============================================
class AnalyticsService {
    constructor() {
        this.stats = null;
        this.lastCalculated = null;
    }

    async calculate(tasks) {
        if (CONFIG.WORKER_ENABLED && workerManager.worker) {
            try {
                this.stats = await workerManager.send('CALCULATE_ANALYTICS', { tasks });
            } catch (e) {
                this.stats = this._calculateLocal(tasks);
            }
        } else {
            this.stats = this._calculateLocal(tasks);
        }

        this.lastCalculated = Date.now();
        eventBus.emit('analytics:updated', this.stats);
        return this.stats;
    }

    _calculateLocal(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        
        const priorityDist = {
            low: tasks.filter(t => t.priority === 'low').length,
            medium: tasks.filter(t => t.priority === 'medium').length,
            high: tasks.filter(t => t.priority === 'high').length
        };

        const now = Date.now();
        const overdue = tasks.filter(t => 
            !t.completed && t.dueDate && new Date(t.dueDate).getTime() < now
        ).length;

        return {
            total,
            completed,
            active,
            overdue,
            completionRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
            priorityDistribution: priorityDist,
            calculatedAt: new Date().toISOString()
        };
    }

    getStats() {
        return this.stats;
    }
}

const analyticsService = new AnalyticsService();

// ============================================
// PRIORITY PREDICTOR SERVICE
// ============================================
class PriorityPredictorService {
    async predict(task) {
        if (CONFIG.WORKER_ENABLED && workerManager.worker) {
            try {
                return await workerManager.send('PREDICT_PRIORITY', { task });
            } catch (e) {
                return this._predictLocal(task);
            }
        }
        return this._predictLocal(task);
    }

    _predictLocal(task) {
        let score = 0;
        const text = (task.text || '').toLowerCase();

        ['urgent', 'asap', 'emergency', 'critical', 'important', 'deadline', 'today'].forEach(k => {
            if (text.includes(k)) score += 2;
        });

        ['later', 'sometime', 'maybe', 'optional'].forEach(k => {
            if (text.includes(k)) score -= 2;
        });

        if (task.dueDate) {
            const daysUntilDue = (new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24);
            if (daysUntilDue < 0) score += 5;
            else if (daysUntilDue < 1) score += 4;
            else if (daysUntilDue < 3) score += 2;
        }

        if (score >= 3) return 'high';
        if (score <= -2) return 'low';
        return 'medium';
    }
}

const priorityPredictor = new PriorityPredictorService();

// ============================================
// UI CONTROLLER
// ============================================
// Use EnhancedUIController instead of basic UIController
const ui = new EnhancedUIController();

// ============================================
// COMMANDS
// ============================================
function createAddTaskCommand(taskData) {
    let task = null;
    return {
        name: 'addTask',
        execute: async () => {
            task = await taskRepository.create(taskData);
            ui.showToast('Task added', 'success', { duration: 2000 });
        },
        undo: async () => {
            if (task) {
                await taskRepository.delete(task.id);
            }
        }
    };
}

function createDeleteTaskCommand(taskId) {
    let task = null;
    return {
        name: 'deleteTask',
        execute: async () => {
            task = await taskRepository.delete(taskId);
            ui.showToast('Task deleted', 'info', {
                actionText: 'Undo',
                onAction: () => {
                    commandHistory.undo();
                    ui.showToast('Task restored', 'success');
                },
                duration: CONFIG.UNDO_TIMEOUT
            });
        },
        undo: async () => {
            if (task) {
                task.completed = false;
                await taskRepository.save(task);
            }
        }
    };
}

function createToggleTaskCommand(taskId) {
    let wasCompleted = null;
    return {
        name: 'toggleTask',
        execute: async () => {
            const task = await taskRepository.getById(taskId);
            if (task) {
                wasCompleted = task.completed;
                task.completed = !wasCompleted;
                task.updatedAt = new Date().toISOString();
                await taskRepository.save(task);
            }
        },
        undo: async () => {
            if (wasCompleted !== null) {
                const task = await taskRepository.getById(taskId);
                if (task) {
                    task.completed = wasCompleted;
                    task.updatedAt = new Date().toISOString();
                    await taskRepository.save(task);
                }
            }
        }
    };
}

// ============================================
// EVENT HANDLERS
// ============================================
function initEventListeners() {
    const els = ui.elements;

    // Add task
    els.taskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = els.taskInput.value;
        const priority = els.prioritySelect.value;
        const dueDate = els.dueDateInput.value;

        if (text.trim()) {
            // Try ML prediction
            let predictedPriority = priority;
            if (CONFIG.WORKER_ENABLED) {
                try {
                    predictedPriority = await priorityPredictor.predict({ text, priority, dueDate });
                } catch (e) {
                    // Use manual selection
                }
            }

            const command = createAddTaskCommand({
                text,
                priority: predictedPriority,
                dueDate
            });
            commandHistory.execute(command);
            ui.render(await taskRepository.getAll());
            els.taskInput.value = '';
            els.taskInput.focus();
        }
    });

    // Search with debounce
    let searchTimeout;
    els.searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            ui.searchQuery = e.target.value;
            els.searchClear.classList.toggle('visible', e.target.value.trim().length > 0);
            ui.render(await taskRepository.getAll(), taskRepository);
        }, CONFIG.DEBOUNCE_DELAY);
    });

    els.searchClear?.addEventListener('click', async () => {
        els.searchInput.value = '';
        ui.searchQuery = '';
        els.searchClear.classList.remove('visible');
        ui.render(await taskRepository.getAll(), taskRepository);
        els.searchInput.focus();
    });

    // Issue 2 Fix: Options are now always visible, no toggle needed

    // Task actions (delegation)
    els.tasksContainer?.addEventListener('click', async (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;

        const taskId = card.dataset.taskId;
        const action = e.target.dataset.action;

        if (action === 'toggle') {
            const command = createToggleTaskCommand(taskId);
            commandHistory.execute(command);
            ui.render(await taskRepository.getAll());
        } else if (action === 'delete') {
            const command = createDeleteTaskCommand(taskId);
            commandHistory.execute(command);
            ui.render(await taskRepository.getAll());
        } else if (action === 'edit') {
            openEditModal(taskId);
        }
    });

    // Filter tabs - Issue 1 Fix: Sync with all navigation
    els.filterTabs?.forEach(tab => {
        tab.addEventListener('click', async (e) => {
            e.preventDefault();
            ui.setFilter(e.target.dataset.filter);
            ui.render(await taskRepository.getAll(), taskRepository);
        });
    });

    // Sidebar nav - Issue 1 Fix: Sync with all navigation
    els.navItems?.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            ui.setFilter(item.dataset.filter);
            closeSidebar();
            ui.render(await taskRepository.getAll(), taskRepository);
        });
    });
    
    // Bottom nav - Issue 4 Fix: New mobile navigation
    els.bottomNav?.addEventListener('click', async (e) => {
        const navItem = e.target.closest('.nav-item');
        if (navItem) {
            e.preventDefault();
            ui.setFilter(navItem.dataset.filter);
            ui.render(await taskRepository.getAll(), taskRepository);
        }
    });

    // Clear completed
    els.clearCompletedBtn?.addEventListener('click', async () => {
        const tasks = await taskRepository.getAll();
        const completed = tasks.filter(t => t.completed);

        if (completed.length === 0) {
            ui.showToast('No completed tasks', 'warning');
            return;
        }

        const completedIds = completed.map(t => t.id);

        const command = {
            name: 'clearCompleted',
            execute: async () => {
                for (const id of completedIds) {
                    await taskRepository.delete(id);
                }
            },
            undo: async () => {
                for (const task of completed) {
                    task.completed = true;
                    await taskRepository.save(task);
                }
            }
        };

        commandHistory.execute(command);
        ui.showToast(`Cleared ${completed.length} task(s)`, 'info', {
            actionText: 'Undo',
            onAction: () => {
                commandHistory.undo();
                ui.showToast('Tasks restored', 'success');
            },
            duration: CONFIG.UNDO_TIMEOUT
        });

        ui.render(await taskRepository.getAll());
    });
    
    // Open Dashboard
    document.getElementById('openDashboard')?.addEventListener('click', async () => {
        const dashboardModal = document.getElementById('dashboardModal');
        const dashboardContainer = document.getElementById('dashboardContainer');
        
        if (dashboardModal && dashboardContainer) {
            dashboardModal.classList.add('visible');
            
            // Render dashboard with fresh data
            const analyticsEngine = new AnalyticsEngine(taskRepository);
            const dashboardRenderer = new DashboardRenderer(dashboardContainer);
            await dashboardRenderer.render(analyticsEngine);
        }
    });
    
    // Close Dashboard
    document.getElementById('dashboardClose')?.addEventListener('click', () => {
        const dashboardModal = document.getElementById('dashboardModal');
        if (dashboardModal) {
            dashboardModal.classList.remove('visible');
        }
    });
    
    // Close dashboard on overlay click
    document.getElementById('dashboardModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.parentElement.classList.remove('visible');
        }
    });

    // Mobile sidebar
    els.menuToggle?.addEventListener('click', openSidebar);
    els.closeSidebar?.addEventListener('click', closeSidebar);
    els.sidebarOverlay?.addEventListener('click', closeSidebar);

    // Modal
    els.modalClose?.addEventListener('click', closeEditModal);
    els.cancelEdit?.addEventListener('click', closeEditModal);
    els.editModal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) closeEditModal();
    });
    els.editForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = els.editTaskId.value;
        const text = els.editTaskInput.value.trim();
        const priority = els.editPrioritySelect.value;
        const dueDate = els.editDueDateInput.value;

        if (!text) {
            ui.showToast('Task cannot be empty', 'error');
            return;
        }

        const task = await taskRepository.getById(taskId);
        if (task) {
            task.text = text;
            task.priority = priority;
            task.dueDate = dueDate;
            await taskRepository.save(task);
            ui.showToast('Task updated', 'success');
            ui.render(await taskRepository.getAll());
        }
        closeEditModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
            closeSidebar();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (commandHistory.undo()) {
                ui.render(await taskRepository.getAll());
                ui.showToast('Undone', 'info', { duration: 1500 });
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
            e.preventDefault();
            if (commandHistory.redo()) {
                ui.render(await taskRepository.getAll());
                ui.showToast('Redone', 'info', { duration: 1500 });
            }
        }
    });

    // Event bus subscriptions
    eventBus.on(AppEvents.TASK_CREATED, () => {
        console.log('[EventBus] Task created');
    });

    eventBus.on('analytics:updated', (stats) => {
        console.log('[Analytics] Updated:', stats);
    });
}

function openSidebar() {
    ui.elements.sidebar?.classList.add('open');
    ui.elements.sidebarOverlay?.classList.add('active');
    ui.elements.menuToggle?.classList.add('active');
}

function closeSidebar() {
    ui.elements.sidebar?.classList.remove('open');
    ui.elements.sidebarOverlay?.classList.remove('active');
    ui.elements.menuToggle?.classList.remove('active');
}

function openEditModal(taskId) {
    const task = taskRepository.memoryCache.get(taskId);
    if (!task) return;

    const els = ui.elements;
    els.editTaskId.value = task.id;
    els.editTaskInput.value = task.text;
    els.editPrioritySelect.value = task.priority;
    els.editDueDateInput.value = task.dueDate || '';
    els.editModal.classList.add('visible');
    els.editTaskInput.focus();
}

function closeEditModal() {
    ui.elements.editModal?.classList.remove('visible');
    ui.elements.editForm?.reset();
}

// ============================================
// SUBTASK HANDLERS
// ============================================
function initSubtaskHandlers(subtasksManager) {
    const container = document.getElementById('tasksContainer');
    
    if (!container) return;
    
    container.addEventListener('click', async (e) => {
        const subtaskItem = e.target.closest('.subtask-item');
        if (!subtaskItem) return;
        
        const taskCard = subtaskItem.closest('.task-card');
        const taskId = taskCard?.dataset.taskId;
        const subtaskId = subtaskItem.dataset.subtaskId;
        const action = e.target.dataset.action;
        
        if (!taskId || !subtaskId) return;
        
        if (action === 'toggleSubtask') {
            await subtasksManager.toggleSubtask(taskId, subtaskId);
            const tasks = await taskRepository.getAll();
            ui.render(tasks, taskRepository);
        } else if (action === 'deleteSubtask') {
            await subtasksManager.deleteSubtask(taskId, subtaskId);
            ui.showToast('Subtask deleted', 'info');
            const tasks = await taskRepository.getAll();
            ui.render(tasks, taskRepository);
        }
    });
    
    // Add subtask button
    container.addEventListener('click', async (e) => {
        if (e.target.dataset.action === 'addSubtask') {
            const taskCard = e.target.closest('.task-card');
            const taskId = taskCard.dataset.taskId;
            const text = prompt('Enter subtask:');
            
            if (text && text.trim()) {
                await subtasksManager.addSubtask(taskId, text.trim());
                ui.showToast('Subtask added', 'success');
                const tasks = await taskRepository.getAll();
                ui.render(tasks, taskRepository);
            }
        }
    });
}

// ============================================
// RECURRENCE HANDLERS
// ============================================
function initRecurrenceHandlers(recurringTasksManager) {
    const taskForm = document.getElementById('taskForm');
    const recurrenceSelect = document.getElementById('recurrenceSelect');
    
    if (!taskForm || !recurrenceSelect) return;
    
    // Handle task completion with recurrence
    document.addEventListener('click', async (e) => {
        if (e.target.closest('.task-checkbox')?.dataset.action === 'toggle') {
            const card = e.target.closest('.task-card');
            const taskId = card.dataset.taskId;
            const task = await taskRepository.getById(taskId);
            
            if (task && task.recurrence && task.recurrence.type !== 'none') {
                const result = await recurringTasksManager.completeRecurringTask(taskId);
                if (result.newTask) {
                    ui.showToast('Task completed! Next instance created.', 'success');
                } else {
                    ui.showToast('Task completed', 'success');
                }
                const tasks = await taskRepository.getAll();
                ui.render(tasks, taskRepository);
            }
        }
    });
}

// ============================================
// NOTIFICATION HANDLERS
// ============================================
function initNotificationHandlers(notificationsManager) {
    const notificationsToggle = document.getElementById('notificationsToggle');
    
    if (!notificationsToggle) return;
    
    // Request permission on first check
    notificationsToggle.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const granted = await notificationsManager.requestPermission();
            if (granted) {
                ui.showToast('Notifications enabled', 'success');
                notificationsManager.enableAllReminders();
            } else {
                e.target.checked = false;
                ui.showToast('Notifications permission denied', 'error');
            }
        } else {
            notificationsManager.clearAllReminders();
            notificationsManager.stopReminderChecker();
            ui.showToast('Notifications disabled', 'info');
        }
    });
}

// ============================================
// STREAK WIDGET
// ============================================
async function updateStreakWidget(streaksManager) {
    const streakWidget = document.getElementById('streakWidget');
    const streakCount = document.getElementById('streakCount');
    
    if (!streakWidget || !streakCount) return;
    
    const info = await streaksManager.getStreakInfo();
    streakCount.textContent = info.currentStreak;
    
    if (info.streakStatus === 'broken') {
        streakWidget.classList.add('broken');
        streakWidget.title = 'Streak broken - complete a task today!';
    } else if (info.streakStatus === 'at_risk') {
        streakWidget.title = 'Complete a task today to keep your streak!';
    } else {
        streakWidget.title = `Current streak: ${info.currentStreak} days`;
    }
    
    // Update streak on task completion
    eventBus.on(AppEvents.TASK_TOGGLED, async (data) => {
        if (data.task.completed) {
            await streaksManager.recordCompletion(data.task);
            const newInfo = await streaksManager.getStreakInfo();
            streakCount.textContent = newInfo.currentStreak;
            
            // Show milestone notification
            if (newInfo.milestones.length > 0) {
                ui.showToast(`🏆 Milestone: ${newInfo.currentStreak} day streak!`, 'success');
            }
        }
    });
}

// ============================================
// SWIPE ACTIONS HANDLERS
// ============================================
function initSwipeHandlers(swipeActionsManager) {
    const container = document.getElementById('tasksContainer');
    if (container) {
        swipeActionsManager.init(container);
    }
}

// ============================================
// DRAG & DROP HANDLERS
// ============================================
function initDragDropHandlers(dragDropManager) {
    const container = document.getElementById('tasksContainer');
    if (container) {
        dragDropManager.init(container);
    }
}

// ============================================
// NATURAL LANGUAGE HANDLERS
// ============================================
function initNaturalLanguageHandlers(naturalLanguageParser) {
    const taskInput = document.getElementById('taskInput');
    const taskForm = document.getElementById('taskForm');
    const prioritySelect = document.getElementById('prioritySelect');
    const dueDateInput = document.getElementById('dueDateInput');
    const recurrenceSelect = document.getElementById('recurrenceSelect');
    
    if (!taskInput || !taskForm) return;
    
    // Parse on input blur
    taskInput.addEventListener('blur', () => {
        const result = naturalLanguageParser.parse(taskInput.value);
        
        if (result.hasNaturalLanguage && result.confidence > 0.5) {
            // Update UI with parsed values
            if (result.priority) {
                prioritySelect.value = result.priority.value;
                prioritySelect.classList.add('has-user-selection');
            }
            
            if (result.dueDate) {
                const dateStr = result.dueDate.toISOString().split('T')[0];
                dueDateInput.value = dateStr;
            }
            
            if (result.recurrence) {
                recurrenceSelect.value = result.recurrence.type;
            }
            
            // Update input with cleaned text
            if (result.cleanedText !== result.originalText) {
                taskInput.value = result.cleanedText;
            }
            
            // Show parsing feedback
            if (result.suggestions.length > 0) {
                result.suggestions.forEach(suggestion => {
                    ui.showToast(suggestion.message, 'info', { duration: 3000 });
                });
            }
        }
    });
    
    // Also parse on Enter key (before submit)
    taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const result = naturalLanguageParser.parse(taskInput.value);
            
            if (result.hasNaturalLanguage) {
                // Apply parsed values immediately
                if (result.priority) {
                    prioritySelect.value = result.priority.value;
                    prioritySelect.classList.add('has-user-selection');
                }
                
                if (result.dueDate) {
                    const dateStr = result.dueDate.toISOString().split('T')[0];
                    dueDateInput.value = dateStr;
                }
                
                if (result.recurrence) {
                    recurrenceSelect.value = result.recurrence.type;
                }
                
                taskInput.value = result.cleanedText;
            }
        }
    });
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });

            console.log('[SW] Registered:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        ui.showToast('Update available! Refresh to apply.', 'info', {
                            actionText: 'Refresh',
                            onAction: () => window.location.reload()
                        });
                    }
                });
            });

            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', (e) => {
                if (e.data.type === 'SYNC_COMPLETE') {
                    ui.showToast('Tasks synced', 'success');
                }
            });

        } catch (error) {
            console.error('[SW] Registration failed:', error);
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    console.log('🚀 TaskMaster Enhanced UI/UX initializing...');

    // Initialize UI with enhanced components
    ui.initElements();
    ui.bindPriorityFeedback();
    
    // Initialize feature managers
    const subtasksManager = new SubtasksManager(taskRepository);
    const recurringTasksManager = new RecurringTasksManager(taskRepository);
    const notificationsManager = new NotificationsManager(taskRepository);
    const streaksManager = new StreaksManager(taskRepository);
    const swipeActionsManager = new SwipeActionsManager(taskRepository, ui);
    const dragDropManager = new DragDropManager(taskRepository, ui);
    const naturalLanguageParser = new NaturalLanguageParser();
    const analyticsEngine = new AnalyticsEngine(taskRepository);
    
    // Initialize streaks
    await streaksManager.init();
    
    // Initialize inline edit manager
    const inlineEditManager = new InlineEditManager(taskRepository, ui);
    ui.setInlineEditManager(inlineEditManager);
    
    // Initialize storage
    await taskRepository.initialize();

    // Initialize worker
    workerManager.initialize();

    // Load tasks
    const tasks = await taskRepository.getAll();

    // Calculate analytics
    if (CONFIG.ANALYTICS_ENABLED) {
        await analyticsService.calculate(tasks);
    }

    // Initialize event listeners
    initEventListeners();
    
    // Initialize feature handlers
    initSubtaskHandlers(subtasksManager);
    initRecurrenceHandlers(recurringTasksManager);
    initNotificationHandlers(notificationsManager);
    initSwipeHandlers(swipeActionsManager);
    initDragDropHandlers(dragDropManager);
    initNaturalLanguageHandlers(naturalLanguageParser);
    
    // Initialize streak display
    updateStreakWidget(streaksManager);
    
    // Initialize dashboard if container exists
    const dashboardContainer = document.getElementById('dashboardContainer');
    if (dashboardContainer) {
        const dashboardRenderer = new DashboardRenderer(dashboardContainer);
        dashboardRenderer.render(analyticsEngine);
    }
    
    // Bind empty state actions
    ui.emptyStateManager.bindActions({
        addAction: () => {
            ui.elements.taskInput?.focus();
        },
        clearSearch: () => {
            ui.elements.searchInput.value = '';
            ui.searchQuery = '';
            ui.elements.searchClear?.classList.remove('visible');
            ui.render(tasks, taskRepository);
        }
    });

    // Register service worker
    await registerServiceWorker();

    // Initial render
    ui.render(tasks, taskRepository);

    // Emit ready event
    eventBus.emit(AppEvents.APP_READY, { taskCount: tasks.length });

    console.log('✅ TaskMaster Enhanced ready!');
    console.log('📊 Stats:', analyticsService.getStats());
    console.log('🎨 Theme:', ui.themeManager.getCurrentTheme());
    
    // Expose managers for debugging
    window.TaskMaster = {
        ...window.TaskMaster,
        subtasksManager,
        recurringTasksManager,
        notificationsManager,
        streaksManager,
        swipeActionsManager,
        dragDropManager,
        naturalLanguageParser,
        analyticsEngine
    };
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.TaskMaster = {
    taskRepository,
    commandHistory,
    analyticsService,
    priorityPredictor,
    workerManager,
    eventBus,
    db,
    ui
};
