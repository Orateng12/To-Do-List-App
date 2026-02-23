/**
 * Gamification System - Achievements, Streaks, Points
 * ====================================================
 * Motivate users through game-like elements
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Achievement Definitions
 */
export const ACHIEVEMENTS = {
    // Task completion achievements
    FIRST_TASK: {
        id: 'first_task',
        name: 'Getting Started',
        description: 'Complete your first task',
        icon: '🎯',
        points: 10,
        condition: (stats) => stats.totalCompleted >= 1
    },
    TASK_MASTER_10: {
        id: 'task_master_10',
        name: 'Task Master',
        description: 'Complete 10 tasks',
        icon: '⭐',
        points: 50,
        condition: (stats) => stats.totalCompleted >= 10
    },
    TASK_MASTER_50: {
        id: 'task_master_50',
        name: 'Task Expert',
        description: 'Complete 50 tasks',
        icon: '🌟',
        points: 200,
        condition: (stats) => stats.totalCompleted >= 50
    },
    TASK_MASTER_100: {
        id: 'task_master_100',
        name: 'Task Legend',
        description: 'Complete 100 tasks',
        icon: '🏆',
        points: 500,
        condition: (stats) => stats.totalCompleted >= 100
    },

    // Streak achievements
    STREAK_3: {
        id: 'streak_3',
        name: 'On a Roll',
        description: '3-day completion streak',
        icon: '🔥',
        points: 30,
        condition: (stats) => stats.currentStreak >= 3
    },
    STREAK_7: {
        id: 'streak_7',
        name: 'Week Warrior',
        description: '7-day completion streak',
        icon: '🔥🔥',
        points: 100,
        condition: (stats) => stats.currentStreak >= 7
    },
    STREAK_30: {
        id: 'streak_30',
        name: 'Monthly Master',
        description: '30-day completion streak',
        icon: '🔥🔥🔥',
        points: 500,
        condition: (stats) => stats.currentStreak >= 30
    },

    // Productivity achievements
    EARLY_BIRD: {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Complete 5 tasks before 9 AM',
        icon: '🌅',
        points: 75,
        condition: (stats) => stats.earlyMorningCompletions >= 5
    },
    NIGHT_OWL: {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Complete 5 tasks after 9 PM',
        icon: '🌙',
        points: 75,
        condition: (stats) => stats.lateNightCompletions >= 5
    },
    SPEED_DEMON: {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Complete 10 tasks in one day',
        icon: '⚡',
        points: 100,
        condition: (stats) => stats.singleDayCompletions >= 10
    },

    // Organization achievements
    PLANNER: {
        id: 'planner',
        name: 'Planner',
        description: 'Add due dates to 20 tasks',
        icon: '📅',
        points: 50,
        condition: (stats) => tasksWithDueDates >= 20
    },
    CATEGORIZER: {
        id: 'categorizer',
        name: 'Categorizer',
        description: 'Use 5 different categories',
        icon: '🏷️',
        points: 40,
        condition: (stats) => stats.uniqueCategories >= 5
    },

    // Comeback achievements
    COMEBACK: {
        id: 'comeback',
        name: 'Comeback Kid',
        description: 'Return after a 7+ day break',
        icon: '💪',
        points: 50,
        condition: (stats) => stats.returnAfterBreak
    }
};

/**
 * Level System
 */
export const LEVELS = {
    0: { name: 'Beginner', icon: '🌱', minPoints: 0 },
    1: { name: 'Novice', icon: '🌿', minPoints: 100 },
    2: { name: 'Apprentice', icon: '🪴', minPoints: 300 },
    3: { name: 'Regular', icon: '🌳', minPoints: 600 },
    4: { name: 'Experienced', icon: '🏔️', minPoints: 1000 },
    5: { name: 'Expert', icon: '⭐', minPoints: 1500 },
    6: { name: 'Master', icon: '🌟', minPoints: 2500 },
    7: { name: 'Grand Master', icon: '👑', minPoints: 4000 },
    8: { name: 'Legend', icon: '🏆', minPoints: 6000 },
    9: { name: 'Mythic', icon: '💎', minPoints: 10000 }
};

/**
 * Gamification Manager
 */
export class GamificationManager {
    constructor() {
        this.state = {
            points: 0,
            level: 0,
            achievements: [],
            unlockedAchievements: [],
            stats: this.initializeStats()
        };
        
        this.loadState();
        this.setupEventListeners();
    }

