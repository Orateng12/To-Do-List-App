/**
 * Temporal Database for Time-Travel Queries
 * ===========================================
 * Bitemporal data model with valid time and transaction time
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Temporal Entity - Stores all versions of an entity
 */
export class TemporalEntity {
    constructor(entityId, entityType) {
        this.entityId = entityId;
        this.entityType = entityType;
        this.versions = []; // Array of temporal versions
    }

    /**
     * Add new version
     */
    addVersion(data, validFrom, validTo = null) {
        const version = {
            data: { ...data },
            validFrom: validFrom || Date.now(),
            validTo: validTo,
            transactionTime: Date.now(),
            versionNumber: this.versions.length
        };

        // Close previous version
        if (this.versions.length > 0) {
            const prevVersion = this.versions[this.versions.length - 1];
            if (prevVersion.validTo === null) {
                prevVersion.validTo = version.validFrom;
            }
        }

        this.versions.push(version);
        return version;
    }

    /**
     * Get version at specific time
     */
    getVersionAt(time) {
        const timestamp = time instanceof Date ? time.getTime() : time;
        
        for (let i = this.versions.length - 1; i >= 0; i--) {
            const version = this.versions[i];
            if (version.validFrom <= timestamp && 
                (version.validTo === null || version.validTo > timestamp)) {
                return version;
            }
        }
        
        return null;
    }

    /**
     * Get version by transaction time
     */
    getVersionByTransactionTime(transactionTime) {
        const timestamp = transactionTime instanceof Date ? transactionTime.getTime() : transactionTime;
        
        for (let i = this.versions.length - 1; i >= 0; i--) {
            const version = this.versions[i];
            if (version.transactionTime <= timestamp) {
                return version;
            }
        }
        
        return null;
    }

    /**
     * Get current version
     */
    getCurrentVersion() {
        return this.versions[this.versions.length - 1] || null;
    }

    /**
     * Get all versions
     */
    getAllVersions() {
        return [...this.versions];
    }

    /**
     * Get version history
     */
    getHistory() {
        return this.versions.map((v, i) => ({
            versionNumber: i,
            data: v.data,
            validFrom: new Date(v.validFrom),
            validTo: v.validTo ? new Date(v.validTo) : null,
            transactionTime: new Date(v.transactionTime)
        }));
    }

    /**
     * Serialize entity
     */
    toJSON() {
        return {
            entityId: this.entityId,
            entityType: this.entityType,
            versions: this.versions
        };
    }

    /**
     * Deserialize entity
     */
    static fromJSON(json) {
        const entity = new TemporalEntity(json.entityId, json.entityType);
        entity.versions = json.versions;
        return entity;
    }
}

/**
 * Temporal Database
 */
export class TemporalDB {
    constructor() {
        this.entities = new Map(); // entityId -> TemporalEntity
        this.entityIndex = new Map(); // entityType -> Set(entityId)
        this.timeIndex = []; // Sorted array of timestamps for efficient time queries
    }

    /**
     * Create or update entity
     */
    upsert(entityId, entityType, data, validFrom = null) {
        let entity = this.entities.get(entityId);
        
        if (!entity) {
            entity = new TemporalEntity(entityId, entityType);
            this.entities.set(entityId, entity);
            
            // Index by type
            if (!this.entityIndex.has(entityType)) {
                this.entityIndex.set(entityType, new Set());
            }
            this.entityIndex.get(entityType).add(entityId);
        }

        const version = entity.addVersion(data, validFrom);
        
        // Index by time
        this.timeIndex.push({
            entityId,
            timestamp: version.validFrom,
            type: 'valid_from'
        });

        eventBus.emit(EVENTS.TEMPORAL_VERSION_CREATED, {
            entityId,
            entityType,
            versionNumber: version.versionNumber
        });

        return version;
    }

    /**
     * Get entity at specific time (time travel)
     */
    getAtTime(entityId, time) {
        const entity = this.entities.get(entityId);
        if (!entity) return null;

        const version = entity.getVersionAt(time);
        return version ? version.data : null;
    }

    /**
     * Get entity as of transaction time
     */
    getAsOf(entityId, transactionTime) {
        const entity = this.entities.get(entityId);
        if (!entity) return null;

        const version = entity.getVersionByTransactionTime(transactionTime);
        return version ? version.data : null;
    }

    /**
     * Get current entity state
     */
    getCurrent(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return null;

        const version = entity.getCurrentVersion();
        return version ? version.data : null;
    }

    /**
     * Get all entities of type at specific time
     */
    getAllAtTime(entityType, time) {
        const entityIds = this.entityIndex.get(entityType);
        if (!entityIds) return [];

        const results = [];
        entityIds.forEach(id => {
            const data = this.getAtTime(id, time);
            if (data) {
                results.push({ entityId: id, data });
            }
        });

        return results;
    }

    /**
     * Get entity history
     */
    getHistory(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return [];

        return entity.getHistory();
    }

    /**
     * Query temporal SQL-like
     */
    query(sql) {
        const parser = new TemporalQueryParser(this);
        return parser.parse(sql);
    }

    /**
     * Find entities changed between times
     */
    findChangedBetween(startTime, endTime, entityType = null) {
        const results = [];
        
        for (const [entityId, entity] of this.entities) {
            if (entityType && entity.entityType !== entityType) continue;

            const versions = entity.versions.filter(v => {
                const txTime = v.transactionTime;
                return txTime >= startTime && txTime <= endTime;
            });

            if (versions.length > 0) {
                results.push({
                    entityId,
                    entityType: entity.entityType,
                    changes: versions.map(v => ({
                        versionNumber: v.versionNumber,
                        data: v.data,
                        transactionTime: new Date(v.transactionTime)
                    }))
                });
            }
        }

        return results;
    }

