/**
 * Intervention Engine - Clear Life OS
 * ====================================
 * Manages critical window interventions,
 * recovery flows, and adaptive suggestions.
 * 
 * Features:
 * - Day 1-3 critical window interventions
 * - Missed day recovery flows
 * - Adaptive suggestion decision matrix
 * - Burnout prevention
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class InterventionEngine {
    constructor(taskRepository, archetypeEngine) {
        this.taskRepository = taskRepository;
        this.archetypeEngine = archetypeEngine;
        
        // Critical window interventions (Days 1-3)
        this.criticalWindowInterventions = {
            day1: {
                focus: 'first_success_experience',
                interventions: [
                    {
                        id: 'ensure_first_completion',
                        trigger: 'habit_viewed_but_not_started',
                        delay: 3600000, // 1 hour
                        action: 'simplify_habit',
                        message: 'Want to try a 2-minute version to get started?'
                    },
                    {
                        id: 'immediate_reinforcement',
                        trigger: 'habit_completed',
                        delay: 0,
                        action: 'celebrate_and_reinforce',
                        message: 'Great start! You\'re building momentum.'
                    },
                    {
                        id: 'identity_reinforcement',
                        trigger: 'day1_evening',
                        delay: 0,
                        action: 'send_identity_message',
                        message: 'You\'re the type of person who follows through. Day 1 ✓'
                    }
                ]
            },
            day2: {
                focus: 'momentum_building',
                interventions: [
                    {
                        id: 'reminder_optimization',
                        trigger: 'no_completion_by_noon',
                        delay: 0,
                        action: 'send_optimized_reminder',
                        message: 'Your system is waiting. What\'s the smallest version you could do?'
                    },
                    {
                        id: 'friction_removal',
                        trigger: 'habit_started_but_abandoned',
                        delay: 0,
                        action: 'offer_friction_help',
                        message: 'Noticing some friction. Want to simplify?'
                    },
                    {
                        id: 'social_proof',
                        trigger: 'day2_evening',
                        delay: 0,
                        action: 'show_social_proof',
                        message: '80% of users who complete Day 2 go on to build lasting habits.'
                    }
                ]
            },
            day3: {
                focus: 'commitment_reinforcement',
                interventions: [
                    {
                        id: 'streak_visualization',
                        trigger: 'day3_completion',
                        delay: 0,
                        action: 'show_streak',
                        message: '3 days in a row! You\'re building real momentum.'
                    },
                    {
                        id: 'micro_commitment',
                        trigger: 'day3_evening',
                        delay: 0,
                        action: 'request_commitment',
                        message: 'Want to commit to just 3 more days? That\'s one week!'
                    },
                    {
                        id: 'early_wins_celebration',
                        trigger: 'day3_complete',
                        delay: 0,
                        action: 'celebrate_wins',
                        message: 'Look at what you\'ve accomplished in just 3 days!'
                    }
                ]
            }
        };
        
        // Missed day recovery flows
        this.recoveryFlows = {
            missed1Day: {
                trigger: 'first_miss_detected',
                severity: 'low',
                interventions: [
                    {
                        timing: 'same_day_evening',
                        type: 'gentle_nudge',
                        message: 'Everyone misses a day. Your system is waiting when you\'re ready.',
                        action: 'simplify_today_only'
                    }
                ],
                successCriteria: 'completion_within_48h'
            },
            missed2Days: {
                trigger: 'second_consecutive_miss',
                severity: 'medium',
                interventions: [
                    {
                        timing: 'immediate',
                        type: 'friction_investigation',
                        message: 'Noticing some friction. What got in the way?',
                        action: 'show_friction_options',
                        options: [
                            'Too busy',
                            'Too difficult',
                            'Forgot',
                            'Lost motivation',
                            'Other'
                        ]
                    },
                    {
                        timing: 'based_on_response',
                        type: 'targeted_solution',
                        mapping: {
                            'Too busy': 'reduce_to_minimum',
                            'Too difficult': 'downgrade_difficulty',
                            'Forgot': 'adjust_reminders',
                            'Lost motivation': 'reconnect_to_identity',
                            'Other': 'offer_recalibration'
                        }
                    }
                ],
                successCriteria: 'completion_within_72h'
            },
            missed3Days: {
                trigger: 'third_consecutive_miss',
                severity: 'high',
                interventions: [
                    {
                        timing: 'immediate',
                        type: 'recalibration_required',
                        message: 'Let\'s rebuild from where you are now.',
                        action: 'mini_onboarding_flow'
                    },
                    {
                        timing: 'post_recalibration',
                        type: 'fresh_start',
                        message: 'New beginning. Let\'s start with just ONE thing.',
                        action: 'single_habit_focus'
                    }
                ],
                successCriteria: 'recalibration_completed'
            },
            missed7Days: {
                trigger: 'week_missed',
                severity: 'critical',
                interventions: [
                    {
                        timing: 'immediate',
                        type: 'fresh_start_protocol',
                        message: 'New week, fresh start. Want to rebuild together?',
                        action: 'archetype_reassessment'
                    },
                    {
                        timing: 'day3_post_reengagement',
                        type: 'momentum_check',
                        message: 'How\'s the new approach feeling?',
                        action: 'gather_feedback'
                    }
                ],
                successCriteria: 'reengagement_and_3_day_streak'
            }
        };
        
        // Adaptive suggestion decision matrix
        this.adaptiveSuggestions = {
            reduceLoad: {
                triggers: [
                    {
                        condition: 'adherence_rate < 0.5',
                        duration: '7_days',
                        action: 'remove_1_habit',
                        message: 'Let\'s simplify to make this sustainable.'
                    },
                    {
                        condition: 'adherence_rate < 0.3',
                        duration: '5_days',
                        action: 'reduce_to_minimum',
                        message: 'Starting smaller leads to bigger long-term success.'
                    },
                    {
                        condition: 'negative_sentiment > 0.6',
                        duration: '3_days',
                        action: 'pause_and_recalibrate',
                        message: 'Let\'s take a breath and reset.'
                    },
                    {
                        condition: 'missed_consecutive_days >= 3',
                        duration: 'immediate',
                        action: 'intervention_flow',
                        message: 'Time for a fresh approach.'
                    }
                ]
            },
            increaseChallenge: {
                triggers: [
                    {
                        condition: 'adherence_rate > 0.9',
                        duration: '14_days',
                        action: 'offer_advanced_system',
                        message: 'You\'ve mastered this level. Ready for more?'
                    },
                    {
                        condition: 'keystone_automaticity == true',
                        duration: 'verified',
                        action: 'add_supporting_habit',
                        message: 'Your keystone habit is automatic. Want to build on it?'
                    },
                    {
                        condition: 'self_reported_boredom',
                        duration: 'reported',
                        action: 'offer_variation',
                        message: 'Ready to mix things up?'
                    }
                ]
            },
            maintain: {
                default: true,
                conditions: 'adherence_rate 0.6-0.85',
                action: 'continue_current_path',
                message: 'You\'re on a great path. Keep going!'
            }
        };
        
        // State
        this.interventionHistory = [];
        this.pendingInterventions = [];
    }

    /**
     * Check for critical window interventions
     * @param {number} dayNumber - Current day in program
     * @param {Object} userState - Current user state
     * @returns {Array} Applicable interventions
     */
    checkCriticalWindowInterventions(dayNumber, userState) {
        const dayKey = `day${Math.min(dayNumber, 3)}`;
        const dayInterventions = this.criticalWindowInterventions[dayKey];
        
        if (!dayInterventions) return [];
        
        const applicable = [];
        
        for (const intervention of dayInterventions.interventions) {
            if (this._shouldTriggerIntervention(intervention, userState)) {
                applicable.push({
                    ...intervention,
                    day: dayNumber,
                    priority: 'critical_window'
                });
            }
        }
        
        return applicable;
    }

    /**
     * Check for recovery flow triggers
     * @param {Object} userState - Current user state
     * @returns {Object} Recovery flow if triggered
     */
    async checkRecoveryFlows(userState) {
        const consecutiveMisses = userState.consecutiveMissedDays || 0;
        
        if (consecutiveMisses >= 7) {
            return this._activateRecoveryFlow('missed7Days', userState);
        } else if (consecutiveMisses >= 3) {
            return this._activateRecoveryFlow('missed3Days', userState);
        } else if (consecutiveMisses >= 2) {
            return this._activateRecoveryFlow('missed2Days', userState);
        } else if (consecutiveMisses >= 1) {
            return this._activateRecoveryFlow('missed1Day', userState);
        }
        
        return null;
    }

    /**
     * Activate recovery flow
     * @private
     */
    _activateRecoveryFlow(flowKey, userState) {
        const flow = this.recoveryFlows[flowKey];
        
        const activatedFlow = {
            ...flow,
            activatedAt: new Date().toISOString(),
            userState: {
                consecutiveMisses: userState.consecutiveMissedDays,
                archetype: userState.archetype,
                lastCompletion: userState.lastCompletionDate
            },
            currentInterventionIndex: 0
        };
        
        eventBus.emit(AppEvents.RECOVERY_FLOW_ACTIVATED, activatedFlow);
        
        return activatedFlow;
    }

    /**
     * Get adaptive suggestion
     * @param {Object} userMetrics - Current user metrics
     * @returns {Object} Suggestion
     */
    async getAdaptiveSuggestion(userMetrics) {
        const adherenceRate = userMetrics.adherenceRate || 0;
        const consecutiveMisses = userMetrics.consecutiveMissedDays || 0;
        const sentiment = userMetrics.sentimentScore || 0.5;
        
        // Check reduce load triggers
        for (const trigger of this.adaptiveSuggestions.reduceLoad.triggers) {
            if (this._evaluateTrigger(trigger, userMetrics)) {
                return {
                    type: 'reduce_load',
                    ...trigger,
                    priority: 'high'
                };
            }
        }
        
        // Check increase challenge triggers
        for (const trigger of this.adaptiveSuggestions.increaseChallenge.triggers) {
            if (this._evaluateTrigger(trigger, userMetrics)) {
                return {
                    type: 'increase_challenge',
                    ...trigger,
                    priority: 'medium'
                };
            }
        }
        
        // Default to maintain
        return {
            type: 'maintain',
            ...this.adaptiveSuggestions.maintain,
            priority: 'low'
        };
    }

    /**
     * Evaluate trigger condition
     * @private
     */
    _evaluateTrigger(trigger, metrics) {
        const condition = trigger.condition;
        
        // Parse and evaluate condition
        if (condition.includes('<')) {
            const [field, value] = condition.split('<').map(s => s.trim());
            return metrics[field] < parseFloat(value);
        } else if (condition.includes('>')) {
            const [field, value] = condition.split('>').map(s => s.trim());
            return metrics[field] > parseFloat(value);
        } else if (condition.includes('==')) {
            const [field, value] = condition.split('==').map(s => s.trim());
            return metrics[field] == value; // eslint-disable-line
        } else if (condition.includes('-')) {
            const [min, max] = condition.split('-').map(s => parseFloat(s.trim()));
            const field = condition.split(' ')[0];
            return metrics[field] >= min && metrics[field] <= max;
        }
        
        return false;
    }

    /**
     * Check if intervention should trigger
     * @private
     */
    _shouldTriggerIntervention(intervention, userState) {
        const trigger = intervention.trigger;
        
        // Handle time-based triggers
        if (trigger.includes('evening')) {
            const hour = new Date().getHours();
            return hour >= 18;
        }
        
        // Handle event-based triggers
        if (trigger === 'habit_completed') {
            return userState.lastHabitCompleted === 'today';
        }
        
        if (trigger === 'habit_viewed_but_not_started') {
            return userState.habitViewed && !userState.habitStarted;
        }
        
        if (trigger === 'no_completion_by_noon') {
            const hour = new Date().getHours();
            return hour >= 12 && !userState.habitCompleted;
        }
        
        if (trigger === 'habit_started_but_abandoned') {
            return userState.habitStarted && !userState.habitCompleted;
        }
        
        if (trigger.includes('day') && trigger.includes('completion')) {
            const day = parseInt(trigger.replace('day', '').split('_')[0]);
            return userState.currentDay === day && userState.habitCompleted;
        }
        
        return false;
    }

    /**
     * Record intervention
     * @param {Object} intervention - Intervention record
     */
    recordIntervention(intervention) {
        this.interventionHistory.push({
            ...intervention,
            recordedAt: new Date().toISOString()
        });
        
        eventBus.emit(AppEvents.INTERVENTION_RECORDED, intervention);
    }

    /**
     * Get intervention history
     * @returns {Array} Intervention history
     */
    getInterventionHistory() {
        return this.interventionHistory;
    }

    /**
     * Get intervention effectiveness
     * @param {string} interventionType - Type of intervention
     * @returns {Object} Effectiveness metrics
     */
    getInterventionEffectiveness(interventionType) {
        const interventions = this.interventionHistory.filter(
            i => i.type === interventionType
        );
        
        if (interventions.length === 0) {
            return { count: 0, successRate: 0 };
        }
        
        const successful = interventions.filter(i => i.success).length;
        
        return {
            count: interventions.length,
            successful,
            successRate: Math.round((successful / interventions.length) * 100) / 100
        };
    }
}

export { InterventionEngine };
