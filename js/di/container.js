/**
 * Dependency Injection Container
 * ===============================
 * Inversion of Control container with auto-wiring
 */

/**
 * Service Lifecycle Types
 */
export const Lifecycle = {
    SINGLETON: 'singleton',     // Single instance for entire app
    TRANSIENT: 'transient',      // New instance each time
    SCOPED: 'scoped'             // One instance per scope
};

/**
 * DI Container
 */
export class Container {
    constructor(parent = null) {
        this.parent = parent;
        this.services = new Map();
        this.instances = new Map();
        this.scopes = new Map();
        this.isLocked = false;
    }

    /**
     * Register a service
     */
    register(name, options) {
        if (this.isLocked) {
            throw new Error('Container is locked. Cannot register new services.');
        }

        const service = {
            name,
            class: options.class || null,
            factory: options.factory || null,
            value: options.value !== undefined ? options.value : null,
            dependencies: options.dependencies || [],
            lifecycle: options.lifecycle || Lifecycle.SINGLETON,
            tags: options.tags || []
        };

        // Auto-detect dependencies from constructor if not specified
        if (service.class && !options.dependencies) {
            service.dependencies = this.extractDependencies(service.class);
        }

        this.services.set(name, service);
        return this;
    }

    /**
     * Register a class
     */
    registerClass(name, clazz, options = {}) {
        return this.register(name, {
            class: clazz,
            ...options
        });
    }

    /**
     * Register a factory function
     */
    registerFactory(name, factory, options = {}) {
        return this.register(name, {
            factory,
            ...options
        });
    }

    /**
     * Register a value (constant)
     */
    registerValue(name, value) {
        return this.register(name, {
            value,
            lifecycle: Lifecycle.SINGLETON
        });
    }

    /**
     * Register an instance
     */
    registerInstance(name, instance) {
        this.instances.set(name, instance);
        return this;
    }

    /**
     * Extract dependencies from class constructor
     */
    extractDependencies(clazz) {
        const str = clazz.toString();
        const match = str.match(/\(([^)]*)\)/);
        if (!match || !match[1]) return [];
        
        return match[1]
            .split(',')
            .map(dep => dep.trim())
            .filter(dep => dep && dep !== '');
    }

    /**
     * Resolve a service
     */
    resolve(name, scopeId = null) {
        // Check if already instantiated (singleton)
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }

        // Check scoped instance
        if (scopeId && this.scopes.has(scopeId)) {
            const scope = this.scopes.get(scopeId);
            if (scope.has(name)) {
                return scope.get(name);
            }
        }

        // Check parent container
        if (this.parent && !this.services.has(name)) {
            return this.parent.resolve(name, scopeId);
        }

        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service "${name}" is not registered`);
        }

        // Return value directly
        if (service.value !== null) {
            return service.value;
        }

        // Resolve dependencies
        const dependencies = service.dependencies.map(dep => this.resolve(dep, scopeId));

        // Create instance
        let instance;
        if (service.factory) {
            instance = service.factory(...dependencies, this);
        } else if (service.class) {
            instance = new service.class(...dependencies);
        } else {
            throw new Error(`Service "${name}" has no class or factory`);
        }

        // Store based on lifecycle
        if (service.lifecycle === Lifecycle.SINGLETON) {
            this.instances.set(name, instance);
        } else if (service.lifecycle === Lifecycle.SCOPED && scopeId) {
            if (!this.scopes.has(scopeId)) {
                this.scopes.set(scopeId, new Map());
            }
            this.scopes.get(scopeId).set(name, instance);
        }

        return instance;
    }

    /**
     * Get a service (alias for resolve)
     */
    get(name) {
        return this.resolve(name);
    }

    /**
     * Create a new scope
     */
    createScope() {
        const scopeId = `scope_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.scopes.set(scopeId, new Map());
        return {
            id: scopeId,
            container: this,
            resolve: (name) => this.resolve(name, scopeId),
            dispose: () => this.disposeScope(scopeId)
        };
    }

    /**
     * Dispose a scope
     */
    disposeScope(scopeId) {
        this.scopes.delete(scopeId);
    }

    /**
     * Check if service is registered
     */
    has(name) {
        return this.services.has(name) || this.instances.has(name) || (this.parent && this.parent.has(name));
    }

    /**
     * Lock container (prevent new registrations)
     */
    lock() {
        this.isLocked = true;
        return this;
    }

    /**
     * Get all registered services
     */
    getServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Get services by tag
     */
    getByTag(tag) {
        const tagged = [];
        this.services.forEach((service, name) => {
            if (service.tags.includes(tag)) {
                tagged.push(name);
            }
        });
        return tagged;
    }

    /**
     * Resolve all services with a tag
     */
    resolveAll(tag) {
        const names = this.getByTag(tag);
        return names.map(name => this.resolve(name));
    }

    /**
     * Create child container
     */
    createChild() {
        return new Container(this);
    }

    /**
     * Clear all instances (for testing)
     */
    clear() {
        this.instances.clear();
        this.scopes.clear();
    }

    /**
     * Dispose container
     */
    dispose() {
        this.clear();
        this.services.clear();
    }
}

