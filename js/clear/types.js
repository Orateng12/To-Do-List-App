/**
 * @fileoverview Central type definitions for Clear Life OS
 * @module clear/types
 * @version 1.0.0
 */

/**
 * @namespace ClearTypes
 * @description Central namespace for all Clear Life OS type definitions
 */

/**
 * User archetype classification
 * @typedef {'clear' | 'confused' | 'lost'} ArchetypeId
 * @memberof ClearTypes
 */

/**
 * User archetype information
 * @typedef {Object} Archetype
 * @memberof ClearTypes
 * @property {ArchetypeId} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - Archetype description
 * @property {ArchetypeCharacteristics} characteristics - Behavioral characteristics
 */

/**
 * Archetype behavioral characteristics
 * @typedef {Object} ArchetypeCharacteristics
 * @memberof ClearTypes
 * @property {'high' | 'medium' | 'low'} clarity - User's clarity level
 * @property {'established' | 'inconsistent' | 'none'} systems - System maturity
 * @property {'low' | 'medium' | 'high'} friction - Friction level
 * @property {'high' | 'medium' | 'low'} readiness - Readiness for change
 */

/**
 * Archetype assignment result
 * @typedef {Object} ArchetypeAssignment
 * @memberof ClearTypes
 * @property {ArchetypeId} archetype - Assigned archetype
 * @property {string} archetypeName - Display name
 * @property {number} confidence - Confidence score (0.0 - 1.0)
 * @property {ArchetypeId | null} secondaryArchetype - Secondary archetype if applicable
 * @property {boolean} requiresValidation - Whether validation is required
 * @property {Array<Contradiction>} contradictions - Detected contradictions
 * @property {Object} scores - Category scores
 * @property {number} compositeScore - Overall composite score
 * @property {string} assignedAt - ISO timestamp
 * @property {string | null} validationDue - Validation due date if required
 */

/**
 * Contradiction in user responses
 * @typedef {Object} Contradiction
 * @memberof ClearTypes
 * @property {string} type - Contradiction type
 * @property {'low' | 'medium' | 'high'} severity - Severity level
 * @property {string} message - Description message
 */

/**
 * Onboarding question
 * @typedef {Object} OnboardingQuestion
 * @memberof ClearTypes
 * @property {string} id - Unique identifier
 * @property {string} text - Question text
 * @property {'likert' | 'multiple_choice' | 'multiple_select'} type - Question type
 * @property {Array} [scale] - Likert scale values
 * @property {Object} [labels] - Scale labels
 * @property {Array} [options] - Multiple choice options
 * @property {number} weight - Question weight in scoring
 */

/**
 * User profile for aspiration analysis
 * @typedef {Object} UserProfile
 * @memberof ClearTypes
 * @property {number} [habitDuration] - Current habit duration in minutes
 * @property {number} [keystoneHabitsCount] - Number of keystone habits
 * @property {boolean} [hasExistingRoutine] - Whether user has existing routine
 * @property {string} [identityDescription] - User's identity description
 * @property {boolean} [earlyMorning] - Whether early morning selected
 * @property {boolean} [multiplePerDay] - Whether multiple per day selected
 * @property {number} [expectedTransformationDays] - Expected days for transformation
 * @property {'low' | 'medium' | 'high'} [habitComplexity] - Habit complexity
 */

/**
 * Aspirational risk analysis result
 * @typedef {Object} AspirationalRisk
 * @memberof ClearTypes
 * @property {'low' | 'medium' | 'high' | 'critical'} overallRiskLevel - Overall risk
 * @property {Array<Risk>} risks - Detected risks
 * @property {number} riskCount - Number of risks
 * @property {boolean} safeToProceed - Whether safe to proceed
 * @property {Recommendation} recommendedAction - Recommended action
 */

/**
 * Individual risk
 * @typedef {Object} Risk
 * @memberof ClearTypes
 * @property {string} pattern - Risk pattern
 * @property {string} name - Risk name
 * @property {boolean} flagged - Whether risk is flagged
 * @property {Intervention} intervention - Intervention to apply
 */

/**
 * Intervention configuration
 * @typedef {Object} Intervention
 * @memberof ClearTypes
 * @property {'reality_check_modal' | 'gradual_build_modal' | 'foundation_first_modal' | 'mindset_reframe_modal' | 'timeline_adjustment_modal'} type - Intervention type
 * @property {string} title - Intervention title
 * @property {string} message - Intervention message
 * @property {string} alternative - Alternative suggestion
 * @property {string} action - Action to take
 */

