/**
 * Archetype Engine - Clear Life OS
 * ==================================
 * Advanced user archetype assignment with confidence scoring,
 * validation, and recalibration mechanisms.
 * 
 * Features:
 * - Multi-factor archetype assessment
 * - Confidence scoring algorithm
 * - Contradiction detection
 * - Validation flow (Day 3, 7, 14)
 * - Archetype migration tracking
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class ArchetypeEngine {
    constructor() {
        // Archetype definitions
        this.archetypes = {
            CLEAR: {
                id: 'clear',
                name: 'Clear',
                description: 'Knows who they are and what they want',
                characteristics: {
                    clarity: 'high',
                    systems: 'established',
                    friction: 'low',
                    readiness: 'high'
                }
            },
            CONFUSED: {
                id: 'confused',
                name: 'Confused',
                description: 'Has direction but struggles with consistency',
                characteristics: {
                    clarity: 'medium',
                    systems: 'inconsistent',
                    friction: 'medium',
                    readiness: 'medium'
                }
            },
            LOST: {
                id: 'lost',
                name: 'Lost',
                description: 'Uncertain about direction and priorities',
                characteristics: {
                    clarity: 'low',
                    systems: 'none',
                    friction: 'high',
                    readiness: 'low'
                }
            }
        };

        // Onboarding questions by category
        this.onboardingQuestions = {
            identity: [
                {
                    id: 'i1',
                    text: 'I know who I want to become',
                    type: 'likert',
                    scale: [1, 2, 3, 4, 5, 6, 7],
                    labels: { 1: 'Strongly Disagree', 7: 'Strongly Agree' },
                    weight: 1.0
                },
                {
                    id: 'i2',
                    text: 'My daily actions align with my identity',
                    type: 'likert',
                    scale: [1, 2, 3, 4, 5, 6, 7],
                    weight: 1.0
                },
                {
                    id: 'i3',
                    text: 'I feel confident in my direction',
                    type: 'likert',
                    scale: [1, 2, 3, 4, 5, 6, 7],
                    weight: 0.8
                }
            ],
            currentSystems: [
                {
                    id: 's1',
                    text: 'How many habit systems are you currently maintaining?',
                    type: 'multiple_choice',
                    options: [
                        { value: 0, label: 'None' },
                        { value: 1, label: 'One' },
                        { value: 2, label: 'Two' },
                        { value: 3, label: 'Three' },
                        { value: '4+', label: 'Four or more' }
                    ],
                    weight: 0.6
                },
                {
                    id: 's2',
                    text: 'Which areas feel most stable?',
                    type: 'multiple_select',
                    options: [
                        { value: 'health', label: 'Health & Fitness' },
                        { value: 'work', label: 'Work & Career' },
                        { value: 'relationships', label: 'Relationships' },
                        { value: 'personal', label: 'Personal Growth' },
                        { value: 'none', label: 'None feel stable' }
                    ],
                    weight: 0.4
                }
            ],
            friction: [
                {
                    id: 'f1',
                    text: 'What typically prevents you from completing habits?',
                    type: 'multiple_select',
                    options: [
                        { value: 'time', label: 'Lack of time' },
                        { value: 'energy', label: 'Lack of energy' },
                        { value: 'motivation', label: 'Lack of motivation' },
                        { value: 'forgetting', label: 'I forget' },
                        { value: 'complexity', label: 'Too complicated' },
                        { value: 'nothing', label: 'Nothing - I\'m consistent' }
                    ],
                    weight: 0.8
                },
                {
                    id: 'f2',
                    text: 'When do you most often struggle?',
                    type: 'multiple_choice',
                    options: [
                        { value: 'starting', label: 'Getting started' },
                        { value: 'middle', label: 'Staying consistent' },
                        { value: 'finishing', label: 'Completing what I start' },
                        { value: 'never', label: 'I rarely struggle' }
                    ],
                    weight: 0.6
                },
                {
                    id: 'f3',
                    text: 'How often do you miss your planned habits?',
                    type: 'multiple_choice',
                    options: [
                        { value: 'always', label: 'Almost always' },
                        { value: 'often', label: 'More than half the time' },
                        { value: 'sometimes', label: 'About half the time' },
                        { value: 'rarely', label: 'Rarely' },
                        { value: 'never', label: 'Almost never' }
                    ],
                    weight: 1.0
                }
            ],
            readiness: [
                {
                    id: 'r1',
                    text: 'I have time and energy for new systems',
                    type: 'likert',
                    scale: [1, 2, 3, 4, 5, 6, 7],
                    weight: 0.7
                },
                {
                    id: 'r2',
                    text: 'I\'m ready to commit to a daily practice',
                    type: 'likert',
                    scale: [1, 2, 3, 4, 5, 6, 7],
                    weight: 0.9
                }
            ]
        };

        // Scoring thresholds
        this.thresholds = {
            clear: { min: 0.70, max: 1.0 },
            confused: { min: 0.40, max: 0.69 },
            lost: { min: 0.0, max: 0.39 }
        };

        // Confidence threshold for validation requirement
        this.confidenceThreshold = 0.65;

        // State
        this.currentAssessment = null;
        this.validationHistory = [];
    }

    /**
     * Calculate archetype from assessment answers
     * @param {Object} answers - User answers by category
     * @returns {Object} Archetype assignment with confidence
     */
    calculateArchetype(answers) {
        const scores = {
            clarity: this._calculateClarityScore(answers.identity),
            systems: this._calculateSystemsScore(answers.currentSystems),
            friction: this._calculateFrictionScore(answers.friction),
            readiness: this._calculateReadinessScore(answers.readiness)
        };

        // Check for contradictions
        const contradictions = this._detectContradictions(answers, scores);

        // Calculate composite score
        const compositeScore = this._calculateCompositeScore(scores);

        // Determine archetype
        const archetype = this._determineArchetype(compositeScore);

        // Calculate confidence
        const confidence = this._calculateConfidence(scores, contradictions);

        // Determine secondary archetype
        const secondaryArchetype = this._determineSecondaryArchetype(compositeScore, archetype);

        // Determine if validation required
        const requiresValidation = confidence < this.confidenceThreshold || contradictions.length > 0;

        const result = {
            archetype: archetype.id,
            archetypeName: archetype.name,
            confidence: Math.round(confidence * 100) / 100,
            secondaryArchetype: secondaryArchetype?.id || null,
            requiresValidation,
            contradictions,
            scores,
            compositeScore: Math.round(compositeScore * 100) / 100,
            assignedAt: new Date().toISOString(),
            validationDue: requiresValidation ? this._calculateValidationDueDate() : null
        };

        this.currentAssessment = result;

        eventBus.emit(AppEvents.ARCHETYPE_ASSIGNED, result);

        return result;
    }

    /**
     * Calculate clarity score from identity answers
     * @private
     */
    _calculateClarityScore(answers) {
        if (!answers || answers.length === 0) return 0.5;

        const maxScore = answers.reduce((sum, q) => sum + (q.weight * 7), 0);
        const actualScore = answers.reduce((sum, q) => {
            return sum + (q.weight * (q.answer || 4)); // Default to neutral
        }, 0);

        return actualScore / maxScore;
    }

    /**
     * Calculate systems score
     * @private
     */
    _calculateSystemsScore(answers) {
        if (!answers || answers.length === 0) return 0.3;

        const systemCount = answers.find(a => a.id === 's1')?.answer || 0;
        const stableAreas = answers.find(a => a.id === 's2')?.answer?.length || 0;

        // More systems + more stable areas = higher score
        const systemScore = Math.min(systemCount / 3, 1.0);
        const stabilityScore = Math.min(stableAreas / 3, 1.0);

        return (systemScore * 0.6) + (stabilityScore * 0.4);
    }

    /**
     * Calculate friction score (inverse - less friction = higher score)
     * @private
     */
    _calculateFrictionScore(answers) {
        if (!answers || answers.length === 0) return 0.5;

        const frequencyAnswer = answers.find(a => a.id === 'f3')?.answer || 'sometimes';
        const frictionFactors = answers.find(a => a.id === 'f1')?.answer?.length || 2;

        const frequencyScore = {
            'never': 1.0,
            'rarely': 0.8,
            'sometimes': 0.5,
            'often': 0.3,
            'always': 0.1
        }[frequencyAnswer] || 0.5;

        // More friction factors = lower score
        const factorScore = 1 - Math.min(frictionFactors / 4, 1.0);

        return (frequencyScore * 0.7) + (factorScore * 0.3);
    }

    /**
     * Calculate readiness score
     * @private
     */
    _calculateReadinessScore(answers) {
        if (!answers || answers.length === 0) return 0.5;

        const maxScore = answers.reduce((sum, q) => sum + (q.weight * 7), 0);
        const actualScore = answers.reduce((sum, q) => {
            return sum + (q.weight * (q.answer || 4));
        }, 0);

        return actualScore / maxScore;
    }

    /**
     * Detect contradictory answers
     * @private
     */
    _detectContradictions(answers, scores) {
        const contradictions = [];

        // Check: High clarity + High friction
        if (scores.clarity > 0.7 && scores.friction < 0.4) {
            contradictions.push({
                type: 'clarity_friction_mismatch',
                severity: 'medium',
                message: 'Your responses suggest both high clarity and high friction, which is unusual.'
            });
        }

        // Check: High readiness + No systems
        if (scores.readiness > 0.7 && scores.systems < 0.3) {
            contradictions.push({
                type: 'readiness_systems_mismatch',
                severity: 'low',
                message: 'You indicate high readiness but no current systems.'
            });
        }

        // Check: Low clarity + Many systems
        if (scores.clarity < 0.4 && scores.systems > 0.6) {
            contradictions.push({
                type: 'clarity_systems_mismatch',
                severity: 'medium',
                message: 'You have established systems but report low clarity.'
            });
        }

        return contradictions;
    }

    /**
     * Calculate composite score
     * @private
     */
    _calculateCompositeScore(scores) {
        const weights = {
            clarity: 0.35,
            systems: 0.25,
            friction: 0.20,
            readiness: 0.20
        };

        return (
            (scores.clarity * weights.clarity) +
            (scores.systems * weights.systems) +
            (scores.friction * weights.friction) +
            (scores.readiness * weights.readiness)
        );
    }

    /**
     * Determine archetype from composite score
     * @private
     */
    _determineArchetype(compositeScore) {
        if (compositeScore >= this.thresholds.clear.min) {
            return this.archetypes.CLEAR;
        } else if (compositeScore >= this.thresholds.confused.min) {
            return this.archetypes.CONFUSED;
        } else {
            return this.archetypes.LOST;
        }
    }

    /**
     * Calculate confidence in archetype assignment
     * @private
     */
    _calculateConfidence(scores, contradictions) {
        // Base confidence from score distance from thresholds
        const compositeScore = this._calculateCompositeScore(scores);
        
        let distanceFromThreshold;
        if (compositeScore >= this.thresholds.clear.min) {
            distanceFromThreshold = compositeScore - this.thresholds.clear.min;
        } else if (compositeScore >= this.thresholds.confused.min) {
            const midPoint = (this.thresholds.clear.min + this.thresholds.confused.min) / 2;
            distanceFromThreshold = Math.abs(compositeScore - midPoint);
        } else {
            distanceFromThreshold = this.thresholds.confused.min - compositeScore;
        }

        // Normalize distance to 0-1 range
        const distanceConfidence = Math.min(distanceFromThreshold / 0.3, 1.0);

        // Reduce confidence for contradictions
        const contradictionPenalty = contradictions.length * 0.1;

        // Reduce confidence for score variance (inconsistent answers)
        const scoreValues = Object.values(scores);
        const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
        const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scoreValues.length;
        const variancePenalty = Math.min(variance * 2, 0.3);

        const confidence = Math.max(0.3, distanceConfidence - contradictionPenalty - variancePenalty);

        return confidence;
    }

    /**
     * Determine secondary archetype
     * @private
     */
    _determineSecondaryArchetype(compositeScore, primaryArchetype) {
        const clearMid = (this.thresholds.clear.min + this.thresholds.confused.max) / 2;
        const confusedMid = (this.thresholds.confused.min + this.thresholds.lost.max) / 2;

        if (primaryArchetype.id === 'clear' && compositeScore < clearMid) {
            return this.archetypes.CONFUSED;
        } else if (primaryArchetype.id === 'confused') {
            if (compositeScore > clearMid) {
                return this.archetypes.CLEAR;
            } else if (compositeScore < confusedMid) {
                return this.archetypes.LOST;
            }
        } else if (primaryArchetype.id === 'lost' && compositeScore > confusedMid) {
            return this.archetypes.CONFUSED;
        }

        return null;
    }

    /**
     * Calculate validation due date
     * @private
     */
    _calculateValidationDueDate() {
        const date = new Date();
        date.setDate(date.getDate() + 3); // Day 3 validation
        return date.toISOString();
    }

    /**
     * Validate archetype assignment (Day 3, 7, 14)
     * @param {string} validationType - 'day3', 'day7', 'day14'
     * @param {Object} validationAnswers - User validation responses
     * @returns {Object} Validation result
     */
    validateArchetype(validationType, validationAnswers) {
        if (!this.currentAssessment) {
            return { success: false, error: 'No assessment to validate' };
        }

        const validationQuestions = this._getValidationQuestions(validationType);
        const score = this._calculateValidationScore(validationAnswers, validationQuestions);
        
        const needsRecalibration = this._checkRecalibrationNeeded(score, validationType);

        const result = {
            validationType,
            validatedAt: new Date().toISOString(),
            score: Math.round(score * 100) / 100,
            needsRecalibration,
            confidenceUpdated: null
        };

        if (needsRecalibration) {
            result.recalibrationTrigger = this._determineRecalibrationTrigger(score, validationType);
        } else {
            // Increase confidence
            const confidenceBoost = validationType === 'day3' ? 0.1 : 
                                   validationType === 'day7' ? 0.05 : 0.03;
            result.confidenceUpdated = Math.min(1.0, this.currentAssessment.confidence + confidenceBoost);
            this.currentAssessment.confidence = result.confidenceUpdated;
        }

        this.validationHistory.push(result);

        eventBus.emit(AppEvents.ARCHETYPE_VALIDATED, result);

        return result;
    }

    /**
     * Get validation questions for specific day
     * @private
     */
    _getValidationQuestions(validationType) {
        const questions = {
            day3: [
                { id: 'v1', text: 'How well does your assigned archetype describe you?', type: 'likert', max: 7 },
                { id: 'v2', text: 'Has the system felt appropriate for you?', type: 'likert', max: 7 }
            ],
            day7: [
                { id: 'v3', text: 'Do you feel the system is working?', type: 'likert', max: 7 },
                { id: 'v4', text: 'Has your clarity improved?', type: 'likert', max: 7 }
            ],
            day14: [
                { id: 'v5', text: 'Do you identify with your archetype?', type: 'likert', max: 7 },
                { id: 'v6', text: 'Should we adjust your system?', type: 'likert', max: 7 }
            ]
        };

        return questions[validationType] || questions.day3;
    }

    /**
     * Calculate validation score
     * @private
     */
    _calculateValidationScore(answers, questions) {
        if (!answers || answers.length === 0) return 0.5;

        const maxScore = questions.reduce((sum, q) => sum + q.max, 0);
        const actualScore = answers.reduce((sum, a, i) => {
            return sum + (a.answer || questions[i].max / 2);
        }, 0);

        return actualScore / maxScore;
    }

    /**
     * Check if recalibration is needed
     * @private
     */
    _checkRecalibrationNeeded(score, validationType) {
        const thresholds = {
            day3: 0.4,
            day7: 0.45,
            day14: 0.5
        };

        return score < (thresholds[validationType] || 0.5);
    }

    /**
     * Determine recalibration trigger
     * @private
     */
    _determineRecalibrationTrigger(score, validationType) {
        if (score < 0.3) {
            return 'major_recalibration';
        } else if (score < 0.5) {
            return 'minor_adjustment';
        } else {
            return 'system_tweak';
        }
    }

    /**
     * Get archetype configuration for user experience
     * @param {string} archetypeId - Archetype ID
     * @returns {Object} Configuration
     */
    getArchetypeConfig(archetypeId) {
        const configs = {
            clear: {
                onboarding: {
                    length: 'short',
                    questionCount: 5,
                    estimatedTime: '< 3 minutes'
                },
                systems: {
                    initialHabits: 3,
                    complexity: 'high',
                    flexibility: 'user_designed'
                },
                reflections: {
                    frequency: 'weekly',
                    depth: 'strategic'
                },
                notifications: {
                    frequency: 'minimal',
                    tone: 'professional'
                }
            },
            confused: {
                onboarding: {
                    length: 'medium',
                    questionCount: 8,
                    estimatedTime: '5-7 minutes'
                },
                systems: {
                    initialHabits: 2,
                    complexity: 'medium',
                    flexibility: 'guided_choices'
                },
                reflections: {
                    frequency: 'twice_weekly',
                    depth: 'exploratory'
                },
                notifications: {
                    frequency: 'moderate',
                    tone: 'encouraging'
                }
            },
            lost: {
                onboarding: {
                    length: 'long',
                    questionCount: 12,
                    estimatedTime: '10-12 minutes'
                },
                systems: {
                    initialHabits: 1,
                    complexity: 'low',
                    flexibility: 'highly_structured'
                },
                reflections: {
                    frequency: 'daily',
                    depth: 'foundational'
                },
                notifications: {
                    frequency: 'frequent',
                    tone: 'supportive'
                }
            }
        };

        return configs[archetypeId] || configs.confused;
    }

    /**
     * Get current assessment
     * @returns {Object} Current assessment
     */
    getCurrentAssessment() {
        return this.currentAssessment;
    }

    /**
     * Get validation history
     * @returns {Array} Validation history
     */
    getValidationHistory() {
        return this.validationHistory;
    }

    /**
     * Reset assessment (for recalibration)
     */
    reset() {
        this.currentAssessment = null;
        this.validationHistory = [];
        eventBus.emit(AppEvents.ARCHETYPE_RESET);
    }
}

export { ArchetypeEngine };
