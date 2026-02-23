/**
 * Task Dependencies & Blocking System
 * ====================================
 * Manage task relationships and dependencies
 * 
 * Features:
 * - Blocker/dependant relationships
 * - Dependency graph visualization
 * - Automatic status updates
 * - Circular dependency detection
 * - Critical path calculation
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class DependencyManager {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        this.dependencyGraph = new Map();
    }

    /**
     * Initialize dependency graph
     */
    async init() {
        const tasks = await this.taskRepository.getAll();
        this._buildDependencyGraph(tasks);
    }

    /**
     * Build dependency graph from tasks
     * @private
     */
    _buildDependencyGraph(tasks) {
        this.dependencyGraph.clear();
        
        tasks.forEach(task => {
            if (!this.dependencyGraph.has(task.id)) {
                this.dependencyGraph.set(task.id, {
                    blockers: [],
                    dependants: [],
                    task
                });
            }
            
            // Process dependencies
            if (task.dependencies && Array.isArray(task.dependencies)) {
                task.dependencies.forEach(blockerId => {
                    // Add blocker relationship
                    if (!this.dependencyGraph.has(task.id)) {
                        this.dependencyGraph.set(task.id, { blockers: [], dependants: [], task });
                    }
                    this.dependencyGraph.get(task.id).blockers.push(blockerId);
                    
                    // Add dependant relationship (reverse)
                    if (!this.dependencyGraph.has(blockerId)) {
                        this.dependencyGraph.set(blockerId, { blockers: [], dependants: [], task: null });
                    }
                    this.dependencyGraph.get(blockerId).dependants.push(task.id);
                });
            }
        });
    }

    /**
     * Add dependency between tasks
     * @param {string} taskId - Task that depends on another
     * @param {string} blockerId - Task that must be completed first
     * @returns {Promise<Object>} Result
     */
    async addDependency(taskId, blockerId) {
        // Check for circular dependency
        if (this._wouldCreateCycle(taskId, blockerId)) {
            return {
                success: false,
                error: 'Would create circular dependency',
                cycle: this._findCycle(taskId, blockerId)
            };
        }
        
        // Update task
        const task = await this.taskRepository.getById(taskId);
        if (!task) {
            return { success: false, error: 'Task not found' };
        }
        
        if (!task.dependencies) {
            task.dependencies = [];
        }
        
        if (!task.dependencies.includes(blockerId)) {
            task.dependencies.push(blockerId);
            task.updatedAt = new Date().toISOString();
            await this.taskRepository.save(task);
        }
        
        // Update graph
        this._buildDependencyGraph(await this.taskRepository.getAll());
        
        eventBus.emit(AppEvents.DEPENDENCY_ADDED, { taskId, blockerId });
        
        return {
            success: true,
            task,
            message: 'Dependency added'
        };
    }

    /**
     * Remove dependency
     * @param {string} taskId - Task ID
     * @param {string} blockerId - Blocker ID to remove
     * @returns {Promise<Object>} Result
     */
    async removeDependency(taskId, blockerId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task || !task.dependencies) {
            return { success: false, error: 'Task not found or no dependencies' };
        }
        
        const index = task.dependencies.indexOf(blockerId);
        if (index === -1) {
            return { success: false, error: 'Dependency not found' };
        }
        
        task.dependencies.splice(index, 1);
        task.updatedAt = new Date().toISOString();
        await this.taskRepository.save(task);
        
        // Update graph
        this._buildDependencyGraph(await this.taskRepository.getAll());
        
        eventBus.emit(AppEvents.DEPENDENCY_REMOVED, { taskId, blockerId });
        
        return { success: true, message: 'Dependency removed' };
    }

    /**
     * Check if task is blocked
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Block status
     */
    async isBlocked(taskId) {
        const task = await this.taskRepository.getById(taskId);
        if (!task || !task.dependencies) {
            return { blocked: false, blockers: [] };
        }
        
        const blockers = [];
        for (const blockerId of task.dependencies) {
            const blocker = await this.taskRepository.getById(blockerId);
            if (blocker && !blocker.completed) {
                blockers.push(blocker);
            }
        }
        
        return {
            blocked: blockers.length > 0,
            blockers,
            completedBlockers: task.dependencies.length - blockers.length
        };
    }

    /**
     * Get all blocked tasks
     * @returns {Promise<Array>} Blocked tasks
     */
    async getBlockedTasks() {
        const tasks = await this.taskRepository.getAll();
        const blocked = [];
        
        for (const task of tasks) {
            if (task.completed) continue;
            
            const blockStatus = await this.isBlocked(task.id);
            if (blockStatus.blocked) {
                blocked.push({
                    ...task,
                    blockers: blockStatus.blockers
                });
            }
        }
        
        return blocked;
    }

    /**
     * Check for circular dependency
     * @private
     */
    _wouldCreateCycle(taskId, blockerId) {
        // If taskId is already a blocker of blockerId, would create cycle
        return this._isDependantOf(blockerId, taskId);
    }

    /**
     * Check if taskA is a dependant of taskB
     * @private
     */
    _isDependantOf(taskA, taskB) {
        if (taskA === taskB) return true;
        
        const node = this.dependencyGraph.get(taskA);
        if (!node) return false;
        
        for (const blockerId of node.blockers) {
            if (blockerId === taskB || this._isDependantOf(blockerId, taskB)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Find cycle path
     * @private
     */
    _findCycle(taskId, blockerId) {
        const path = [taskId];
        const visited = new Set([taskId]);
        
        const dfs = (currentId) => {
            if (currentId === blockerId) {
                return true;
            }
            
            const node = this.dependencyGraph.get(currentId);
            if (!node) return false;
            
            for (const depId of node.blockers) {
                if (!visited.has(depId)) {
                    visited.add(depId);
                    path.push(depId);
                    if (dfs(depId)) return true;
                    path.pop();
                }
            }
            
            return false;
        };
        
        dfs(taskId);
        return path;
    }

    /**
     * Get dependency chain for a task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Dependency chain
     */
    async getDependencyChain(taskId) {
        const chain = {
            taskId,
            blockers: [],
            dependants: [],
            depth: 0
        };
        
        // Get all blockers (recursive)
        const collectBlockers = (id, depth = 0) => {
            const node = this.dependencyGraph.get(id);
            if (!node) return;
            
            for (const blockerId of node.blockers) {
                chain.blockers.push({ id, depth });
                collectBlockers(blockerId, depth + 1);
            }
        };
        
        // Get all dependants (recursive)
        const collectDependants = (id, depth = 0) => {
            const node = this.dependencyGraph.get(id);
            if (!node) return;
            
            for (const depId of node.dependants) {
                chain.dependants.push({ id, depth });
                collectDependants(depId, depth + 1);
            }
        };
        
        collectBlockers(taskId);
        collectDependants(taskId);
        
        chain.depth = Math.max(
            ...chain.blockers.map(b => b.depth),
            ...chain.dependants.map(d => d.depth),
            0
        );
        
        return chain;
    }

    /**
     * Calculate critical path
     * @returns {Promise<Array>} Critical path tasks
     */
    async getCriticalPath() {
        const tasks = await this.taskRepository.getAll();
        const activeTasks = tasks.filter(t => !t.completed);
        
        // Find tasks with no blockers (can start immediately)
        const startTasks = activeTasks.filter(task => {
            const node = this.dependencyGraph.get(task.id);
            return !node || node.blockers.length === 0;
        });
        
        // Find tasks with no dependants (end tasks)
        const endTasks = activeTasks.filter(task => {
            const node = this.dependencyGraph.get(task.id);
            return !node || node.dependants.length === 0;
        });
        
        // Calculate longest path
        const longestPath = [];
        
        const findPath = (taskId, path = []) => {
            const task = activeTasks.find(t => t.id === taskId);
            if (!task) return path;
            
            path = [...path, task];
            
            const node = this.dependencyGraph.get(taskId);
            if (!node || node.dependants.length === 0) {
                return path;
            }
            
            let longest = path;
            for (const depId of node.dependants) {
                const candidate = findPath(depId, path);
                if (candidate.length > longest.length) {
                    longest = candidate;
                }
            }
            
            return longest;
        };
        
        for (const startTask of startTasks) {
            const path = findPath(startTask.id);
            if (path.length > longestPath.length) {
                longestPath.length = 0;
                longestPath.push(...path);
            }
        }
        
        return {
            path: longestPath,
            length: longestPath.length,
            startTasks: startTasks.length,
            endTasks: endTasks.length
        };
    }

    /**
     * Auto-complete dependant tasks when blocker is completed
     * @param {string} completedTaskId - Completed task ID
     * @returns {Promise<Array>} Unblocked tasks
     */
    async handleBlockerCompletion(completedTaskId) {
        const node = this.dependencyGraph.get(completedTaskId);
        if (!node || node.dependants.length === 0) {
            return [];
        }
        
        const unblocked = [];
        
        for (const dependantId of node.dependants) {
            const blockStatus = await this.isBlocked(dependantId);
            if (!blockStatus.blocked) {
                const dependant = await this.taskRepository.getById(dependantId);
                unblocked.push(dependant);
                
                eventBus.emit(AppEvents.TASK_UNBLOCKED, { taskId: dependantId });
            }
        }
        
        return unblocked;
    }

    /**
     * Get dependency statistics
     * @returns {Promise<Object>} Statistics
     */
    async getStats() {
        const tasks = await this.taskRepository.getAll();
        const activeTasks = tasks.filter(t => !t.completed);
        
        let totalDependencies = 0;
        let blockedCount = 0;
        let maxDepth = 0;
        
        for (const task of activeTasks) {
            if (task.dependencies) {
                totalDependencies += task.dependencies.length;
                
                const blockStatus = await this.isBlocked(task.id);
                if (blockStatus.blocked) {
                    blockedCount++;
                }
            }
            
            const chain = await this.getDependencyChain(task.id);
            if (chain.depth > maxDepth) {
                maxDepth = chain.depth;
            }
        }
        
        return {
            totalTasks: activeTasks.length,
            tasksWithDependencies: activeTasks.filter(t => t.dependencies?.length > 0).length,
            blockedTasks: blockedCount,
            totalDependencies,
            maxDependencyDepth: maxDepth,
            criticalPathLength: (await this.getCriticalPath()).length
        };
    }

    /**
     * Visualize dependency graph (text representation)
     * @returns {Promise<string>} Graph visualization
     */
    async visualize() {
        const tasks = await this.taskRepository.getAll();
        const lines = [];
        
        lines.push('Dependency Graph:');
        lines.push('=' .repeat(40));
        
        for (const task of tasks) {
            if (task.dependencies?.length > 0) {
                const blockerNames = task.dependencies
                    .map(id => {
                        const t = tasks.find(t => t.id === id);
                        return t ? t.text : id;
                    });
                
                lines.push(`${task.text}`);
                lines.push(`  ← Blocked by: ${blockerNames.join(', ')}`);
            }
        }
        
        return lines.join('\n');
    }
}

export { DependencyManager };
