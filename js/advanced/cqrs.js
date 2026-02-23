/**
 * CQRS (Command Query Responsibility Segregation) Implementation
 * ================================================================
 * Separates read and write operations for scalability
 */

import { eventBus, EVENTS } from '../core/event-bus.js';
import { DomainEvent, EventStore, EventSourcingRepository, DomainEvents } from './event-sourcing.js';

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Command Base Class
 */
export class Command {
    constructor(type, payload, metadata = {}) {
        this.id = this.generateId();
        this.type = type;
        this.payload = payload;
        this.metadata = {
            timestamp: Date.now(),
            userId: metadata.userId || 'system',
            correlationId: metadata.correlationId || this.generateId(),
            ...metadata
        };
        this.result = null;
        this.error = null;
    }

    generateId() {
        return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Mark command as successful
     */
    succeed(result) {
        this.result = result;
        return this;
    }

    /**
     * Mark command as failed
     */
    fail(error) {
        this.error = error;
        return this;
    }
}

/**
 * Command Types
 */
export const CommandTypes = {
    CREATE_TASK: 'CreateTask',
    UPDATE_TASK: 'UpdateTask',
    DELETE_TASK: 'DeleteTask',
    COMPLETE_TASK: 'CompleteTask',
    UNCOMPLETE_TASK: 'UncompleteTask',
    SET_PRIORITY: 'SetPriority',
    SET_DUE_DATE: 'SetDueDate',
    ADD_CATEGORY: 'AddCategory',
    REMOVE_CATEGORY: 'RemoveCategory',
    ADD_SUBTASK: 'AddSubtask',
    REMOVE_SUBTASK: 'RemoveSubtask',
    CLEAR_COMPLETED: 'ClearCompleted',
    IMPORT_TASKS: 'ImportTasks'
};

/**
 * Command Handlers
 */
export class CommandHandler {
    constructor(repository) {
        this.repository = repository;
        this.handlers = new Map();
        this.registerHandlers();
    }

    /**
     * Register all command handlers
     */
    registerHandlers() {
        this.handlers.set(CommandTypes.CREATE_TASK, this.handleCreateTask.bind(this));
        this.handlers.set(CommandTypes.UPDATE_TASK, this.handleUpdateTask.bind(this));
        this.handlers.set(CommandTypes.DELETE_TASK, this.handleDeleteTask.bind(this));
        this.handlers.set(CommandTypes.COMPLETE_TASK, this.handleCompleteTask.bind(this));
        this.handlers.set(CommandTypes.UNCOMPLETE_TASK, this.handleUncompleteTask.bind(this));
        this.handlers.set(CommandTypes.SET_PRIORITY, this.handleSetPriority.bind(this));
        this.handlers.set(CommandTypes.SET_DUE_DATE, this.handleSetDueDate.bind(this));
        this.handlers.set(CommandTypes.ADD_CATEGORY, this.handleAddCategory.bind(this));
        this.handlers.set(CommandTypes.REMOVE_CATEGORY, this.handleRemoveCategory.bind(this));
        this.handlers.set(CommandTypes.CLEAR_COMPLETED, this.handleClearCompleted.bind(this));
    }

    /**
     * Handle command
     */
    async handle(command) {
        const handler = this.handlers.get(command.type);
        if (!handler) {
            throw new Error(`No handler for command: ${command.type}`);
        }

        try {
            const result = await handler(command);
            command.succeed(result);
            eventBus.emit(EVENTS.COMMAND_SUCCESS, { command });
            return result;
        } catch (error) {
            command.fail(error.message);
            eventBus.emit(EVENTS.COMMAND_FAILED, { command, error });
            throw error;
        }
    }

    // Command Handlers Implementation
    async handleCreateTask(command) {
        const { text, priority, dueDate, categories } = command.payload;
        
        if (!text || !text.trim()) {
            throw new Error('Task text is required');
        }

        const taskId = this.generateTaskId();
        const aggregate = this.repository.getAggregate(taskId);
        
        aggregate.create(text, {
            priority,
            dueDate,
            categories
        });

        await this.repository.saveAggregate(aggregate);
        
        return { taskId, aggregate };
    }

