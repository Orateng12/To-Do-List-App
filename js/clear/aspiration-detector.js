/**
 * Aspirational Identity Detector - Clear Life OS
 * ================================================
 * Detects when users select habits/identities disconnected
 * from their actual capabilities and readiness.
 * 
 * Features:
 * - Aspiration-capability gap analysis
 * - Reality check interventions
 * - Tiny habit downgrade suggestions
 * - Burnout prevention
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class AspirationalIdentityDetector {
    constructor() {
        // Risk patterns for aspirational identity detection
        this.riskPatterns = {
            duration: {
                name: 'Duration Jump',
                check: (current, selected) => {
                    const currentMin = current.habitDuration || 5;
                    const selectedMin = selected.habitDuration || 10;
                    const ratio = selectedMin / currentMin;
                    return {
                        flagged: ratio > 3, // 3x increase is risky
                        ratio,
                        message: `This represents a ${Math.round(ratio)}x increase in time commitment`
                    };
                }
            },
            complexity: {
                name: 'Complexity Overload',
                check: (current, selected) => {
                    const currentHabits = current.keystoneHabitsCount || 0;
                    const selectedHabits = selected.keystoneHabitsCount || 2;
                    const increase = selectedHabits - currentHabits;
                    return {
                        flagged: increase > 2, // Adding more than 2 habits is risky
                        increase,
                        message: `Adding ${increase} new habits at once`
                    };
                }
            },
            routine: {
                name: 'No Foundation',
                check: (current, selected) => {
                    const hasRoutine = current.hasExistingRoutine || false;
                    const ambitiousSelected = selected.earlyMorning || selected.multiplePerDay;
                    return {
                        flagged: !hasRoutine && ambitiousSelected,
                        message: 'Selecting advanced routines without existing habit foundation'
                    };
                }
            },
            language: {
                name: 'Absolute Language',
                check: (current, selected) => {
                    const identityDescription = selected.identityDescription || '';
                    const absoluteWords = ['always', 'never', 'every', 'all', 'no excuses'];
                    const foundWords = absoluteWords.filter(word => 
                        identityDescription.toLowerCase().includes(word)
                    );
                    return {
                        flagged: foundWords.length > 0,
                        words: foundWords,
                        message: 'Using absolute language that sets unrealistic expectations'
                    };
                }
            },
            timeline: {
                name: 'Unrealistic Timeline',
                check: (current, selected) => {
                    const expectedTransformation = selected.expectedTransformationDays || 30;
                    const habitComplexity = selected.habitComplexity || 'medium';
                    
                    const realisticTimelines = {
                        low: 14,
                        medium: 30,
                        high: 60
                    };
                    
                    return {
                        flagged: expectedTransformationDays < (realisticTimelines[habitComplexity] / 2),
                        message: `Expecting transformation in ${expectedTransformationDays} days for ${habitComplexity} complexity habits`
                    };
                }
            }
        };
        
        // Intervention strategies
        this.interventions = {
            duration: {
                type: 'reality_check_modal',
                title: 'Let\'s Start Smaller',
                message: 'Research shows that starting with habits 1/3 of your target size leads to 3x better long-term adherence.',
                alternative: 'suggested_tiny_habit',
                action: 'downgrade_duration'
            },
            complexity: {
                type: 'gradual_build_modal',
                title: 'Build Gradually',
                message: 'Adding habits one at a time over 2-week intervals has 73% higher success rate.',
                alternative: 'staged_habit_addition',
                action: 'stage_habits'
            },
            routine: {
                type: 'foundation_first_modal',
                title: 'Foundation First',
                message: 'Let\'s establish one keystone habit for 14 days before adding more complexity.',
                alternative: 'single_habit_focus',
                action: 'reduce_to_one'
            },
            language: {
                type: 'mindset_reframe_modal',
                title: 'Flexible Mindset',
                message: 'Flexible commitments ("I usually...") lead to better long-term success than rigid rules ("I always...").',
                alternative: 'reframed_identity',
                action: 'reframe_language'
            },
            timeline: {
                type: 'timeline_adjustment_modal',
                title: 'Sustainable Timeline',
                message: 'Meaningful habit change takes 66 days on average. Let\'s set realistic expectations.',
                alternative: 'extended_timeline',
                action: 'extend_timeline'
            }
        };
    }

    /**
     * Analyze habit selection for aspirational risk
     * @param {Object} currentProfile - User's current habits/capabilities
     * @param {Object} selectedProfile - User's selected habits/goals
     * @returns {Object} Risk analysis
     */
    analyzeRisk(currentProfile, selectedProfile) {
        const risks = [];
        let overallRiskLevel = 'low';
        
        for (const [patternKey, pattern] of Object.entries(this.riskPatterns)) {
            const result = pattern.check(currentProfile, selectedProfile);
            
            if (result.flagged) {
                risks.push({
                    pattern: patternKey,
                    name: pattern.name,
                    ...result,
                    intervention: this.interventions[patternKey]
                });
            }
        }
        
        // Calculate overall risk level
        if (risks.length >= 3) {
            overallRiskLevel = 'critical';
        } else if (risks.length >= 2) {
            overallRiskLevel = 'high';
        } else if (risks.length >= 1) {
            overallRiskLevel = 'medium';
        }
        
        const result = {
            overallRiskLevel,
            risks,
            riskCount: risks.length,
            safeToProceed: overallRiskLevel !== 'critical',
            recommendedAction: this._getRecommendedAction(risks)
        };
        
        eventBus.emit(AppEvents.ASPIRATION_ANALYZED, result);
        
        return result;
    }

    /**
     * Get recommended action based on risks
     * @private
     */
    _getRecommendedAction(risks) {
        if (risks.length === 0) {
            return {
                type: 'proceed',
                message: 'Your selections look realistic. Ready to begin?'
            };
        }
        
        // Prioritize interventions
        const priorityOrder = ['duration', 'routine', 'complexity', 'timeline', 'language'];
        const highestPriority = risks.find(r => priorityOrder.includes(r.pattern));
        
        if (highestPriority) {
            return {
                type: 'intervene',
                intervention: highestPriority.intervention,
                message: highestPriority.intervention.message
            };
        }
        
        return {
            type: 'warn',
            message: 'Consider starting smaller for better long-term success.'
        };
    }

    /**
     * Generate tiny habit alternative
     * @param {Object} selectedHabit - User's selected habit
     * @returns {Object} Tiny habit version
     */
    generateTinyHabitAlternative(selectedHabit) {
        const tinyVersions = {
            exercise: {
                original: selectedHabit.duration || 30,
                tiny: 5,
                description: '5 minutes of movement',
                progression: [5, 10, 15, 20, 30]
            },
            meditation: {
                original: selectedHabit.duration || 20,
                tiny: 2,
                description: '2 minutes of breathing',
                progression: [2, 5, 10, 15, 20]
            },
            journaling: {
                original: selectedHabit.duration || 15,
                tiny: 2,
                description: 'Write 1 sentence',
                progression: ['1 sentence', '3 sentences', '1 paragraph', '1 page']
            },
            reading: {
                original: selectedHabit.duration || 30,
                tiny: 5,
                description: 'Read 1 page',
                progression: [5, 10, 20, 30]
            }
        };
        
        const habitType = selectedHabit.type?.toLowerCase() || 'general';
        const tinyVersion = tinyVersions[habitType] || {
            original: selectedHabit.duration || 15,
            tiny: Math.max(2, Math.floor((selectedHabit.duration || 15) / 5)),
            description: 'Minimal version',
            progression: 'gradual'
        };
        
        return {
            original: selectedHabit,
            tiny: {
                ...selectedHabit,
                duration: tinyVersion.tiny,
                description: tinyVersion.description
            },
            progression: tinyVersion.progression,
            rationale: 'Starting small builds consistency. You can always increase duration after 14 days.'
        };
    }

    /**
     * Create staged habit addition plan
     * @param {Array} selectedHabits - Array of selected habits
     * @returns {Object} Staged plan
     */
    createStagedPlan(selectedHabits) {
        if (selectedHabits.length <= 1) {
            return {
                stages: [{ habits: selectedHabits, week: 1 }],
                rationale: 'Single habit - no staging needed'
            };
        }
        
        const stages = [];
        const coreHabits = selectedHabits.slice(0, 2); // Start with 2
        const additionalHabits = selectedHabits.slice(2);
        
        stages.push({
            week: 1,
            habits: coreHabits,
            focus: 'Establish foundation'
        });
        
        additionalHabits.forEach((habit, index) => {
            stages.push({
                week: 3 + (index * 2), // Add one habit every 2 weeks
                habits: [...coreHabits, ...additionalHabits.slice(0, index + 1)],
                focus: `Add ${habit.name || 'new habit'}`
            });
        });
        
        return {
            stages,
            totalWeeks: stages[stages.length - 1].week,
            rationale: 'Adding habits gradually increases long-term adherence by 73%'
        };
    }

    /**
     * Reframe absolute language
     * @param {string} identityStatement - User's identity statement
     * @returns {Object} Reframed statement
     */
    reframeIdentityLanguage(identityStatement) {
        const reframes = [
            { from: /always/gi, to: 'usually' },
            { from: /never/gi, to: 'rarely' },
            { from: /every day/gi, to: 'most days' },
            { from: /all the time/gi, to: 'often' },
            { from: /no excuses/gi, to: 'with commitment' }
        ];
        
        let reframed = identityStatement;
        const changes = [];
        
        reframes.forEach(({ from, to }) => {
            if (from.test(reframed)) {
                reframed = reframed.replace(from, to);
                changes.push({ from: from.source, to });
            }
        });
        
        return {
            original: identityStatement,
            reframed,
            changes,
            rationale: 'Flexible language allows for life\'s inevitable variations'
        };
    }

    /**
     * Calculate realistic timeline
     * @param {Object} habit - Habit details
     * @returns {Object} Timeline estimate
     */
    calculateRealisticTimeline(habit) {
        const complexityFactors = {
            duration: habit.duration > 30 ? 1.5 : 1.0,
            frequency: habit.frequency === 'multiple_daily' ? 1.5 : 1.0,
            difficulty: habit.difficulty === 'high' ? 2.0 : habit.difficulty === 'medium' ? 1.3 : 1.0,
            lifestyle: habit.requiresLifestyleChange ? 1.5 : 1.0
        };
        
        const baseDays = 21; // Minimum habit formation
        const multiplier = Object.values(complexityFactors).reduce((a, b) => a * b, 1);
        const realisticDays = Math.round(baseDays * multiplier);
        
        return {
            userExpected: habit.expectedDays || 30,
            realistic: realisticDays,
            phases: [
                { name: 'Conscious effort', days: '1-14', description: 'Requires deliberate action' },
                { name: 'Building automaticity', days: '15-40', description: 'Getting easier' },
                { name: 'Near automatic', days: '41-66', description: 'Almost effortless' },
                { name: 'Identity integrated', days: '67+', description: 'Part of who you are' }
            ],
            rationale: `Based on ${habit.name || 'this habit'} complexity`
        };
    }
}

export { AspirationalIdentityDetector };
