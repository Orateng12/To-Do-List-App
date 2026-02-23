/**
 * Drag and Drop with Virtual Scrolling
 * ======================================
 * High-performance drag-and-drop for 10,000+ tasks
 */

import { eventBus, EVENTS } from '../event-bus.js';

export class DragDropManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.draggedItem = null;
        this.draggedElement = null;
        this.placeholder = null;
        this.startIndex = -1;
        this.endIndex = -1;
        
        this.init();
    }

    init() {
        this.createPlaceholder();
        this.bindEvents();
    }

    /**
     * Create placeholder element for drag preview
     */
    createPlaceholder() {
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'drag-placeholder';
        this.placeholder.innerHTML = '<div class="placeholder-content"></div>';
    }

    /**
     * Bind drag and drop events
     */
    bindEvents() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;

        // Use event delegation for efficiency
        container.addEventListener('dragstart', (e) => this.handleDragStart(e));
        container.addEventListener('dragend', (e) => this.handleDragEnd(e));
        container.addEventListener('dragover', (e) => this.handleDragOver(e));
        container.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        container.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        container.addEventListener('drop', (e) => this.handleDrop(e));

        // Touch support for mobile
        container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
        container.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    /**
     * Handle drag start
     */
    handleDragStart(e) {
        const card = e.target.closest('.task-card');
        if (!card) return;

        this.draggedItem = card;
        this.draggedElement = card;
        this.startIndex = Array.from(card.parentNode.children).indexOf(card);

        // Set drag data
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.taskId);

        // Add dragging class
        card.classList.add('dragging');

        // Create drag image
        const dragImage = card.cloneNode(true);
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);

        // Store for cleanup
        this.dragImage = dragImage;

        eventBus.emit(EVENTS.DRAG_STARTED, { 
            taskId: card.dataset.taskId,
            index: this.startIndex 
        });
    }

    /**
     * Handle drag end
     */
    handleDragEnd(e) {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }

        if (this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }

        if (this.dragImage) {
            document.body.removeChild(this.dragImage);
            this.dragImage = null;
        }

        // If item was dropped in a valid position
        if (this.endIndex >= 0 && this.startIndex !== this.endIndex) {
            this.reorderTasks(this.startIndex, this.endIndex);
        }

        eventBus.emit(EVENTS.DRAG_ENDED, {
            startIndex: this.startIndex,
            endIndex: this.endIndex
        });

        // Reset state
        this.draggedItem = null;
        this.draggedElement = null;
        this.startIndex = -1;
        this.endIndex = -1;
    }

    /**
     * Handle drag over
     */
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * Handle drag enter
     */
    handleDragEnter(e) {
        const card = e.target.closest('.task-card');
        if (!card || card === this.draggedElement) return;

        // Move placeholder
        const rect = card.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
            card.parentNode.insertBefore(this.placeholder, card);
        } else {
            card.parentNode.insertBefore(this.placeholder, card.nextSibling);
        }

        this.endIndex = Array.from(this.placeholder.parentNode.children).indexOf(this.placeholder) - 1;
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(e) {
        // No-op for now
    }

    /**
     * Handle drop
     */
    handleDrop(e) {
        e.preventDefault();
    }

    /**
     * Reorder tasks in state manager
     */
    reorderTasks(fromIndex, toIndex) {
        const tasks = this.stateManager.tasks;
        
        // Adjust indices for filtered view
        const filteredTasks = this.stateManager.getFilteredTasks();
        
        if (fromIndex < 0 || toIndex < 0 || 
            fromIndex >= tasks.length || toIndex >= tasks.length) {
            return;
        }

        // Save state for undo
        this.stateManager.saveToHistory();

        // Move task
        const [movedTask] = tasks.splice(fromIndex, 1);
        tasks.splice(toIndex, 0, movedTask);

        // Update order property for persistence
        tasks.forEach((task, index) => {
            task.order = index;
        });

        eventBus.emit(EVENTS.TASKS_REORDERED, { 
            fromIndex, 
            toIndex, 
            task: movedTask 
        });
        eventBus.emit(EVENTS.TASKS_CHANGED, { tasks, reason: 'reorder' });
    }

    /**
     * Touch support - drag start
     */
    handleTouchStart(e) {
        const card = e.target.closest('.task-card');
        if (!card) return;

        this.touchStartY = e.touches[0].clientY;
        this.touchStartX = e.touches[0].clientX;
        this.draggedElement = card;
        this.startIndex = Array.from(card.parentNode.children).indexOf(card);

        card.classList.add('dragging');
    }

    /**
     * Touch support - drag move
     */
    handleTouchMove(e) {
        if (!this.draggedElement) return;

        const touch = e.touches[0];
        const deltaY = touch.clientY - this.touchStartY;

        // Move the card visually
        this.draggedElement.style.transform = `translateY(${deltaY}px)`;
        this.draggedElement.style.zIndex = '1000';

        // Find target element
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCard = target?.closest('.task-card');

        if (targetCard && targetCard !== this.draggedElement) {
            const rect = targetCard.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;

            if (touch.clientY < midpoint) {
                this.placeholder.style.height = `${this.draggedElement.offsetHeight}px`;
                targetCard.parentNode.insertBefore(this.placeholder, targetCard);
            } else {
                this.placeholder.style.height = `${this.draggedElement.offsetHeight}px`;
                targetCard.parentNode.insertBefore(this.placeholder, targetCard.nextSibling);
            }

            this.endIndex = Array.from(this.placeholder.parentNode.children).indexOf(this.placeholder) - 1;
        }
    }

    /**
     * Touch support - drag end
     */
    handleTouchEnd(e) {
        if (!this.draggedElement) return;

        this.draggedElement.style.transform = '';
        this.draggedElement.style.zIndex = '';
        this.draggedElement.classList.remove('dragging');

        if (this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }

        if (this.endIndex >= 0 && this.startIndex !== this.endIndex) {
            this.reorderTasks(this.startIndex, this.endIndex);
        }

        this.draggedElement = null;
        this.startIndex = -1;
        this.endIndex = -1;
    }
}

