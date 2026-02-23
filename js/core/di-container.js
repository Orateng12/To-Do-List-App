/**
 * Dependency Injection Container
 * ===============================
 * Inversion of Control container for managing dependencies
 * 
 * Features:
 * - Singleton and transient services
 * - Factory functions
 * - Auto-wiring dependencies
 * - Service lifecycle management
 * - Circular dependency detection
 */

class DIContainer {
    constructor() {
        this.services = new Map();
        this.instances = new Map();
        this.factoryCache = new Map();
        this.initializing = new Set();
    }

    /**
     * Register a service
     * @param {string} name - Service name
     * @param {Function|any} provider - Class, factory function, or value
     * @param {object} options - Configuration options
     */
    register(name, provider, options = {}) {
        const {
            singleton = true,
            dependencies = [],
            lazy = false
        } = options;

        this.services.set(name, {
            provider,
            singleton,
            dependencies,
            lazy,
            type: this._getProviderType(provider)
        });

        return this; // Fluent interface
    }

    /**
     * Register a class as a service
     * @param {string} name - Service name
     * @param {Function} Class - Class constructor
     * @param {string[]} dependencies - Dependency names
     */
    registerClass(name, Class, dependencies = []) {
        return this.register(name, Class, {
            singleton: true,
            dependencies,
            type: 'class'
        });
    }

    /**
     * Register a factory function
     * @param {string} name - Service name
     * @param {Function} factory - Factory function
     * @param {string[]} dependencies - Dependency names
     */
    registerFactory(name, factory, dependencies = []) {
        return this.register(name, factory, {
            singleton: true,
            dependencies,
            type: 'factory'
        });
    }

    /**
     * Register a value (already instantiated)
     * @param {string} name - Service name
     * @param {any} value - Value to register
     */
    registerValue(name, value) {
        return this.register(name, value, {
            singleton: true,
            type: 'value'
        });
    }

    /**
     * Get a service instance
     * @param {string} name - Service name
     * @returns {any} Service instance
     */
    get(name) {
        if (!this.services.has(name)) {
            throw new Error(`Service "${name}" is not registered`);
        }

        const service = this.services.get(name);

        // Return cached instance for singletons
        if (service.singleton && this.instances.has(name)) {
            return this.instances.get(name);
        }

        // Detect circular dependencies
        if (this.initializing.has(name)) {
            throw new Error(
                `Circular dependency detected: ${[...this.initializing, name].join(' -> ')}`
            );
        }

        this.initializing.add(name);

        try {
            const instance = this._createInstance(service, name);
            
            if (service.singleton) {
                this.instances.set(name, instance);
            }

            return instance;
        } finally {
            this.initializing.delete(name);
        }
    }

    /**
     * Create service instance based on type
     * @private
     */
    _createInstance(service, name) {
        switch (service.type) {
            case 'value':
                return service.provider;

            case 'class':
                return this._instantiateClass(service.provider, service.dependencies);

            case 'factory':
                return this._callFactory(service.provider, service.dependencies);

            default:
                return service.provider;
        }
    }

    /**
     * Instantiate a class with dependency injection
     * @private
     */
    _instantiateClass(Class, dependencies) {
        const deps = dependencies.map(name => this.get(name));
        return new Class(...deps);
    }

    /**
     * Call a factory function with dependency injection
     * @private
     */
    _callFactory(factory, dependencies) {
        const deps = dependencies.map(name => this.get(name));
        return factory(...deps);
    }

    /**
     * Determine provider type
     * @private
     */
    _getProviderType(provider) {
        if (provider === null || typeof provider !== 'function') {
            return 'value';
        }
        if (provider.prototype && provider.prototype.constructor) {
            return 'class';
        }
        return 'factory';
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name);
    }

    /**
     * Remove a service
     * @param {string} name - Service name
     */
    remove(name) {
        this.services.delete(name);
        this.instances.delete(name);
        this.factoryCache.delete(name);
    }

    /**
     * Clear all services and instances
     */
    clear() {
        // Call destroy on services that have it
        this.instances.forEach((instance, name) => {
            if (typeof instance.destroy === 'function') {
                try {
                    instance.destroy();
                } catch (e) {
                    console.error(`Error destroying service "${name}":`, e);
                }
            }
        });

        this.services.clear();
        this.instances.clear();
        this.factoryCache.clear();
        this.initializing.clear();
    }

    /**
     * Get all registered service names
     * @returns {string[]}
     */
    getServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Create a child container that inherits from this one
     * @returns {DIContainer}
     */
    createChild() {
        const child = new DIContainer();
        child.parent = this;
        child.get = (name) => {
            if (child.services.has(name)) {
                return DIContainer.prototype.get.call(child, name);
            }
            if (this.has(name)) {
                return this.get(name);
            }
            throw new Error(`Service "${name}" is not registered`);
        };
        return child;
    }
}

// Export singleton container
export const container = new DIContainer();

export { DIContainer };
