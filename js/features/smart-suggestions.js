/**
 * AI-Powered Smart Suggestions Engine
 * =====================================
 * Machine learning-inspired recommendation system
 * 
 * Features:
 * - Pattern recognition from user behavior
 * - Smart task prioritization
 * - Optimal scheduling recommendations
 * - Context-aware suggestions
 * - Learning from user actions
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class SmartSuggestionsEngine {
    constructor(taskRepository, analyticsEngine) {
        this.taskRepository = taskRepository;
        this.analyticsEngine = analyticsEngine;
        
        // User behavior patterns
        this.userPatterns = {
            productiveHours: new Array(24).fill(0),
            productiveDays: new Array(7).fill(0),
            taskCompletionHistory: [],
            priorityPreferences: { high: 0, medium: 0, low: 0 },
            averageTasksPerDay: 0,
            preferredTaskLength: 0
        };
        
        // Weights for suggestion scoring
        this.weights = {
            urgency: 0.3,
            importance: 0.25,
            energy: 0.2,
            momentum: 0.15,
            deadline: 0.1
        };
        
        // Initialize
        this._loadUserPatterns();
    }

    /**
     * Get smart suggestions for current context
     * @returns {Promise<Object>} Suggestions object
     */
    async getSuggestions() {
        const tasks = await this.taskRepository.getAll();
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        
        return {
            nextAction: await this._suggestNextAction(tasks, now),
            prioritizedList: await this._generatePrioritizedList(tasks, now),
            timeBlocking: await this._suggestTimeBlocking(tasks, now),
            energyMatching: this._matchTasksToEnergy(tasks, currentHour),
            quickWins: this._findQuickWins(tasks),
            focusTasks: this._findFocusTasks(tasks, now),
            avoidProcrastination: this._identifyProcrastination(tasks),
            learningInsights: this._generateLearningInsights()
        };
    }

    /**
     * Suggest the single next best action
     * @private
     */
    async _suggestNextAction(tasks, now) {
        const activeTasks = tasks.filter(t => !t.completed);
        
        if (activeTasks.length === 0) {
            return {
                available: false,
                message: 'All tasks completed! 🎉',
                task: null
            };
        }
        
        // Score each task
        const scored = activeTasks.map(task => ({
            task,
            score: this._calculateTaskScore(task, now)
        }));
        
        // Sort by score
        scored.sort((a, b) => b.score - a.score);
        
        const best = scored[0];
        
        return {
            available: true,
            task: best.task,
            score: Math.round(best.score * 100),
            reasons: this._explainScore(best.task, best.score, now),
            estimatedTime: this._estimateTaskDuration(best.task)
        };
    }

    /**
     * Calculate task score using multiple factors
     * @private
     */
    _calculateTaskScore(task, now) {
        let score = 0;
        
        // Urgency score (based on due date)
        const urgencyScore = this._calculateUrgencyScore(task, now);
        score += urgencyScore * this.weights.urgency;
        
        // Importance score (based on priority)
        const importanceScore = this._calculateImportanceScore(task);
        score += importanceScore * this.weights.importance;
        
        // Energy matching score
        const energyScore = this._calculateEnergyScore(task, now.getHours());
        score += energyScore * this.weights.energy;
        
        // Momentum score (quick wins)
        const momentumScore = this._calculateMomentumScore(task);
        score += momentumScore * this.weights.momentum;
        
        // Deadline pressure
        const deadlineScore = this._calculateDeadlineScore(task, now);
        score += deadlineScore * this.weights.deadline;
        
        return score;
    }

    /**
     * Calculate urgency based on due date
     * @private
     */
    _calculateUrgencyScore(task, now) {
        if (!task.dueDate) return 0.5;
        
        const dueDate = new Date(task.dueDate);
        const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
        
        if (hoursUntilDue < 0) return 1.0; // Overdue
        if (hoursUntilDue < 2) return 0.95; // Due in 2 hours
        if (hoursUntilDue < 24) return 0.85; // Due today
        if (hoursUntilDue < 48) return 0.7; // Due tomorrow
        if (hoursUntilDue < 168) return 0.5; // Due this week
        return 0.3; // Due later
    }

    /**
     * Calculate importance based on priority
     * @private
     */
    _calculateImportanceScore(task) {
        switch (task.priority) {
            case 'high': return 1.0;
            case 'medium': return 0.6;
            case 'low': return 0.3;
            default: return 0.5;
        }
    }

    /**
     * Calculate energy matching score
     * @private
     */
    _calculateEnergyScore(task, currentHour) {
        const userEnergy = this._getUserEnergyLevel(currentHour);
        const taskEnergy = this._getTaskEnergyRequirement(task);
        
        // Match high energy tasks to high energy hours
        const match = 1 - Math.abs(userEnergy - taskEnergy);
        return match;
    }

    /**
     * Get user energy level at given hour
     * @private
     */
    _getUserEnergyLevel(hour) {
        // Default energy curve (can be learned from user behavior)
        const defaultEnergy = [
            0.3, 0.3, 0.3, 0.3, 0.3, 0.4,  // 0-5 AM
            0.6, 0.8, 0.9, 1.0, 0.95, 0.9,  // 6-11 AM
            0.8, 0.7, 0.75, 0.8, 0.85, 0.8, // 12-5 PM
            0.7, 0.6, 0.5, 0.4, 0.35, 0.3   // 6-11 PM
        ];
        
        return defaultEnergy[hour] || 0.5;
    }

    /**
     * Get task energy requirement
     * @private
     */
    _getTaskEnergyRequirement(task) {
        // High priority = high energy
        if (task.priority === 'high') return 0.9;
        if (task.priority === 'medium') return 0.6;
        return 0.4;
    }

    /**
     * Calculate momentum score (quick wins boost)
     * @private
     */
    _calculateMomentumScore(task) {
        const estimatedDuration = this._estimateTaskDuration(task);
        
        // Quick tasks (< 15 min) get momentum boost
        if (estimatedDuration.value < 15 && estimatedDuration.unit === 'minutes') {
            return 1.0;
        }
        if (estimatedDuration.value < 30 && estimatedDuration.unit === 'minutes') {
            return 0.7;
        }
        return 0.4;
    }

    /**
     * Calculate deadline pressure score
     * @private
     */
    _calculateDeadlineScore(task, now) {
        if (!task.dueDate) return 0.3;
        
        const dueDate = new Date(task.dueDate);
        const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
        
        if (daysUntilDue < 0) return 1.0;
        if (daysUntilDue < 1) return 0.9;
        if (daysUntilDue < 3) return 0.7;
        if (daysUntilDue < 7) return 0.5;
        return 0.3;
    }

    /**
     * Explain why a task was scored highly
     * @private
     */
    _explainScore(task, score, now) {
        const reasons = [];
        
        if (task.priority === 'high') {
            reasons.push('🔴 High priority');
        }
        
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
            
            if (hoursUntilDue < 0) {
                reasons.push('⏰ Overdue');
            } else if (hoursUntilDue < 24) {
                reasons.push('⏰ Due today');
            } else if (hoursUntilDue < 48) {
                reasons.push('⏰ Due tomorrow');
            }
        }
        
        const estimatedDuration = this._estimateTaskDuration(task);
        if (estimatedDuration.value < 30 && estimatedDuration.unit === 'minutes') {
            reasons.push('⚡ Quick win');
        }
        
        if (score > 0.8) {
            reasons.push('🎯 Highly recommended');
        }
        
        return reasons;
    }

    /**
     * Estimate task duration based on patterns
     * @private
     */
    _estimateTaskDuration(task) {
        // Simple heuristic based on text length and priority
        const textLength = task.text?.length || 0;
        
        if (textLength < 20) {
            return { value: 10, unit: 'minutes' };
        } else if (textLength < 50) {
            return { value: 25, unit: 'minutes' };
        } else if (textLength < 100) {
            return { value: 45, unit: 'minutes' };
        } else {
            return { value: 1, unit: 'hours' };
        }
    }

    /**
     * Generate prioritized task list
     * @private
     */
    async _generatePrioritizedList(tasks, now) {
        const activeTasks = tasks.filter(t => !t.completed);
        
        const scored = activeTasks.map(task => ({
            ...task,
            score: this._calculateTaskScore(task, now),
            reasons: this._explainScore(task, this._calculateTaskScore(task, now), now)
        }));
        
        scored.sort((a, b) => b.score - a.score);
        
        return {
            tasks: scored.slice(0, 10), // Top 10
            totalActive: activeTasks.length
        };
    }

    /**
     * Suggest time blocking schedule
     * @private
     */
    async _suggestTimeBlocking(tasks, now) {
        const activeTasks = tasks.filter(t => !t.completed);
        
        // Group tasks by estimated duration
        const quick = activeTasks.filter(t => this._estimateTaskDuration(t).value < 30);
        const medium = activeTasks.filter(t => {
            const d = this._estimateTaskDuration(t);
            return d.value >= 30 && d.value < 60;
        });
        const long = activeTasks.filter(t => this._estimateTaskDuration(t).value >= 60);
        
        // Create time blocks
        const blocks = [];
        const currentHour = now.getHours();
        let blockStart = currentHour;
        
        // Morning: Deep work (long tasks)
        if (currentHour < 12) {
            if (long.length > 0) {
                blocks.push({
                    time: 'Morning (Deep Work)',
                    tasks: long.slice(0, 2),
                    duration: '2-3 hours',
                    energy: 'High'
                });
            }
        }
        
        // Afternoon: Medium tasks
        if (medium.length > 0) {
            blocks.push({
                time: 'Afternoon (Focus)',
                tasks: medium.slice(0, 3),
                duration: '2-3 hours',
                energy: 'Medium'
            });
        }
        
        // Evening: Quick wins
        if (quick.length > 0) {
            blocks.push({
                time: 'Evening (Quick Wins)',
                tasks: quick.slice(0, 5),
                duration: '1-2 hours',
                energy: 'Low'
            });
        }
        
        return {
            blocks,
            totalTasks: activeTasks.length
        };
    }

    /**
     * Match tasks to current energy level
     * @private
     */
    _matchTasksToEnergy(tasks, currentHour) {
        const energyLevel = this._getUserEnergyLevel(currentHour);
        const activeTasks = tasks.filter(t => !t.completed);
        
        let matchedTasks;
        
        if (energyLevel > 0.7) {
            // High energy - suggest challenging tasks
            matchedTasks = activeTasks.filter(t => t.priority === 'high').slice(0, 3);
            return {
                level: 'High',
                message: '🔥 You\'re at peak energy! Tackle challenging tasks.',
                tasks: matchedTasks
            };
        } else if (energyLevel > 0.4) {
            // Medium energy - suggest moderate tasks
            matchedTasks = activeTasks.filter(t => t.priority === 'medium').slice(0, 3);
            return {
                level: 'Medium',
                message: '⚡ Good energy for focused work.',
                tasks: matchedTasks
            };
        } else {
            // Low energy - suggest easy tasks
            matchedTasks = activeTasks.filter(t => t.priority === 'low').slice(0, 3);
            return {
                level: 'Low',
                message: '😌 Low energy? Start with quick wins.',
                tasks: matchedTasks
            };
        }
    }

    /**
     * Find quick wins (tasks < 15 min)
     * @private
     */
    _findQuickWins(tasks) {
        const activeTasks = tasks.filter(t => !t.completed);
        
        const quickWins = activeTasks.filter(task => {
            const duration = this._estimateTaskDuration(task);
            return duration.value < 15 && duration.unit === 'minutes';
        }).slice(0, 5);
        
        return {
            tasks: quickWins,
            message: quickWins.length > 0 
                ? `⚡ ${quickWins.length} quick wins available!`
                : 'No quick wins right now',
            totalMomentumTime: quickWins.length * 10 // minutes
        };
    }

    /**
     * Find focus tasks (important, not urgent)
     * @private
     */
    _findFocusTasks(tasks, now) {
        const activeTasks = tasks.filter(t => !t.completed);
        
        // Important but not due soon (Eisenhower Matrix Quadrant 2)
        const focusTasks = activeTasks.filter(task => {
            if (task.priority !== 'high') return false;
            if (!task.dueDate) return true;
            
            const dueDate = new Date(task.dueDate);
            const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
            return daysUntilDue > 7; // Not due this week
        }).slice(0, 3);
        
        return {
            tasks: focusTasks,
            message: '🎯 Important but not urgent - perfect for deep work',
            count: focusTasks.length
        };
    }

    /**
     * Identify procrastination patterns
     * @private
     */
    _identifyProcrastination(tasks) {
        const activeTasks = tasks.filter(t => !t.completed);
        
        // Tasks that have been pending for too long
        const now = Date.now();
        const procrastinated = activeTasks.filter(task => {
            if (!task.createdAt) return false;
            const created = new Date(task.createdAt).getTime();
            const daysPending = (now - created) / (1000 * 60 * 60 * 24);
            return daysPending > 7 && task.priority === 'high';
        }).slice(0, 3);
        
        return {
            tasks: procrastinated,
            message: procrastinated.length > 0
                ? `⚠️ ${procrastinated.length} important tasks pending for over a week`
                : '✅ No procrastination detected!',
            count: procrastinated.length
        };
    }

    /**
     * Generate learning insights from user patterns
     * @private
     */
    _generateLearningInsights() {
        const insights = [];
        
        // Analyze completion patterns
        const patterns = this.userPatterns;
        
        // Peak productivity insight
        const peakHour = patterns.productiveHours.indexOf(Math.max(...patterns.productiveHours));
        if (peakHour >= 0) {
            insights.push({
                type: 'productivity',
                title: 'Peak Performance',
                message: `You're most productive at ${this._formatHour(peakHour)}`,
                action: 'Schedule important tasks during this time'
            });
        }
        
        // Task completion rate
        if (patterns.taskCompletionHistory.length > 0) {
            const recentCompletions = patterns.taskCompletionHistory.slice(-7);
            const average = recentCompletions.reduce((a, b) => a + b, 0) / recentCompletions.length;
            
            if (average > 5) {
                insights.push({
                    type: 'achievement',
                    title: 'Consistent Performer',
                    message: `You complete ~${Math.round(average)} tasks daily`,
                    action: 'Keep up the great work!'
                });
            } else if (average < 2 && average > 0) {
                insights.push({
                    type: 'improvement',
                    title: 'Room to Grow',
                    message: `You complete ~${Math.round(average)} tasks daily`,
                    action: 'Try breaking tasks into smaller subtasks'
                });
            }
        }
        
        return insights;
    }

    /**
     * Load user patterns from storage
     * @private
     */
    async _loadUserPatterns() {
        try {
            const stored = localStorage.getItem('smartSuggestions_patterns');
            if (stored) {
                this.userPatterns = { ...this.userPatterns, ...JSON.parse(stored) };
            }
        } catch (error) {
            console.error('[SmartSuggestions] Error loading patterns:', error);
        }
    }

    /**
     * Save user patterns to storage
     * @private
     */
    _saveUserPatterns() {
        try {
            localStorage.setItem('smartSuggestions_patterns', JSON.stringify(this.userPatterns));
        } catch (error) {
            console.error('[SmartSuggestions] Error saving patterns:', error);
        }
    }

    /**
     * Record task completion for learning
     * @param {Object} task - Completed task
     */
    recordCompletion(task) {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        // Update productive hours
        this.userPatterns.productiveHours[hour]++;
        this.userPatterns.productiveDays[day]++;
        
        // Update completion history
        this.userPatterns.taskCompletionHistory.push(1);
        this.userPatterns.taskCompletionHistory = 
            this.userPatterns.taskCompletionHistory.slice(-30); // Last 30 days
        
        // Update priority preferences
        if (task.priority) {
            this.userPatterns.priorityPreferences[task.priority]++;
        }
        
        // Save patterns
        this._saveUserPatterns();
        
        // Emit event
        eventBus.emit(AppEvents.SUGGESTION_LEARNED, { task, hour, day });
    }

    /**
     * Format hour for display
     * @private
     */
    _formatHour(hour) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        return `${displayHour} ${period}`;
    }

    /**
     * Reset learning data
     */
    reset() {
        this.userPatterns = {
            productiveHours: new Array(24).fill(0),
            productiveDays: new Array(7).fill(0),
            taskCompletionHistory: [],
            priorityPreferences: { high: 0, medium: 0, low: 0 },
            averageTasksPerDay: 0,
            preferredTaskLength: 0
        };
        this._saveUserPatterns();
    }
}

export { SmartSuggestionsEngine };
