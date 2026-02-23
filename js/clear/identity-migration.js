/**
 * Identity Migration System - Clear Life OS
 * ==========================================
 * Manages archetype transitions, regression detection,
 * and recalibration flows.
 * 
 * Features:
 * - Progressive migration tracking (Lost → Confused → Clear)
 * - Regression detection (Clear → Lost)
 * - Oscillation pattern recognition
 * - Automatic recalibration triggers
 * - Migration history
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class IdentityMigrationSystem {
    constructor(taskRepository, archetypeEngine) {
        this.taskRepository = taskRepository;
        this.archetypeEngine = archetypeEngine;
        
        // Migration paths
        this.migrationPaths = {
            progressive: ['lost', 'confused', 'clear'],
            regressive: ['clear', 'confused', 'lost']
        };
        
        // Migration criteria
        this.migrationCriteria = {
            lostToConfused: {
                criteria: [
                    { metric: 'completed_7_day_streak', operator: 'gte', value: 1 },
                    { metric: 'system_adherence_rate', operator: 'gte', value: 0.7 },
                    { metric: 'self_reported_clarity_score', operator: 'gte', value: 6 }
                ],
                action: 'unlock_advanced_systems',
                message: 'You\'ve shown consistent progress. Ready for the next level?'
            },
            confusedToClear: {
                criteria: [
                    { metric: 'completed_14_day_streak', operator: 'gte', value: 1 },
                    { metric: 'keystone_habits_automatic', operator: 'eq', value: true },
                    { metric: 'self_reported_identity_shift', operator: 'eq', value: true }
                ],
                action: 'offer_mentor_archetype',
                message: 'You\'ve mastered consistency. Ready to help others?'
            },
            regression: {
                criteria: [
                    { metric: 'missed_consecutive_days', operator: 'gte', value: 5 },
                    { metric: 'engagement_drop', operator: 'gte', value: 0.5 },
                    { metric: 'negative_reflection_sentiment', operator: 'gte', value: 0.6 }
                ],
                action: 'trigger_recalibration_flow',
                message: 'Let\'s rebuild from where you are now.'
            }
        };
        
        // State
        this.currentArchetype = null;
        this.migrationHistory = [];
        this.regressionFlags = [];
    }

    /**
     * Initialize migration tracking
     * @param {string} initialArchetype - Starting archetype
     */
    initialize(initialArchetype) {
        this.currentArchetype = initialArchetype;
        this._loadMigrationHistory();
        
        eventBus.emit(AppEvents.IDENTITY_MIGRATION_INIT, {
            archetype: initialArchetype,
            historyLength: this.migrationHistory.length
        });
    }

    /**
     * Check for migration eligibility
     * @param {Object} userMetrics - Current user metrics
     * @returns {Object} Migration status
     */
    async checkMigrationEligibility(userMetrics) {
        if (!this.currentArchetype) {
            return { eligible: false, reason: 'No archetype assigned' };
        }
        
        const possibleMigrations = this._getPossibleMigrations();
        const eligibleMigrations = [];
        
        for (const migration of possibleMigrations) {
            const criteria = this.migrationCriteria[migration];
            const meetsCriteria = await this._evaluateCriteria(criteria.criteria, userMetrics);
            
            if (meetsCriteria.all) {
                eligibleMigrations.push({
                    type: migration,
                    from: this.currentArchetype,
                    to: this._getTargetArchetype(migration),
                    criteria: criteria,
                    metCriteriaCount: meetsCriteria.met.length,
                    totalCriteriaCount: criteria.criteria.length
                });
            }
        }
        
        return {
            eligible: eligibleMigrations.length > 0,
            migrations: eligibleMigrations,
            currentArchetype: this.currentArchetype
        };
    }

    /**
     * Execute migration
     * @param {string} migrationType - Type of migration
     * @returns {Object} Migration result
     */
    async executeMigration(migrationType) {
        const previousArchetype = this.currentArchetype;
        const newArchetype = this._getTargetArchetype(migrationType);
        
        if (!newArchetype) {
            return {
                success: false,
                error: 'Invalid migration type'
            };
        }
        
        // Update archetype
        this.currentArchetype = newArchetype;
        
        // Record migration
        const migrationRecord = {
            type: migrationType,
            from: previousArchetype,
            to: newArchetype,
            executedAt: new Date().toISOString(),
            userMetrics: await this._captureUserMetrics()
        };
        
        this.migrationHistory.push(migrationRecord);
        this._saveMigrationHistory();
        
        // Execute migration action
        const action = this.migrationCriteria[migrationType]?.action;
        if (action) {
            await this._executeMigrationAction(action, newArchetype);
        }
        
        eventBus.emit(AppEvents.IDENTITY_MIGRATED, migrationRecord);
        
        return {
            success: true,
            migration: migrationRecord,
            newArchetype,
            previousArchetype
        };
    }

    /**
     * Check for regression
     * @param {Object} userMetrics - Current user metrics
     * @returns {Object} Regression status
     */
    async checkRegression(userMetrics) {
        const criteria = this.migrationCriteria.regression.criteria;
        const meetsCriteria = await this._evaluateCriteria(criteria, userMetrics);
        
        if (meetsCriteria.all) {
            const regressionFlag = {
                detectedAt: new Date().toISOString(),
                severity: this._calculateRegressionSeverity(meetsCriteria.met),
                currentArchetype: this.currentArchetype,
                recommendedAction: 'recalibration'
            };
            
            this.regressionFlags.push(regressionFlag);
            
            eventBus.emit(AppEvents.IDENTITY_REGRESSION_DETECTED, regressionFlag);
            
            return {
                regression: true,
                flag: regressionFlag
            };
        }
        
        return { regression: false };
    }

    /**
     * Trigger recalibration flow
     * @returns {Object} Recalibration result
     */
    async triggerRecalibration() {
        const recalibration = {
            triggeredAt: new Date().toISOString(),
            reason: this.regressionFlags.length > 0 ? 'regression_detected' : 'user_initiated',
            previousArchetype: this.currentArchetype,
            status: 'pending'
        };
        
        // Reset to assessment phase
        this.archetypeEngine.reset();
        
        eventBus.emit(AppEvents.IDENTITY_RECALIBRATION_TRIGGERED, recalibration);
        
        return {
            success: true,
            recalibration
        };
    }

    /**
     * Complete recalibration with new archetype
     * @param {string} newArchetype - New archetype assignment
     * @returns {Object} Recalibration completion result
     */
    async completeRecalibration(newArchetype) {
        const previousArchetype = this.currentArchetype;
        this.currentArchetype = newArchetype;
        
        const completion = {
            completedAt: new Date().toISOString(),
            from: previousArchetype,
            to: newArchetype,
            type: 'recalibration',
            regressionFlagsCleared: this.regressionFlags.length
        };
        
        this.migrationHistory.push(completion);
        this.regressionFlags = [];
        this._saveMigrationHistory();
        
        eventBus.emit(AppEvents.IDENTITY_RECALIBRATION_COMPLETE, completion);
        
        return {
            success: true,
            completion
        };
    }

    /**
     * Get migration history
     * @returns {Array} Migration history
     */
    getMigrationHistory() {
        return this.migrationHistory;
    }

    /**
     * Get current archetype
     * @returns {string} Current archetype
     */
    getCurrentArchetype() {
        return this.currentArchetype;
    }

    /**
     * Get possible migrations from current archetype
     * @private
     */
    _getPossibleMigrations() {
        const migrations = [];
        
        if (this.currentArchetype === 'lost') {
            migrations.push('lostToConfused');
        } else if (this.currentArchetype === 'confused') {
            migrations.push('confusedToClear');
            migrations.push('regression');
        } else if (this.currentArchetype === 'clear') {
            migrations.push('regression');
        }
        
        return migrations;
    }

    /**
     * Get target archetype for migration type
     * @private
     */
    _getTargetArchetype(migrationType) {
        const targets = {
            lostToConfused: 'confused',
            confusedToClear: 'clear',
            regression: this._getRegressiveArchetype()
        };
        
        return targets[migrationType];
    }

    /**
     * Get regressive archetype (one step back)
     * @private
     */
    _getRegressiveArchetype() {
        const currentIndex = this.migrationPaths.progressive.indexOf(this.currentArchetype);
        if (currentIndex > 0) {
            return this.migrationPaths.progressive[currentIndex - 1];
        }
        return this.currentArchetype;
    }

    /**
     * Evaluate criteria against user metrics
     * @private
     */
    async _evaluateCriteria(criteria, userMetrics) {
        const met = [];
        const notMet = [];
        
        for (const criterion of criteria) {
            const userValue = userMetrics[criterion.metric];
            const passes = this._evaluateSingleCriterion(userValue, criterion);
            
            if (passes) {
                met.push(criterion);
            } else {
                notMet.push(criterion);
            }
        }
        
        return {
            all: notMet.length === 0,
            met,
            notMet,
            passRate: met.length / criteria.length
        };
    }

    /**
     * Evaluate single criterion
     * @private
     */
    _evaluateSingleCriterion(userValue, criterion) {
        switch (criterion.operator) {
            case 'gte':
                return userValue >= criterion.value;
            case 'gt':
                return userValue > criterion.value;
            case 'lte':
                return userValue <= criterion.value;
            case 'lt':
                return userValue < criterion.value;
            case 'eq':
                return userValue === criterion.value;
            case 'neq':
                return userValue !== criterion.value;
            default:
                return false;
        }
    }

    /**
     * Execute migration action
     * @private
     */
    async _executeMigrationAction(action, newArchetype) {
        switch (action) {
            case 'unlock_advanced_systems':
                // Unlock more complex system templates
                eventBus.emit(AppEvents.SYSTEMS_UNLOCKED, {
                    level: 'advanced',
                    archetype: newArchetype
                });
                break;
                
            case 'offer_mentor_archetype':
                // Offer mentor/teacher role
                eventBus.emit(AppEvents.MENTOR_OFFERED, {
                    archetype: newArchetype
                });
                break;
                
            case 'trigger_recalibration_flow':
                // Already handled by triggerRecalibration
                break;
        }
    }

    /**
     * Calculate regression severity
     * @private
     */
    _calculateRegressionSeverity(metCriteria) {
        const ratio = metCriteria.length / this.migrationCriteria.regression.criteria.length;
        
        if (ratio >= 0.8) {
            return 'critical';
        } else if (ratio >= 0.5) {
            return 'high';
        } else {
            return 'moderate';
        }
    }

    /**
     * Capture user metrics for migration record
     * @private
     */
    async _captureUserMetrics() {
        const tasks = await this.taskRepository.getAll();
        const completed = tasks.filter(t => t.completed);
        const active = tasks.filter(t => !t.completed);
        
        return {
            totalTasks: tasks.length,
            completedTasks: completed.length,
            activeTasks: active.length,
            completionRate: tasks.length > 0 ? completed.length / tasks.length : 0,
            capturedAt: new Date().toISOString()
        };
    }

    /**
     * Load migration history from storage
     * @private
     */
    _loadMigrationHistory() {
        try {
            const stored = localStorage.getItem('identity_migration_history');
            if (stored) {
                this.migrationHistory = JSON.parse(stored);
            }
        } catch (error) {
            console.error('[IdentityMigration] Error loading history:', error);
        }
    }

    /**
     * Save migration history to storage
     * @private
     */
    _saveMigrationHistory() {
        try {
            localStorage.setItem('identity_migration_history', JSON.stringify(this.migrationHistory));
        } catch (error) {
            console.error('[IdentityMigration] Error saving history:', error);
        }
    }
}

export { IdentityMigrationSystem };
