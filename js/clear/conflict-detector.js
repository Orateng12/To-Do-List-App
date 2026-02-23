/**
 * Keystone Habit Conflict Detector - Clear Life OS
 * =================================================
 * Detects and resolves conflicts between habits
 * within a system.
 * 
 * Features:
 * - Time conflict detection
 * - Energy conflict detection
 * - Identity conflict detection
 * - Automatic resolution suggestions
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class KeystoneConflictDetector {
    constructor() {
        // Conflict detection rules
        this.conflictRules = {
            time: [
                {
                    id: 'early_morning_vs_late_night',
                    habits: ['early_morning', 'late_night'],
                    minGapHours: 8,
                    severity: 'high',
                    resolution: 'suggest_schedule_adjustment'
                },
                {
                    id: 'morning_rush_conflict',
                    habits: ['morning_exercise', 'morning_meditation', 'morning_journal'],
                    maxConcurrent: 2,
                    severity: 'medium',
                    resolution: 'prioritize_one'
                },
                {
                    id: 'work_hours_conflict',
                    habits: ['midday_exercise', 'deep_work_block'],
                    minGapHours: 2,
                    severity: 'medium',
                    resolution: 'time_block_separation'
                }
            ],
            energy: [
                {
                    id: 'high_intensity_conflict',
                    habits: ['high_intensity_workout', 'deep_meditation'],
                    minGapHours: 2,
                    severity: 'high',
                    resolution: 'physiological_spacing',
                    rationale: 'Competing physiological states (sympathetic vs parasympathetic)'
                },
                {
                    id: 'mental_fatigue_conflict',
                    habits: ['deep_work', 'decision_heavy_task', 'creative_work'],
                    maxConcurrent: 2,
                    severity: 'medium',
                    resolution: 'cognitive_load_distribution'
                },
                {
                    id: 'willpower_depletion',
                    habits: ['diet_restriction', 'exercise_requirement', 'productivity_push'],
                    maxConcurrent: 2,
                    severity: 'medium',
                    resolution: 'willpower_budget_management'
                }
            ],
            identity: [
                {
                    id: 'rigid_vs_flexible',
                    habits: ['rigid_schedule', 'spontaneous_creativity'],
                    severity: 'high',
                    resolution: 'identity_reframe',
                    rationale: 'Cognitive dissonance between structure and flexibility'
                },
                {
                    id: 'solo_vs_social',
                    habits: ['solitary_focus', 'social_networking'],
                    minGapHours: 1,
                    severity: 'low',
                    resolution: 'context_switching_buffer'
                },
                {
                    id: 'achievement_vs_acceptance',
                    habits: ['achievement_tracking', 'mindful_acceptance'],
                    severity: 'medium',
                    resolution: 'integration_practice'
                }
            ],
            resource: [
                {
                    id: 'equipment_conflict',
                    habits: ['home_gym', 'home_office'],
                    resource: 'space',
                    severity: 'low',
                    resolution: 'space_scheduling'
                },
                {
                    id: 'time_budget_exceeded',
                    maxDailyMinutes: 120,
                    severity: 'high',
                    resolution: 'priority_reduction'
                }
            ]
        };
        
        // Habit metadata for conflict detection
        this.habitMetadata = {
            early_morning: { timeWindow: [5, 8], energy: 'medium', type: 'activation' },
            late_night: { timeWindow: [22, 24], energy: 'low', type: 'deactivation' },
            morning_exercise: { timeWindow: [6, 9], energy: 'high', type: 'activation' },
            morning_meditation: { timeWindow: [6, 9], energy: 'low', type: 'centering' },
            morning_journal: { timeWindow: [6, 9], energy: 'low', type: 'reflection' },
            midday_exercise: { timeWindow: [11, 14], energy: 'high', type: 'activation' },
            deep_work_block: { timeWindow: [9, 17], energy: 'high', type: 'cognitive' },
            high_intensity_workout: { energy: 'very_high', type: 'physical_stress' },
            deep_meditation: { energy: 'very_low', type: 'parasympathetic' },
            deep_work: { energy: 'high', type: 'cognitive' },
            decision_heavy_task: { energy: 'high', type: 'cognitive' },
            creative_work: { energy: 'medium', type: 'cognitive' },
            diet_restriction: { willpower: 'high', type: 'restriction' },
            exercise_requirement: { willpower: 'medium', type: 'requirement' },
            productivity_push: { willpower: 'high', type: 'requirement' },
            rigid_schedule: { flexibility: 'none', type: 'structure' },
            spontaneous_creativity: { flexibility: 'maximum', type: 'flow' },
            solitary_focus: { social: 'none', type: 'introvert' },
            social_networking: { social: 'high', type: 'extrovert' },
            achievement_tracking: { mindset: 'striving', type: 'growth' },
            mindful_acceptance: { mindset: 'accepting', type: 'contentment' },
            home_gym: { space: 'dedicated', type: 'physical' },
            home_office: { space: 'dedicated', type: 'cognitive' }
        };
    }

    /**
     * Detect conflicts in habit set
     * @param {Array} habits - Array of habit objects
     * @returns {Object} Conflict detection result
     */
    detectConflicts(habits) {
        const conflicts = [];
        
        // Check time conflicts
        const timeConflicts = this._checkTimeConflicts(habits);
        conflicts.push(...timeConflicts);
        
        // Check energy conflicts
        const energyConflicts = this._checkEnergyConflicts(habits);
        conflicts.push(...energyConflicts);
        
        // Check identity conflicts
        const identityConflicts = this._checkIdentityConflicts(habits);
        conflicts.push(...identityConflicts);
        
        // Check resource conflicts
        const resourceConflicts = this._checkResourceConflicts(habits);
        conflicts.push(...resourceConflicts);
        
        // Calculate overall severity
        const severityScore = this._calculateSeverityScore(conflicts);
        
        const result = {
            hasConflicts: conflicts.length > 0,
            conflictCount: conflicts.length,
            conflicts,
            severity: this._getSeverityLevel(severityScore),
            severityScore,
            canProceed: severityScore < 0.7,
            recommendations: this._generateRecommendations(conflicts)
        };
        
        eventBus.emit(AppEvents.CONFLICTS_DETECTED, result);
        
        return result;
    }

    /**
     * Check time-based conflicts
     * @private
     */
    _checkTimeConflicts(habits) {
        const conflicts = [];
        
        // Get habits with time windows
        const timedHabits = habits.filter(h => {
            const meta = this.habitMetadata[h.id] || h.metadata;
            return meta?.timeWindow;
        });
        
        // Check for overlaps
        for (let i = 0; i < timedHabits.length; i++) {
            for (let j = i + 1; j < timedHabits.length; j++) {
                const habitA = timedHabits[i];
                const habitB = timedHabits[j];
                const metaA = this.habitMetadata[habitA.id] || habitA.metadata;
                const metaB = this.habitMetadata[habitB.id] || habitB.metadata;
                
                const [startA, endA] = metaA.timeWindow;
                const [startB, endB] = metaB.timeWindow;
                
                // Check for overlap
                if (startA < endB && startB < endA) {
                    conflicts.push({
                        type: 'time',
                        subtype: 'window_overlap',
                        habits: [habitA.id, habitB.id],
                        severity: 'medium',
                        details: `Both habits scheduled for overlapping time windows`,
                        resolution: this._suggestTimeResolution(habitA, habitB, metaA, metaB)
                    });
                }
            }
        }
        
        return conflicts;
    }

    /**
     * Check energy-based conflicts
     * @private
     */
    _checkEnergyConflicts(habits) {
        const conflicts = [];
        
        // Get habits with energy requirements
        const energyHabits = habits.filter(h => {
            const meta = this.habitMetadata[h.id] || h.metadata;
            return meta?.energy;
        });
        
        // Check for opposing energy states
        for (let i = 0; i < energyHabits.length; i++) {
            for (let j = i + 1; j < energyHabits.length; j++) {
                const habitA = energyHabits[i];
                const habitB = energyHabits[j];
                const metaA = this.habitMetadata[habitA.id] || habitA.metadata;
                const metaB = this.habitMetadata[habitB.id] || habitB.metadata;
                
                const energyOpposites = [
                    ['very_high', 'very_low'],
                    ['high', 'very_low'],
                    ['very_high', 'low']
                ];
                
                const isOpposite = energyOpposites.some(([e1, e2]) =>
                    (metaA.energy === e1 && metaB.energy === e2) ||
                    (metaA.energy === e2 && metaB.energy === e1)
                );
                
                if (isOpposite) {
                    conflicts.push({
                        type: 'energy',
                        subtype: 'opposing_states',
                        habits: [habitA.id, habitB.id],
                        severity: 'high',
                        details: `${metaA.energy} energy habit conflicts with ${metaB.energy} energy habit`,
                        resolution: {
                            type: 'spacing',
                            suggestion: `Schedule at least 2 hours between these habits`,
                            rationale: 'Allows physiological state transition'
                        }
                    });
                }
            }
        }
        
        // Check for cognitive load overload
        const cognitiveHabits = energyHabits.filter(h => {
            const meta = this.habitMetadata[h.id] || h.metadata;
            return meta?.type === 'cognitive';
        });
        
        if (cognitiveHabits.length > 2) {
            conflicts.push({
                type: 'energy',
                subtype: 'cognitive_overload',
                habits: cognitiveHabits.map(h => h.id),
                severity: 'medium',
                details: `${cognitiveHabits.length} cognitively demanding habits may cause mental fatigue`,
                resolution: {
                    type: 'distribution',
                    suggestion: 'Spread cognitive habits across different days or times',
                    rationale: 'Preserves mental energy for quality work'
                }
            });
        }
        
        return conflicts;
    }

    /**
     * Check identity-based conflicts
     * @private
     */
    _checkIdentityConflicts(habits) {
        const conflicts = [];
        
        // Get habits with identity implications
        const identityHabits = habits.filter(h => {
            const meta = this.habitMetadata[h.id] || h.metadata;
            return meta?.flexibility !== undefined || meta?.mindset !== undefined;
        });
        
        for (let i = 0; i < identityHabits.length; i++) {
            for (let j = i + 1; j < identityHabits.length; j++) {
                const habitA = identityHabits[i];
                const habitB = identityHabits[j];
                const metaA = this.habitMetadata[habitA.id] || habitA.metadata;
                const metaB = this.habitMetadata[habitB.id] || habitB.metadata;
                
                // Check flexibility conflict
                if (metaA.flexibility === 'none' && metaB.flexibility === 'maximum') {
                    conflicts.push({
                        type: 'identity',
                        subtype: 'flexibility_mismatch',
                        habits: [habitA.id, habitB.id],
                        severity: 'high',
                        details: 'Rigid structure conflicts with spontaneous flexibility',
                        resolution: {
                            type: 'reframe',
                            suggestion: 'Create "structured flexibility" - flexible within defined boundaries',
                            rationale: 'Reduces cognitive dissonance'
                        }
                    });
                }
                
                // Check mindset conflict
                if (metaA.mindset && metaB.mindset) {
                    const mindsetConflicts = [
                        ['striving', 'accepting'],
                        ['growth', 'contentment']
                    ];
                    
                    const isConflicting = mindsetConflicts.some(([m1, m2]) =>
                        (metaA.mindset === m1 && metaB.mindset === m2) ||
                        (metaA.mindset === m2 && metaB.mindset === m1)
                    );
                    
                    if (isConflicting) {
                        conflicts.push({
                            type: 'identity',
                            subtype: 'mindset_conflict',
                            habits: [habitA.id, habitB.id],
                            severity: 'medium',
                            details: `${metaA.mindset} mindset conflicts with ${metaB.mindset} mindset`,
                            resolution: {
                                type: 'integration',
                                suggestion: 'Practice "accepting while growing" - accept present while working toward future',
                                rationale: 'Integrates both mindsets harmoniously'
                            }
                        });
                    }
                }
            }
        }
        
        return conflicts;
    }

    /**
     * Check resource-based conflicts
     * @private
     */
    _checkResourceConflicts(habits) {
        const conflicts = [];
        
        // Check space conflicts
        const spaceHabits = habits.filter(h => {
            const meta = this.habitMetadata[h.id] || h.metadata;
            return meta?.space === 'dedicated';
        });
        
        if (spaceHabits.length > 1) {
            const spaces = spaceHabits.map(h => ({
                id: h.id,
                space: (this.habitMetadata[h.id] || h.metadata).space
            }));
            
            // Group by space type
            const spaceGroups = {};
            spaces.forEach(s => {
                if (!spaceGroups[s.space]) spaceGroups[s.space] = [];
                spaceGroups[s.space].push(s.id);
            });
            
            for (const [space, habitIds] of Object.entries(spaceGroups)) {
                if (habitIds.length > 1) {
                    conflicts.push({
                        type: 'resource',
                        subtype: 'space_conflict',
                        habits: habitIds,
                        severity: 'low',
                        details: `Multiple habits require ${space} space`,
                        resolution: {
                            type: 'scheduling',
                            suggestion: 'Create schedule for space usage',
                            rationale: 'Prevents resource contention'
                        }
                    });
                }
            }
        }
        
        // Check total time budget
        const totalMinutes = habits.reduce((sum, h) => sum + (h.duration || 0), 0);
        if (totalMinutes > 120) {
            conflicts.push({
                type: 'resource',
                subtype: 'time_budget_exceeded',
                habits: habits.map(h => h.id),
                severity: 'high',
                details: `Total daily habit time (${totalMinutes} min) exceeds recommended budget (120 min)`,
                resolution: {
                    type: 'prioritization',
                    suggestion: 'Reduce to 2-3 keystone habits totaling < 60 minutes',
                    rationale: 'Sustainable habit load'
                }
            });
        }
        
        return conflicts;
    }

    /**
     * Suggest time-based resolution
     * @private
     */
    _suggestTimeResolution(habitA, habitB, metaA, metaB) {
        const [startA, endA] = metaA.timeWindow;
        const [startB, endB] = metaB.timeWindow;
        
        // Find non-overlapping alternative
        const alternatives = [];
        
        if (endA < 12) { // Morning habit
            alternatives.push({
                habit: habitB.id,
                newWindow: [endA + 1, endA + 3],
                rationale: 'Schedule after first habit completes'
            });
        }
        
        return {
            type: 'reschedule',
            alternatives,
            suggestion: 'Adjust timing to prevent overlap'
        };
    }

    /**
     * Calculate overall severity score
     * @private
     */
    _calculateSeverityScore(conflicts) {
        if (conflicts.length === 0) return 0;
        
        const severityWeights = {
            high: 0.4,
            medium: 0.25,
            low: 0.1
        };
        
        const totalScore = conflicts.reduce((sum, c) => {
            return sum + (severityWeights[c.severity] || 0.2);
        }, 0);
        
        return Math.min(1.0, totalScore);
    }

    /**
     * Get severity level from score
     * @private
     */
    _getSeverityLevel(score) {
        if (score >= 0.7) return 'critical';
        if (score >= 0.4) return 'high';
        if (score >= 0.2) return 'medium';
        return 'low';
    }

    /**
     * Generate recommendations
     * @private
     */
    _generateRecommendations(conflicts) {
        const recommendations = [];
        
        // Group by type
        const byType = {};
        conflicts.forEach(c => {
            if (!byType[c.type]) byType[c.type] = [];
            byType[c.type].push(c);
        });
        
        // Generate type-specific recommendations
        if (byType.time) {
            recommendations.push({
                category: 'Timing',
                priority: 'high',
                action: 'Review and adjust habit scheduling',
                details: 'Space conflicting habits appropriately'
            });
        }
        
        if (byType.energy) {
            recommendations.push({
                category: 'Energy Management',
                priority: 'high',
                action: 'Balance high and low energy activities',
                details: 'Allow recovery time between opposing states'
            });
        }
        
        if (byType.identity) {
            recommendations.push({
                category: 'Identity Integration',
                priority: 'medium',
                action: 'Reframe conflicting identities',
                details: 'Find harmonious integration of values'
            });
        }
        
        if (byType.resource) {
            recommendations.push({
                category: 'Resource Allocation',
                priority: 'medium',
                action: 'Optimize resource usage',
                details: 'Schedule shared resources to prevent conflicts'
            });
        }
        
        return recommendations;
    }
}

export { KeystoneConflictDetector };