/**
 * Atomic system template
 * @typedef {Object} AtomicSystemTemplate
 * @memberof ClearTypes
 * @property {string} id - System identifier
 * @property {string} name - System name
 * @property {string} description - System description
 * @property {Array<ArchetypeId>} archetype - Compatible archetypes
 * @property {HabitComponent} keystone - Keystone habit
 * @property {Array<AddOnComponent>} addOns - Optional add-ons
 * @property {CompletionRules} completionRules - Completion rules
 */

/**
 * Habit component (keystone)
 * @typedef {Object} HabitComponent
 * @memberof ClearTypes
 * @property {string} id - Habit identifier
 * @property {string} name - Habit name
 * @property {number} minimumDuration - Minimum duration in minutes
 * @property {number} recommendedDuration - Recommended duration in minutes
 * @property {string} description - Habit description
 * @property {Array<string>} alternatives - Alternative descriptions
 */

/**
 * Add-on component
 * @typedef {Object} AddOnComponent
 * @memberof ClearTypes
 * @property {string} id - Add-on identifier
 * @property {string} name - Add-on name
 * @property {Array<AddOnLevel>} levels - Difficulty levels
 */

/**
 * Add-on difficulty level
 * @typedef {Object} AddOnLevel
 * @memberof ClearTypes
 * @property {number} duration - Duration in minutes
 * @property {string} description - Level description
 */

/**
 * Completion rules
 * @typedef {Object} CompletionRules
 * @memberof ClearTypes
 * @property {CompletionRule} minimum - Minimum completion rule
 * @property {CompletionRule} standard - Standard completion rule
 * @property {CompletionRule} bonus - Bonus completion rule
 */

/**
 * Individual completion rule
 * @typedef {Object} CompletionRule
 * @memberof ClearTypes
 * @property {string} description - Rule description
 * @property {string} requirement - Requirement specification
 * @property {'success' | 'full_success' | 'bonus'} counts_as - Success level
 */

/**
 * Habit conflict
 * @typedef {Object} HabitConflict
 * @memberof ClearTypes
 * @property {'time' | 'energy' | 'identity' | 'resource'} type - Conflict type
 * @property {string} subtype - Conflict subtype
 * @property {Array<string>} habits - Conflicting habit IDs
 * @property {'low' | 'medium' | 'high'} severity - Severity level
 * @property {string} details - Conflict details
 * @property {ConflictResolution} resolution - Resolution suggestion
 */

/**
 * Conflict resolution
 * @typedef {Object} ConflictResolution
 * @memberof ClearTypes
 * @property {'spacing' | 'reframe' | 'integration' | 'scheduling' | 'reschedule' | 'prioritization' | 'distribution'} type - Resolution type
 * @property {string} suggestion - Resolution suggestion
 * @property {string} [rationale] - Resolution rationale
 */

/**
 * Conflict detection result
 * @typedef {Object} ConflictDetectionResult
 * @memberof ClearTypes
 * @property {boolean} hasConflicts - Whether conflicts exist
 * @property {number} conflictCount - Number of conflicts
 * @property {Array<HabitConflict>} conflicts - Detected conflicts
 * @property {'low' | 'medium' | 'high' | 'critical'} severity - Overall severity
 * @property {number} severityScore - Severity score (0.0 - 1.0)
 * @property {boolean} canProceed - Whether user can proceed
 * @property {Array<Recommendation>} recommendations - Recommendations
 */

/**
 * Recommendation
 * @typedef {Object} Recommendation
 * @memberof ClearTypes
 * @property {string} category - Recommendation category
 * @property {'high' | 'medium' | 'low'} priority - Priority level
 * @property {string} action - Recommended action
 * @property {string} details - Recommendation details
 */

/**
 * Event log entry
 * @typedef {Object} EventLogEntry
 * @memberof ClearTypes
 * @property {string} eventId - Unique event identifier
 * @property {EventType} eventType - Event type
 * @property {string} timestamp - ISO timestamp
 * @property {Object} data - Event data
 * @property {boolean} validated - Whether event is validated
 * @property {Array<string>} [validationErrors] - Validation errors if any
 */

/**
 * Event type
 * @typedef {'habit.viewed' | 'habit.started' | 'habit.completed' | 'habit.skipped' | 'habit.failed' | 'reflection.started' | 'reflection.completed' | 'reflection.abandoned' | 'system.created' | 'system.modified' | 'system.adapted' | 'identity.assigned' | 'identity.validated' | 'identity.migrated' | 'session.started' | 'session.completed' | 'notification.received' | 'clarity.scored' | 'clarity.milestone'} EventType
 * @memberof ClearTypes
 */

