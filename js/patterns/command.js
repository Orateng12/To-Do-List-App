/**
 * Command Pattern Implementation
 * ===============================
 * Advanced undo/redo with macro commands and command stacking
 */

import { eventBus, EVENTS } from '../event-bus.js';

/**
 * Command Interface
 * All commands must implement execute() and undo()
 */
export class Command {
    constructor(name) {
        if (new.target === Command) {
            throw new Error('Command is an abstract class');
        }
        this.name = name;
        this.timestamp = Date.now();
    }

    execute() {
        throw new Error('execute() must be implemented');
    }

    undo() {
        throw new Error('undo() must be implemented');
    }

    getPayload() {
        return {
            name: this.name,
            timestamp: this.timestamp
        };
    }
}

/**
 * Add Task Command
 */
export class AddTaskCommand extends Command {
    constructor(stateManager, task) {
        super('addTask');
        this.stateManager = stateManager;
        this.task = task;
        this.insertIndex = 0;
    }

    execute() {
        this.stateManager.tasks.unshift(this.task);
        this.insertIndex = 0;
        eventBus.emit(EVENTS.TASK_ADDED, { task: this.task });
    }

    undo() {
        const index = this.stateManager.tasks.findIndex(t => t.id === this.task.id);
        if (index > -1) {
            this.stateManager.tasks.splice(index, 1);
        }
        eventBus.emit(EVENTS.TASK_DELETED, { task: this.task, id: this.task.id, undo: true });
    }
}

/**
 * Delete Task Command
 */
export class DeleteTaskCommand extends Command {
    constructor(stateManager, taskId) {
        super('deleteTask');
        this.stateManager = stateManager;
        this.taskId = taskId;
        this.task = null;
        this.deletedIndex = -1;
    }

    execute() {
        const index = this.stateManager.tasks.findIndex(t => t.id === this.taskId);
        if (index > -1) {
            this.task = this.stateManager.tasks[index];
            this.deletedIndex = index;
            this.stateManager.tasks.splice(index, 1);
        }
        eventBus.emit(EVENTS.TASK_DELETED, { task: this.task, id: this.taskId });
    }

    undo() {
        if (this.task) {
            if (this.deletedIndex >= 0) {
                this.stateManager.tasks.splice(this.deletedIndex, 0, this.task);
            } else {
                this.stateManager.tasks.unshift(this.task);
            }
            eventBus.emit(EVENTS.TASK_ADDED, { task: this.task, undo: true });
        }
    }
}

/**
 * Update Task Command
 */
export class UpdateTaskCommand extends Command {
    constructor(stateManager, taskId, updates) {
        super('updateTask');
        this.stateManager = stateManager;
        this.taskId = taskId;
        this.updates = updates;
        this.previousState = null;
    }

    execute() {
        const task = this.stateManager.tasks.find(t => t.id === this.taskId);
        if (task) {
            this.previousState = { ...task };
            Object.assign(task, this.updates);
            eventBus.emit(EVENTS.TASK_UPDATED, { task, updates: this.updates });
        }
    }

    undo() {
        const task = this.stateManager.tasks.find(t => t.id === this.taskId);
        if (task && this.previousState) {
            Object.assign(task, this.previousState);
            eventBus.emit(EVENTS.TASK_UPDATED, { task, updates: this.previousState, undo: true });
        }
    }
}

/**
 * Toggle Task Command
 */
export class ToggleTaskCommand extends Command {
    constructor(stateManager, taskId) {
        super('toggleTask');
        this.stateManager = stateManager;
        this.taskId = taskId;
        this.previousState = null;
    }

    execute() {
        const task = this.stateManager.tasks.find(t => t.id === this.taskId);
        if (task) {
            this.previousState = { completed: task.completed, completedAt: task.completedAt };
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            eventBus.emit(EVENTS.TASK_TOGGLED, { task });
        }
    }

    undo() {
        const task = this.stateManager.tasks.find(t => t.id === this.taskId);
        if (task && this.previousState) {
            task.completed = this.previousState.completed;
            task.completedAt = this.previousState.completedAt;
            eventBus.emit(EVENTS.TASK_TOGGLED, { task, undo: true });
        }
    }
}

/**
 * Clear Completed Command
 */
export class ClearCompletedCommand extends Command {
    constructor(stateManager) {
        super('clearCompleted');
        this.stateManager = stateManager;
        this.deletedTasks = [];
    }

    execute() {
        this.deletedTasks = this.stateManager.tasks.filter(t => t.completed);
        this.stateManager.tasks = this.stateManager.tasks.filter(t => !t.completed);
        eventBus.emit(EVENTS.TASKS_CLEARED, { tasks: this.deletedTasks });
    }

