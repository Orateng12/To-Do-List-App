/**
 * UI Renderer - Connects TypeScript app to DOM
 * ==============================================
 * Renders tasks, handles user interactions, and updates the UI
 */

import type { Task, Priority, TaskStatus } from '../types';
import { app } from '../main';

export interface UIConfig {
  emptyStateMessages: Record<string, { title: string; message: string }>;
  priorityIcons: Record<Priority, string>;
  statusLabels: Record<TaskStatus, string>;
}

export class UIRenderer {
  private config: UIConfig = {
    emptyStateMessages: {
      all: { title: 'No tasks yet', message: 'Add your first task to get started!' },
      active: { title: 'No active tasks', message: 'All caught up! Add a new task.' },
      completed: { title: 'No completed tasks', message: 'Complete some tasks to see them here.' }
    },
    priorityIcons: {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      critical: '🔴🔴'
    },
    statusLabels: {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      archived: 'Archived'
    }
  };

  // DOM Elements
  private elements: Record<string, HTMLElement | null> = {};

  /**
   * Initialize UI renderer
   */
  init(): void {
    this.cacheElements();
    this.attachEventListeners();
    this.updateCounts();
  }

  /**
   * Cache DOM elements
   */
  private cacheElements(): void {
    this.elements = {
      taskForm: document.getElementById('taskForm'),
      taskInput: document.getElementById('taskInput'),
      prioritySelect: document.getElementById('prioritySelect'),
      dueDateInput: document.getElementById('dueDateInput'),
      recurrenceSelect: document.getElementById('recurrenceSelect'),
      tasksContainer: document.getElementById('tasksContainer'),
      emptyState: document.getElementById('emptyState'),
      emptyStateTitle: document.getElementById('emptyStateTitle'),
      emptyStateMessage: document.getElementById('emptyStateMessage'),
      filterTabs: document.querySelector('.filter-tabs'),
      clearCompleted: document.getElementById('clearCompleted'),
      taskCountDisplay: document.getElementById('taskCountDisplay'),
      countAll: document.getElementById('countAll'),
      countActive: document.getElementById('countActive'),
      countCompleted: document.getElementById('countCompleted'),
      totalTasks: document.getElementById('totalTasks'),
      themeToggle: document.getElementById('themeToggle'),
      themeIcon: document.getElementById('themeIcon'),
      searchInput: document.getElementById('searchInput'),
      searchClear: document.getElementById('searchClear'),
      editModal: document.getElementById('editModal'),
      editForm: document.getElementById('editForm'),
      editTaskInput: document.getElementById('editTaskInput'),
      editPrioritySelect: document.getElementById('editPrioritySelect'),
      editDueDateInput: document.getElementById('editDueDateInput'),
      modalClose: document.getElementById('modalClose'),
      cancelEdit: document.getElementById('cancelEdit'),
      sidebar: document.getElementById('sidebar'),
      menuToggle: document.getElementById('menuToggle'),
      closeSidebar: document.getElementById('closeSidebar'),
      sidebarOverlay: document.getElementById('sidebarOverlay'),
      streakWidget: document.getElementById('streakWidget'),
      streakCount: document.getElementById('streakCount')
    };
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Task form submission
    this.elements.taskForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTaskSubmit();
    });

    // Filter tabs
    this.elements.filterTabs?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('filter-tab')) {
        this.handleFilterChange(target.dataset.filter || 'all');
      }
    });

    // Clear completed
    this.elements.clearCompleted?.addEventListener('click', () => {
      this.handleClearCompleted();
    });

    // Theme toggle
    this.elements.themeToggle?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Search
    this.elements.searchInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.handleSearch(target.value);
    });

    this.elements.searchClear?.addEventListener('click', () => {
      const input = this.elements.searchInput as HTMLInputElement;
      if (input) input.value = '';
      this.handleSearch('');
    });

    // Modal close
    this.elements.modalClose?.addEventListener('click', () => this.closeEditModal());
    this.elements.cancelEdit?.addEventListener('click', () => this.closeEditModal());
    this.elements.editModal?.querySelector('.modal-overlay')?.addEventListener('click', () => this.closeEditModal());

    // Edit form
    this.elements.editForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEditSubmit();
    });

    // Mobile sidebar
    this.elements.menuToggle?.addEventListener('click', () => this.toggleSidebar());
    this.elements.closeSidebar?.addEventListener('click', () => this.closeSidebar());
    this.elements.sidebarOverlay?.addEventListener('click', () => this.closeSidebar());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  /**
   * Render tasks list
   */
  renderTasks(tasks: Task[], filter: string = 'all'): void {
    const container = this.elements.tasksContainer;
    if (!container) return;

    // Filter tasks
    let filteredTasks = tasks;

    switch (filter) {
      case 'active':
        filteredTasks = tasks.filter(t => t.status !== 'completed');
        break;
      case 'completed':
        filteredTasks = tasks.filter(t => t.status === 'completed');
        break;
    }

    // Sort by priority and date
    filteredTasks.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Update empty state
    this.updateEmptyState(filteredTasks.length, filter);

    // Render tasks
    if (filteredTasks.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = filteredTasks.map(task => this.renderTaskCard(task)).join('');

    // Attach task-specific event listeners
    this.attachTaskListeners(container);
  }

  /**
   * Render single task card
   */
  private renderTaskCard(task: Task): string {
    const priorityIcon = this.config.priorityIcons[task.priority];
    const isCompleted = task.status === 'completed';
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;

    return `
      <div class="task-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
        <div class="task-checkbox">
          <input 
            type="checkbox" 
            class="task-checkbox-input" 
            ${isCompleted ? 'checked' : ''}
            aria-label="Mark task as complete"
          >
        </div>
        <div class="task-content">
          <div class="task-header">
            <span class="task-text">${this.escapeHtml(task.text)}</span>
            <span class="priority-badge">${priorityIcon}</span>
          </div>
          ${task.description ? `<p class="task-description">${this.escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta">
            ${task.dueDate ? `
              <span class="task-due ${isOverdue ? 'overdue' : ''}">
                📅 ${this.formatDate(task.dueDate)}
              </span>
            ` : ''}
            ${task.recurrence && task.recurrence !== 'none' ? `
              <span class="task-recurrence">🔁 ${task.recurrence}</span>
            ` : ''}
            ${task.subtasks?.length ? `
              <span class="task-subtasks">
                📋 ${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length}
              </span>
            ` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-edit" aria-label="Edit task" title="Edit">✏️</button>
          <button class="btn-delete" aria-label="Delete task" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to task cards
   */
  private attachTaskListeners(container: HTMLElement): void {
    // Checkbox changes
    container.querySelectorAll('.task-checkbox-input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const taskCard = (e.target as HTMLElement).closest('.task-card') as HTMLElement;
        const taskId = taskCard?.dataset.taskId;
        if (taskId) this.handleTaskComplete(taskId, (e.target as HTMLInputElement).checked);
      });
    });

    // Edit buttons
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskCard = (e.target as HTMLElement).closest('.task-card') as HTMLElement;
        const taskId = taskCard?.dataset.taskId;
        if (taskId) this.handleEditTask(taskId);
      });
    });

    // Delete buttons
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskCard = (e.target as HTMLElement).closest('.task-card') as HTMLElement;
        const taskId = taskCard?.dataset.taskId;
        if (taskId) this.handleDeleteTask(taskId);
      });
    });
  }

  /**
   * Handle task form submission
   */
  private async handleTaskSubmit(): Promise<void> {
    const input = this.elements.taskInput as HTMLInputElement;
    const prioritySelect = this.elements.prioritySelect as HTMLSelectElement;
    const dueDateInput = this.elements.dueDateInput as HTMLInputElement;
    const recurrenceSelect = this.elements.recurrenceSelect as HTMLSelectElement;

    if (!input?.value.trim()) return;

    const text = input.value.trim();
    const priority = prioritySelect?.value as Priority || 'medium';
    const dueDate = dueDateInput?.value;
    const recurrence = recurrenceSelect?.value || 'none';

    try {
      await app.executeCommand({
        id: this.generateId(),
        type: 'CREATE_TASK',
        payload: {
          text,
          options: {
            priority,
            dueDate,
            recurrence: recurrence as any
          }
        },
        metadata: {},
        timestamp: new Date().toISOString()
      });

      // Clear form
      input.value = '';
      prioritySelect.value = '';
      dueDateInput.value = '';
      recurrenceSelect.value = 'none';

      // Refresh UI
      this.refresh();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  }

  /**
   * Handle filter change
   */
  private handleFilterChange(filter: string): void {
    // Update active state
    document.querySelectorAll('.filter-tab').forEach(tab => {
      const el = tab as HTMLElement;
      tab.classList.toggle('active', el.dataset?.filter === filter);
    });

    document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
      const el = item as HTMLElement;
      item.classList.toggle('active', el.dataset?.filter === filter);
    });

    // Refresh tasks with new filter
    this.refresh(filter);
  }

  /**
   * Handle task complete toggle
   */
  private async handleTaskComplete(taskId: string, completed: boolean): Promise<void> {
    try {
      if (completed) {
        await app.executeCommand({
          id: this.generateId(),
          type: 'COMPLETE_TASK',
          payload: { taskId },
          metadata: {},
          timestamp: new Date().toISOString()
        });
      }
      this.refresh();
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  }

  /**
   * Handle edit task
   */
  private async handleEditTask(taskId: string): Promise<void> {
    const tasks = app.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Populate edit form
    const editInput = this.elements.editTaskInput as HTMLInputElement;
    const editPriority = this.elements.editPrioritySelect as HTMLSelectElement;
    const editDueDate = this.elements.editDueDateInput as HTMLInputElement;

    if (editInput) editInput.value = task.text;
    if (editPriority) editPriority.value = task.priority;
    if (editDueDate && task.dueDate) {
      editDueDate.value = task.dueDate.split('T')[0]!;
    }

    // Store task ID for save
    this.elements.editForm?.setAttribute('data-task-id', taskId);

    // Show modal
    this.elements.editModal?.classList.add('active');
  }

  /**
   * Close edit modal
   */
  private closeEditModal(): void {
    this.elements.editModal?.classList.remove('active');
  }

  /**
   * Handle edit form submission
   */
  private async handleEditSubmit(): Promise<void> {
    const taskId = this.elements.editForm?.getAttribute('data-task-id');
    if (!taskId) return;

    const editInput = this.elements.editTaskInput as HTMLInputElement;
    const editPriority = this.elements.editPrioritySelect as HTMLSelectElement;
    const editDueDate = this.elements.editDueDateInput as HTMLInputElement;

    // In a full implementation, this would dispatch an UPDATE_TASK command
    console.log('Update task:', taskId, {
      text: editInput?.value,
      priority: editPriority?.value,
      dueDate: editDueDate?.value
    });

    this.closeEditModal();
    this.refresh();
  }

  /**
   * Handle delete task
   */
  private async handleDeleteTask(taskId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await app.executeCommand({
        id: this.generateId(),
        type: 'DELETE_TASK',
        payload: { taskId },
        metadata: {},
        timestamp: new Date().toISOString()
      });
      this.refresh();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }

  /**
   * Handle clear completed tasks
   */
  private async handleClearCompleted(): Promise<void> {
    if (!confirm('Are you sure you want to clear all completed tasks?')) return;

    const tasks = app.getTasks();
    const completedTasks = tasks.filter(t => t.status === 'completed');

    for (const task of completedTasks) {
      await app.executeCommand({
        id: this.generateId(),
        type: 'DELETE_TASK',
        payload: { taskId: task.id },
        metadata: {},
        timestamp: new Date().toISOString()
      });
    }

    this.refresh();
  }

  /**
   * Handle search
   */
  private async handleSearch(query: string): Promise<void> {
    const tasks = app.getTasks();

    if (!query.trim()) {
      this.renderTasks(tasks);
      return;
    }

    const filtered = tasks.filter(t =>
      t.text.toLowerCase().includes(query.toLowerCase()) ||
      t.description?.toLowerCase().includes(query.toLowerCase()) ||
      t.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );

    this.renderTasks(filtered);
  }

  /**
   * Toggle theme
   */
  private toggleTheme(): void {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('taskmaster-theme', newTheme);

    const icon = this.elements.themeIcon as HTMLElement;
    if (icon) icon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
  }

  /**
   * Toggle mobile sidebar
   */
  private toggleSidebar(): void {
    this.elements.sidebar?.classList.add('active');
    this.elements.sidebarOverlay?.classList.add('active');
  }

  /**
   * Close mobile sidebar
   */
  private closeSidebar(): void {
    this.elements.sidebar?.classList.remove('active');
    this.elements.sidebarOverlay?.classList.remove('active');
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyboard(e: KeyboardEvent): void {
    // Focus search with /
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      e.preventDefault();
      (this.elements.searchInput as HTMLInputElement)?.focus();
    }

    // Close modal with Escape
    if (e.key === 'Escape') {
      this.closeEditModal();
      this.closeSidebar();
    }
  }

  /**
   * Update empty state
   */
  private updateEmptyState(count: number, filter: string): void {
    const emptyState = this.elements.emptyState;
    const emptyStateTitle = this.elements.emptyStateTitle;
    const emptyStateMessage = this.elements.emptyStateMessage;

    if (!emptyState || !emptyStateTitle || !emptyStateMessage) return;

    if (count === 0) {
      const messages = this.config.emptyStateMessages[filter] || this.config.emptyStateMessages.all;
      emptyStateTitle.textContent = messages!.title;
      emptyStateMessage.textContent = messages!.message;
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }
  }

  /**
   * Update task counts
   */
  updateCounts(): void {
    const tasks = app.getTasks();
    const active = tasks.filter(t => t.status !== 'completed').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    if (this.elements.countAll) this.elements.countAll.textContent = String(tasks.length);
    if (this.elements.countActive) this.elements.countActive.textContent = String(active);
    if (this.elements.countCompleted) this.elements.countCompleted.textContent = String(completed);
    if (this.elements.totalTasks) this.elements.totalTasks.textContent = String(tasks.length);
    if (this.elements.taskCountDisplay) {
      this.elements.taskCountDisplay.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Refresh UI
   */
  refresh(filter: string = 'all'): void {
    const tasks = app.getTasks();
    this.renderTasks(tasks, filter);
    this.updateCounts();
  }

  /**
   * Utility: Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Utility: Format date
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Utility: Generate ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const uiRenderer = new UIRenderer();
