/**
 * Bulk Operations & Quick Actions Manager
 * ========================================
 * Multi-select, context menu, and batch operations for efficient task management
 *
 * Features:
 * - Multi-select tasks
 * - Context menu (right-click)
 * - Batch operations (complete, delete, move, edit)
 * - Keyboard shortcuts for bulk actions
 * - Quick action toolbar
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class BulkOperationsManager {
    constructor(taskRepository, ui) {
        this.taskRepository = taskRepository;
        this.ui = ui;
        this.selectedTasks = new Set();
        this.selectionMode = false;
        
        this.contextMenuElement = null;
        this._initContextMenu();
    }

    /**
     * Toggle selection mode
     * @param {boolean} enabled - Enable/disable selection mode
     */
    setSelectionMode(enabled) {
        this.selectionMode = enabled;
        if (!enabled) {
            this.clearSelection();
        }
        eventBus.emit(AppEvents.SELECTION_MODE_CHANGED, { enabled });
    }

    /**
     * Toggle task selection
     * @param {string} taskId - Task ID
     */
    toggleSelection(taskId) {
        if (this.selectedTasks.has(taskId)) {
            this.selectedTasks.delete(taskId);
        } else {
            this.selectedTasks.add(taskId);
        }
        
        eventBus.emit(AppEvents.SELECTION_CHANGED, { 
            selected: Array.from(this.selectedTasks),
            count: this.selectedTasks.size
        });

        this._updateSelectionUI();
    }

    /**
     * Select a single task (deselect others)
     * @param {string} taskId - Task ID
     */
    selectSingle(taskId) {
        this.selectedTasks.clear();
        this.selectedTasks.add(taskId);
        
        eventBus.emit(AppEvents.SELECTION_CHANGED, { 
            selected: [taskId],
            count: 1
        });

        this._updateSelectionUI();
    }

    /**
     * Select a range of tasks
     * @param {string} fromTaskId - Start task ID
     * @param {string} toTaskId - End task ID
     * @param {Array} allTaskIds - All visible task IDs in order
     */
    selectRange(fromTaskId, toTaskId, allTaskIds) {
        const fromIndex = allTaskIds.indexOf(fromTaskId);
        const toIndex = allTaskIds.indexOf(toTaskId);
        
        if (fromIndex === -1 || toIndex === -1) return;

        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);

        for (let i = start; i <= end; i++) {
            this.selectedTasks.add(allTaskIds[i]);
        }

        eventBus.emit(AppEvents.SELECTION_CHANGED, { 
            selected: Array.from(this.selectedTasks),
            count: this.selectedTasks.size
        });

        this._updateSelectionUI();
    }

    /**
     * Select all visible tasks
     * @param {Array} taskIds - Task IDs to select
     */
    selectAll(taskIds) {
        taskIds.forEach(id => this.selectedTasks.add(id));
        
        eventBus.emit(AppEvents.SELECTION_CHANGED, { 
            selected: Array.from(this.selectedTasks),
            count: this.selectedTasks.size
        });

        this._updateSelectionUI();
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selectedTasks.clear();
        
        eventBus.emit(AppEvents.SELECTION_CHANGED, { 
            selected: [],
            count: 0
        });

        this._updateSelectionUI();
    }

    /**
     * Get selected task IDs
     * @returns {Array} Selected task IDs
     */
    getSelected() {
        return Array.from(this.selectedTasks);
    }

    /**
     * Batch complete selected tasks
     * @returns {Promise<Array>} Completed tasks
     */
    async batchComplete() {
        const selectedIds = this.getSelected();
        if (selectedIds.length === 0) {
            this.ui.showToast('No tasks selected', 'warning');
            return [];
        }

        const completed = [];
        for (const taskId of selectedIds) {
            const task = await this.taskRepository.getById(taskId);
            if (task && !task.completed) {
                task.completed = true;
                task.completedAt = new Date().toISOString();
                task.updatedAt = new Date().toISOString();
                await this.taskRepository.save(task);
                completed.push(task);
            }
        }

        this.ui.showToast(`Completed ${completed.length} task(s)`, 'success');
        eventBus.emit(AppEvents.BATCH_COMPLETE, { completed, count: completed.length });
        
        this.clearSelection();
        return completed;
    }

    /**
     * Batch delete selected tasks
     * @returns {Promise<Array>} Deleted tasks
     */
    async batchDelete() {
        const selectedIds = this.getSelected();
        if (selectedIds.length === 0) {
            this.ui.showToast('No tasks selected', 'warning');
            return [];
        }

        const deleted = [];
        for (const taskId of selectedIds) {
            const task = await this.taskRepository.getById(taskId);
            if (task) {
                await this.taskRepository.delete(taskId);
                deleted.push(task);
            }
        }

        this.ui.showToast(`Deleted ${deleted.length} task(s)`, 'info', {
            actionText: 'Undo',
            onAction: () => this._undoDelete(deleted),
            duration: 5000
        });

        eventBus.emit(AppEvents.BATCH_DELETE, { deleted, count: deleted.length });
        
        this.clearSelection();
        return deleted;
    }

    /**
     * Batch update priority for selected tasks
     * @param {string} priority - New priority
     * @returns {Promise<Array>} Updated tasks
     */
    async batchSetPriority(priority) {
        const selectedIds = this.getSelected();
        if (selectedIds.length === 0) {
            this.ui.showToast('No tasks selected', 'warning');
            return [];
        }

        const updated = [];
        for (const taskId of selectedIds) {
            const task = await this.taskRepository.getById(taskId);
            if (task && task.priority !== priority) {
                task.priority = priority;
                task.updatedAt = new Date().toISOString();
                await this.taskRepository.save(task);
                updated.push(task);
            }
        }

        this.ui.showToast(`Updated priority for ${updated.length} task(s)`, 'success');
        eventBus.emit(AppEvents.BATCH_PRIORITY, { updated, priority, count: updated.length });
        
        return updated;
    }

    /**
     * Batch update category for selected tasks
     * @param {string} category - New category
     * @returns {Promise<Array>} Updated tasks
     */
    async batchSetCategory(category) {
        const selectedIds = this.getSelected();
        if (selectedIds.length === 0) {
            this.ui.showToast('No tasks selected', 'warning');
            return [];
        }

        const updated = [];
        for (const taskId of selectedIds) {
            const task = await this.taskRepository.getById(taskId);
            if (task) {
                if (!task.categories) task.categories = [];
                if (!task.categories.includes(category)) {
                    task.categories.push(category);
                    task.updatedAt = new Date().toISOString();
                    await this.taskRepository.save(task);
                    updated.push(task);
                }
            }
        }

        this.ui.showToast(`Added category to ${updated.length} task(s)`, 'success');
        eventBus.emit(AppEvents.BATCH_CATEGORY, { updated, category, count: updated.length });
        
        return updated;
    }

    /**
     * Batch export selected tasks
     * @param {string} format - Export format (json, csv, txt)
     * @returns {Object} Export data
     */
    async batchExport(format = 'json') {
        const selectedIds = this.getSelected();
        if (selectedIds.length === 0) {
            this.ui.showToast('No tasks selected', 'warning');
            return null;
        }

        const tasks = [];
        for (const taskId of selectedIds) {
            const task = await this.taskRepository.getById(taskId);
            if (task) {
                tasks.push(task);
            }
        }

        let exportData, mimeType, extension;

        switch (format) {
            case 'csv':
                exportData = this._toCSV(tasks);
                mimeType = 'text/csv';
                extension = 'csv';
                break;
            case 'txt':
                exportData = this._toText(tasks);
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            case 'json':
            default:
                exportData = JSON.stringify(tasks, null, 2);
                mimeType = 'application/json';
                extension = 'json';
        }

        this._downloadFile(exportData, `tasks-export.${extension}`, mimeType);
        
        eventBus.emit(AppEvents.BATCH_EXPORT, { count: tasks.length, format });
        
        return { tasks, format };
    }

    /**
     * Show context menu at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} taskId - Task ID for context
     */
    showContextMenu(x, y, taskId) {
        if (!this.contextMenuElement) return;

        // Select the task if not already selected
        if (taskId && !this.selectedTasks.has(taskId)) {
            this.selectSingle(taskId);
        }

        const menu = this.contextMenuElement;
        const hasSelection = this.selectedTasks.size > 0;

        // Update menu items based on selection
        this._updateContextMenu(hasSelection);

        // Position menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
        menu.dataset.taskId = taskId || '';

        // Keep menu within viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }

        eventBus.emit(AppEvents.CONTEXT_MENU_OPEN, { x, y, taskId });
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        if (this.contextMenuElement) {
            this.contextMenuElement.style.display = 'none';
        }
        eventBus.emit(AppEvents.CONTEXT_MENU_CLOSED);
    }

    /**
     * Get selection info
     * @returns {Object} Selection information
     */
    getSelectionInfo() {
        const selectedIds = this.getSelected();
        return {
            count: selectedIds.length,
            selectedIds,
            hasSelection: selectedIds.length > 0,
            allCompleted: selectedIds.length > 0 && selectedIds.every(id => {
                const task = this.taskRepository.memoryCache?.get(id);
                return task?.completed;
            }),
            mixedCompletion: selectedIds.length > 1
        };
    }

    // ==================== Private Methods ====================

    _initContextMenu() {
        // Create context menu element
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.id = 'bulkContextMenu';
        menu.style.display = 'none';
        
        menu.innerHTML = `
            <div class="context-menu-item" data-action="complete">
                <span class="icon">✓</span>
                <span class="label">Complete</span>
            </div>
            <div class="context-menu-item" data-action="uncomplete">
                <span class="icon">↩</span>
                <span class="label">Mark Incomplete</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="priority-high">
                <span class="icon">🔴</span>
                <span class="label">Set High Priority</span>
            </div>
            <div class="context-menu-item" data-action="priority-medium">
                <span class="icon">🟡</span>
                <span class="label">Set Medium Priority</span>
            </div>
            <div class="context-menu-item" data-action="priority-low">
                <span class="icon">🟢</span>
                <span class="label">Set Low Priority</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="select-all">
                <span class="icon">☑</span>
                <span class="label">Select All Visible</span>
            </div>
            <div class="context-menu-item" data-action="invert">
                <span class="icon">⇄</span>
                <span class="label">Invert Selection</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="export-json">
                <span class="icon">📄</span>
                <span class="label">Export as JSON</span>
            </div>
            <div class="context-menu-item" data-action="export-csv">
                <span class="icon">📊</span>
                <span class="label">Export as CSV</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" data-action="delete">
                <span class="icon">🗑</span>
                <span class="label">Delete</span>
            </div>
        `;

        // Add event listeners
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                const action = item.dataset.action;
                this._handleContextMenuAction(action);
                this.hideContextMenu();
            }
        });

        document.body.appendChild(menu);
        this.contextMenuElement = menu;

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });

        // Prevent default context menu on task cards
        document.addEventListener('contextmenu', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (taskCard) {
                e.preventDefault();
                const taskId = taskCard.dataset.taskId;
                this.showContextMenu(e.clientX, e.clientY, taskId);
            }
        });
    }

    _updateContextMenu(hasSelection) {
        if (!this.contextMenuElement) return;
        
        const items = this.contextMenuElement.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            const action = item.dataset.action;
            if (['complete', 'uncomplete', 'delete', 'export-json', 'export-csv'].includes(action)) {
                item.style.display = hasSelection ? 'flex' : 'none';
            }
        });
    }

    _handleContextMenuAction(action) {
        switch (action) {
            case 'complete':
                this.batchComplete();
                break;
            case 'uncomplete':
                this.batchUncomplete();
                break;
            case 'priority-high':
                this.batchSetPriority('high');
                break;
            case 'priority-medium':
                this.batchSetPriority('medium');
                break;
            case 'priority-low':
                this.batchSetPriority('low');
                break;
            case 'select-all':
                this._selectAllVisible();
                break;
            case 'invert':
                this._invertSelection();
                break;
            case 'export-json':
                this.batchExport('json');
                break;
            case 'export-csv':
                this.batchExport('csv');
                break;
            case 'delete':
                this.batchDelete();
                break;
        }
    }

    async _undoDelete(deletedTasks) {
        for (const task of deletedTasks) {
            task.completed = false;
            await this.taskRepository.save(task);
        }
        this.ui.showToast('Tasks restored', 'success');
    }

    async batchUncomplete() {
        const selectedIds = this.getSelected();
        if (selectedIds.length === 0) {
            this.ui.showToast('No tasks selected', 'warning');
            return [];
        }

        const uncompleted = [];
        for (const taskId of selectedIds) {
            const task = await this.taskRepository.getById(taskId);
            if (task && task.completed) {
                task.completed = false;
                task.updatedAt = new Date().toISOString();
                await this.taskRepository.save(task);
                uncompleted.push(task);
            }
        }

        this.ui.showToast(`Marked ${uncompleted.length} task(s) as incomplete`, 'success');
        eventBus.emit(AppEvents.BATCH_UNCOMPLETE, { uncompleted, count: uncompleted.length });
        
        this.clearSelection();
        return uncompleted;
    }

    _selectAllVisible() {
        const visibleTasks = document.querySelectorAll('.task-card');
        const taskIds = Array.from(visibleTasks).map(card => card.dataset.taskId);
        this.selectAll(taskIds);
        this.ui.showToast(`Selected ${taskIds.length} task(s)`, 'info');
    }

    _invertSelection() {
        const visibleTasks = document.querySelectorAll('.task-card');
        const visibleIds = Array.from(visibleTasks).map(card => card.dataset.taskId);
        
        visibleIds.forEach(id => {
            if (this.selectedTasks.has(id)) {
                this.selectedTasks.delete(id);
            } else {
                this.selectedTasks.add(id);
            }
        });

        eventBus.emit(AppEvents.SELECTION_CHANGED, { 
            selected: Array.from(this.selectedTasks),
            count: this.selectedTasks.size
        });

        this._updateSelectionUI();
        this.ui.showToast('Selection inverted', 'info');
    }

    _updateSelectionUI() {
        // Update task card selection state
        document.querySelectorAll('.task-card').forEach(card => {
            const taskId = card.dataset.taskId;
            if (this.selectedTasks.has(taskId)) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Update selection toolbar if exists
        const toolbar = document.getElementById('selectionToolbar');
        if (toolbar) {
            const count = this.selectedTasks.size;
            toolbar.style.display = count > 0 ? 'flex' : 'none';
            toolbar.querySelector('.selection-count')?.textContent = `${count} selected`;
        }

        // Show/hide selection mode indicator
        const selectionModeIndicator = document.getElementById('selectionModeIndicator');
        if (selectionModeIndicator) {
            selectionModeIndicator.classList.toggle('active', this.selectionMode || this.selectedTasks.size > 0);
        }
    }

    _toCSV(tasks) {
        const headers = ['ID', 'Text', 'Priority', 'Completed', 'Due Date', 'Created At'];
        const rows = tasks.map(t => [
            t.id,
            `"${t.text.replace(/"/g, '""')}"`,
            t.priority,
            t.completed ? 'Yes' : 'No',
            t.dueDate || '',
            t.createdAt
        ]);
        
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    _toText(tasks) {
        return tasks.map(t => {
            const status = t.completed ? '✓' : '○';
            const priority = t.priority ? `[${t.priority.toUpperCase()}]` : '';
            const due = t.dueDate ? ` (Due: ${t.dueDate})` : '';
            return `${status} ${priority} ${t.text}${due}`;
        }).join('\n');
    }

    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Additional events
AppEvents.SELECTION_MODE_CHANGED = 'selection:mode_changed';
AppEvents.SELECTION_CHANGED = 'selection:changed';
AppEvents.BATCH_COMPLETE = 'batch:complete';
AppEvents.BATCH_UN_COMPLETE = 'batch:uncomplete';
AppEvents.BATCH_DELETE = 'batch:delete';
AppEvents.BATCH_PRIORITY = 'batch:priority';
AppEvents.BATCH_CATEGORY = 'batch:category';
AppEvents.BATCH_EXPORT = 'batch:export';
AppEvents.CONTEXT_MENU_OPEN = 'contextmenu:open';
AppEvents.CONTEXT_MENU_CLOSED = 'contextmenu:closed';

export { BulkOperationsManager };
