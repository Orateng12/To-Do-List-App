/**
 * Task Dependency Manager
 * ========================
 * Manages task dependencies, blocking relationships, and critical path calculation
 *
 * Features:
 * - Add/remove dependencies between tasks
 * - Detect circular dependencies
 * - Calculate critical path
 * - Find blocked and blocking tasks
 * - Topological sorting
 * - Dependency graph visualization data
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class DependencyManager {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        this.DEPENDENCY_TYPES = {
            BLOCKS: 'blocks',           // Task A must finish before Task B can start (FS)
            STARTS: 'starts',           // Task A must start before Task B can start (SS)
            FINISHES: 'finishes',       // Task A must finish before Task B can finish (FF)
            PRECEDES: 'precedes'        // Task A must finish before Task B can start with lag
        };
    }

    /**
     * Add a dependency relationship between tasks
     * @param {string} predecessorId - Task that must be completed first
     * @param {string} successorId - Task that depends on the predecessor
     * @param {string} type - Type of dependency
     * @param {number} lagDays - Optional lag time in days
     * @returns {Promise<Object>} Dependency relationship
     */
    async addDependency(predecessorId, successorId, type = this.DEPENDENCY_TYPES.BLOCKS, lagDays = 0) {
        if (predecessorId === successorId) {
            throw new Error('Task cannot depend on itself');
        }

        // Check for circular dependency
        if (await this.wouldCreateCycle(predecessorId, successorId)) {
            throw new Error('Adding this dependency would create a circular dependency');
        }

        const predecessor = await this.taskRepository.getById(predecessorId);
        const successor = await this.taskRepository.getById(successorId);

        if (!predecessor || !successor) {
            throw new Error('One or both tasks not found');
        }

        // Initialize dependencies array if not exists
        if (!successor.dependencies) {
            successor.dependencies = [];
        }

        // Check if dependency already exists
        const exists = successor.dependencies.some(
            d => d.predecessorId === predecessorId && d.type === type
        );

        if (exists) {
            throw new Error('Dependency already exists');
        }

        // Add dependency
        successor.dependencies.push({
            predecessorId,
            type,
            lagDays,
            createdAt: new Date().toISOString()
        });

        successor.updatedAt = new Date().toISOString();
        await this.taskRepository.save(successor);

        // Add reverse relationship to predecessor
        if (!predecessor.dependents) {
            predecessor.dependents = [];
        }
        predecessor.dependents.push({
            successorId,
            type,
            lagDays,
            createdAt: new Date().toISOString()
        });
        predecessor.updatedAt = new Date().toISOString();
        await this.taskRepository.save(predecessor);

        eventBus.emit(AppEvents.DEPENDENCY_ADDED, {
            predecessor,
            successor,
            type,
            lagDays
        });

        return { predecessor, successor, type, lagDays };
    }

    /**
     * Remove a dependency relationship
     * @param {string} predecessorId - Predecessor task ID
     * @param {string} successorId - Successor task ID
     * @returns {Promise<void>}
     */
    async removeDependency(predecessorId, successorId) {
        const successor = await this.taskRepository.getById(successorId);
        const predecessor = await this.taskRepository.getById(predecessorId);

        if (!successor || !predecessor) {
            throw new Error('Task not found');
        }

        // Remove from successor
        if (successor.dependencies) {
            successor.dependencies = successor.dependencies.filter(
                d => d.predecessorId !== predecessorId
            );
        }

        // Remove from predecessor
        if (predecessor.dependents) {
            predecessor.dependents = predecessor.dependents.filter(
                d => d.successorId !== successorId
            );
        }

        successor.updatedAt = new Date().toISOString();
        predecessor.updatedAt = new Date().toISOString();

        await this.taskRepository.save(successor);
        await this.taskRepository.save(predecessor);

        eventBus.emit(AppEvents.DEPENDENCY_REMOVED, { predecessor, successor });
    }

    /**
     * Check if adding a dependency would create a cycle
     * @param {string} fromId - Source task ID
     * @param {string} toId - Target task ID
     * @returns {Promise<boolean>}
     */
    async wouldCreateCycle(fromId, toId) {
        // If toId already depends on fromId (directly or indirectly), adding fromId -> toId creates cycle
        const visited = new Set();
        const queue = [toId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            if (currentId === fromId) {
                return true;
            }

            const task = await this.taskRepository.getById(currentId);
            if (task?.dependencies) {
                for (const dep of task.dependencies) {
                    queue.push(dep.predecessorId);
                }
            }
        }

        return false;
    }

    /**
     * Get all tasks that block a given task
     * @param {string} taskId - Task ID
     * @returns {Promise<Array>} Array of blocking tasks
     */
    async getBlockingTasks(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task || !task.dependencies) {
            return [];
        }

        const blockingTasks = [];
        for (const dep of task.dependencies) {
            const predecessor = await this.taskRepository.getById(dep.predecessorId);
            if (predecessor) {
                blockingTasks.push({
                    task: predecessor,
                    type: dep.type,
                    lagDays: dep.lagDays,
                    isBlocking: !predecessor.completed
                });
            }
        }

        return blockingTasks;
    }

    /**
     * Get all tasks that are blocked by a given task
     * @param {string} taskId - Task ID
     * @returns {Promise<Array>} Array of blocked tasks
     */
    async getBlockedTasks(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task || !task.dependents) {
            return [];
        }

        const blockedTasks = [];
        for (const dep of task.dependents) {
            const successor = await this.taskRepository.getById(dep.successorId);
            if (successor) {
                blockedTasks.push({
                    task: successor,
                    type: dep.type,
                    lagDays: dep.lagDays,
                    isBlocked: !task.completed
                });
            }
        }

        return blockedTasks;
    }

    /**
     * Check if a task can be started (all dependencies completed)
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Can start info
     */
    async canStart(taskId) {
        const blockingTasks = await this.getBlockingTasks(taskId);
        const incompleteBlocking = blockingTasks.filter(b => b.isBlocking);

        return {
            canStart: incompleteBlocking.length === 0,
            blockingCount: incompleteBlocking.length,
            blockingTasks: incompleteBlocking.map(b => b.task),
            completionPercentage: blockingTasks.length > 0
                ? Math.round(((blockingTasks.length - incompleteBlocking.length) / blockingTasks.length) * 100)
                : 100
        };
    }

    /**
     * Calculate critical path through all tasks
     * @param {Array} tasks - All tasks
     * @returns {Object} Critical path information
     */
    async calculateCriticalPath(tasks) {
        // Build adjacency list
        const graph = new Map();
        const inDegree = new Map();
        const taskMap = new Map();

        tasks.forEach(task => {
            taskMap.set(task.id, task);
            graph.set(task.id, []);
            inDegree.set(task.id, 0);
        });

        // Build graph
        tasks.forEach(task => {
            if (task.dependencies) {
                task.dependencies.forEach(dep => {
                    graph.get(dep.predecessorId).push(task.id);
                    inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
                });
            }
        });

        // Topological sort using Kahn's algorithm
        const queue = [];
        const topologicalOrder = [];
        const earliestStart = new Map();
        const earliestFinish = new Map();

        // Initialize tasks with no dependencies
        tasks.forEach(task => {
            if (inDegree.get(task.id) === 0) {
                queue.push(task.id);
                earliestStart.set(task.id, 0);
                earliestFinish.set(task.id, this._getTaskDuration(task));
            }
        });

        while (queue.length > 0) {
            const currentId = queue.shift();
            topologicalOrder.push(currentId);

            const neighbors = graph.get(currentId);
            const currentFinish = earliestFinish.get(currentId);

            for (const neighborId of neighbors) {
                const neighborTask = taskMap.get(neighborId);
                const dep = neighborTask.dependencies?.find(d => d.predecessorId === currentId);
                const lagDays = dep?.lagDays || 0;

                const newStart = currentFinish + lagDays;
                const newFinish = newStart + this._getTaskDuration(neighborTask);

                if (!earliestStart.has(neighborId) || earliestStart.get(neighborId) < newStart) {
                    earliestStart.set(neighborId, newStart);
                    earliestFinish.set(neighborId, newFinish);
                }

                inDegree.set(neighborId, inDegree.get(neighborId) - 1);
                if (inDegree.get(neighborId) === 0) {
                    queue.push(neighborId);
                }
            }
        }

        // Find critical path (tasks with zero slack)
        const projectDuration = Math.max(...Array.from(earliestFinish.values()), 0);
        const criticalPath = [];

        tasks.forEach(task => {
            const finish = earliestFinish.get(task.id);
            if (finish !== undefined && finish === projectDuration) {
                criticalPath.push({
                    ...task,
                    earliestStart: earliestStart.get(task.id),
                    earliestFinish
                });
            }
        });

        return {
            topologicalOrder,
            criticalPath,
            projectDuration,
            taskTimings: tasks.map(task => ({
                id: task.id,
                text: task.text,
                earliestStart: earliestStart.get(task.id) || 0,
                earliestFinish: earliestFinish.get(task.id) || 0,
                duration: this._getTaskDuration(task),
                isCritical: criticalPath.some(t => t.id === task.id)
            }))
        };
    }

    /**
     * Get dependency graph data for visualization
     * @param {Array} tasks - All tasks
     * @returns {Object} Graph data (nodes and edges)
     */
    async getGraphData(tasks) {
        const nodes = [];
        const edges = [];

        for (const task of tasks) {
            const canStartInfo = await this.canStart(task.id);
            nodes.push({
                id: task.id,
                label: task.text,
                completed: task.completed,
                canStart: canStartInfo.canStart,
                blockingCount: canStartInfo.blockingCount,
                priority: task.priority,
                dueDate: task.dueDate
            });

            if (task.dependencies) {
                task.dependencies.forEach(dep => {
                    edges.push({
                        from: dep.predecessorId,
                        to: task.id,
                        type: dep.type,
                        lagDays: dep.lagDays,
                        isBlocking: true
                    });
                });
            }

            if (task.dependents) {
                task.dependents.forEach(dep => {
                    edges.push({
                        from: task.id,
                        to: dep.successorId,
                        type: dep.type,
                        lagDays: dep.lagDays,
                        isBlocking: false
                    });
                });
            }
        }

        return { nodes, edges };
    }

    /**
     * Get all tasks that would be affected if a task is delayed
     * @param {string} taskId - Task ID
     * @returns {Promise<Array>} Affected tasks
     */
    async getAffectedTasks(taskId) {
        const affected = new Set();
        const queue = [taskId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            const task = await this.taskRepository.getById(currentId);

            if (task?.dependents) {
                for (const dep of task.dependents) {
                    if (!affected.has(dep.successorId)) {
                        affected.add(dep.successorId);
                        queue.push(dep.successorId);
                    }
                }
            }
        }

        return Array.from(affected).map(id => this.taskRepository.getById(id));
    }

    /**
     * Get task duration estimate (in days)
     * @private
     */
    _getTaskDuration(task) {
        if (task.duration) return task.duration;
        if (task.dueDate && task.createdAt) {
            const days = (new Date(task.dueDate) - new Date(task.createdAt)) / (1000 * 60 * 60 * 24);
            return Math.max(1, Math.ceil(days));
        }
        return 1; // Default 1 day
    }

    /**
     * Bulk update dependencies when task is deleted
     * @param {string} taskId - Deleted task ID
     * @returns {Promise<Array>} Updated tasks
     */
    async handleTaskDeletion(taskId) {
        const updatedTasks = [];

        // Remove from tasks that depend on this task
        const allTasks = await this.taskRepository.getAll();
        for (const task of allTasks) {
            let modified = false;

            if (task.dependencies) {
                const beforeLength = task.dependencies.length;
                task.dependencies = task.dependencies.filter(d => d.predecessorId !== taskId);
                if (task.dependencies.length < beforeLength) {
                    modified = true;
                }
            }

            if (task.dependents) {
                const beforeLength = task.dependents.length;
                task.dependents = task.dependents.filter(d => d.successorId !== taskId);
                if (task.dependents.length < beforeLength) {
                    modified = true;
                }
            }

            if (modified) {
                task.updatedAt = new Date().toISOString();
                await this.taskRepository.save(task);
                updatedTasks.push(task);
            }
        }

        return updatedTasks;
    }
}

// Additional events
AppEvents.DEPENDENCY_ADDED = 'dependency:added';
AppEvents.DEPENDENCY_REMOVED = 'dependency:removed';
AppEvents.TASK_BLOCKED = 'task:blocked';
AppEvents.TASK_UNBLOCKED = 'task:unblocked';

export { DependencyManager };
