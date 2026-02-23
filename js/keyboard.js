/**
 * Keyboard Shortcuts Handler
 * ===========================
 * Provides keyboard navigation and quick actions
 */

import { eventBus, EVENTS } from './event-bus.js';
import { stateManager } from './state.js';
import { uiRenderer } from './ui.js';

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }

    /**
     * Initialize keyboard shortcuts
     */
    init() {
        // Register all shortcuts
        this.register('ctrl+enter, meta+enter', 'Add task', () => {
            const form = document.getElementById('taskForm');
            if (form) form.dispatchEvent(new Event('submit'));
        });

        this.register('ctrl+k, meta+k', 'Search', (e) => {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
        });

        this.register('ctrl+n, meta+n', 'New task', (e) => {
            e.preventDefault();
            const taskInput = document.getElementById('taskInput');
            if (taskInput) taskInput.focus();
        });

        this.register('ctrl+z, meta+z', 'Undo', (e) => {
            e.preventDefault();
            if (stateManager.canUndo()) {
                stateManager.undo();
                uiRenderer.showToast('Undo successful', 'info');
            }
        });

        this.register('ctrl+y, meta+y, ctrl+shift+z, meta+shift+z', 'Redo', (e) => {
            e.preventDefault();
            if (stateManager.canRedo()) {
                stateManager.redo();
                uiRenderer.showToast('Redo successful', 'info');
            }
        });

        this.register('escape', 'Close modal/sidebar', () => {
            uiRenderer.closeEditModal();
            uiRenderer.closeSidebar();
        });

        this.register('ctrl+/, meta+/', 'Show shortcuts', (e) => {
            e.preventDefault();
            this.showShortcutsHelp();
        });

        this.register('delete, backspace', 'Delete selected task', (e) => {
            // Only if not in an input field
            if (this.isInputFocused()) return;
            
            const selectedTask = document.querySelector('.task-card.selected');
            if (selectedTask) {
                const taskId = selectedTask.dataset.taskId;
                stateManager.deleteTask(taskId);
                uiRenderer.showToast('Task deleted', 'success');
            }
        });

        this.register('enter', 'Toggle selected task', (e) => {
            if (this.isInputFocused()) return;
            
            const selectedTask = document.querySelector('.task-card.selected');
            if (selectedTask) {
                e.preventDefault();
                stateManager.toggleTask(selectedTask.dataset.taskId);
            }
        });

        this.register('j, arrowdown', 'Select next task', (e) => {
            if (this.isInputFocused()) return;
            e.preventDefault();
            this.selectNextTask();
        });

        this.register('k, arrowup', 'Select previous task', (e) => {
            if (this.isInputFocused()) return;
            e.preventDefault();
            this.selectPreviousTask();
        });

        this.register('e', 'Edit selected task', (e) => {
            if (this.isInputFocused()) return;
            
            const selectedTask = document.querySelector('.task-card.selected');
            if (selectedTask) {
                e.preventDefault();
                uiRenderer.openEditModal(selectedTask.dataset.taskId);
            }
        });

        this.register('c', 'Complete selected task', (e) => {
            if (this.isInputFocused()) return;
            
            const selectedTask = document.querySelector('.task-card.selected');
            if (selectedTask) {
                e.preventDefault();
                stateManager.toggleTask(selectedTask.dataset.taskId);
            }
        });

        this.register('t', 'Toggle theme', () => {
            if (this.isInputFocused()) return;
            uiRenderer.toggleTheme();
        });

        // Listen for keydown events
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    /**
     * Register a keyboard shortcut
     * @param {string} keys - Key combination (comma-separated for multiple)
     * @param {string} description - Description of the shortcut
     * @param {Function} handler - Handler function
     */
    register(keys, description, handler) {
        const keyList = keys.split(',').map(k => k.trim().toLowerCase());
        keyList.forEach(key => {
            this.shortcuts.set(key, { description, handler });
        });
    }

    /**
     * Handle keydown event
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeydown(e) {
        const key = this.normalizeKey(e);
        const shortcut = this.shortcuts.get(key);

        if (shortcut) {
            // Don't trigger if in input field (except for specific shortcuts)
            if (this.isInputFocused() && !this.shouldTriggerInInput(key)) {
                return;
            }

            shortcut.handler(e);
        }
    }

    /**
     * Normalize key combination to string
     * @param {KeyboardEvent} e - Keyboard event
     * @returns {string} Normalized key string
     */
    normalizeKey(e) {
        const parts = [];

        if (e.ctrlKey) parts.push('ctrl');
        if (e.metaKey) parts.push('meta');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        const key = e.key.toLowerCase();
        if (!['control', 'meta', 'shift', 'alt'].includes(key)) {
            parts.push(key);
        }

        return parts.join('+');
    }

    /**
     * Check if an input field is focused
     * @returns {boolean}
     */
    isInputFocused() {
        const active = document.activeElement;
        return active.tagName === 'INPUT' || 
               active.tagName === 'TEXTAREA' || 
               active.tagName === 'SELECT' ||
               active.isContentEditable;
    }

    /**
     * Check if shortcut should trigger in input fields
     * @param {string} key - Key combination
     * @returns {boolean}
     */
    shouldTriggerInInput(key) {
        const inputShortcuts = ['escape', 'ctrl+enter', 'meta+enter'];
        return inputShortcuts.some(k => key.includes(k));
    }

    /**
     * Select next task in the list
     */
    selectNextTask() {
        const tasks = document.querySelectorAll('.task-card');
        const selected = document.querySelector('.task-card.selected');
        
        if (!selected) {
            if (tasks.length > 0) tasks[0].classList.add('selected');
            return;
        }

        const currentIndex = Array.from(tasks).indexOf(selected);
        if (currentIndex < tasks.length - 1) {
            selected.classList.remove('selected');
            tasks[currentIndex + 1].classList.add('selected');
            tasks[currentIndex + 1].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Select previous task in the list
     */
    selectPreviousTask() {
        const tasks = document.querySelectorAll('.task-card');
        const selected = document.querySelector('.task-card.selected');
        
        if (!selected) {
            if (tasks.length > 0) tasks[tasks.length - 1].classList.add('selected');
            return;
        }

        const currentIndex = Array.from(tasks).indexOf(selected);
        if (currentIndex > 0) {
            selected.classList.remove('selected');
            tasks[currentIndex - 1].classList.add('selected');
            tasks[currentIndex - 1].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Show keyboard shortcuts help modal
     */
    showShortcutsHelp() {
        const helpContent = `
            <div class="shortcuts-help">
                <h3>Keyboard Shortcuts</h3>
                <div class="shortcuts-grid">
                    ${Array.from(this.shortcuts.entries()).map(([key, { description }]) => `
                        <div class="shortcut-item">
                            <kbd>${key}</kbd>
                            <span>${description}</span>
                        </div>
                    `).join('')}
                </div>
                <p class="shortcuts-hint">Press <kbd>Esc</kbd> to close</p>
            </div>
        `;

        // Create or show existing help modal
        let modal = document.getElementById('shortcutsHelpModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'shortcutsHelpModal';
            modal.className = 'modal shortcuts-modal';
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-content">${helpContent}</div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.modal-overlay').addEventListener('click', () => {
                modal.classList.remove('visible');
            });
        } else {
            modal.querySelector('.modal-content').innerHTML = helpContent;
        }

        modal.classList.add('visible');
    }
}

// Export singleton instance
export const keyboardShortcuts = new KeyboardShortcuts();