/**
 * Decorator for injecting dependencies
 */
export function inject(serviceName) {
    return function(target, propertyKey) {
        const serviceNameKey = `__inject_${propertyKey}`;
        target[serviceNameKey] = serviceName;
    };
}

/**
 * Decorator for marking a class as injectable
 */
export function injectable() {
    return function(target) {
        target.__injectable__ = true;
        return target;
    };
}

/**
 * Auto-wiring helper
 */
export function autoWire(container, instance) {
    Object.getOwnPropertyNames(instance).forEach(key => {
        const injectKey = `__inject_${key}`;
        if (instance[injectKey]) {
            instance[key] = container.resolve(instance[injectKey]);
        }
    });
    return instance;
}

// ============================================================================
// Built-in Services
// ============================================================================

/**
 * Logger Service
 */
@injectable()
export class Logger {
    constructor(config = { level: 'info' }) {
        this.config = config;
        this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    }

    debug(message, ...args) {
        if (this.levels.debug >= this.levels[this.config.level]) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }

    info(message, ...args) {
        if (this.levels.info >= this.levels[this.config.level]) {
            console.info(`[INFO] ${message}`, ...args);
        }
    }

    warn(message, ...args) {
        if (this.levels.warn >= this.levels[this.config.level]) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }

    error(message, ...args) {
        if (this.levels.error >= this.levels[this.config.level]) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }
}

/**
 * Config Service
 */
@injectable()
export class Config {
    constructor() {
        this.settings = new Map();
        this.loadDefaults();
    }

    loadDefaults() {
        this.settings.set('app.name', 'TaskMaster');
        this.settings.set('app.version', '3.0.0');
        this.settings.set('storage.provider', 'indexeddb');
        this.settings.set('storage.dbName', 'TaskMasterDB');
        this.settings.set('features.crdt', true);
        this.settings.set('features.eventSourcing', true);
        this.settings.set('features.analytics', true);
    }

    get(key, defaultValue = null) {
        return this.settings.has(key) ? this.settings.get(key) : defaultValue;
    }

    set(key, value) {
        this.settings.set(key, value);
        return this;
    }

    getAll() {
        return Object.fromEntries(this.settings);
    }
}

/**
 * Cache Service
 */
@injectable()
export class Cache {
    constructor(logger) {
        this.logger = logger;
        this.store = new Map();
        this.ttls = new Map();
    }

    set(key, value, ttl = null) {
        this.store.set(key, value);
        
        if (ttl) {
            const expiry = Date.now() + ttl;
            this.ttls.set(key, expiry);
            
            setTimeout(() => {
                this.delete(key);
            }, ttl);
        }
        
        return this;
    }

    get(key, defaultValue = null) {
        if (this.isExpired(key)) {
            this.delete(key);
            return defaultValue;
        }
        return this.store.has(key) ? this.store.get(key) : defaultValue;
    }

    has(key) {
        if (this.isExpired(key)) {
            this.delete(key);
            return false;
        }
        return this.store.has(key);
    }

    delete(key) {
        this.store.delete(key);
        this.ttls.delete(key);
        return this;
    }

    clear() {
        this.store.clear();
        this.ttls.clear();
        return this;
    }

    isExpired(key) {
        if (!this.ttls.has(key)) return false;
        return Date.now() > this.ttls.get(key);
    }

    stats() {
        return {
            size: this.store.size,
            ttls: this.ttls.size
        };
    }
}

/**
 * Event Aggregator (for decoupled communication)
 */
@injectable()
export class EventAggregator {
    constructor(logger) {
        this.logger = logger;
        this.handlers = new Map();
    }

    subscribe(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
        
        return () => this.unsubscribe(event, handler);
    }

    unsubscribe(event, handler) {
        if (!this.handlers.has(event)) return;
        
        const handlers = this.handlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    publish(event, data) {
        this.logger.debug(`Event published: ${event}`, data);
        
        if (!this.handlers.has(event)) return;
        
        this.handlers.get(event).forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                this.logger.error(`Event handler error: ${event}`, error);
            }
        });
    }

    clear(event) {
        if (event) {
            this.handlers.delete(event);
        } else {
            this.handlers.clear();
        }
    }
}

// ============================================================================
// Container Setup
// ============================================================================

/**
 * Create and configure the application container
 */
export function createContainer() {
    const container = new Container();

    // Register core services
    container.registerClass('config', Config);
    container.registerClass('logger', Logger, {
        dependencies: ['config']
    });
    container.registerClass('cache', Cache, {
        dependencies: ['logger']
    });
    container.registerClass('events', EventAggregator, {
        dependencies: ['logger']
    });

    // Register configuration values
    container.registerValue('appId', `app_${Date.now()}`);

    return container.lock();
}

/**
 * Global container instance
 */
export const container = createContainer();
