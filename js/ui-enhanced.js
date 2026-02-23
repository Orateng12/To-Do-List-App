/**
 * TaskMaster - Enhanced UI Controller
 * ====================================
 * 
 * Implements fixes for 8 UI/UX issues:
 * 1. Navigation Architecture - Single navigation paradigm
 * 2. Feature Discoverability - Always-visible options
 * 3. Visual Hierarchy - Enhanced primary actions
 * 4. Responsive Design - Bottom nav for mobile
 * 5. Empty States - Contextual messaging
 * 6. Visual Feedback - Priority selection feedback
 * 7. Interaction Patterns - Inline editing
 * 8. Accessibility - Theme toggle with light/dark support
 */

// ============================================
// THEME MANAGER (Issue 8 Fix)
// ============================================
class ThemeManager {
    constructor() {
        this.themes = ['light', 'dark'];
        this.icons = {
            light: '☀️',
            dark: '🌙'
        };
        this.init();
    }

    init() {
        this.toggle = document.getElementById('themeToggle');
        this.icon = document.getElementById('themeIcon');
        this.updateIcon();
        this.bindEvents();
    }

    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('taskmaster-theme', theme);
        this.updateIcon();
    }

    toggleTheme() {
        const current = this.getCurrentTheme();
        const next = current === 'light' ? 'dark' : 'light';
        this.setTheme(next);
    }

    updateIcon() {
        if (this.icon) {
            this.icon.textContent = this.icons[this.getCurrentTheme()];
        }
    }

    bindEvents() {
        if (this.toggle) {
            this.toggle.addEventListener('click', () => this.toggleTheme());
        }
    }
}

// ============================================
// EMPTY STATE MANAGER (Issue 5 Fix)
// ============================================
class EmptyStateManager {
    constructor() {
        this.states = {
            firstTime: {
                icon: '🎉',
                title: 'Welcome to TaskMaster!',
                message: 'You have no tasks yet. Add your first task to get started!',
                actionText: 'Add Your First Task',
                showAction: true,
                celebration: false
            },
            allCompleted: {
                icon: '🎊',
                title: 'All Clear!',
                message: 'You\'ve completed all your tasks. Great job!',
                actionText: 'Add New Task',
                showAction: true,
                celebration: true
            },
            noActive: {
                icon: '✅',
                title: 'No Active Tasks',
                message: 'All tasks are completed. View completed tasks or add new ones.',
                actionText: 'View Completed',
                showAction: true,
                secondaryText: 'Or ',
                secondaryActionText: 'add a new task',
                secondaryAction: 'add'
            },
            noCompleted: {
                icon: '📝',
                title: 'No Completed Tasks',
                message: 'Complete some tasks to see them here.',
                actionText: 'View Active Tasks',
                showAction: true,
                secondaryText: '',
                secondaryActionText: '',
                secondaryAction: ''
            },
            searchNoResults: {
                icon: '🔍',
                title: 'No Matching Tasks',
                message: 'No tasks found matching your search.',
                actionText: 'Clear Search',
                showAction: true,
                secondaryText: '',
                secondaryActionText: '',
                secondaryAction: ''
            },
            filterEmpty: {
                icon: '📋',
                title: 'No Tasks in This View',
                message: 'There are no tasks matching your current filter.',
                actionText: 'View All Tasks',
                showAction: true,
                secondaryText: '',
                secondaryActionText: '',
                secondaryAction: ''
            }
        };
    }

    update(tasks, filter, searchQuery) {
        const emptyState = document.getElementById('emptyState');
        const container = document.getElementById('tasksContainer');
        
        if (!emptyState || !container) return;

        const state = this.getState(tasks, filter, searchQuery);
        
        if (state) {
            container.style.display = 'none';
            emptyState.classList.add('visible');
            if (state.celebration) {
                emptyState.classList.add('celebration');
            } else {
                emptyState.classList.remove('celebration');
            }
            this.render(state);
        } else {
            container.style.display = 'flex';
            emptyState.classList.remove('visible');
            emptyState.classList.remove('celebration');
        }
    }

    getState(tasks, filter, searchQuery) {
        const hasTasks = tasks.length > 0;
        const hasActive = tasks.some(t => !t.completed);
        const hasCompleted = tasks.some(t => t.completed);

        // Search with no results
        if (searchQuery && searchQuery.trim()) {
            let filtered = tasks;
            if (filter === 'active') filtered = tasks.filter(t => !t.completed);
            else if (filter === 'completed') filtered = tasks.filter(t => t.completed);
            
            const query = searchQuery.toLowerCase();
            const hasMatches = filtered.some(t => t.text.toLowerCase().includes(query));
            
            if (!hasMatches) {
                return this.states.searchNoResults;
            }
        }

        // No tasks at all
        if (!hasTasks) {
            return this.states.firstTime;
        }

        // Filter-specific empty states
        if (filter === 'active' && !hasActive) {
            return this.states.noActive;
        }

        if (filter === 'completed' && !hasCompleted) {
            return this.states.noCompleted;
        }

        // All tasks completed
        if (hasTasks && !hasActive) {
            return this.states.allCompleted;
        }

        return null;
    }

