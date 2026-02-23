/**
 * Drag & Drop Manager with Virtual Scrolling
 * ============================================
 * High-performance task reordering with smooth animations
 * 
 * Features:
 * - Native HTML5 drag & drop
 * - Touch support for mobile
 * - Virtual scrolling for 1000+ tasks
 * - Smooth animations
 * - Auto-scroll when dragging near edges
 * - Persist order to storage
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class DragDropManager {
    constructor(taskRepository, uiController) {
        this.taskRepository = taskRepository;
        this.uiController = uiController;
        
        // Configuration
        this.config = {
            ANIMATION_DURATION: 200,
            SCROLL_THRESHOLD: 100,
            SCROLL_SPEED: 10,
            VIRTUAL_SCROLL_THRESHOLD: 50
        };
        
        // State
        this.draggedItem = null;
        this.draggedElement = null;
        this.placeholder = null;
        this.scrollInterval = null;
        this.taskOrder = new Map();
        
        // Virtual scroll state
        this.virtualScroll = {
            enabled: false,
            itemHeight: 120,
            visibleCount: 10,
            startIndex: 0,
            endIndex: 0
        };
        
        // Bind methods
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    }

    /**
     * Initialize drag & drop
     */
    init(container) {
        if (!container) return;
        
        // Check if we need virtual scrolling
        const taskCount = container.querySelectorAll('.task-card').length;
        if (taskCount > this.config.VIRTUAL_SCROLL_THRESHOLD) {
            this._enableVirtualScroll(container);
        }
        
        // Desktop drag & drop
        container.addEventListener('dragstart', this.handleDragStart);
        container.addEventListener('dragover', this.handleDragOver);
        container.addEventListener('drop', this.handleDrop);
        container.addEventListener('dragend', this.handleDragEnd);
        container.addEventListener('dragleave', this.handleDragLeave);
        
        // Mobile touch
        container.addEventListener('touchstart', this.handleTouchStart, { passive: true });
        container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        container.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        
        console.log('[DragDrop] Initialized', { 
            taskCount, 
            virtualScroll: this.virtualScroll.enabled 
        });
    }

    /**
     * Handle drag start
     */
    handleDragStart(e) {
        const card = e.target.closest('.task-card');
        if (!card) return;
        
        // Don't drag if clicking on interactive elements
        if (e.target.closest('.task-checkbox') ||
            e.target.closest('.task-action-btn') ||
            e.target.closest('.subtask-item')) {
            e.preventDefault();
            return;
        }
        
        this.draggedItem = {
            id: card.dataset.taskId,
            element: card
        };
        this.draggedElement = card;
        
        // Set drag image
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.taskId);
        
        // Create custom drag image
        const dragImage = card.cloneNode(true);
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        dragImage.style.width = card.offsetWidth + 'px';
        dragImage.classList.add('dragging');
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 20, 20);
        
        // Store for cleanup
        this._dragImage = dragImage;
        
        // Add dragging class
        card.classList.add('dragging');
        
        // Create placeholder
        this._createPlaceholder(card);
        
        eventBus.emit(AppEvents.TASK_DRAG_START, { taskId: card.dataset.taskId });
    }

    /**
     * Handle drag over
     */
    handleDragOver(e) {
        e.preventDefault();
        
        if (!this.draggedElement) return;
        
        const card = e.target.closest('.task-card');
        if (!card || card === this.draggedElement) return;
        
        const rect = card.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        // Determine if we should insert before or after
        if (e.clientY < midpoint) {
            card.classList.add('drag-over');
            card.parentElement.insertBefore(this.placeholder, card);
        } else {
            card.classList.add('drag-over');
            card.parentElement.insertBefore(this.placeholder, card.nextSibling);
        }
        
        // Auto-scroll near edges
        this._handleAutoScroll(e.clientY);
    }

    /**
     * Handle drop
     */
    async handleDrop(e) {
        e.preventDefault();
        
        if (!this.draggedItem) return;
        
        const taskId = this.draggedItem.id;
        const placeholder = this.placeholder;
        const parent = placeholder?.parentElement;
        
        if (placeholder && parent) {
            // Get new order
            const cards = Array.from(parent.querySelectorAll('.task-card:not(.dragging)'));
            const newOrder = cards.map((card, index) => ({
                id: card.dataset.taskId,
                order: index
            }));
            
            // Insert dragged item at correct position
            const placeholderIndex = Array.from(parent.children).indexOf(placeholder);
            newOrder.splice(placeholderIndex, 0, { id: taskId, order: placeholderIndex });
            
            // Re-index all items
            newOrder.forEach((item, index) => {
                item.order = index;
            });
            
            // Save to repository
            await this._saveOrder(newOrder);
            
            eventBus.emit(AppEvents.TASK_REORDERED, { 
                taskId, 
                newOrder: placeholderIndex 
            });
            
            this.uiController.showToast('Task reordered', 'success');
        }
        
        this._cleanup();
    }

    /**
     * Handle drag end
     */
    handleDragEnd() {
        this._cleanup();
        this._stopAutoScroll();
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(e) {
        const card = e.target.closest('.task-card');
        if (card) {
            card.classList.remove('drag-over');
        }
    }

    /**
     * Touch start for mobile
     */
    handleTouchStart(e) {
        const card = e.target.closest('.task-card');
        if (!card) return;
        
        // Only handle drag handle touches
        if (!e.target.closest('.drag-handle')) return;
        
        this.draggedItem = {
            id: card.dataset.taskId,
            element: card,
            touchStartY: e.touches[0].clientY
        };
        this.draggedElement = card;
        
        card.classList.add('dragging');
        this._createPlaceholder(card);
        
        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(20);
        }
    }

    /**
     * Touch move for mobile
     */
    handleTouchMove(e) {
        if (!this.draggedElement) return;
        
        e.preventDefault();
        
        const touch = e.touches[0];
        const card = e.target.closest('.task-card');
        
        if (card && card !== this.draggedElement) {
            const rect = card.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (touch.clientY < midpoint) {
                card.classList.add('drag-over');
                card.parentElement.insertBefore(this.placeholder, card);
            } else {
                card.parentElement.insertBefore(this.placeholder, card.nextSibling);
            }
        }
        
        // Auto-scroll
        this._handleAutoScroll(touch.clientY);
    }

    /**
     * Touch end for mobile
     */
    async handleTouchEnd(e) {
        if (!this.draggedItem) return;
        
        await this.handleDrop(e);
        this._cleanup();
        this._stopAutoScroll();
    }

    /**
     * Create placeholder element
     * @private
     */
    _createPlaceholder(reference) {
        if (this.placeholder) {
            this.placeholder.remove();
        }
        
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'task-card placeholder';
        this.placeholder.style.height = reference.offsetHeight + 'px';
        this.placeholder.style.background = 'rgba(99, 102, 241, 0.1)';
        this.placeholder.style.border = '2px dashed var(--accent-primary)';
        
        reference.parentElement.insertBefore(this.placeholder, reference.nextSibling);
    }

    /**
     * Cleanup after drag
     * @private
     */
    _cleanup() {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
            this.draggedElement.style.transform = '';
        }
        
        if (this.placeholder) {
            this.placeholder.remove();
            this.placeholder = null;
        }
        
        if (this._dragImage) {
            this._dragImage.remove();
            this._dragImage = null;
        }
        
        // Remove all drag-over classes
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        
        this.draggedItem = null;
        this.draggedElement = null;
    }

    /**
     * Handle auto-scrolling when dragging near edges
     * @private
     */
    _handleAutoScroll(y) {
        const viewport = window.innerHeight;
        const threshold = this.config.SCROLL_THRESHOLD;
        
        if (y < threshold) {
            this._startAutoScroll(-this.config.SCROLL_SPEED);
        } else if (y > viewport - threshold) {
            this._startAutoScroll(this.config.SCROLL_SPEED);
        } else {
            this._stopAutoScroll();
        }
    }

    /**
     * Start auto-scroll
     * @private
     */
    _startAutoScroll(speed) {
        if (this.scrollInterval) return;
        
        this.scrollInterval = setInterval(() => {
            window.scrollBy(0, speed);
        }, 16);
    }

    /**
     * Stop auto-scroll
     * @private
     */
    _stopAutoScroll() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    }

    /**
     * Save task order to repository
     * @private
     */
    async _saveOrder(order) {
        try {
            for (const item of order) {
                const task = await this.taskRepository.getById(item.id);
                if (task) {
                    task.order = item.order;
                    task.updatedAt = new Date().toISOString();
                    await this.taskRepository.save(task);
                    this.taskOrder.set(item.id, item.order);
                }
            }
        } catch (error) {
            console.error('[DragDrop] Error saving order:', error);
        }
    }

    /**
     * Enable virtual scrolling for large lists
     * @private
     */
    _enableVirtualScroll(container) {
        this.virtualScroll.enabled = true;
        this.virtualScroll.itemHeight = 120; // Average task card height
        this.virtualScroll.visibleCount = Math.ceil(window.innerHeight / this.virtualScroll.itemHeight) + 2;
        
        // Wrap container for virtual scroll
        const wrapper = document.createElement('div');
        wrapper.className = 'virtual-scroll-wrapper';
        wrapper.style.height = '100%';
        wrapper.style.overflowY = 'auto';
        
        container.parentElement.insertBefore(wrapper, container);
        wrapper.appendChild(container);
        
        // Listen to scroll
        wrapper.addEventListener('scroll', () => {
            this._updateVirtualScroll(wrapper, container);
        });
        
        // Initial render
        this._updateVirtualScroll(wrapper, container);
    }

    /**
     * Update virtual scroll rendering
     * @private
     */
    _updateVirtualScroll(wrapper, container) {
        const scrollTop = wrapper.scrollTop;
        const startIndex = Math.floor(scrollTop / this.virtualScroll.itemHeight);
        const endIndex = startIndex + this.virtualScroll.visibleCount;
        
        if (startIndex === this.virtualScroll.startIndex && 
            endIndex === this.virtualScroll.endIndex) {
            return;
        }
        
        this.virtualScroll.startIndex = startIndex;
        this.virtualScroll.endIndex = endIndex;
        
        // Update visible items
        const cards = container.querySelectorAll('.task-card');
        cards.forEach((card, index) => {
            if (index >= startIndex && index < endIndex) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
        
        eventBus.emit(AppEvents.VIRTUAL_SCROLL_UPDATE, {
            startIndex,
            endIndex,
            visibleCount: endIndex - startIndex
        });
    }

    /**
     * Get task order
     */
    getOrder() {
        return Array.from(this.taskOrder.entries());
    }

    /**
     * Destroy drag & drop
     */
    destroy(container) {
        if (!container) return;
        
        container.removeEventListener('dragstart', this.handleDragStart);
        container.removeEventListener('dragover', this.handleDragOver);
        container.removeEventListener('drop', this.handleDrop);
        container.removeEventListener('dragend', this.handleDragEnd);
        container.removeEventListener('dragleave', this.handleDragLeave);
        container.removeEventListener('touchstart', this.handleTouchStart);
        container.removeEventListener('touchmove', this.handleTouchMove);
        container.removeEventListener('touchend', this.handleTouchEnd);
        
        this._stopAutoScroll();
    }
}

export { DragDropManager };