    async handleUpdateTask(command) {
        const { taskId, text } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.updateText(text);
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleDeleteTask(command) {
        const { taskId } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.delete();
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleCompleteTask(command) {
        const { taskId } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.complete();
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleUncompleteTask(command) {
        const { taskId } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.uncomplete();
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleSetPriority(command) {
        const { taskId, priority } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.setPriority(priority);
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleSetDueDate(command) {
        const { taskId, dueDate } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.setDueDate(dueDate);
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleAddCategory(command) {
        const { taskId, category } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.addCategory(category);
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleRemoveCategory(command) {
        const { taskId, category } = command.payload;
        
        const aggregate = await this.repository.loadAggregate(taskId);
        aggregate.removeCategory(category);
        
        await this.repository.saveAggregate(aggregate);
        
        return { taskId };
    }

    async handleClearCompleted(command) {
        const completedTasks = this.repository.getAllTasks().filter(t => t.completed);
        
        for (const task of completedTasks) {
            const aggregate = await this.repository.loadAggregate(task.id);
            aggregate.delete();
            await this.repository.saveAggregate(aggregate);
        }
        
        return { clearedCount: completedTasks.length };
    }

    generateTaskId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Query Base Class
 */
export class Query {
    constructor(type, params = {}) {
        this.id = this.generateId();
        this.type = type;
        this.params = params;
    }

    generateId() {
        return `qry_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }
}

/**
 * Query Types
 */
export const QueryTypes = {
    GET_ALL_TASKS: 'GetAllTasks',
    GET_TASK_BY_ID: 'GetTaskById',
    GET_TASKS_BY_FILTER: 'GetTasksByFilter',
    GET_TASKS_BY_PRIORITY: 'GetTasksByPriority',
    GET_OVERDUE_TASKS: 'GetOverdueTasks',
    GET_TASKS_DUE_TODAY: 'GetTasksDueToday',
    GET_TASK_STATS: 'GetTaskStats',
    GET_TASK_ANALYTICS: 'GetTaskAnalytics',
    SEARCH_TASKS: 'SearchTasks',
    GET_TASKS_BY_CATEGORY: 'GetTasksByCategory'
};

/**
 * Query Handlers
 */
export class QueryHandler {
    constructor(repository) {
        this.repository = repository;
        this.handlers = new Map();
        this.registerHandlers();
    }

    /**
     * Register all query handlers
     */
    registerHandlers() {
        this.handlers.set(QueryTypes.GET_ALL_TASKS, this.handleGetAllTasks.bind(this));
        this.handlers.set(QueryTypes.GET_TASK_BY_ID, this.handleGetTaskById.bind(this));
        this.handlers.set(QueryTypes.GET_TASKS_BY_FILTER, this.handleGetTasksByFilter.bind(this));
        this.handlers.set(QueryTypes.GET_TASKS_BY_PRIORITY, this.handleGetTasksByPriority.bind(this));
        this.handlers.set(QueryTypes.GET_OVERDUE_TASKS, this.handleGetOverdueTasks.bind(this));
        this.handlers.set(QueryTypes.GET_TASKS_DUE_TODAY, this.handleGetTasksDueToday.bind(this));
        this.handlers.set(QueryTypes.GET_TASK_STATS, this.handleGetTaskStats.bind(this));
        this.handlers.set(QueryTypes.SEARCH_TASKS, this.handleSearchTasks.bind(this));
        this.handlers.set(QueryTypes.GET_TASKS_BY_CATEGORY, this.handleGetTasksByCategory.bind(this));
    }

    /**
     * Handle query
     */
    async handle(query) {
        const handler = this.handlers.get(query.type);
        if (!handler) {
            throw new Error(`No handler for query: ${query.type}`);
        }

        const result = await handler(query);
        eventBus.emit(EVENTS.QUERY_EXECUTED, { query, result });
        return result;
    }

    // Query Handlers Implementation
    handleGetAllTasks() {
        return this.repository.getAllTasks();
    }

    handleGetTaskById(query) {
        const tasks = this.repository.getAllTasks();
        return tasks.find(t => t.id === query.params.id) || null;
    }

    handleGetTasksByFilter(query) {
        const { filter } = query.params;
        let tasks = this.repository.getAllTasks();

        switch (filter) {
            case 'active':
                return tasks.filter(t => !t.completed);
            case 'completed':
                return tasks.filter(t => t.completed);
            default:
                return tasks;
        }
    }

    handleGetTasksByPriority(query) {
        const { priority } = query.params;
        const tasks = this.repository.getAllTasks();
        return tasks.filter(t => t.priority === priority);
    }

    handleGetOverdueTasks() {
        const tasks = this.repository.getAllTasks();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate) < today
        );
    }

    handleGetTasksDueToday() {
        const tasks = this.repository.getAllTasks();
        const today = new Date().toDateString();

        return tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate).toDateString() === today
        );
    }

    handleGetTaskStats() {
        const tasks = this.repository.getAllTasks();
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdue = tasks.filter(t => 
            !t.completed && 
            t.dueDate && 
            new Date(t.dueDate) < today
        ).length;

        return {
            total,
            completed,
            active,
            overdue,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    handleSearchTasks(query) {
        const { searchTerm } = query.params;
        const tasks = this.repository.getAllTasks();
        const searchLower = searchTerm.toLowerCase();

        return tasks.filter(t => 
            t.text.toLowerCase().includes(searchLower) ||
            (t.notes && t.notes.toLowerCase().includes(searchLower)) ||
            (t.categories && t.categories.some(c => c.toLowerCase().includes(searchLower)))
        );
    }

    handleGetTasksByCategory(query) {
        const { category } = query.params;
        const tasks = this.repository.getAllTasks();
        
        return tasks.filter(t => 
            t.categories && t.categories.includes(category)
        );
    }
}

// ============================================================================
// CQRS BUS
// ============================================================================

/**
 * CQRS Bus - Central coordinator for commands and queries
 */
export class CQRSBus {
    constructor(repository) {
        this.repository = repository;
        this.commandHandler = new CommandHandler(repository);
        this.queryHandler = new QueryHandler(repository);
        this.commandMiddleware = [];
        this.queryMiddleware = [];
    }

    /**
     * Send command
     */
    async send(command) {
        // Execute command middleware
        const context = { command, timestamp: Date.now() };
        await this.executeMiddleware(this.commandMiddleware, context);

        // Handle command
        const result = await this.commandHandler.handle(command);
        
        return result;
    }

    /**
     * Ask query
     */
    async ask(query) {
        // Execute query middleware
        const context = { query, timestamp: Date.now() };
        await this.executeMiddleware(this.queryMiddleware, context);

        // Handle query
        const result = await this.queryHandler.handle(query);
        
        return result;
    }

    /**
     * Register command middleware
     */
    useCommand(middleware) {
        this.commandMiddleware.push(middleware);
    }

    /**
     * Register query middleware
     */
    useQuery(middleware) {
        this.queryMiddleware.push(middleware);
    }

    /**
     * Execute middleware chain
     */
    async executeMiddleware(middleware, context) {
        const execute = async (index) => {
            if (index >= middleware.length) return;
            
            const mw = middleware[index];
            await mw(context, () => execute(index + 1));
        };
        
        await execute(0);
    }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create CQRS commands
 */
export const Commands = {
    createTask: (payload, metadata) => 
        new Command(CommandTypes.CREATE_TASK, payload, metadata),
    
    updateTask: (taskId, text, metadata) => 
        new Command(CommandTypes.UPDATE_TASK, { taskId, text }, metadata),
    
    deleteTask: (taskId, metadata) => 
        new Command(CommandTypes.DELETE_TASK, { taskId }, metadata),
    
    completeTask: (taskId, metadata) => 
        new Command(CommandTypes.COMPLETE_TASK, { taskId }, metadata),
    
    uncompleteTask: (taskId, metadata) => 
        new Command(CommandTypes.UNCOMPLETE_TASK, { taskId }, metadata),
    
    setPriority: (taskId, priority, metadata) => 
        new Command(CommandTypes.SET_PRIORITY, { taskId, priority }, metadata),
    
    setDueDate: (taskId, dueDate, metadata) => 
        new Command(CommandTypes.SET_DUE_DATE, { taskId, dueDate }, metadata),
    
    addCategory: (taskId, category, metadata) => 
        new Command(CommandTypes.ADD_CATEGORY, { taskId, category }, metadata),
    
    removeCategory: (taskId, category, metadata) => 
        new Command(CommandTypes.REMOVE_CATEGORY, { taskId, category }, metadata),
    
    clearCompleted: (metadata) => 
        new Command(CommandTypes.CLEAR_COMPLETED, {}, metadata)
};

/**
 * Create queries
 */
export const Queries = {
    getAllTasks: () => new Query(QueryTypes.GET_ALL_TASKS),
    getTaskById: (id) => new Query(QueryTypes.GET_TASK_BY_ID, { id }),
    getTasksByFilter: (filter) => new Query(QueryTypes.GET_TASKS_BY_FILTER, { filter }),
    getTasksByPriority: (priority) => new Query(QueryTypes.GET_TASKS_BY_PRIORITY, { priority }),
    getOverdueTasks: () => new Query(QueryTypes.GET_OVERDUE_TASKS),
    getTasksDueToday: () => new Query(QueryTypes.GET_TASKS_DUE_TODAY),
    getTaskStats: () => new Query(QueryTypes.GET_TASK_STATS),
    searchTasks: (searchTerm) => new Query(QueryTypes.SEARCH_TASKS, { searchTerm }),
    getTasksByCategory: (category) => new Query(QueryTypes.GET_TASKS_BY_CATEGORY, { category })
};

/**
 * Initialize CQRS system
 */
export async function createCQRS() {
    const eventStore = new EventStore();
    await eventStore.init();
    
    const repository = new EventSourcingRepository(eventStore);
    const bus = new CQRSBus(repository);
    
    // Add logging middleware
    bus.useCommand(async (context, next) => {
        console.log('[CQRS] Command:', context.command.type, context.command.payload);
        await next();
    });
    
    bus.useQuery(async (context, next) => {
        console.log('[CQRS] Query:', context.query.type);
        await next();
    });
    
    return { bus, repository, eventStore };
}