    undo() {
        this.deletedTasks.forEach(task => {
            this.stateManager.tasks.unshift(task);
        });
        eventBus.emit(EVENTS.TASKS_CLEARED, { tasks: this.deletedTasks, undo: true });
        this.deletedTasks = [];
    }
}

/**
 * Macro Command - Groups multiple commands together
 */
export class MacroCommand extends Command {
    constructor(name = 'macro') {
        super(name);
        this.commands = [];
    }

    addCommand(command) {
        this.commands.push(command);
    }

    execute() {
        this.commands.forEach(cmd => cmd.execute());
    }

    undo() {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
    }

    getPayload() {
        return {
            name: this.name,
            timestamp: this.timestamp,
            commandCount: this.commands.length
        };
    }
}

/**
 * Command History Manager
 */
export class CommandHistory {
    constructor(maxSize = 100) {
        this.history = [];
        this.future = []; // For redo
        this.maxSize = maxSize;
        this.isExecuting = false;
    }

    /**
     * Execute a command and add to history
     */
    execute(command) {
        this.isExecuting = true;
        try {
            command.execute();
            this.history.push(command);
            this.future = []; // Clear redo stack on new action
            
            // Limit history size
            if (this.history.length > this.maxSize) {
                this.history.shift();
            }

            this.emitEvents();
        } catch (error) {
            console.error('Command execution failed:', error);
            throw error;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Undo last command
     */
    undo() {
        if (this.history.length === 0) return false;

        const command = this.history.pop();
        try {
            this.isExecuting = true;
            command.undo();
            this.future.push(command);
            this.emitEvents();
            return true;
        } catch (error) {
            console.error('Undo failed:', error);
            this.history.push(command); // Restore on error
            return false;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Redo last undone command
     */
    redo() {
        if (this.future.length === 0) return false;

        const command = this.future.pop();
        try {
            this.isExecuting = true;
            command.execute();
            this.history.push(command);
            this.emitEvents();
            return true;
        } catch (error) {
            console.error('Redo failed:', error);
            this.future.push(command); // Restore on error
            return false;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.history.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.future.length > 0;
    }

    /**
     * Get undo stack size
     */
    getUndoCount() {
        return this.history.length;
    }

    /**
     * Get redo stack size
     */
    getRedoCount() {
        return this.future.length;
    }

    /**
     * Clear history
     */
    clear() {
        this.history = [];
        this.future = [];
        this.emitEvents();
    }

    /**
     * Emit undo/redo availability events
     */
    emitEvents() {
        eventBus.emit(EVENTS.UNDO_AVAILABLE, { available: this.canUndo() });
        eventBus.emit(EVENTS.REDO_AVAILABLE, { available: this.canRedo() });
        eventBus.emit(EVENTS.HISTORY_CHANGED, {
            undoCount: this.getUndoCount(),
            redoCount: this.getRedoCount()
        });
    }

    /**
     * Get history summary for debugging
     */
    getDebugInfo() {
        return {
            undoCount: this.getUndoCount(),
            redoCount: this.getRedoCount(),
            maxSize: this.maxSize,
            isExecuting: this.isExecuting,
            lastCommand: this.history[this.history.length - 1]?.getPayload()
        };
    }
}

/**
 * Command Manager - Main interface for command operations
 */
export class CommandManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.history = new CommandHistory(100);
    }

    // Task operations using commands
    addTask(task) {
        const command = new AddTaskCommand(this.stateManager, task);
        this.history.execute(command);
    }

    deleteTask(taskId) {
        const command = new DeleteTaskCommand(this.stateManager, taskId);
        this.history.execute(command);
    }

    updateTask(taskId, updates) {
        const command = new UpdateTaskCommand(this.stateManager, taskId, updates);
        this.history.execute(command);
    }

    toggleTask(taskId) {
        const command = new ToggleTaskCommand(this.stateManager, taskId);
        this.history.execute(command);
    }

    clearCompleted() {
        const command = new ClearCompletedCommand(this.stateManager);
        this.history.execute(command);
    }

    // Macro operations
    createMacro(name) {
        return new MacroCommand(name);
    }

    executeMacro(macro) {
        this.history.execute(macro);
    }

    // History operations
    undo() {
        return this.history.undo();
    }

    redo() {
        return this.history.redo();
    }

    canUndo() {
        return this.history.canUndo();
    }

    canRedo() {
        return this.history.canRedo();
    }

    getHistoryInfo() {
        return this.history.getDebugInfo();
    }

    clearHistory() {
        this.history.clear();
    }
}
