/**
 * Atomic System Templates - Clear Life OS
 * ========================================
 * Decomposes habit systems into atomic, independently
 * functioning components with flexible completion rules.
 * 
 * Features:
 * - Atomic habit decomposition
 * - Keystone + optional add-on structure
 * - Minimum viable completion rules
 * - Flexible difficulty scaling
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class AtomicSystemTemplates {
    constructor() {
        // Atomic system templates
        this.templates = {
            morning: {
                id: 'morning_system',
                name: 'Morning System',
                description: 'Start your day with intention',
                archetype: ['clear', 'confused', 'lost'],
                keystone: {
                    id: 'morning_keystone',
                    name: 'Mindful Start',
                    minimumDuration: 2,
                    recommendedDuration: 5,
                    description: 'Begin with 2 minutes of conscious breathing or gratitude',
                    alternatives: [
                        '2 minutes of deep breathing',
                        'Write 1 thing you\'re grateful for',
                        'Set 1 intention for the day'
                    ]
                },
                addOns: [
                    {
                        id: 'morning_movement',
                        name: 'Movement',
                        levels: [
                            { duration: 5, description: '5 min stretch' },
                            { duration: 10, description: '10 min walk' },
                            { duration: 20, description: '20 min workout' }
                        ]
                    },
                    {
                        id: 'morning_journal',
                        name: 'Journaling',
                        levels: [
                            { duration: 2, description: '2 min brain dump' },
                            { duration: 5, description: '5 min reflection' },
                            { duration: 10, description: '10 min deep writing' }
                        ]
                    },
                    {
                        id: 'morning_read',
                        name: 'Reading',
                        levels: [
                            { duration: 5, description: '5 pages' },
                            { duration: 10, description: '10 pages' },
                            { duration: 20, description: '20 pages' }
                        ]
                    }
                ],
                completionRules: {
                    minimum: {
                        description: 'Keystone habit only',
                        requirement: 'keystone_complete',
                        counts_as: 'success'
                    },
                    standard: {
                        description: 'Keystone + 1 add-on',
                        requirement: 'keystone_complete + 1_addon',
                        counts_as: 'full_success'
                    },
                    bonus: {
                        description: 'All components',
                        requirement: 'keystone_complete + all_addons',
                        counts_as: 'bonus'
                    }
                }
            },
            evening: {
                id: 'evening_system',
                name: 'Evening System',
                description: 'End your day with reflection',
                archetype: ['clear', 'confused', 'lost'],
                keystone: {
                    id: 'evening_keystone',
                    name: 'Day Close',
                    minimumDuration: 2,
                    recommendedDuration: 5,
                    description: 'Review your day and prepare for tomorrow',
                    alternatives: [
                        '2 min day review',
                        'Write 1 win from today',
                        'Prepare 1 thing for tomorrow'
                    ]
                },
                addOns: [
                    {
                        id: 'evening_wind_down',
                        name: 'Wind Down',
                        levels: [
                            { duration: 10, description: '10 min no screens' },
                            { duration: 30, description: '30 min digital detox' },
                            { duration: 60, description: '60 min sleep routine' }
                        ]
                    },
                    {
                        id: 'evening_gratitude',
                        name: 'Gratitude',
                        levels: [
                            { duration: 1, description: '1 thing' },
                            { duration: 3, description: '3 things' },
                            { duration: 5, description: 'Detailed reflection' }
                        ]
                    }
                ],
                completionRules: {
                    minimum: {
                        description: 'Keystone habit only',
                        requirement: 'keystone_complete',
                        counts_as: 'success'
                    },
                    standard: {
                        description: 'Keystone + 1 add-on',
                        requirement: 'keystone_complete + 1_addon',
                        counts_as: 'full_success'
                    },
                    bonus: {
                        description: 'All components',
                        requirement: 'keystone_complete + all_addons',
                        counts_as: 'bonus'
                    }
                }
            },
            work: {
                id: 'work_system',
                name: 'Deep Work System',
                description: 'Focused work sessions',
                archetype: ['clear', 'confused'],
                keystone: {
                    id: 'work_keystone',
                    name: 'Focus Block',
                    minimumDuration: 25,
                    recommendedDuration: 50,
                    description: 'One uninterrupted work session',
                    alternatives: [
                        '25 min Pomodoro',
                        '50 min deep work',
                        '90 min power session'
                    ]
                },
                addOns: [
                    {
                        id: 'work_planning',
                        name: 'Planning',
                        levels: [
                            { duration: 5, description: '5 min task review' },
                            { duration: 10, description: '10 min priority setting' },
                            { duration: 15, description: '15 min day planning' }
                        ]
                    },
                    {
                        id: 'work_break',
                        name: 'Intentional Break',
                        levels: [
                            { duration: 5, description: '5 min walk' },
                            { duration: 10, description: '10 min stretch' },
                            { duration: 15, description: '15 min rest' }
                        ]
                    }
                ],
                completionRules: {
                    minimum: {
                        description: 'One focus block',
                        requirement: 'keystone_complete',
                        counts_as: 'success'
                    },
                    standard: {
                        description: 'Focus block + planning + break',
                        requirement: 'keystone_complete + 2_addons',
                        counts_as: 'full_success'
                    },
                    bonus: {
                        description: 'Multiple focus blocks',
                        requirement: 'keystone_complete_2x',
                        counts_as: 'bonus'
                    }
                }
            },
            health: {
                id: 'health_system',
                name: 'Health System',
                description: 'Physical wellbeing foundation',
                archetype: ['clear', 'confused', 'lost'],
                keystone: {
                    id: 'health_keystone',
                    name: 'Daily Movement',
                    minimumDuration: 5,
                    recommendedDuration: 20,
                    description: 'Any form of physical activity',
                    alternatives: [
                        '5 min walk',
                        '10 min stretch',
                        '20 min workout'
                    ]
                },
                addOns: [
                    {
                        id: 'health_nutrition',
                        name: 'Mindful Eating',
                        levels: [
                            { duration: 0, description: '1 healthy meal' },
                            { duration: 0, description: '2 healthy meals' },
                            { duration: 0, description: 'All meals mindful' }
                        ]
                    },
                    {
                        id: 'health_water',
                        name: 'Hydration',
                        levels: [
                            { duration: 0, description: '4 glasses' },
                            { duration: 0, description: '6 glasses' },
                            { duration: 0, description: '8 glasses' }
                        ]
                    }
                ],
                completionRules: {
                    minimum: {
                        description: 'Any movement',
                        requirement: 'keystone_complete',
                        counts_as: 'success'
                    },
                    standard: {
                        description: 'Movement + nutrition OR hydration',
                        requirement: 'keystone_complete + 1_addon',
                        counts_as: 'full_success'
                    },
                    bonus: {
                        description: 'All components',
                        requirement: 'keystone_complete + all_addons',
                        counts_as: 'bonus'
                    }
                }
            }
        };
    }

    /**
     * Get system template by ID
     * @param {string} templateId - Template ID
     * @returns {Object} System template
     */
    getTemplate(templateId) {
        return this.templates[templateId] || null;
    }

    /**
     * Get templates available for archetype
     * @param {string} archetype - User archetype
     * @returns {Array} Available templates
     */
    getTemplatesForArchetype(archetype) {
        return Object.values(this.templates).filter(
            template => template.archetype.includes(archetype)
        );
    }

    /**
     * Decompose system into atomic components
     * @param {string} templateId - Template ID
     * @returns {Object} Atomic decomposition
     */
    decomposeToAtomic(templateId) {
        const template = this.templates[templateId];
        if (!template) return null;
        
        return {
            systemId: template.id,
            systemName: template.name,
            components: {
                keystone: {
                    ...template.keystone,
                    required: true,
                    type: 'keystone'
                },
                addOns: template.addOns.map(addon => ({
                    ...addon,
                    required: false,
                    type: 'optional',
                    selectable: true
                }))
            },
            completionRules: template.completionRules
        };
    }

    /**
     * Create customized system from template
     * @param {string} templateId - Template ID
     * @param {Object} customization - User customizations
     * @returns {Object} Customized system
     */
    createCustomizedSystem(templateId, customization = {}) {
        const atomic = this.decomposeToAtomic(templateId);
        if (!atomic) return null;
        
        // Apply customizations
        if (customization.keystone) {
            atomic.components.keystone = {
                ...atomic.components.keystone,
                ...customization.keystone
            };
        }
        
        if (customization.addOns) {
            // Filter to selected add-ons only
            atomic.components.addOns = atomic.components.addOns.filter(addon =>
                customization.addOns.includes(addon.id)
            );
        }
        
        if (customization.completionRules) {
            atomic.completionRules = {
                ...atomic.completionRules,
                ...customization.completionRules
            };
        }
        
        return atomic;
    }

    /**
     * Check if system completion meets minimum requirements
     * @param {Object} system - System instance
     * @param {Object} completions - What was completed
     * @returns {Object} Completion status
     */
    checkCompletion(system, completions) {
        const { keystone, addOns } = system.components;
        const { rules } = system;
        
        const keystoneComplete = completions.keystone === true;
        const addOnsComplete = completions.addOns?.filter(a => a.complete).length || 0;
        
        // Check minimum completion
        const minimumMet = keystoneComplete;
        
        // Check standard completion
        const standardMet = keystoneComplete && addOnsComplete >= 1;
        
        // Check bonus completion
        const bonusMet = keystoneComplete && addOnsComplete === addOns.length;
        
        let status = 'incomplete';
        let level = 'none';
        
        if (bonusMet) {
            status = 'complete';
            level = 'bonus';
        } else if (standardMet) {
            status = 'complete';
            level = 'standard';
        } else if (minimumMet) {
            status = 'complete';
            level = 'minimum';
        }
        
        return {
            status,
            level,
            keystoneComplete,
            addOnsComplete,
            totalAddOns: addOns.length,
            completionRate: keystoneComplete ? 
                ((addOnsComplete / addOns.length) + 1) / 2 : // 50% base + add-on ratio
                0
        };
    }

    /**
     * Scale system difficulty
     * @param {Object} system - Current system
     * @param {string} direction - 'up' or 'down'
     * @returns {Object} Scaled system
     */
    scaleDifficulty(system, direction) {
        const scaled = JSON.parse(JSON.stringify(system));
        
        if (direction === 'down') {
            // Reduce to minimum viable
            scaled.components.addOns = scaled.components.addOns.slice(0, 1);
            
            // Reduce keystone duration
            if (scaled.components.keystone.recommendedDuration) {
                scaled.components.keystone.recommendedDuration = 
                    Math.max(2, scaled.components.keystone.recommendedDuration / 2);
            }
        } else if (direction === 'up') {
            // Add more add-ons if available
            const template = this.templates[system.systemId];
            if (template && template.addOns.length > scaled.components.addOns.length) {
                const currentIds = scaled.components.addOns.map(a => a.id);
                const nextAddOn = template.addOns.find(a => !currentIds.includes(a.id));
                if (nextAddOn) {
                    scaled.components.addOns.push({
                        ...nextAddOn,
                        required: false,
                        type: 'optional'
                    });
                }
            }
            
            // Increase keystone duration
            if (scaled.components.keystone.recommendedDuration) {
                scaled.components.keystone.recommendedDuration = 
                    Math.min(60, scaled.components.keystone.recommendedDuration * 1.5);
            }
        }
        
        return scaled;
    }

    /**
     * Get system statistics
     * @param {Object} system - System instance
     * @param {Array} completionHistory - Array of completion records
     * @returns {Object} System statistics
     */
    getSystemStats(system, completionHistory) {
        const total = completionHistory.length;
        const completions = completionHistory.filter(c => c.status === 'complete');
        const minimumCompletions = completions.filter(c => c.level === 'minimum');
        const standardCompletions = completions.filter(c => c.level === 'standard');
        const bonusCompletions = completions.filter(c => c.level === 'bonus');
        
        return {
            totalDays: total,
            completionRate: total > 0 ? completions.length / total : 0,
            minimumRate: total > 0 ? minimumCompletions.length / total : 0,
            standardRate: total > 0 ? standardCompletions.length / total : 0,
            bonusRate: total > 0 ? bonusCompletions.length / total : 0,
            averageAddOns: completions.length > 0 ?
                completions.reduce((sum, c) => sum + c.addOnsComplete, 0) / completions.length :
                0,
            streak: this._calculateStreak(completionHistory)
        };
    }

    /**
     * Calculate current streak
     * @private
     */
    _calculateStreak(completionHistory) {
        if (completionHistory.length === 0) return 0;
        
        const sorted = [...completionHistory].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        let streak = 0;
        const now = new Date();
        
        for (const record of sorted) {
            const recordDate = new Date(record.date);
            const daysDiff = (now - recordDate) / (1000 * 60 * 60 * 24);
            
            if (daysDiff <= 1.5) { // Allow some time zone flexibility
                streak++;
                now.setDate(now.getDate() - 1);
            } else {
                break;
            }
        }
        
        return streak;
    }
}

export { AtomicSystemTemplates };
