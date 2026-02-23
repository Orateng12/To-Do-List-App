/**
 * Clear Life OS - Core Integration Module
 * =========================================
 * Main integration point for all Phase 4 features.
 * Provides unified API for the Clear Life OS system.
 * 
 * Features:
 * - Unified initialization
 * - Cross-module coordination
 * - Event routing
 * - State management
 */

import { eventBus, AppEvents } from '../core/event-bus.js';
import { ArchetypeEngine } from './archetype-engine.js';
import { IdentityMigrationSystem } from './identity-migration.js';
import { AspirationalIdentityDetector } from './aspiration-detector.js';
import { AtomicSystemTemplates } from './atomic-systems.js';
import { KeystoneConflictDetector } from './conflict-detector.js';
import { UnifiedEventLogger } from './event-logger.js';
import { ClarityMeasurementSystem } from './clarity-measurement.js';
import { InterventionEngine } from './intervention-engine.js';

class ClearLifeOS {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        this.initialized = false;
        
        // Initialize all modules
        this.archetypeEngine = new ArchetypeEngine();
        this.identityMigration = new IdentityMigrationSystem(taskRepository, this.archetypeEngine);
        this.aspirationDetector = new AspirationalIdentityDetector();
        this.atomicSystems = new AtomicSystemTemplates();
        this.conflictDetector = new KeystoneConflictDetector();
        this.eventLogger = new UnifiedEventLogger();
        this.clarityMeasurement = new ClarityMeasurementSystem();
        this.interventionEngine = new InterventionEngine(taskRepository, this.archetypeEngine);
        
        // State
        this.userState = {
            archetype: null,
            currentDay: 0,
            system: null,
            lastActivity: null
        };
        