/**
 * Virtual Scroll Manager
 * Renders only visible items for 10,000+ task performance
 */
export class VirtualScrollManager {
    constructor(options = {}) {
        this.itemHeight = options.itemHeight || 100; // Average task card height in px
        this.overscan = options.overscan || 5; // Items to render above/below viewport
        this.container = null;
        this.viewport = null;
        this.content = null;
        this.items = [];
        this.scrollTop = 0;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.isScrolling = false;
        this.scrollTimeout = null;
    }

    /**
     * Initialize virtual scroller
     */
    init(containerSelector, viewportSelector) {
        this.container = document.querySelector(containerSelector);
        this.viewport = document.querySelector(viewportSelector);

        if (!this.container || !this.viewport) {
            console.warn('VirtualScroll: Container or viewport not found');
            return false;
        }

        this.content = document.createElement('div');
        this.content.className = 'virtual-scroll-content';
        this.viewport.appendChild(this.content);

        this.bindEvents();
        return true;
    }

    /**
     * Bind scroll events
     */
    bindEvents() {
        if (!this.viewport) return;

        // Use requestAnimationFrame for smooth scrolling
        this.viewport.addEventListener('scroll', () => {
            if (!this.isScrolling) {
                this.isScrolling = true;
                requestAnimationFrame(() => this.onScroll());
            }

            // Debounce scroll end
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.isScrolling = false;
            }, 150);
        }, { passive: true });

        // Handle resize
        window.addEventListener('resize', () => {
            this.render();
        });
    }

    /**
     * Handle scroll event
     */
    onScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.render();
    }

    /**
     * Set items to render
     */
    setItems(items) {
        this.items = items;
        this.render();
    }

    /**
     * Calculate visible range
     */
    calculateVisibleRange() {
        const viewportHeight = this.viewport.clientHeight;
        const totalItems = this.items.length;

        // Calculate start index
        const start = Math.floor(this.scrollTop / this.itemHeight);
        const visibleCount = Math.ceil(viewportHeight / this.itemHeight);

        // Add overscan
        const visibleStart = Math.max(0, start - this.overscan);
        const visibleEnd = Math.min(totalItems, start + visibleCount + this.overscan);

        this.visibleStart = visibleStart;
        this.visibleEnd = visibleEnd;

        return { visibleStart, visibleEnd };
    }

    /**
     * Render visible items
     */
    render() {
        if (!this.content || this.items.length === 0) return;

        const { visibleStart, visibleEnd } = this.calculateVisibleRange();
        const visibleItems = this.items.slice(visibleStart, visibleEnd);

        // Set total height for proper scrollbar
        const totalHeight = this.items.length * this.itemHeight;
        this.content.style.height = `${totalHeight}px`;
        this.content.style.position = 'relative';

        // Render only visible items
        let html = '';
        visibleItems.forEach((item, index) => {
            const actualIndex = visibleStart + index;
            const top = actualIndex * this.itemHeight;
            
            html += `
                <div class="virtual-scroll-item" 
                     style="position: absolute; top: ${top}px; left: 0; right: 0; height: ${this.itemHeight}px;"
                     data-index="${actualIndex}"
                     data-task-id="${item.id}">
                    ${this.renderItem(item, actualIndex)}
                </div>
            `;
        });

        this.content.innerHTML = html;

        eventBus.emit(EVENTS.VIRTUAL_SCROLL_RENDERED, {
            visibleStart,
            visibleEnd,
            totalItems: this.items.length,
            renderedCount: visibleItems.length
        });
    }

    /**
     * Render single item (override this for custom rendering)
     */
    renderItem(item, index) {
        return `<div>Item ${index}: ${item.text || item.id}</div>`;
    }

    /**
     * Scroll to specific item
     */
    scrollToIndex(index) {
        if (!this.viewport || index < 0 || index >= this.items.length) return;

        const top = index * this.itemHeight;
        this.viewport.scrollTo({
            top,
            behavior: 'smooth'
        });
    }

    /**
     * Scroll to top
     */
    scrollToTop() {
        if (this.viewport) {
            this.viewport.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        if (this.viewport) {
            const maxScroll = this.viewport.scrollHeight - this.viewport.clientHeight;
            this.viewport.scrollTo({
                top: maxScroll,
                behavior: 'smooth'
            });
        }
    }

    /**
     * Update item height (for dynamic heights)
     */
    setItemHeight(height) {
        this.itemHeight = height;
        this.render();
    }

    /**
     * Get current scroll position
     */
    getScrollPosition() {
        return {
            scrollTop: this.scrollTop,
            visibleStart: this.visibleStart,
            visibleEnd: this.visibleEnd
        };
    }

    /**
     * Destroy virtual scroller
     */
    destroy() {
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        if (this.content && this.content.parentNode) {
            this.content.parentNode.removeChild(this.content);
        }

        this.container = null;
        this.viewport = null;
        this.content = null;
        this.items = [];
    }
}