    render(state) {
        const icon = document.querySelector('#emptyState .empty-icon');
        const title = document.getElementById('emptyStateTitle');
        const message = document.getElementById('emptyStateMessage');
        const action = document.getElementById('emptyStateAction');
        const actionText = document.getElementById('emptyStateActionText');
        const secondary = document.getElementById('emptyStateSecondary');
        const secondaryText = document.getElementById('emptyStateSecondaryText');
        const secondaryAction = document.getElementById('emptyStateSecondaryAction');

        if (icon) icon.textContent = state.icon;
        if (title) title.textContent = state.title;
        if (message) message.textContent = state.message;
        
        if (action) {
            if (state.showAction) {
                action.style.display = 'inline-flex';
                if (actionText) actionText.textContent = state.actionText;
            } else {
                action.style.display = 'none';
            }
        }

        if (secondary) {
            if (state.secondaryText || state.secondaryActionText) {
                secondary.style.display = 'block';
                if (secondaryText) secondaryText.textContent = state.secondaryText;
                if (secondaryAction) {
                    secondaryAction.textContent = state.secondaryActionText;
                    secondaryAction.dataset.action = state.secondaryAction;
                }
            } else {
                secondary.style.display = 'none';
            }
        }
    }

    bindActions(handlers) {
        const action = document.getElementById('emptyStateAction');
        const secondaryAction = document.getElementById('emptyStateSecondaryAction');

        if (action && handlers.addAction) {
            action.addEventListener('click', handlers.addAction);
        }

        if (secondaryAction && handlers.clearSearch) {
            secondaryAction.addEventListener('click', (e) => {
                const actionType = e.target.dataset.action;
                if (actionType === 'add' && handlers.addAction) {
                    handlers.addAction();
                }
            });
        }
    }
}

// ============================================
// INLINE EDIT MANAGER (Issue 7 Fix)
// ============================================
class InlineEditManager {
    constructor(taskRepository, uiController) {
        this.taskRepository = taskRepository;
        this.uiController = uiController;
        this.currentEdit = null;
    }

    init(container) {
        this.container = container;
        this.bindEvents();
    }

    bindEvents() {
        if (!this.container) return;

        // Double-click to edit task text
        this.container.addEventListener('dblclick', (e) => {
            const taskText = e.target.closest('.task-text');
            if (taskText) {
                const card = taskText.closest('.task-card');
                const taskId = card?.dataset.taskId;
                if (taskId) {
                    this.enableInlineEdit(taskText, taskId);
                }
            }
        });

        // Click on priority badge to quick-edit priority
        this.container.addEventListener('click', (e) => {
            const priorityBadge = e.target.closest('.task-priority');
            if (priorityBadge) {
                const card = priorityBadge.closest('.task-card');
                const taskId = card?.dataset.taskId;
                if (taskId) {
                    this.showPriorityPopover(priorityBadge, taskId);
                }
            }
        });
    }

    enableInlineEdit(element, taskId) {
        const originalText = element.textContent.trim();
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.className = 'inline-edit-input';
        
        // Save on blur
        const save = async () => {
            const newText = input.value.trim();
            if (newText && newText !== originalText) {
                await this.saveTaskText(taskId, newText);
            } else if (input.parentElement) {
                input.replaceWith(element);
            }
            this.currentEdit = null;
        };

        // Cancel on escape
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            } else if (e.key === 'Escape') {
                if (input.parentElement) {
                    input.replaceWith(element);
                }
                this.currentEdit = null;
            }
        });

        input.addEventListener('blur', save);

        // Replace element with input
        element.textContent = '';
        element.appendChild(input);
        input.focus();
        input.select();
        
        this.currentEdit = { taskId, element, input };
    }

    async saveTaskText(taskId, newText) {
        try {
            const task = await this.taskRepository.getById(taskId);
            if (task) {
                task.text = newText;
                task.updatedAt = new Date().toISOString();
                await this.taskRepository.save(task);
                this.uiController.showToast('Task updated', 'success');
            }
        } catch (error) {
            console.error('Failed to save task:', error);
            this.uiController.showToast('Failed to update task', 'error');
        }
    }

    showPriorityPopover(badgeElement, taskId) {
        // Remove existing popover
        const existing = document.querySelector('.edit-popover');
        if (existing) existing.remove();

        // Create popover
        const popover = document.createElement('div');
        popover.className = 'edit-popover';
        popover.innerHTML = `
            <div class="popover-row">
                <span class="popover-label">Priority</span>
                <select id="popoverPriority">
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                </select>
            </div>
        `;

        // Position popover
        const rect = badgeElement.getBoundingClientRect();
        popover.style.top = `${rect.bottom + 8}px`;
        popover.style.left = `${rect.left}px`;

        // Set current value
        const currentPriority = badgeElement.classList.contains('high') ? 'high' :
                               badgeElement.classList.contains('medium') ? 'medium' : 'low';
        const select = popover.querySelector('#popoverPriority');
        select.value = currentPriority;

        // Handle change
        select.addEventListener('change', async (e) => {
            await this.saveTaskPriority(taskId, e.target.value);
            popover.remove();
        });

        // Close on outside click
        const closeOnOutside = (e) => {
            if (!popover.contains(e.target) && !badgeElement.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', closeOnOutside);
            }
        };

        document.body.appendChild(popover);
        setTimeout(() => {
            document.addEventListener('click', closeOnOutside);
        }, 100);
    }

    async saveTaskPriority(taskId, priority) {
        try {
            const task = await this.taskRepository.getById(taskId);
            if (task) {
                task.priority = priority;
                task.updatedAt = new Date().toISOString();
                await this.taskRepository.save(task);
                this.uiController.showToast('Priority updated', 'success');
            }
        } catch (error) {
            console.error('Failed to save priority:', error);
            this.uiController.showToast('Failed to update priority', 'error');
        }
    }
}