    /**
     * Initialize stats tracking
     */
    initializeStats() {
        return {
            totalCreated: 0,
            totalCompleted: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastCompletionDate: null,
            completionsByDate: {},
            earlyMorningCompletions: 0,
            lateNightCompletions: 0,
            singleDayCompletions: 0,
            uniqueCategories: new Set(),
            tasksWithDueDates: 0,
            returnAfterBreak: false
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        eventBus.on(EVENTS.TASK_ADDED, (data) => {
            this.onTaskAdded(data.task);
        });

        eventBus.on(EVENTS.TASK_TOGGLED, (data) => {
            if (data.task.completed) {
                this.onTaskCompleted(data.task);
            }
        });

        eventBus.on(EVENTS.TASK_DELETED, (data) => {
            this.onTaskDeleted(data.task);
        });
    }

    /**
     * Handle task added
     */
    onTaskAdded(task) {
        this.state.stats.totalCreated++;
        
        if (task.dueDate) {
            this.state.stats.tasksWithDueDates++;
        }
        
        if (task.categories) {
            task.categories.forEach(cat => this.state.stats.uniqueCategories.add(cat));
        }

        this.checkAchievements();
        this.saveState();
    }

    /**
     * Handle task completed
     */
    onTaskCompleted(task) {
        const today = new Date().toDateString();
        const hour = new Date().getHours();
        
        // Update completion stats
        this.state.stats.totalCompleted++;
        this.state.stats.completionsByDate[today] = (this.state.stats.completionsByDate[today] || 0) + 1;
        
        // Track streak
        this.updateStreak(today);
        
        // Track time-based completions
        if (hour < 9) {
            this.state.stats.earlyMorningCompletions++;
        }
        if (hour >= 21) {
            this.state.stats.lateNightCompletions++;
        }
        
        // Track single day completions
        this.state.stats.singleDayCompletions = this.state.stats.completionsByDate[today];
        
        // Award points
        this.addPoints(10, 'task_completed');
        
        // Check for level up
        this.checkLevelUp();
        
        // Check achievements
        this.checkAchievements();
        
        // Emit event
        eventBus.emit(EVENTS.GAMIFICATION_TASK_COMPLETED, {
            task,
            pointsEarned: 10,
            newStreak: this.state.stats.currentStreak
        });
        
        this.saveState();
    }

    /**
     * Handle task deleted
     */
    onTaskDeleted(task) {
        // Optionally remove points for deleted completed tasks
        if (task.completed) {
            this.deductPoints(5, 'task_deleted');
        }
        this.saveState();
    }

    /**
     * Update streak
     */
    updateStreak(today) {
        const lastDate = this.state.stats.lastCompletionDate;
        
        if (!lastDate) {
            this.state.stats.currentStreak = 1;
        } else {
            const lastCompletion = new Date(lastDate);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate - lastCompletion) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                // Same day, don't increase streak
            } else if (diffDays === 1) {
                this.state.stats.currentStreak++;
            } else {
                // Streak broken
                this.state.stats.currentStreak = 1;
                this.state.stats.returnAfterBreak = true;
            }
        }
        