/**
 * Hybrid Renderer - Uses virtual scrolling when needed
 */
export class HybridRenderer {
    constructor(stateManager, threshold = 100) {
        this.stateManager = stateManager;
        this.threshold = threshold;
        this.virtualScroll = new VirtualScrollManager({ itemHeight: 100, overscan: 5 });
        this.useVirtualScroll = false;
        this.container = null;
    }

    init() {
        this.container = document.getElementById('tasksContainer');
        if (!this.container) return;

        // Initialize virtual scroll but don't use it yet
        this.virtualScroll.init('.tasks-section', '.tasks-section');
        
        // Override renderItem for task cards
        this.virtualScroll.renderItem = (task) => this.renderTaskCard(task);

        this.checkMode();
    }

    /**
     * Check if we should use virtual scrolling
     */
    checkMode() {
        const tasks = this.stateManager.getFilteredTasks();
        this.useVirtualScroll = tasks.length >= this.threshold;
    }

    /**
     * Render tasks
     */
    render() {
        this.checkMode();
        const tasks = this.stateManager.getFilteredTasks();

        if (this.useVirtualScroll) {
            this.renderVirtual(tasks);
        } else {
            this.renderNormal(tasks);
        }
    }

    /**
     * Normal rendering for small lists
     */
    renderNormal(tasks) {
        if (!this.container) return;

        if (tasks.length === 0) {
            this.container.innerHTML = '';
            const emptyState = document.getElementById('emptyState');
            if (emptyState) emptyState.classList.add('visible');
            return;
        }

        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.classList.remove('visible');

        this.container.innerHTML = tasks
            .map(task => this.renderTaskCard(task))
            .join('');

        eventBus.emit(EVENTS.TASKS_RENDERED, { 
            count: tasks.length, 
            mode: 'normal' 
        });
    }

    /**
     * Virtual rendering for large lists
     */
    renderVirtual(tasks) {
        if (!this.container) return;

        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.classList.remove('visible');

        // Hide normal container, show virtual scroll
        this.container.style.display = 'none';
        
        // Use virtual scroll
        this.virtualScroll.setItems(tasks);

        eventBus.emit(EVENTS.TASKS_RENDERED, { 
            count: tasks.length, 
            mode: 'virtual' 
        });
    }

    /**
     * Render single task card
     */
    renderTaskCard(task) {
        // Simplified card rendering for virtual scroll
        return `
            <div class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''}"
                 data-task-id="${task.id}"
                 draggable="true">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle"></div>
                <div class="task-content">
                    <p class="task-text">${this.escapeHtml(task.text)}</p>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