// ============================================
// ENHANCED UI CONTROLLER
// ============================================
class EnhancedUIController {
    constructor() {
        this.elements = {};
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.themeManager = new ThemeManager();
        this.emptyStateManager = new EmptyStateManager();
        this.inlineEditManager = null;
    }

    initElements() {
        const ids = [
            'taskForm', 'taskInput', 'prioritySelect', 'dueDateInput',
            'searchInput', 'searchClear',
            'tasksContainer', 'emptyState', 'emptyStateAction',
            'filterTabs', 'navItems', 'bottomNav',
            'clearCompletedBtn', 'taskCountDisplay', 'countAll', 'countActive',
            'countCompleted', 'totalTasks', 'menuToggle', 'sidebar',
            'closeSidebar', 'sidebarOverlay', 'editModal', 'editForm',
            'editTaskId', 'editTaskInput', 'editPrioritySelect', 'editDueDateInput',
            'modalClose', 'cancelEdit', 'toastContainer', 'themeToggle', 'themeIcon'
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                this.elements[id] = el;
            }
        });

        this.elements.filterTabs = document.querySelectorAll('.filter-tab');
        this.elements.navItems = document.querySelectorAll('.nav-item');
        this.elements.bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
    }

    setInlineEditManager(manager) {
        this.inlineEditManager = manager;
    }

    // Issue 6 Fix: Track priority selection for visual feedback
    bindPriorityFeedback() {
        const prioritySelect = this.elements.prioritySelect;
        if (prioritySelect) {
            prioritySelect.addEventListener('change', () => {
                if (prioritySelect.value) {
                    prioritySelect.classList.add('has-user-selection');
                } else {
                    prioritySelect.classList.remove('has-user-selection');
                }
            });
        }
    }

    // Issue 4 Fix: Sync navigation across sidebar, filter tabs, and bottom nav
    setFilter(filter) {
        this.currentFilter = filter;

        // Update filter tabs
        this.elements.filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });

        // Update sidebar nav
        this.elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.filter === filter);
        });

        // Update bottom nav
        this.elements.bottomNavItems.forEach(item => {
            item.classList.toggle('active', item.dataset.filter === filter);
        });
    }

    renderTaskCard(task) {
        const overdueClass = this._isOverdue(task.dueDate, task.completed) ? 'overdue' : '';
        const formattedDate = this._formatDate(task.dueDate);
        
        // Subtask progress
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        const completedSubtasks = hasSubtasks ? task.subtasks.filter(s => s.completed).length : 0;
        const totalSubtasks = hasSubtasks ? task.subtasks.length : 0;
        const subtaskProgress = hasSubtasks ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
        
        // Recurrence info
        const hasRecurrence = task.recurrence && task.recurrence.type !== 'none';
        const recurrenceIcon = this._getRecurrenceIcon(task.recurrence?.type);

        return `
            <div class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''} draggable"
                 data-task-id="${task.id}"
                 draggable="true">
                <div class="drag-handle" title="Drag to reorder">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                
                <div class="task-checkbox ${task.completed ? 'checked' : ''}"
                     data-action="toggle" role="checkbox"
                     aria-checked="${task.completed}" tabindex="0"></div>
                     
                <div class="task-content">
                    <p class="task-text">${this._escapeHtml(task.text)}</p>
                    
                    <div class="task-meta">
                        <span class="task-priority ${task.priority}">${task.priority}</span>
                        ${task.dueDate ? `<span class="task-due-date ${overdueClass}">📅 ${formattedDate}</span>` : ''}
                        ${hasRecurrence ? `<span class="task-recurrence">${recurrenceIcon} ${task.recurrence.type}</span>` : ''}
                        ${hasSubtasks ? `<span class="task-subtasks">✓ ${completedSubtasks}/${totalSubtasks}</span>` : ''}
                    </div>
                    
                    ${hasSubtasks ? `
                        <div class="subtasks-container">
                            <div class="subtasks-header">
                                <span class="subtasks-title">Subtasks</span>
                                <span class="subtasks-progress">${subtaskProgress}%</span>
                            </div>
                            <div class="subtasks-list">
                                ${task.subtasks.map(subtask => `
                                    <div class="subtask-item" data-subtask-id="${subtask.id}">
                                        <div class="subtask-checkbox ${subtask.completed ? 'checked' : ''}" 
                                             data-action="toggleSubtask" 
                                             data-subtask-id="${subtask.id}"></div>
                                        <span class="subtask-text ${subtask.completed ? 'completed' : ''}">${this._escapeHtml(subtask.text)}</span>
                                        <button class="subtask-delete" data-action="deleteSubtask" data-subtask-id="${subtask.id}">&times;</button>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="subtask-progress-bar">
                                <div class="subtask-progress-fill" style="width: ${subtaskProgress}%"></div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="task-actions">
                    <button class="task-action-btn add-subtask" data-action="addSubtask" title="Add subtask">➕</button>
                    <button class="task-action-btn edit" data-action="edit" title="Edit">✏️</button>
                    <button class="task-action-btn delete" data-action="delete" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }

    render(tasks, taskRepository) {
        let filtered = [...tasks];

        if (this.currentFilter === 'active') {
            filtered = filtered.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        }

        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(t => t.text.toLowerCase().includes(query));
        }

        const container = this.elements.tasksContainer;
        
        if (filtered.length === 0) {
            // Issue 5 Fix: Use contextual empty state
            this.emptyStateManager.update(tasks, this.currentFilter, this.searchQuery);
        } else {
            container.style.display = 'flex';
            this.elements.emptyState.classList.remove('visible');
            container.innerHTML = filtered.map(t => this.renderTaskCard(t)).join('');
            
            // Initialize inline edit if not already done
            if (this.inlineEditManager && !this.inlineEditManager.container) {
                this.inlineEditManager.init(container);
            }
        }

        this.updateCounts(tasks);
    }

    updateCounts(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        const filtered = this._getFilteredCount(tasks);

        const els = this.elements;
        if (els.countAll) els.countAll.textContent = total;
        if (els.countActive) els.countActive.textContent = active;
        if (els.countCompleted) els.countCompleted.textContent = completed;
        if (els.totalTasks) els.totalTasks.textContent = total;

        if (els.taskCountDisplay) {
            const labels = { all: 'All', active: 'Active', completed: 'Completed' };
            els.taskCountDisplay.textContent = `${filtered} ${labels[this.currentFilter]} task${filtered !== 1 ? 's' : ''}`;
        }
    }

    _getFilteredCount(tasks) {
        let filtered = tasks;
        if (this.currentFilter === 'active') {
            filtered = tasks.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            filtered = tasks.filter(t => t.completed);
        }
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(t => t.text.toLowerCase().includes(q));
        }
        return filtered.length;
    }

    _formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    _isOverdue(dateString, completed) {
        if (!dateString || completed) return false;
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    }

    showToast(message, type = 'info', options = {}) {
        const { actionText, onAction, duration = 4000 } = options;
        const container = this.elements.toastContainer;
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${this._escapeHtml(message)}</span>
            ${actionText ? `
                <div class="toast-actions">
                    <button class="toast-action-btn undo">${actionText}</button>
                    <button class="toast-action-btn dismiss">&times;</button>
                </div>
            ` : `
                <button class="toast-action-btn dismiss">&times;</button>
            `}
        `;

        if (actionText && onAction) {
            toast.querySelector('.undo').addEventListener('click', () => {
                onAction();
                this._removeToast(toast);
            });
        }

        toast.querySelector('.dismiss').addEventListener('click', () => this._removeToast(toast));
        container.appendChild(toast);

        toast.timeoutId = setTimeout(() => this._removeToast(toast), duration);
    }

    _removeToast(toast) {
        if (toast.timeoutId) clearTimeout(toast.timeoutId);
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove());
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    _getRecurrenceIcon(type) {
        const icons = {
            daily: '📅',
            weekly: '📆',
            monthly: '🗓️',
            yearly: '📌'
        };
        return icons[type] || '🔄';
    }
}

// Export for use in main app
export { EnhancedUIController, ThemeManager, EmptyStateManager, InlineEditManager };