        this.state.stats.lastCompletionDate = today;
        this.state.stats.longestStreak = Math.max(
            this.state.stats.longestStreak,
            this.state.stats.currentStreak
        );
    }

    /**
     * Add points
     */
    addPoints(amount, reason) {
        this.state.points += amount;
        
        eventBus.emit(EVENTS.GAMIFICATION_POINTS_EARNED, {
            amount,
            reason,
            totalPoints: this.state.points
        });
    }

    /**
     * Deduct points
     */
    deductPoints(amount, reason) {
        this.state.points = Math.max(0, this.state.points - amount);
        
        eventBus.emit(EVENTS.GAMIFICATION_POINTS_LOST, {
            amount,
            reason,
            totalPoints: this.state.points
        });
    }

    /**
     * Check for level up
     */
    checkLevelUp() {
        const newLevel = this.calculateLevel();
        
        if (newLevel > this.state.level) {
            const oldLevel = this.state.level;
            this.state.level = newLevel;
            
            eventBus.emit(EVENTS.GAMIFICATION_LEVEL_UP, {
                oldLevel,
                newLevel,
                levelInfo: LEVELS[newLevel]
            });
        }
    }

    /**
     * Calculate current level
     */
    calculateLevel() {
        for (let level = 9; level >= 0; level--) {
            if (this.state.points >= LEVELS[level].minPoints) {
                return level;
            }
        }
        return 0;
    }

    /**
     * Check achievements
     */
    checkAchievements() {
        for (const achievement of Object.values(ACHIEVEMENTS)) {
            if (this.state.unlockedAchievements.includes(achievement.id)) {
                continue;
            }
            
            if (achievement.condition(this.state.stats)) {
                this.unlockAchievement(achievement);
            }
        }
    }

    /**
     * Unlock achievement
     */
    unlockAchievement(achievement) {
        this.state.unlockedAchievements.push(achievement.id);
        this.addPoints(achievement.points, 'achievement');
        
        eventBus.emit(EVENTS.GAMIFICATION_ACHIEVEMENT_UNLOCKED, {
            achievement,
            pointsEarned: achievement.points
        });
        
        this.saveState();
    }

    /**
     * Get progress to next level
     */
    getLevelProgress() {
        const currentLevel = LEVELS[this.state.level];
        const nextLevel = LEVELS[this.state.level + 1];
        
        if (!nextLevel) {
            return { current: this.state.points, max: this.state.points, percentage: 100 };
        }
        
        const prevMin = currentLevel.minPoints;
        const nextMin = nextLevel.minPoints;
        const progress = this.state.points - prevMin;
        const total = nextMin - prevMin;
        
        return {
            current: progress,
            max: total,
            percentage: Math.round((progress / total) * 100)
        };
    }

    /**
     * Get all achievements
     */
    getAllAchievements() {
        return Object.values(ACHIEVEMENTS).map(a => ({
            ...a,
            unlocked: this.state.unlockedAchievements.includes(a.id)
        }));
    }

    /**
     * Get stats summary
     */
    getStatsSummary() {
        return {
            ...this.state.stats,
            uniqueCategories: this.state.stats.uniqueCategories.size,
            points: this.state.points,
            level: this.state.level,
            levelInfo: LEVELS[this.state.level],
            levelProgress: this.getLevelProgress(),
            achievementsUnlocked: this.state.unlockedAchievements.length,
            totalAchievements: Object.keys(ACHIEVEMENTS).length
        };
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        const toSave = {
            ...this.state,
            uniqueCategories: Array.from(this.state.stats.uniqueCategories)
        };
        localStorage.setItem('taskmaster-gamification', JSON.stringify(toSave));
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        const saved = localStorage.getItem('taskmaster-gamification');
        if (saved) {
            const loaded = JSON.parse(saved);
            this.state = {
                ...this.state,
                ...loaded,
                stats: {
                    ...this.state.stats,
                    ...loaded.stats,
                    uniqueCategories: new Set(loaded.stats?.uniqueCategories || [])
                }
            };
        }
    }

    /**
     * Reset all progress
     */
    reset() {
        this.state = {
            points: 0,
            level: 0,
            achievements: [],
            unlockedAchievements: [],
            stats: this.initializeStats()
        };
        localStorage.removeItem('taskmaster-gamification');
        
        eventBus.emit(EVENTS.GAMIFICATION_RESET);
    }
}

/**
 * Gamification UI Component
 */
export class GamificationUI {
    constructor(gamificationManager) {
        this.gamification = gamificationManager;
        this.container = null;
    }

    /**
     * Initialize UI
     */
    init(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;

        this.render();
        this.subscribeToEvents();
    }

    /**
     * Subscribe to events
     */
    subscribeToEvents() {
        eventBus.on(EVENTS.GAMIFICATION_POINTS_EARNED, () => this.render());
        eventBus.on(EVENTS.GAMIFICATION_LEVEL_UP, (data) => this.showLevelUpAnimation(data));
        eventBus.on(EVENTS.GAMIFICATION_ACHIEVEMENT_UNLOCKED, (data) => this.showAchievementNotification(data));
    }

    /**
     * Render gamification UI
     */
    render() {
        if (!this.container) return;

        const stats = this.gamification.getStatsSummary();
        
        this.container.innerHTML = `
            <div class="gamification-dashboard">
                <div class="level-display">
                    <div class="level-icon">${stats.levelInfo.icon}</div>
                    <div class="level-info">
                        <div class="level-name">${stats.levelInfo.name}</div>
                        <div class="level-number">Level ${stats.level}</div>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="progress-label">
                        <span>Progress to ${LEVELS[stats.level + 1]?.name || 'Max Level'}</span>
                        <span>${stats.points} / ${LEVELS[stats.level + 1]?.minPoints || '∞'} pts</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.levelProgress.percentage}%"></div>
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalCompleted}</div>
                        <div class="stat-label">Tasks Done</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">🔥 ${stats.currentStreak}</div>
                        <div class="stat-label">Day Streak</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">🏆 ${stats.achievementsUnlocked}/${stats.totalAchievements}</div>
                        <div class="stat-label">Achievements</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show level up animation
     */
    showLevelUpAnimation(data) {
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-icon">🎉</div>
                <h3>Level Up!</h3>
                <p>You reached ${data.levelInfo.name} (Level ${data.newLevel})</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Show achievement notification
     */
    showAchievementNotification(data) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">${data.achievement.icon}</div>
                <div class="achievement-info">
                    <h4>${data.achievement.name}</h4>
                    <p>${data.achievement.description}</p>
                    <span class="points-earned">+${data.pointsEarned} points</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}

/**
 * Create gamification system
 */
export function createGamification() {
    const manager = new GamificationManager();
    const ui = new GamificationUI(manager);
    return { manager, ui };
}