/**
 * Clarity score record
 * @typedef {Object} ClarityRecord
 * @memberof ClearTypes
 * @property {string} date - Date (YYYY-MM-DD)
 * @property {string} timestamp - ISO timestamp
 * @property {number} overall - Overall clarity score
 * @property {ClarityDimensions} dimensions - Dimension scores
 * @property {ClarityShift} shift - Shift from previous
 * @property {Array<string>} milestones - Achieved milestones
 */

/**
 * Clarity dimensions
 * @typedef {Object} ClarityDimensions
 * @memberof ClearTypes
 * @property {number} [identity] - Identity clarity (1-10)
 * @property {number} [priorities] - Priority clarity (1-10)
 * @property {number} [systems] - System clarity (1-10)
 * @property {number} [progress] - Progress clarity (1-10)
 */

/**
 * Clarity shift
 * @typedef {Object} ClarityShift
 * @memberof ClearTypes
 * @property {number} absolute - Absolute change
 * @property {number} percentage - Percentage change
 * @property {'up' | 'down' | 'stable'} direction - Shift direction
 */

/**
 * Clarity statistics
 * @typedef {Object} ClarityStats
 * @memberof ClearTypes
 * @property {number} average - Average clarity score
 * @property {'improving' | 'declining' | 'stable' | 'insufficient_data'} trend - Trend direction
 * @property {number} volatility - Score volatility
 * @property {{date: string, score: number}} [bestDay] - Best day record
 * @property {{date: string, score: number}} [worstDay] - Worst day record
 * @property {number} totalDays - Total days tracked
 * @property {number} currentStreak - Current positive streak
 */

/**
 * Intervention configuration
 * @typedef {Object} InterventionConfig
 * @memberof ClearTypes
 * @property {string} id - Intervention identifier
 * @property {string} trigger - Trigger condition
 * @property {number} delay - Delay in milliseconds
 * @property {string} action - Action to take
 * @property {string} message - Intervention message
 */

/**
 * Recovery flow
 * @typedef {Object} RecoveryFlow
 * @memberof ClearTypes
 * @property {string} trigger - Flow trigger
 * @property {'low' | 'medium' | 'high' | 'critical'} severity - Severity level
 * @property {Array<InterventionConfig>} interventions - Interventions
 * @property {string} successCriteria - Success criteria
 */

/**
 * Adaptive suggestion
 * @typedef {Object} AdaptiveSuggestion
 * @memberof ClearTypes
 * @property {'reduce_load' | 'increase_challenge' | 'maintain'} type - Suggestion type
 * @property {string} condition - Trigger condition
 * @property {string} duration - Duration requirement
 * @property {string} action - Action to take
 * @property {string} message - Suggestion message
 * @property {'high' | 'medium' | 'low'} priority - Priority level
 */

/**
 * Identity migration record
 * @typedef {Object} MigrationRecord
 * @memberof ClearTypes
 * @property {string} type - Migration type
 * @property {ArchetypeId} from - Source archetype
 * @property {ArchetypeId} to - Target archetype
 * @property {string} executedAt - ISO timestamp
 * @property {Object} [userMetrics] - User metrics at migration
 */

/**
 * Daily recommendations
 * @typedef {Object} DailyRecommendations
 * @memberof ClearTypes
 * @property {ArchetypeId} archetype - User archetype
 * @property {number} currentDay - Current day in program
 * @property {Object} system - Current system
 * @property {Array<InterventionConfig>} interventions - Critical window interventions
 * @property {AdaptiveSuggestion} adaptiveSuggestion - Adaptive suggestion
 * @property {ClarityStats} clarityStats - Clarity statistics
 */

/**
 * User state
 * @typedef {Object} UserState
 * @memberof ClearTypes
 * @property {ArchetypeId | null} archetype - Current archetype
 * @property {number} currentDay - Current day in program
 * @property {Object | null} system - Current system
 * @property {string | null} lastActivity - Last activity timestamp
 * @property {number} [consecutiveMisses] - Consecutive missed days
 * @property {string} [lastCompletionDate] - Last completion date
 */

/**
 * System initialization options
 * @typedef {Object} InitOptions
 * @memberof ClearTypes
 * @property {boolean} [enableLogging=true] - Enable event logging
 * @property {boolean} [enableAnalytics=true] - Enable analytics
 * @property {string} [storageKey='clear_user_state'] - Storage key
 */

/**
 * Operation result
 * @typedef {Object} OperationResult
 * @memberof ClearTypes
 * @property {boolean} success - Whether operation succeeded
 * @property {*} [data] - Result data
 * @property {string} [error] - Error message if failed
 */

export const ClearTypes = {};
