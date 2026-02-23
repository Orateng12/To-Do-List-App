/**
 * Focus Mode & Pomodoro Timer
 * =============================
 * Deep work session management with Pomodoro technique
 * 
 * Features:
 * - Customizable work/break intervals
 * - Task-focused sessions
 * - Session statistics
 * - Auto-start breaks
 * - Focus mode UI
 * - Session history
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class FocusModeManager {
    constructor(taskRepository) {
        this.taskRepository = taskRepository;
        
        // Timer configuration
        this.config = {
            workDuration: 25 * 60,      // 25 minutes in seconds
            shortBreak: 5 * 60,          // 5 minutes
            longBreak: 15 * 60,          // 15 minutes
            sessionsBeforeLongBreak: 4,  // After 4 sessions, take long break
            autoStartBreaks: false,
            autoStartWork: false,
            notificationsEnabled: true
        };
        
        // Timer state
        this.state = {
            isRunning: false,
            isPaused: false,
            mode: 'work', // 'work', 'shortBreak', 'longBreak'
            timeRemaining: this.config.workDuration,
            currentSession: 1,
            totalSessions: 0,
            currentTaskId: null,
            startTime: null,
            endTime: null,
            intervalId: null
        };
        
        // Session history
        this.history = this._loadHistory();
        
        // Load saved config
        this._loadConfig();
    }

    /**
     * Initialize focus mode
     */
    init() {
        // Request notification permission
        if (this.config.notificationsEnabled && 'Notification' in window) {
            Notification.requestPermission();
        }
    }

    /**
     * Start focus session
     * @param {string} taskId - Optional task to focus on
     * @returns {Object} Session info
     */
    startFocusSession(taskId = null) {
        if (this.state.isRunning) {
            return { success: false, error: 'Session already running' };
        }
        
        this.state = {
            ...this.state,
            isRunning: true,
            isPaused: false,
            mode: 'work',
            timeRemaining: this.config.workDuration,
            currentTaskId: taskId,
            startTime: new Date(),
            endTime: new Date(Date.now() + this.config.workDuration * 1000)
        };
        
        this._startTimer();
        
        eventBus.emit(AppEvents.FOCUS_SESSION_START, {
            mode: this.state.mode,
            taskId,
            duration: this.config.workDuration
        });
        
        return {
            success: true,
            mode: this.state.mode,
            timeRemaining: this.state.timeRemaining,
            taskId
        };
    }

    /**
     * Pause current session
     */
    pauseSession() {
        if (!this.state.isRunning || this.state.isPaused) {
            return { success: false, error: 'No active session to pause' };
        }
        
        this.state.isPaused = true;
        this._stopTimer();
        
        eventBus.emit(AppEvents.FOCUS_SESSION_PAUSE);
        
        return { success: true, timeRemaining: this.state.timeRemaining };
    }

    /**
     * Resume paused session
     */
    resumeSession() {
        if (!this.state.isRunning || !this.state.isPaused) {
            return { success: false, error: 'No paused session to resume' };
        }
        
        this.state.isPaused = false;
        this._startTimer();
        
        eventBus.emit(AppEvents.FOCUS_SESSION_RESUME);
        
        return { success: true, timeRemaining: this.state.timeRemaining };
    }

    /**
     * Stop current session
     */
    stopSession() {
        if (!this.state.isRunning) {
            return { success: false, error: 'No active session' };
        }
        
        this._stopTimer();
        
        // Record partial session
        if (this.state.mode === 'work') {
            const elapsed = this.config.workDuration - this.state.timeRemaining;
            if (elapsed > 60) { // Only record if more than 1 minute
                this._recordSession(elapsed);
            }
        }
        
        this.state = {
            ...this.state,
            isRunning: false,
            isPaused: false,
            mode: 'idle',
            currentTaskId: null
        };
        
        eventBus.emit(AppEvents.FOCUS_SESSION_STOP);
        
        return { success: true };
    }

    /**
     * Skip to break
     */
    skipToBreak() {
        if (!this.state.isRunning) {
            return { success: false, error: 'No active session' };
        }
        
        this._stopTimer();
        this._startBreak();
        
        return { success: true };
    }

    /**
     * Start break
     * @private
     */
    _startBreak() {
        const isLongBreak = this.state.currentSession % this.config.sessionsBeforeLongBreak === 0;
        const breakDuration = isLongBreak ? this.config.longBreak : this.config.shortBreak;
        
        this.state = {
            ...this.state,
            mode: isLongBreak ? 'longBreak' : 'shortBreak',
            timeRemaining: breakDuration,
            endTime: new Date(Date.now() + breakDuration * 1000)
        };
        
        this._startTimer();
        
        // Send notification
        if (this.config.notificationsEnabled) {
            this._sendNotification(
                '🎉 Time for a break!',
                isLongBreak ? 'Take a long break (15 min)' : 'Take a short break (5 min)'
            );
        }
        
        eventBus.emit(AppEvents.FOCUS_BREAK_START, {
            mode: this.state.mode,
            duration: breakDuration,
            isLongBreak
        });
    }

    /**
     * Start work session after break
     * @private
     */
    _startNextWorkSession() {
        this.state = {
            ...this.state,
            mode: 'work',
            timeRemaining: this.config.workDuration,
            currentSession: this.state.currentSession + 1,
            startTime: new Date(),
            endTime: new Date(Date.now() + this.config.workDuration * 1000)
        };
        
        this._startTimer();
        
        // Send notification
        if (this.config.notificationsEnabled) {
            this._sendNotification(
                '💪 Ready to focus?',
                `Session ${this.state.currentSession} starting now`
            );
        }
        
        eventBus.emit(AppEvents.FOCUS_SESSION_START, {
            mode: 'work',
            session: this.state.currentSession,
            duration: this.config.workDuration
        });
    }

    /**
     * Start timer interval
     * @private
     */
    _startTimer() {
        this._stopTimer(); // Clear any existing timer
        
        this.state.intervalId = setInterval(() => {
            if (!this.state.isPaused) {
                this.state.timeRemaining--;
                
                // Emit tick event for UI updates
                eventBus.emit(AppEvents.FOCUS_TIMER_TICK, {
                    timeRemaining: this.state.timeRemaining,
                    mode: this.state.mode
                });
                
                // Check if time is up
                if (this.state.timeRemaining <= 0) {
                    this._handleTimeUp();
                }
            }
        }, 1000);
    }

    /**
     * Stop timer
     * @private
     */
    _stopTimer() {
        if (this.state.intervalId) {
            clearInterval(this.state.intervalId);
            this.state.intervalId = null;
        }
    }

    /**
     * Handle timer completion
     * @private
     */
    _handleTimeUp() {
        this._stopTimer();
        
        if (this.state.mode === 'work') {
            // Record completed session
            this._recordSession(this.config.workDuration);
            this.state.totalSessions++;
            
            // Start break
            if (this.config.autoStartBreaks) {
                this._startBreak();
            } else {
                this._sendNotification(
                    '✅ Focus session complete!',
                    'Time for a break'
                );
                eventBus.emit(AppEvents.FOCUS_SESSION_COMPLETE, {
                    session: this.state.currentSession
                });
            }
        } else {
            // Break complete, start work
            if (this.config.autoStartWork) {
                this._startNextWorkSession();
            } else {
                this._sendNotification(
                    '☕ Break\'s over!',
                    'Ready for the next focus session?'
                );
                eventBus.emit(AppEvents.FOCUS_BREAK_COMPLETE);
            }
        }
    }

    /**
     * Record completed session
     * @private
     */
    _recordSession(duration) {
        const session = {
            id: this._generateId(),
            date: new Date().toISOString(),
            duration,
            mode: this.state.mode,
            taskId: this.state.currentTaskId,
            completed: true
        };
        
        this.history.push(session);
        this._saveHistory();
        
        eventBus.emit(AppEvents.FOCUS_SESSION_RECORDED, { session });
    }

    /**
     * Get session statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const todaySessions = this.history.filter(s => new Date(s.date) >= today);
        const weekSessions = this.history.filter(s => new Date(s.date) >= weekAgo);
        
        const todayFocusTime = todaySessions
            .filter(s => s.mode === 'work')
            .reduce((sum, s) => sum + s.duration, 0);
        
        const weekFocusTime = weekSessions
            .filter(s => s.mode === 'work')
            .reduce((sum, s) => sum + s.duration, 0);
        
        return {
            totalSessions: this.history.length,
            todaySessions: todaySessions.length,
            weekSessions: weekSessions.length,
            todayFocusTime: this._formatDuration(todayFocusTime),
            weekFocusTime: this._formatDuration(weekFocusTime),
            averageSessionDuration: this.history.length > 0
                ? this._formatDuration(
                    this.history.reduce((sum, s) => sum + s.duration, 0) / this.history.length
                )
                : '0 min',
            currentStreak: this._calculateStreak(),
            totalSessionsToday: this.state.totalSessions
        };
    }

    /**
     * Calculate current streak
     * @private
     */
    _calculateStreak() {
        if (this.history.length === 0) return 0;
        
        let streak = 0;
        const now = new Date();
        let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Sort history by date descending
        const sortedHistory = [...this.history].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );
        
        for (const session of sortedHistory) {
            const sessionDate = new Date(session.date);
            sessionDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
            
            const diffDays = (currentDate - sessionDate) / (1000 * 60 * 60 * 24);
            
            if (diffDays <= 1) {
                streak++;
                currentDate = sessionDate;
            } else {
                break;
            }
        }
        
        return streak;
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return {
            isRunning: this.state.isRunning,
            isPaused: this.state.isPaused,
            mode: this.state.mode,
            timeRemaining: this.state.timeRemaining,
            formattedTime: this._formatTime(this.state.timeRemaining),
            currentSession: this.state.currentSession,
            totalSessions: this.state.totalSessions,
            currentTaskId: this.state.currentTaskId,
            endTime: this.state.endTime
        };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this._saveConfig();
        
        // Update time remaining if not running
        if (!this.state.isRunning) {
            if (this.state.mode === 'work') {
                this.state.timeRemaining = this.config.workDuration;
            } else {
                this.state.timeRemaining = this.state.mode === 'shortBreak'
                    ? this.config.shortBreak
                    : this.config.longBreak;
            }
        }
        
        eventBus.emit(AppEvents.FOCUS_CONFIG_UPDATED, { config: this.config });
    }

    /**
     * Get configuration
     * @returns {Object} Current config
     */
    getConfig() {
        return this.config;
    }

    /**
     * Send notification
     * @private
     */
    _sendNotification(title, body) {
        if (!this.config.notificationsEnabled) return;
        
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/icon-192.png',
                badge: '/badge-72.png',
                vibrate: [200, 100, 200]
            });
        }
    }

    /**
     * Format time for display
     * @private
     */
    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format duration for display
     * @private
     */
    _formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const hours = Math.floor(mins / 60);
        
        if (hours > 0) {
            return `${hours}h ${mins % 60}m`;
        }
        return `${mins}m`;
    }

    /**
     * Save history to localStorage
     * @private
     */
    _saveHistory() {
        // Keep last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const filteredHistory = this.history.filter(
            s => new Date(s.date) >= ninetyDaysAgo
        );
        
        localStorage.setItem('focusMode_history', JSON.stringify(filteredHistory));
        this.history = filteredHistory;
    }

    /**
     * Load history from localStorage
     * @private
     */
    _loadHistory() {
        try {
            const stored = localStorage.getItem('focusMode_history');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('[FocusMode] Error loading history:', error);
            return [];
        }
    }

    /**
     * Save config to localStorage
     * @private
     */
    _saveConfig() {
        localStorage.setItem('focusMode_config', JSON.stringify(this.config));
    }

    /**
     * Load config from localStorage
     * @private
     */
    _loadConfig() {
        try {
            const stored = localStorage.getItem('focusMode_config');
            if (stored) {
                this.config = { ...this.config, ...JSON.parse(stored) };
            }
        } catch (error) {
            console.error('[FocusMode] Error loading config:', error);
        }
    }

    _generateId() {
        return 'focus_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

export { FocusModeManager };