        // Bind event handlers
        this._bindEventHandlers();
    }

    /**
     * Initialize Clear Life OS
     * @param {Object} options - Initialization options
     * @returns {Promise<Object>} Initialization result
     */
    async initialize(options = {}) {
        console.log('[ClearLifeOS] Initializing...');
        
        try {
            // Load existing user state
            await this._loadUserState();
            
            // Initialize identity migration if archetype exists
            if (this.userState.archetype) {
                this.identityMigration.initialize(this.userState.archetype);
            }
            
            this.initialized = true;
            
            eventBus.emit(AppEvents.CLEAR_LIFE_OS_INIT, {
                archetype: this.userState.archetype,
                currentDay: this.userState.currentDay
            });
            
            console.log('[ClearLifeOS] Initialized successfully');
            
            return {
                success: true,
                state: this.userState
            };
        } catch (error) {
            console.error('[ClearLifeOS] Initialization error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Complete onboarding and assign archetype
     * @param {Object} onboardingAnswers - User's onboarding answers
     * @returns {Object} Archetype assignment result
     */
    completeOnboarding(onboardingAnswers) {
        // Calculate archetype with confidence
        const archetypeResult = this.archetypeEngine.calculateArchetype(onboardingAnswers);
        
        // Check for aspirational identity risks
        const aspirationRisk = this.aspirationDetector.analyzeRisk(
            this._getCurrentProfile(),
            this._getSelectedProfile(onboardingAnswers)
        );
        
        // Initialize identity migration
        this.identityMigration.initialize(archetypeResult.archetype);
        
        // Update user state
        this.userState.archetype = archetypeResult.archetype;
        this.userState.currentDay = 1;
        this._saveUserState();
        
        // Log event
        this.eventLogger.log('identity.assigned', archetypeResult);
        
        // Get archetype-specific configuration
        const config = this.archetypeEngine.getArchetypeConfig(archetypeResult.archetype);
        
        return {
            archetype: archetypeResult,
            aspirationRisk,
            config,
            recommendedSystems: this.atomicSystems.getTemplatesForArchetype(archetypeResult.archetype)
        };
    }

    /**
     * Create system from template
     * @param {string} templateId - Template ID
     * @param {Object} customization - Customization options
     * @returns {Object} Created system
     */
    createSystem(templateId, customization = {}) {
        // Check for conflicts
        const template = this.atomicSystems.getTemplate(templateId);
        if (!template) {
            return { success: false, error: 'Template not found' };
        }
        
        // Create customized system
        const system = this.atomicSystems.createCustomizedSystem(templateId, customization);
        
        // Check for conflicts
        const habitList = this._extractHabitsFromSystem(system);
        const conflicts = this.conflictDetector.detectConflicts(habitList);
        
        if (conflicts.severity === 'critical') {
            return {
                success: false,
                error: 'Critical conflicts detected',
                conflicts
            };
        }
        
        // Save system
        this.userState.system = system;
        this._saveUserState();
        
        // Log event
        this.eventLogger.log('system.created', {
            systemId: system.systemId,
            templateUsed: templateId,
            modifications: customization
        });
        
        return {
            success: true,
            system,
            conflicts: conflicts.hasConflicts ? conflicts : null
        };
    }

    /**
     * Record habit completion
     * @param {string} habitId - Habit ID
     * @param {Object} completionData - Completion data
     * @returns {Object} Completion result
     */
    async recordHabitCompletion(habitId, completionData) {
        const result = {
            success: true,
            habitId,
            completionType: completionData.completionType || 'full',
            streak: await this._updateStreak(habitId),
            interventions: []
        };
        
        // Log event
        this.eventLogger.log('habit.completed', {
            habitId,
            completionType: result.completionType,
            duration: completionData.duration,
            moodBefore: completionData.moodBefore,
            moodAfter: completionData.moodAfter
        });
        
        // Check for interventions
        const dayInterventions = this.interventionEngine.checkCriticalWindowInterventions(
            this.userState.currentDay,
            this.userState
        );
        
        if (dayInterventions.length > 0) {
            result.interventions = dayInterventions;
        }
        
        // Update identity migration
        const metrics = await this._getUserMetrics();
        const migrationCheck = await this.identityMigration.checkMigrationEligibility(metrics);
        
        if (migrationCheck.eligible) {
            result.migrationOpportunity = migrationCheck.migrations[0];
        }
        
        return result;
    }

    /**
     * Record habit miss
     * @param {string} habitId - Habit ID
     * @param {string} reason - Reason for missing
     * @returns {Object} Miss result with recovery flow
     */
    async recordHabitMiss(habitId, reason) {
        // Log event
        this.eventLogger.log('habit.skipped', {
            habitId,
            reason,
            timestamp: new Date().toISOString()
        });
        
        // Update consecutive misses
        this.userState.consecutiveMisses = (this.userState.consecutiveMisses || 0) + 1;
        this._saveUserState();
        
        // Check for recovery flow
        const recoveryFlow = await this.interventionEngine.checkRecoveryFlows({
            consecutiveMissedDays: this.userState.consecutiveMisses,
            archetype: this.userState.archetype,
            lastCompletionDate: this.userState.lastCompletionDate
        });
        
        // Get adaptive suggestion
        const metrics = await this._getUserMetrics();
        const suggestion = await this.interventionEngine.getAdaptiveSuggestion(metrics);
        
        return {
            success: true,
            consecutiveMisses: this.userState.consecutiveMisses,
            recoveryFlow,
            adaptiveSuggestion: suggestion
        };
    }

    /**
     * Record daily clarity score
     * @param {Object} scores - Scores by dimension
     * @returns {Object} Clarity result
     */
    recordClarityScore(scores) {
        const result = this.clarityMeasurement.recordDailyClarity(scores);
        
        // Log event
        this.eventLogger.log('clarity.scored', {
            score: result.overall,
            dimensions: scores,
            shift: result.shift
        });
        
        // Check for milestones
        if (result.milestones.length > 0) {
            result.hasMilestones = true;
            eventBus.emit(AppEvents.CLARITY_MILESTONE, {
                milestones: result.milestones,
                score: result.overall
            });
        }
        
        return result;
    }

    /**
     * Get daily recommendations
     * @returns {Promise<Object>} Recommendations
     */
    async getDailyRecommendations() {
        const metrics = await this._getUserMetrics();
        
        return {
            archetype: this.userState.archetype,
            currentDay: this.userState.currentDay,
            system: this.userState.system,
            interventions: this.interventionEngine.checkCriticalWindowInterventions(
                this.userState.currentDay,
                this.userState
            ),
            adaptiveSuggestion: await this.interventionEngine.getAdaptiveSuggestion(metrics),
            clarityStats: this.clarityMeasurement.getClarityStats()
        };
    }

    /**
     * Validate archetype (Day 3, 7, 14)
     * @param {string} validationType - Validation type
     * @param {Object} answers - Validation answers
     * @returns {Object} Validation result
     */
    validateArchetype(validationType, answers) {
        const result = this.archetypeEngine.validateArchetype(validationType, answers);
        
        // Log event
        this.eventLogger.log('identity.validated', {
            validationType,
            score: result.score,
            needsRecalibration: result.needsRecalibration
        });
        
        if (result.needsRecalibration) {
            return {
                ...result,
                action: 'recalibration_recommended',
                recalibrationTrigger: result.recalibrationTrigger
            };
        }
        
        return result;
    }

    /**
     * Get user progress
     * @returns {Promise<Object>} Progress data
     */
    async getProgress() {
        const metrics = await this._getUserMetrics();
        const clarityStats = this.clarityMeasurement.getClarityStats();
        const migrationHistory = this.identityMigration.getMigrationHistory();
        
        return {
            archetype: this.userState.archetype,
            currentDay: this.userState.currentDay,
            metrics,
            clarity: clarityStats,
            migrations: migrationHistory,
            system: this.userState.system
        };
    }

    /**
     * Bind event handlers
     * @private
     */
    _bindEventHandlers() {
        // Listen for archetype changes
        eventBus.on(AppEvents.ARCHETYPE_ASSIGNED, (data) => {
            this.userState.archetype = data.archetype;
            this._saveUserState();
        });
        
        // Listen for identity migrations
        eventBus.on(AppEvents.IDENTITY_MIGRATED, (data) => {
            this.userState.archetype = data.to;
            this._saveUserState();
        });
        
        // Listen for interventions
        eventBus.on(AppEvents.INTERVENTION_RECORDED, (data) => {
            console.log('[ClearLifeOS] Intervention:', data);
        });
    }

    /**
     * Load user state from storage
     * @private
     */
    async _loadUserState() {
        try {
            const stored = localStorage.getItem('clear_user_state');
            if (stored) {
                this.userState = { ...this.userState, ...JSON.parse(stored) };
            }
        } catch (error) {
            console.error('[ClearLifeOS] Load state error:', error);
        }
    }

    /**
     * Save user state to storage
     * @private
     */
    _saveUserState() {
        try {
            localStorage.setItem('clear_user_state', JSON.stringify(this.userState));
        } catch (error) {
            console.error('[ClearLifeOS] Save state error:', error);
        }
    }

    /**
     * Get current user profile
     * @private
     */
    _getCurrentProfile() {
        return {
            habitDuration: this.userState.system?.components?.keystone?.recommendedDuration || 5,
            keystoneHabitsCount: this.userState.system?.components?.addOns?.length || 0,
            hasExistingRoutine: this.userState.currentDay > 14,
            identityDescription: ''
        };
    }

    /**
     * Get selected profile from onboarding
     * @private
     */
    _getSelectedProfile(answers) {
        return {
            habitDuration: answers.selectedDuration || 20,
            keystoneHabitsCount: answers.selectedHabits?.length || 2,
            earlyMorning: answers.selectedTime === 'early',
            multiplePerDay: answers.selectedFrequency === 'multiple',
            identityDescription: answers.identityStatement || '',
            expectedTransformationDays: answers.expectedTimeline || 30,
            habitComplexity: answers.selectedComplexity || 'medium'
        };
    }

    /**
     * Extract habits from system
     * @private
     */
    _extractHabitsFromSystem(system) {
        const habits = [];
        
        if (system?.components?.keystone) {
            habits.push({
                id: system.components.keystone.id,
                metadata: system.components.keystone
            });
        }
        
        if (system?.components?.addOns) {
            system.components.addOns.forEach(addon => {
                habits.push({
                    id: addon.id,
                    metadata: addon
                });
            });
        }
        
        return habits;
    }

    /**
     * Update habit streak
     * @private
     */
    async _updateStreak(habitId) {
        // Simplified streak tracking
        const stored = localStorage.getItem('clear_habit_streaks');
        const streaks = stored ? JSON.parse(stored) : {};
        
        const today = new Date().toISOString().split('T')[0];
        const lastStreakDate = streaks[habitId]?.lastDate;
        
        if (lastStreakDate !== today) {
            streaks[habitId] = {
                count: (streaks[habitId]?.count || 0) + 1,
                lastDate: today
            };
            localStorage.setItem('clear_habit_streaks', JSON.stringify(streaks));
        }
        
        return streaks[habitId]?.count || 1;
    }

    /**
     * Get user metrics
     * @private
     */
    async _getUserMetrics() {
        const tasks = await this.taskRepository.getAll();
        const completed = tasks.filter(t => t.completed);
        const total = tasks.length;
        
        return {
            adherenceRate: total > 0 ? completed.length / total : 0,
            consecutiveMissedDays: this.userState.consecutiveMisses || 0,
            sentimentScore: 0.5, // Would come from reflection data
            currentDay: this.userState.currentDay
        };
    }
}

export { ClearLifeOS };
