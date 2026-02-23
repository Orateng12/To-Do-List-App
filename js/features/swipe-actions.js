/**
 * Swipe Actions Manager
 * ======================
 * Advanced touch gesture recognition for mobile task actions
 * 
 * Features:
 * - Swipe right to complete
 * - Swipe left to delete
 * - Swipe threshold detection
 * - Haptic feedback
 * - Smooth animations
 * - Gesture cancellation
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class SwipeActionsManager {
    constructor(taskRepository, uiController) {
        this.taskRepository = taskRepository;
        this.uiController = uiController;
        
        // Configuration
        this.config = {
            SWIPE_THRESHOLD: 80,        // px to trigger action
            SWIPE_MAX: 160,             // max swipe distance
            FRICTION: 0.7,              // resistance factor
            VELOCITY_THRESHOLD: 0.3,    // min velocity for flick
            HAPTIC_ENABLED: true
        };
        
        // State tracking
        this.activeSwipe = null;
        this.startX = 0;
        this.currentX = 0;
        this.startTime = 0;
        this.isScrolling = false;
        
        // Bind methods
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    }

    /**
     * Initialize swipe gestures on task container
     */
    init(container) {
        if (!container) return;
        
        // Use event delegation for dynamic content
        container.addEventListener('touchstart', this.handleTouchStart, { passive: true });
        container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        container.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        container.addEventListener('touchcancel', this.handleTouchEnd, { passive: true });
        
        console.log('[SwipeActions] Initialized on', container);
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        const taskCard = e.target.closest('.task-card');
        if (!taskCard) return;
        
        // Don't interfere with checkbox, buttons, or subtasks
        if (e.target.closest('.task-checkbox') || 
            e.target.closest('.task-action-btn') ||
            e.target.closest('.subtask-item') ||
            e.target.closest('.drag-handle')) {
            return;
        }
        
        const touch = e.touches[0];
        this.startX = touch.clientX;
        this.currentX = this.startX;
        this.startTime = Date.now();
        this.isScrolling = false;
        
        this.activeSwipe = {
            card: taskCard,
            taskId: taskCard.dataset.taskId,
            element: taskCard,
            startX: this.startX,
            currentX: this.startX
        };
        
        // Add swipe class for styling
        taskCard.classList.add('swiping');
        
        // Create/prepare swipe actions background
        this._createSwipeActions(taskCard);
    }

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        if (!this.activeSwipe) return;
        
        const touch = e.touches[0];
        this.currentX = touch.clientX;
        const deltaX = this.currentX - this.startX;
        
        // Detect if user is scrolling vertically
        const touchY = touch.clientY;
        if (!this.isScrolling) {
            const deltaY = Math.abs(touchY - (e.target.getBoundingClientRect().top));
            if (deltaY > 10) {
                this.isScrolling = true;
                this._resetSwipe();
                return;
            }
        }
        
        // Only handle horizontal swipes
        if (Math.abs(deltaX) > 10) {
            e.preventDefault();
            this.isScrolling = false;
        }
        
        // Apply friction for smoother feel
        const frictionDelta = deltaX * this.config.FRICTION;
        const clampedDelta = Math.max(
            -this.config.SWIPE_MAX,
            Math.min(this.config.SWIPE_MAX, frictionDelta)
        );
        
        // Move the card
        this.activeSwipe.element.style.transform = `translateX(${clampedDelta}px)`;
        
        // Update action buttons visibility
        this._updateSwipeActions(this.activeSwipe.card, clampedDelta);
        
        // Haptic feedback at threshold
        if (this.config.HAPTIC_ENABLED && navigator.vibrate) {
            const threshold = this.config.SWIPE_THRESHOLD;
            if (Math.abs(deltaX) > threshold && Math.abs(deltaX - this.config.SWIPE_MAX) < 20) {
                navigator.vibrate(10);
            }
        }
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        if (!this.activeSwipe) return;
        
        const deltaX = this.currentX - this.startX;
        const deltaTime = Date.now() - this.startTime;
        const velocity = Math.abs(deltaX) / deltaTime;
        
        // Determine if swipe should trigger action
        const shouldComplete = deltaX > this.config.SWIPE_THRESHOLD;
        const shouldDelete = deltaX < -this.config.SWIPE_THRESHOLD;
        const isFastFlick = velocity > this.config.VELOCITY_THRESHOLD;
        
        if (shouldComplete || (isFastFlick && deltaX > 0)) {
            this._executeAction('complete');
        } else if (shouldDelete || (isFastFlick && deltaX < 0)) {
            this._executeAction('delete');
        } else {
            this._resetSwipe();
        }
        
        this.activeSwipe = null;
    }

    /**
     * Create swipe action buttons
     * @private
     */
    _createSwipeActions(card) {
        // Remove existing if any
        const existing = card.querySelector('.swipe-actions');
        if (existing) existing.remove();
        
        const actions = document.createElement('div');
        actions.className = 'swipe-actions';
        actions.innerHTML = `
            <div class="swipe-action delete">
                <span>🗑️ Delete</span>
            </div>
            <div class="swipe-action complete">
                <span>✓ Complete</span>
            </div>
        `;
        
        // Insert before the card
        const wrapper = card.parentElement;
        if (wrapper) {
            wrapper.insertBefore(actions, card);
        }
    }

    /**
     * Update swipe action visibility
     * @private
     */
    _updateSwipeActions(card, deltaX) {
        const actions = card.parentElement?.querySelector('.swipe-actions');
        if (!actions) return;
        
        const completeAction = actions.querySelector('.swipe-action.complete');
        const deleteAction = actions.querySelector('.swipe-action.delete');
        
        if (deltaX > 0) {
            // Swiping right - show complete
            completeAction.style.transform = `translateX(${Math.min(deltaX - 80, 0)}px)`;
            deleteAction.style.transform = 'translateX(0)';
        } else {
            // Swiping left - show delete
            deleteAction.style.transform = `translateX(${Math.max(deltaX + 80, 0)}px)`;
            completeAction.style.transform = 'translateX(0)';
        }
    }

    /**
     * Execute swipe action
     * @private
     */
    async _executeAction(action) {
        if (!this.activeSwipe) return;
        
        const { card, taskId } = this.activeSwipe;
        
        // Animate to full swipe
        const targetX = action === 'complete' ? this.config.SWIPE_MAX : -this.config.SWIPE_MAX;
        card.style.transition = 'transform 0.2s ease-out';
        card.style.transform = `translateX(${targetX}px)`;
        
        // Haptic feedback
        if (this.config.HAPTIC_ENABLED && navigator.vibrate) {
            navigator.vibrate([30, 50, 30]);
        }
        
        // Execute action
        try {
            if (action === 'complete') {
                const task = await this.taskRepository.getById(taskId);
                if (task) {
                    task.completed = true;
                    task.completedAt = new Date().toISOString();
                    await this.taskRepository.save(task);
                    
                    eventBus.emit(AppEvents.TASK_TOGGLED, { task });
                    this.uiController.showToast('Task completed! ✓', 'success');
                }
            } else if (action === 'delete') {
                const task = await this.taskRepository.getById(taskId);
                await this.taskRepository.delete(taskId);
                
                eventBus.emit(AppEvents.TASK_DELETED, { task, id: taskId });
                this.uiController.showToast('Task deleted', 'info', {
                    actionText: 'Undo',
                    onAction: async () => {
                        task.completed = false;
                        await this.taskRepository.save(task);
                        this.uiController.showToast('Task restored', 'success');
                    }
                });
            }
        } catch (error) {
            console.error('[SwipeActions] Error:', error);
            this.uiController.showToast('Action failed', 'error');
        }
        
        // Remove card after animation
        setTimeout(async () => {
            card.style.opacity = '0';
            card.style.transition = 'opacity 0.2s ease';
            setTimeout(async () => {
                const tasks = await this.taskRepository.getAll();
                this.uiController.render(tasks, this.taskRepository);
            }, 200);
        }, 200);
    }

    /**
     * Reset swipe state
     * @private
     */
    _resetSwipe() {
        if (!this.activeSwipe) return;
        
        const { card } = this.activeSwipe;
        
        // Animate back to original position
        card.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.transform = 'translateX(0)';
        
        // Remove swipe class
        setTimeout(() => {
            card.classList.remove('swiping');
            const actions = card.parentElement?.querySelector('.swipe-actions');
            if (actions) actions.remove();
        }, 300);
        
        this.activeSwipe = null;
    }

    /**
     * Destroy swipe gestures
     */
    destroy(container) {
        if (!container) return;
        
        container.removeEventListener('touchstart', this.handleTouchStart);
        container.removeEventListener('touchmove', this.handleTouchMove);
        container.removeEventListener('touchend', this.handleTouchEnd);
        container.removeEventListener('touchcancel', this.handleTouchEnd);
    }
}

export { SwipeActionsManager };
