/**
 * Time Blocking & Auto-Scheduler
 * ===============================
 * Intelligent task scheduling with calendar integration and optimal time allocation
 *
 * Features:
 * - Time blocking (assign tasks to specific time slots)
 * - Auto-schedule based on priorities and dependencies
 * - Calendar availability checking
 * - Optimal task ordering
 * - Buffer time management
 * - Energy-aware scheduling
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class TimeBlockingScheduler {
    constructor(taskRepository, dependencyManager) {
        this.taskRepository = taskRepository;
        this.dependencyManager = dependencyManager;
        
        this.DEFAULT_WORK_HOURS = {
            start: 9,  // 9 AM
            end: 17,   // 5 PM
            breakStart: 12,
            breakEnd: 13
        };
        
        this.DEFAULT_BUFFER_MINUTES = 15;
        this.MIN_TASK_DURATION = 15; // minutes
    }

    /**
     * Create a time block for a task
     * @param {string} taskId - Task ID
     * @param {Date} startTime - Block start time
     * @param {number} durationMinutes - Duration in minutes
     * @returns {Promise<Object>} Time block
     */
    async createTimeBlock(taskId, startTime, durationMinutes) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        
        const timeBlock = {
            id: this._generateId(),
            taskId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: durationMinutes,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        if (!task.timeBlocks) {
            task.timeBlocks = [];
        }
        task.timeBlocks.push(timeBlock);
        task.updatedAt = new Date().toISOString();

        await this.taskRepository.save(task);

        eventBus.emit(AppEvents.TIME_BLOCK_CREATED, { task, timeBlock });

        return timeBlock;
    }

    /**
     * Auto-schedule tasks for a given date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {Object} options - Scheduling options
     * @returns {Promise<Object>} Schedule
     */
    async autoSchedule(startDate, endDate, options = {}) {
        const {
            workHours = this.DEFAULT_WORK_HOURS,
            bufferMinutes = this.DEFAULT_BUFFER_MINUTES,
            considerEnergy = false,
            energyLevel = 50,
            maxTasksPerDay = 8
        } = options;

        // Get all active tasks
        const allTasks = await this.taskRepository.getAll();
        const activeTasks = allTasks.filter(t => !t.completed && !t.timeBlocks?.length);

        // Sort by priority and due date
        const sortedTasks = this._prioritizeTasks(activeTasks);

        // Get existing time blocks
        const existingBlocks = this._getExistingBlocks(allTasks, startDate, endDate);

        // Generate schedule
        const schedule = [];
        const scheduledTasks = new Set();
        let currentDate = new Date(startDate);
        currentDate.setHours(workHours.start, 0, 0, 0);

        while (currentDate <= endDate && scheduledTasks.size < sortedTasks.length) {
            const dayStart = new Date(currentDate);
            dayStart.setHours(workHours.start, 0, 0, 0);
            
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(workHours.end, 0, 0, 0);

            let currentTime = dayStart;
            let tasksScheduledToday = 0;

            while (currentTime < dayEnd && tasksScheduledToday < maxTasksPerDay) {
                // Skip break time
                const breakStart = new Date(currentDate);
                breakStart.setHours(workHours.breakStart, 0, 0, 0);
                const breakEnd = new Date(currentDate);
                breakEnd.setHours(workHours.breakEnd, 0, 0, 0);

                if (currentTime >= breakStart && currentTime < breakEnd) {
                    currentTime = new Date(breakEnd);
                    continue;
                }

                // Find next available slot
                const availableSlot = this._findAvailableSlot(
                    currentTime,
                    dayEnd,
                    existingBlocks,
                    bufferMinutes
                );

                if (!availableSlot) {
                    break;
                }

                // Find task that fits
                const taskToSchedule = sortedTasks.find(task => {
                    if (scheduledTasks.has(task.id)) return false;
                    
                    const duration = this._estimateTaskDuration(task);
                    return duration <= availableSlot.duration;
                });

                if (!taskToSchedule) {
                    break;
                }

                // Check dependencies
                const canStartInfo = await this.dependencyManager?.canStart(taskToSchedule.id);
                if (canStartInfo && !canStartInfo.canStart) {
                    sortedTasks.push(sortedTasks.splice(sortedTasks.indexOf(taskToSchedule), 1)[0]);
                    continue;
                }

                // Schedule the task
                const duration = this._estimateTaskDuration(taskToSchedule);
                const actualDuration = Math.min(duration, availableSlot.duration);

                schedule.push({
                    task: taskToSchedule,
                    startTime: availableSlot.start,
                    endTime: new Date(availableSlot.start.getTime() + actualDuration * 60000),
                    duration: actualDuration
                });

                scheduledTasks.add(taskToSchedule.id);
                existingBlocks.push({
                    startTime: availableSlot.start,
                    endTime: new Date(availableSlot.start.getTime() + actualDuration * 60000)
                });

                currentTime = new Date(availableSlot.start.getTime() + actualDuration * 60000 + bufferMinutes * 60000);
                tasksScheduledToday++;
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(workHours.start, 0, 0, 0);
        }

        const result = {
            schedule,
            unscheduledTasks: sortedTasks.filter(t => !scheduledTasks.has(t.id)),
            dateRange: { start: startDate, end: endDate },
            generatedAt: new Date().toISOString()
        };

        eventBus.emit(AppEvents.SCHEDULE_GENERATED, result);

        return result;
    }

    /**
     * Apply the generated schedule to tasks
     * @param {Object} schedule - Generated schedule
     * @returns {Promise<Array>} Updated tasks
     */
    async applySchedule(schedule) {
        const updatedTasks = [];

        for (const item of schedule.schedule) {
            const timeBlock = await this.createTimeBlock(
                item.task.id,
                item.startTime,
                item.duration
            );
            updatedTasks.push({ ...item.task, timeBlock });
        }

        return updatedTasks;
    }

    /**
     * Find optimal time for a specific task
     * @param {string} taskId - Task ID
     * @param {Date} preferredDate - Preferred date (optional)
     * @returns {Promise<Object>} Optimal time slot
     */
    async findOptimalTime(taskId, preferredDate = null) {
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        const duration = this._estimateTaskDuration(task);
        const allTasks = await this.taskRepository.getAll();
        const existingBlocks = this._getAllExistingBlocks(allTasks);

        // Check dependencies
        const canStartInfo = await this.dependencyManager?.canStart(taskId);
        let earliestStart = null;
        if (canStartInfo && !canStartInfo.canStart) {
            // Find when blocking tasks complete
            const blockingTasks = await this.dependencyManager?.getBlockingTasks(taskId);
            if (blockingTasks?.length) {
                const latestBlockingEnd = blockingTasks
                    .filter(b => !b.task.completed)
                    .reduce((latest, b) => {
                        const taskEnd = b.task.timeBlocks?.[0]?.endTime || b.task.dueDate;
                        return taskEnd > latest ? taskEnd : latest;
                    }, new Date().toISOString());
                
                earliestStart = new Date(latestBlockingEnd || Date.now());
            }
        }

        // Search for available slot
        const searchStart = preferredDate || new Date();
        if (earliestStart && earliestStart > searchStart) {
            searchStart.setTime(earliestStart.getTime());
        }

        const searchEnd = new Date(searchStart);
        searchEnd.setDate(searchEnd.getDate() + 14); // Search within 2 weeks

        const slot = this._findNextAvailableSlot(
            searchStart,
            searchEnd,
            duration,
            existingBlocks
        );

        return {
            taskId,
            suggestedStart: slot?.start || null,
            suggestedEnd: slot?.end || null,
            duration,
            confidence: slot ? 'high' : 'low'
        };
    }

    /**
     * Get calendar conflicts for a task
     * @param {string} taskId - Task ID
     * @param {Date} startTime - Proposed start time
     * @param {number} duration - Duration in minutes
     * @returns {Promise<Object>} Conflict info
     */
    async getConflicts(taskId, startTime, duration) {
        const allTasks = await this.taskRepository.getAll();
        const existingBlocks = this._getAllExistingBlocks(allTasks);
        
        const proposedEnd = new Date(startTime.getTime() + duration * 60000);
        const conflicts = [];

        for (const block of existingBlocks) {
            const blockEnd = new Date(block.endTime);
            const blockStart = new Date(block.startTime);

            // Check overlap
            if (startTime < blockEnd && proposedEnd > blockStart) {
                const task = allTasks.find(t => t.id === block.taskId);
                conflicts.push({
                    task,
                    block,
                    overlapMinutes: this._calculateOverlap(startTime, proposedEnd, blockStart, blockEnd)
                });
            }
        }

        return {
            hasConflicts: conflicts.length > 0,
            conflicts,
            proposedStart: startTime,
            proposedEnd: proposedEnd
        };
    }

    /**
     * Reschedule a time block
     * @param {string} taskId - Task ID
     * @param {string} blockId - Time block ID
     * @param {Date} newStartTime - New start time
     * @returns {Promise<Object>} Updated time block
     */
    async reschedule(taskId, blockId, newStartTime) {
        const task = await this.taskRepository.getById(taskId);
        if (!task || !task.timeBlocks) {
            throw new Error('Task or time block not found');
        }

        const block = task.timeBlocks.find(b => b.id === blockId);
        if (!block) {
            throw new Error('Time block not found');
        }

        const duration = block.duration;
        const newEndTime = new Date(newStartTime.getTime() + duration * 60000);

        // Check for conflicts
        const conflicts = await this.getConflicts(taskId, newStartTime, duration);
        if (conflicts.hasConflicts) {
            throw new Error('Time slot has conflicts');
        }

        block.startTime = newStartTime.toISOString();
        block.endTime = newEndTime.toISOString();
        block.updatedAt = new Date().toISOString();

        task.updatedAt = new Date().toISOString();
        await this.taskRepository.save(task);

        eventBus.emit(AppEvents.TIME_BLOCK_UPDATED, { task, block });

        return block;
    }

    /**
     * Remove a time block
     * @param {string} taskId - Task ID
     * @param {string} blockId - Time block ID
     * @returns {Promise<void>}
     */
    async removeTimeBlock(taskId, blockId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task || !task.timeBlocks) {
            throw new Error('Task or time block not found');
        }

        const blockIndex = task.timeBlocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) {
            throw new Error('Time block not found');
        }

        const removedBlock = task.timeBlocks.splice(blockIndex, 1)[0];
        task.updatedAt = new Date().toISOString();

        await this.taskRepository.save(task);

        eventBus.emit(AppEvents.TIME_BLOCK_REMOVED, { task, block: removedBlock });
    }

    /**
     * Get daily schedule
     * @param {Date} date - Date
     * @returns {Promise<Object>} Daily schedule
     */
    async getDailySchedule(date) {
        const allTasks = await this.taskRepository.getAll();
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const blocks = [];
        
        for (const task of allTasks) {
            if (task.timeBlocks) {
                for (const block of task.timeBlocks) {
                    const blockStart = new Date(block.startTime);
                    if (blockStart >= dayStart && blockStart <= dayEnd) {
                        blocks.push({
                            task,
                            block
                        });
                    }
                }
            }
        }

        // Sort by start time
        blocks.sort((a, b) => new Date(a.block.startTime) - new Date(b.block.startTime));

        return {
            date,
            blocks,
            totalScheduledMinutes: blocks.reduce((sum, b) => sum + b.block.duration, 0),
            taskCount: blocks.length
        };
    }

    // ==================== Private Helper Methods ====================

    _prioritizeTasks(tasks) {
        return [...tasks].sort((a, b) => {
            // Priority score
            const priorityScore = { high: 3, medium: 2, low: 1 };
            const aPriority = priorityScore[a.priority] || 2;
            const bPriority = priorityScore[b.priority] || 2;

            // Due date score (closer = higher priority)
            const now = Date.now();
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            const aDaysUntilDue = (aDue - now) / (1000 * 60 * 60 * 24);
            const bDaysUntilDue = (bDue - now) / (1000 * 60 * 60 * 24);

            // Combined score
            const aScore = aPriority * 10 - Math.min(aDaysUntilDue, 30);
            const bScore = bPriority * 10 - Math.min(bDaysUntilDue, 30);

            return bScore - aScore;
        });
    }

    _estimateTaskDuration(task) {
        if (task.estimatedDuration) {
            return task.estimatedDuration;
        }

        // Estimate based on subtasks
        if (task.subtasks?.length) {
            return task.subtasks.length * 20; // 20 min per subtask
        }

        // Estimate based on priority
        const durationByPriority = {
            high: 60,
            medium: 45,
            low: 30
        };

        return durationByPriority[task.priority] || 30;
    }

    _getExistingBlocks(tasks, startDate, endDate) {
        const blocks = [];
        const start = startDate.getTime();
        const end = endDate.getTime();

        for (const task of tasks) {
            if (task.timeBlocks) {
                for (const block of task.timeBlocks) {
                    const blockTime = new Date(block.startTime).getTime();
                    if (blockTime >= start && blockTime <= end) {
                        blocks.push({
                            taskId: task.id,
                            startTime: new Date(block.startTime),
                            endTime: new Date(block.endTime)
                        });
                    }
                }
            }
        }

        return blocks;
    }

    _getAllExistingBlocks(tasks) {
        const blocks = [];
        for (const task of tasks) {
            if (task.timeBlocks) {
                for (const block of task.timeBlocks) {
                    blocks.push({
                        taskId: task.id,
                        startTime: new Date(block.startTime),
                        endTime: new Date(block.endTime)
                    });
                }
            }
        }
        return blocks;
    }

    _findAvailableSlot(currentTime, dayEnd, existingBlocks, bufferMinutes) {
        let slotStart = new Date(currentTime);

        while (slotStart < dayEnd) {
            const slotEnd = new Date(slotStart.getTime() + 30 * 60000); // Try 30-min slots

            const hasConflict = existingBlocks.some(block => {
                return slotStart < block.endTime && slotEnd > block.startTime;
            });

            if (!hasConflict) {
                return {
                    start: slotStart,
                    duration: 30
                };
            }

            // Move to next potential slot
            slotStart = new Date(slotStart.getTime() + 15 * 60000);
        }

        return null;
    }

    _findNextAvailableSlot(searchStart, searchEnd, duration, existingBlocks) {
        const workHours = this.DEFAULT_WORK_HOURS;
        let currentTime = new Date(searchStart);

        // Set to work hours if before start
        if (currentTime.getHours() < workHours.start) {
            currentTime.setHours(workHours.start, 0, 0, 0);
        }

        while (currentTime < searchEnd) {
            // Skip weekends
            if (currentTime.getDay() === 0 || currentTime.getDay() === 6) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(workHours.start, 0, 0, 0);
                continue;
            }

            // Skip outside work hours
            if (currentTime.getHours() >= workHours.end) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(workHours.start, 0, 0, 0);
                continue;
            }

            // Skip lunch break
            if (currentTime.getHours() >= workHours.breakStart && currentTime.getHours() < workHours.breakEnd) {
                currentTime.setHours(workHours.breakEnd, 0, 0, 0);
                continue;
            }

            const slotEnd = new Date(currentTime.getTime() + duration * 60000);

            // Check if slot fits within work hours
            if (slotEnd.getHours() > workHours.end || 
                (slotEnd.getHours() === workHours.end && slotEnd.getMinutes() > 0)) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(workHours.start, 0, 0, 0);
                continue;
            }

            const hasConflict = existingBlocks.some(block => {
                return currentTime < block.endTime && slotEnd > block.startTime;
            });

            if (!hasConflict) {
                return {
                    start: currentTime,
                    end: slotEnd,
                    duration
                };
            }

            // Move to next slot
            currentTime = new Date(currentTime.getTime() + 15 * 60000);
        }

        return null;
    }

    _calculateOverlap(start1, end1, start2, end2) {
        const overlapStart = Math.max(start1.getTime(), start2.getTime());
        const overlapEnd = Math.min(end1.getTime(), end2.getTime());
        return Math.max(0, (overlapEnd - overlapStart) / 60000);
    }

    _generateId() {
        return 'tb_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

// Additional events
AppEvents.TIME_BLOCK_CREATED = 'timeblock:created';
AppEvents.TIME_BLOCK_UPDATED = 'timeblock:updated';
AppEvents.TIME_BLOCK_REMOVED = 'timeblock:removed';
AppEvents.SCHEDULE_GENERATED = 'schedule:generated';

export { TimeBlockingScheduler };
