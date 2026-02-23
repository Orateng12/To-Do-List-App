/**
 * UI Renderer - Dynamic UI Updates
 * =================================
 * Handles all DOM manipulation and rendering
 */

import { eventBus, EVENTS } from './event-bus.js';
import { stateManager } from './state.js';
import { formatDate, isOverdue, escapeHtml } from './utils.js';

class UIRenderer {
    constructor() {
        this.elements = {};
        this.animationTimers = new Map();
    }

    /**
     * Initialize DOM element references
     */
    init() {
        this.cacheElements();
        this.bindEvents();
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            // Form elements
            taskForm: document.getElementById('taskForm'),
            taskInput: document.getElementById('taskInput'),
            prioritySelect: document.getElementById('prioritySelect'),
            dueDateInput: document.getElementById('dueDateInput'),
            recurrenceSelect: document.getElementById('recurrenceSelect'),
            categoryInput: document.getElementById('categoryInput'),
            toggleOptions: document.getElementById('toggleOptions'),
            formOptions: document.getElementById('formOptions'),

            // Search and filter
            searchInput: document.getElementById('searchInput'),
            sortSelect: document.getElementById('sortSelect'),

            // Task list
            tasksContainer: document.getElementById('tasksContainer'),
            emptyState: document.getElementById('emptyState'),

            // Filter elements
            filterTabs: document.querySelectorAll('.filter-tab'),
            navItems: document.querySelectorAll('.nav-item'),
            clearCompletedBtn: document.getElementById('clearCompleted'),

            // Count displays
            countAll: document.getElementById('countAll'),
            countActive: document.getElementById('countActive'),
            countCompleted: document.getElementById('countCompleted'),
            totalTasks: document.getElementById('totalTasks'),
            statsOverdue: document.getElementById('statsOverdue'),
            statsHighPriority: document.getElementById('statsHighPriority'),
            progressbar: document.getElementById('progressbar'),
            progressFill: document.getElementById('progressFill'),

            // Mobile navigation
            menuToggle: document.getElementById('menuToggle'),
            sidebar: document.getElementById('sidebar'),
            closeSidebar: document.getElementById('closeSidebar'),
            sidebarOverlay: document.getElementById('sidebarOverlay'),

            // Edit Modal
            editModal: document.getElementById('editModal'),
            editForm: document.getElementById('editForm'),
            editTaskId: document.getElementById('editTaskId'),
            editTaskInput: document.getElementById('editTaskInput'),
            editPrioritySelect: document.getElementById('editPrioritySelect'),
            editDueDateInput: document.getElementById('editDueDateInput'),
            editRecurrenceSelect: document.getElementById('editRecurrenceSelect'),
            editCategoryInput: document.getElementById('editCategoryInput'),
            editNotesInput: document.getElementById('editNotesInput'),
            modalClose: document.getElementById('modalClose'),
            cancelEdit: document.getElementById('cancelEdit'),

            // Theme toggle
            themeToggle: document.getElementById('themeToggle'),

            // Undo/Redo buttons
            undoBtn: document.getElementById('undoBtn'),
            redoBtn: document.getElementById('redoBtn'),

            // Export/Import
            exportBtn: document.getElementById('exportBtn'),
            importInput: document.getElementById('importInput'),

            // Categories container
            categoriesList: document.getElementById('categoriesList'),

            // Notifications
            enableNotificationsBtn: document.getElementById('enableNotifications'),

            // Toast container
            toastContainer: document.getElementById('toastContainer')
        };
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Subscribe to events
        eventBus.on(EVENTS.TASKS_CHANGED, () => this.renderTasks());
        eventBus.on(EVENTS.TASK_ADDED, () => this.clearForm());
        eventBus.on(EVENTS.FILTER_CHANGED, () => this.updateFilterUI());
        eventBus.on(EVENTS.CATEGORIES_CHANGED, (data) => this.renderCategories(data.categories));
        eventBus.on(EVENTS.UNDO_AVAILABLE, (data) => this.updateUndoRedoButtons(data.available));
        eventBus.on(EVENTS.REDO_AVAILABLE, (data) => this.updateUndoRedoButtons(null, data.available));
        eventBus.on(EVENTS.TOAST_SHOW, (data) => this.showToast(data.message, data.type));
    }

    /**
     * Render all tasks
     */
    renderTasks() {
        const filteredTasks = stateManager.getFilteredTasks();
        const stats = stateManager.getStats();

        if (filteredTasks.length === 0) {
            this.elements.tasksContainer.innerHTML = '';
            this.elements.emptyState.classList.add('visible');
        } else {
            this.elements.emptyState.classList.remove('visible');
            this.elements.tasksContainer.innerHTML = filteredTasks
                .map(task => this.renderTaskCard(task))
                .join('');
        }

        this.updateCounts(stats);
        this.updateProgress(stats);
    }

    /**
     * Render a single task card
     * @param {Object} task - Task object
     * @returns {string} HTML string
     */
    renderTaskCard(task) {
        const overdueClass = isOverdue(task.dueDate, task.completed) ? 'overdue' : '';
        const formattedDate = formatDate(task.dueDate);
        const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
        const totalSubtasks = task.subtasks?.length || 0;
        const hasSubtasks = totalSubtasks > 0;
        const recurrenceIcon = this.getRecurrenceIcon(task.recurrence);
        const hasRecurrence = task.recurrence && task.recurrence !== 'none';

        return `
            <div class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''}"
                 data-task-id="${task.id}"
                 draggable="true"
                 role="listitem">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}"
                     data-action="toggle"
                     role="checkbox"
                     aria-checked="${task.completed}"
                     tabindex="0">
                </div>

                <div class="task-content">
                    <p class="task-text">${escapeHtml(task.text)}</p>

                    ${task.categories?.length > 0 ? `
                        <div class="task-categories">
                            ${task.categories.map(cat =>
                                `<span class="category-tag">${escapeHtml(cat)}</span>`
                            ).join('')}
                        </div>
                    ` : ''}

                    <div class="task-meta">
                        <span class="task-priority ${task.priority}">
                            ${task.priority}
                        </span>
                        ${task.dueDate ? `
                            <span class="task-due-date ${overdueClass}">
                                📅 ${formattedDate}
                            </span>
                        ` : ''}
                        ${hasRecurrence ? `
                            <span class="task-recurrence" title="Repeats ${task.recurrence}">
                                ${recurrenceIcon} ${task.recurrence}
                            </span>
                        ` : ''}
                        ${hasSubtasks ? `
                            <span class="task-subtasks-info">
                                ✓ ${completedSubtasks}/${totalSubtasks}
                            </span>
                        ` : ''}
                    </div>

                    ${task.notes ? `
                        <div class="task-notes-preview">
                            📝 ${escapeHtml(task.notes.substring(0, 100))}${task.notes.length > 100 ? '...' : ''}
                        </div>
                    ` : ''}
                </div>

                <div class="task-actions">
                    <button class="task-action-btn add-subtask"
                            data-action="addSubtask"
                            title="Add subtask"
                            aria-label="Add subtask">➕</button>
                    <button class="task-action-btn edit"
                            data-action="edit"
                            title="Edit task"
                            aria-label="Edit task">✏️</button>
                    <button class="task-action-btn delete"
                            data-action="delete"
                            title="Delete task"
                            aria-label="Delete task">🗑️</button>
                </div>
            </div>
        `;
    }

    /**
     * Get icon for recurrence type
     * @param {string} recurrence - Recurrence type
     * @returns {string} Icon emoji
     */
    getRecurrenceIcon(recurrence) {
        const icons = {
            'daily': '📅',
            'weekly': '📆',
            'monthly': '🗓️',
            'yearly': '📌'
        };
        return icons[recurrence] || '🔄';
    }

    /**
     * Update count displays
     * @param {Object} stats - Statistics object
     */
    updateCounts(stats) {
        if (this.elements.countAll) this.elements.countAll.textContent = stats.total;
        if (this.elements.countActive) this.elements.countActive.textContent = stats.active;
        if (this.elements.countCompleted) this.elements.countCompleted.textContent = stats.completed;
        if (this.elements.totalTasks) this.elements.totalTasks.textContent = stats.total;
        if (this.elements.statsOverdue) this.elements.statsOverdue.textContent = stats.overdue;
        if (this.elements.statsHighPriority) this.elements.statsHighPriority.textContent = stats.highPriority;
    }

    /**
     * Update progress bar
     * @param {Object} stats - Statistics object
     */
    updateProgress(stats) {
        if (this.elements.progressbar && this.elements.progressFill) {
            this.elements.progressFill.style.width = `${stats.completionRate}%`;
            this.elements.progressbar.setAttribute('aria-valuenow', stats.completionRate);
        }
    }

    /**
     * Update filter UI
     */
    updateFilterUI() {
        const { filter } = stateManager;

        this.elements.filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });

        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.filter === filter);
        });
    }

    /**
     * Render categories list
     * @param {Array} categories - Categories array
     */
    renderCategories(categories) {
        if (!this.elements.categoriesList) return;

        if (categories.length === 0) {
            this.elements.categoriesList.innerHTML = '<p class="no-categories">No categories yet</p>';
            return;
        }

        this.elements.categoriesList.innerHTML = categories.map(cat => `
            <div class="category-item" data-category="${escapeHtml(cat)}">
                <span class="category-name">${escapeHtml(cat)}</span>
                <button class="category-remove" data-action="removeCategory" data-category="${escapeHtml(cat)}" aria-label="Remove category">&times;</button>
            </div>
        `).join('');
    }

    /**
     * Update undo/redo buttons
     * @param {boolean} canUndo - Can undo
     * @param {boolean} canRedo - Can redo
     */
    updateUndoRedoButtons(canUndo, canRedo) {
        if (this.elements.undoBtn) {
            this.elements.undoBtn.disabled = !canUndo;
            this.elements.undoBtn.setAttribute('aria-disabled', !canUndo);
        }
        if (this.elements.redoBtn) {
            this.elements.redoBtn.disabled = !canRedo;
            this.elements.redoBtn.setAttribute('aria-disabled', !canRedo);
        }
    }

    /**
     * Clear form inputs
     */
    clearForm() {
        if (this.elements.taskForm) {
            this.elements.taskForm.reset();
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success/error/info/warning)
     */
    showToast(message, type = 'info') {
        if (!this.elements.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getToastIcon(type)}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Close">&times;</button>
        `;

        this.elements.toastContainer.appendChild(toast);

        // Auto-remove after 4 seconds
        const timer = setTimeout(() => {
            this.removeToast(toast);
        }, 4000);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(timer);
            this.removeToast(toast);
        });

        // Swipe to dismiss (mobile)
        let startX, currentX;
        toast.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        toast.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            toast.style.transform = `translateX(${diff}px)`;
        });
        toast.addEventListener('touchend', () => {
            if (currentX - startX > 100 || startX - currentX > 100) {
                this.removeToast(toast);
            } else {
                toast.style.transform = '';
            }
        });
    }

    /**
     * Get toast icon based on type
     * @param {string} type - Toast type
     * @returns {string} Icon emoji
     */
    getToastIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    /**
     * Remove toast with animation
     * @param {HTMLElement} toast - Toast element
     */
    removeToast(toast) {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    /**
     * Open edit modal with task data
     * @param {string} id - Task ID
     */
    openEditModal(id) {
        const task = stateManager.tasks.find(t => t.id === id);
        if (!task) return;

        this.elements.editTaskId.value = task.id;
        this.elements.editTaskInput.value = task.text;
        this.elements.editPrioritySelect.value = task.priority;
        this.elements.editDueDateInput.value = task.dueDate || '';
        this.elements.editRecurrenceSelect.value = task.recurrence || 'none';
        this.elements.editCategoryInput.value = task.categories?.join(', ') || '';
        this.elements.editNotesInput.value = task.notes || '';

        this.elements.editModal.classList.add('visible');
        this.elements.editTaskInput.focus();
        eventBus.emit(EVENTS.MODAL_OPEN, { task });
    }

    /**
     * Close edit modal
     */
    closeEditModal() {
        this.elements.editModal.classList.remove('visible');
        this.elements.editForm.reset();
        eventBus.emit(EVENTS.MODAL_CLOSE);
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        this.elements.sidebar.classList.add('open');
        this.elements.sidebarOverlay.classList.add('active');
        this.elements.menuToggle.classList.add('active');
    }

    /**
     * Close sidebar
     */
    closeSidebar() {
        this.elements.sidebar.classList.remove('open');
        this.elements.sidebarOverlay.classList.remove('active');
        this.elements.menuToggle.classList.remove('active');
    }

    /**
     * Toggle form options
     */
    toggleFormOptions() {
        this.elements.formOptions.classList.toggle('visible');
        this.elements.toggleOptions.classList.toggle('active');
        const text = this.elements.toggleOptions.querySelector('.toggle-text');
        text.textContent = this.elements.formOptions.classList.contains('visible')
            ? 'Hide Options'
            : 'Show Options';
    }

    /**
     * Set theme
     * @param {string} theme - Theme name (light/dark)
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('taskmaster-theme', theme);
        eventBus.emit(EVENTS.THEME_CHANGED, { theme });
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
    }

    /**
     * Initialize theme from preference
     */
    initTheme() {
        const saved = localStorage.getItem('taskmaster-theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        this.setTheme(theme);
    }
}

// Export singleton instance
export const uiRenderer = new UIRenderer();