    /**
     * Rollback entity to previous version
     */
    rollback(entityId, toVersion) {
        const entity = this.entities.get(entityId);
        if (!entity) return null;

        const targetVersion = entity.versions[toVersion];
        if (!targetVersion) return null;

        // Create new version with old data
        return this.upsert(entityId, entity.entityType, targetVersion.data);
    }

    /**
     * Get statistics
     */
    getStats() {
        const typeCounts = {};
        let totalVersions = 0;

        this.entityIndex.forEach((set, type) => {
            typeCounts[type] = set.size;
        });

        this.entities.forEach(entity => {
            totalVersions += entity.versions.length;
        });

        return {
            entityCount: this.entities.size,
            totalVersions,
            typeCounts,
            avgVersionsPerEntity: (totalVersions / this.entities.size).toFixed(2)
        };
    }

    /**
     * Export temporal database
     */
    export() {
        return {
            entities: Array.from(this.entities.values()).map(e => e.toJSON()),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import temporal database
     */
    import(data) {
        data.entities.forEach(json => {
            const entity = TemporalEntity.fromJSON(json);
            this.entities.set(entity.entityId, entity);
            
            // Rebuild index
            if (!this.entityIndex.has(entity.entityType)) {
                this.entityIndex.set(entity.entityType, new Set());
            }
            this.entityIndex.get(entity.entityType).add(entity.entityId);
        });
    }
}

/**
 * Temporal Query Parser
 */
export class TemporalQueryParser {
    constructor(db) {
        this.db = db;
    }

    /**
     * Parse temporal SQL
     */
    parse(sql) {
        // FOR SYSTEM_TIME AS OF timestamp
        const asOfMatch = sql.match(/FOR\s+SYSTEM_TIME\s+AS\s+OF\s+'([^']+)'/i);
        
        // FOR VALID_TIME BETWEEN start AND end
        const validTimeMatch = sql.match(/FOR\s+VALID_TIME\s+BETWEEN\s+'([^']+)'s+AND\s+'([^']+)'/i);
        
        // SELECT * FROM type
        const selectMatch = sql.match(/SELECT\s+\*?\s*FROM\s+(\w+)/i);

        if (!selectMatch) {
            return { error: 'Invalid query syntax' };
        }

        const entityType = selectMatch[1];
        let results;

        if (asOfMatch) {
            // Time-travel query
            const time = new Date(asOfMatch[1]).getTime();
            results = this.db.getAllAtTime(entityType, time);
        } else if (validTimeMatch) {
            // Valid time range query
            const startTime = new Date(validTimeMatch[1]).getTime();
            const endTime = new Date(validTimeMatch[2]).getTime();
            results = this.db.findChangedBetween(startTime, endTime, entityType);
        } else {
            // Current state query
            const entityIds = this.db.entityIndex.get(entityType);
            if (!entityIds) return { results: [], count: 0 };
            
            results = Array.from(entityIds).map(id => ({
                entityId: id,
                data: this.db.getCurrent(id)
            }));
        }

        return { results, count: results.length };
    }
}

/**
 * Task Temporal Database - Specialized for tasks
 */
export class TaskTemporalDB extends TemporalDB {
    constructor() {
        super();
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        eventBus.on(EVENTS.TASK_ADDED, (data) => {
            this.upsert(data.task.id, 'Task', data.task);
        });

        eventBus.on(EVENTS.TASK_UPDATED, (data) => {
            const current = this.getCurrent(data.task.id);
            if (current) {
                this.upsert(data.task.id, 'Task', {
                    ...current,
                    ...data.updates
                });
            }
        });

        eventBus.on(EVENTS.TASK_DELETED, (data) => {
            const current = this.getCurrent(data.id || data.task?.id);
            if (current) {
                this.upsert(data.id || data.task.id, 'Task', {
                    ...current,
                    deleted: true,
                    deletedAt: new Date().toISOString()
                });
            }
        });
    }

    /**
     * Time travel to see task at past date
     */
    seeTaskAt(taskId, date) {
        return this.getAtTime(taskId, date);
    }

    /**
     * Get task change history
     */
    getTaskChanges(taskId) {
        return this.getHistory(taskId);
    }

    /**
     * Find what changed on specific date
     */
    whatChangedOn(date) {
        const start = new Date(date).setHours(0, 0, 0, 0);
        const end = new Date(date).setHours(23, 59, 59, 999);
        return this.findChangedBetween(start, end, 'Task');
    }

    /**
     * Undo task changes to specific version
     */
    undoTaskChanges(taskId, toVersion) {
        return this.rollback(taskId, toVersion);
    }

    /**
     * Get task timeline visualization data
     */
    getTaskTimeline(taskId) {
        const history = this.getHistory(taskId);
        
        return history.map((v, i) => ({
            version: i,
            timestamp: v.transactionTime,
            validFrom: v.validFrom,
            validTo: v.validTo,
            changes: this.getChangeSummary(i > 0 ? history[i - 1].data : null, v.data)
        }));
    }

    /**
     * Get change summary between two versions
     */
    getChangeSummary(oldData, newData) {
        if (!oldData) return { type: 'created' };
        if (!newData) return { type: 'deleted' };

        const changes = {};
        
        Object.keys(newData).forEach(key => {
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changes[key] = {
                    from: oldData[key],
                    to: newData[key]
                };
            }
        });

        return { type: 'updated', changes };
    }
}

/**
 * Create task temporal database
 */
export function createTaskTemporalDB() {
    return new TaskTemporalDB();
}
