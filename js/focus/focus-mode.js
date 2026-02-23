/**
 * Focus Mode with Pomodoro Integration
 * ======================================
 * Distraction-free work sessions with time tracking
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Pomodoro Timer
 */
export class PomodoroTimer {
    constructor() {
        this.config = {
            workDuration: 25 * 60,      // 25 minutes
            shortBreak: 5 * 60,          // 5 minutes
            longBreak: 15 * 60,          // 15 minutes
            sessionsBeforeLongBreak: 4
        };

        this.state = {
            isRunning: false,
            isPaused: false,
            mode: 'work', // 'work', 'shortBreak', 'longBreak'
            timeRemaining: this.config.workDuration,
            currentSession: 0,
            totalSessions: 0,
            taskId: null
        };

        this.timerInterval = null;
        this.audioContext = null;
    }

    /**
     * Start timer
     */
    start(taskId = null) {
        if (this.state.isRunning && !this.state.isPaused) return;

        this.state.isRunning = true;
        this.state.isPaused = false;
        this.state.taskId = taskId;

        this.timerInterval = setInterval(() => {
            this.tick();
        }, 1000);

        eventBus.emit(EVENTS.FOCUS_STARTED, {
            mode: this.state.mode,
            taskId,
            duration: this.getTimeForMode(this.state.mode)
        });
    }

    /**
     * Pause timer
     */
    pause() {
        if (!this.state.isRunning) return;

        this.state.isPaused = true;
        clearInterval(this.timerInterval);

        eventBus.emit(EVENTS.FOCUS_PAUSED, {
            timeRemaining: this.state.timeRemaining
        });
    }

    /**
     * Resume timer
     */
    resume() {
        if (!this.state.isPaused) return;

        this.state.isPaused = false;
        this.timerInterval = setInterval(() => this.tick(), 1000);

        eventBus.emit(EVENTS.FOCUS_RESUMED, {
            timeRemaining: this.state.timeRemaining
        });
    }

    /**
     * Stop timer
     */
    stop() {
        this.state.isRunning = false;
        this.state.isPaused = false;
        clearInterval(this.timerInterval);

        eventBus.emit(EVENTS.FOCUS_STOPPED);
    }

    /**
     * Timer tick
     */
    tick() {
        if (this.state.timeRemaining > 0) {
            this.state.timeRemaining--;
            
            eventBus.emit(EVENTS.FOCUS_TICK, {
                timeRemaining: this.state.timeRemaining,
                mode: this.state.mode
            });
        } else {
            this.completeSession();
        }
    }

    /**
     * Complete current session
     */
    completeSession() {
        this.playNotificationSound();

        if (this.state.mode === 'work') {
            this.state.totalSessions++;
            this.state.currentSession++;

            eventBus.emit(EVENTS.FOCUS_SESSION_COMPLETE, {
                mode: 'work',
                totalSessions: this.state.totalSessions
            });

            // Determine next break type
            if (this.state.currentSession >= this.config.sessionsBeforeLongBreak) {
                this.state.currentSession = 0;
                this.switchMode('longBreak');
            } else {
                this.switchMode('shortBreak');
            }
        } else {
            // Break complete, switch to work
            this.switchMode('work');
        }
    }

    /**
     * Switch mode
     */
    switchMode(mode) {
        this.state.mode = mode;
        this.state.timeRemaining = this.getTimeForMode(mode);

        eventBus.emit(EVENTS.FOCUS_MODE_SWITCHED, {
            mode,
            duration: this.state.timeRemaining
        });

        // Auto-start next session
        setTimeout(() => {
            if (this.state.isRunning) {
                this.start(this.state.taskId);
            }
        }, 5000);
    }

    /**
     * Get time for mode
     */
    getTimeForMode(mode) {
        switch (mode) {
            case 'work': return this.config.workDuration;
            case 'shortBreak': return this.config.shortBreak;
            case 'longBreak': return this.config.longBreak;
            default: return this.config.workDuration;
        }
    }

    /**
     * Play notification sound
     */
    playNotificationSound() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('Audio notification failed:', error);
        }
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...this.state,
            formattedTime: this.formatTime(this.state.timeRemaining)
        };
    }

    /**
     * Format time
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (!this.state.isRunning) {
            this.state.timeRemaining = this.getTimeForMode(this.state.mode);
        }
    }

    /**
     * Reset timer
     */
    reset() {
        this.stop();
        this.state = {
            isRunning: false,
            isPaused: false,
            mode: 'work',
            timeRemaining: this.config.workDuration,
            currentSession: 0,
            totalSessions: 0,
            taskId: null
        };

        eventBus.emit(EVENTS.FOCUS_RESET);
    }
}

/**
 * Focus Mode Manager
 */
export class FocusModeManager {
    constructor() {
        this.pomodoro = new PomodoroTimer();
        this.focusTask = null;
        this.isFocusMode = false;
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.pomodoroTimer = this.pomodoro;
    }

    /**
     * Enter focus mode
     */
    enterFocusMode(task) {
        this.isFocusMode = true;
        this.focusTask = task;

        document.body.classList.add('focus-mode');
        
        eventBus.emit(EVENTS.FOCUS_MODE_ENTERED, {
            task,
            timestamp: Date.now()
        });

        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: `Focus mode: Working on "${task?.text || 'Single Task'}"`,
            type: 'info'
        });
    }

    /**
     * Exit focus mode
     */
    exitFocusMode() {
        this.isFocusMode = false;
        this.focusTask = null;
        this.pomodoro.stop();

        document.body.classList.remove('focus-mode');
        
        eventBus.emit(EVENTS.FOCUS_MODE_EXITED);

        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: 'Focus mode ended',
            type: 'info'
        });
    }

    /**
     * Toggle focus mode
     */
    toggleFocusMode(task) {
        if (this.isFocusMode) {
            this.exitFocusMode();
        } else {
            this.enterFocusMode(task);
        }
    }

    /**
     * Start focus session
     */
    startFocusSession(task) {
        if (!this.isFocusMode) {
            this.enterFocusMode(task);
        }
        this.pomodoro.start(task?.id);
    }

    /**
     * Get focus statistics
     */
    getFocusStats() {
        const savedStats = localStorage.getItem('taskmaster-focus-stats');
        return savedStats ? JSON.parse(savedStats) : {
            totalSessions: 0,
            totalFocusTime: 0,
            sessionsByDate: {},
            averageSessionsPerDay: 0
        };
    }

    /**
     * Record focus session
     */
    recordSession(duration, taskId) {
        const stats = this.getFocusStats();
        const today = new Date().toDateString();

        stats.totalSessions++;
        stats.totalFocusTime += duration;
        
        if (!stats.sessionsByDate[today]) {
            stats.sessionsByDate[today] = { sessions: 0, time: 0 };
        }
        stats.sessionsByDate[today].sessions++;
        stats.sessionsByDate[today].time += duration;

        localStorage.setItem('taskmaster-focus-stats', JSON.stringify(stats));

        eventBus.emit(EVENTS.FOCUS_STATS_UPDATED, stats);
    }
}

/**
 * Focus Mode UI
 */
export class FocusModeUI {
    constructor(focusManager) {
        this.focusManager = focusManager;
        this.container = null;
    }

    /**
     * Initialize focus UI
     */
    init(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;

        this.render();
        this.subscribeToEvents();
    }

    /**
     * Render focus UI
     */
    render() {
        if (!this.container) return;

        const state = this.focusManager.pomodoro.getState();
        const task = this.focusManager.focusTask;

        this.container.innerHTML = `
            <div class="focus-mode-container ${this.focusManager.isFocusMode ? 'active' : ''}">
                <div class="focus-header">
                    <h2>🎯 Focus Mode</h2>
                    <button class="exit-focus" id="exitFocus">✕</button>
                </div>
                
                ${task ? `
                    <div class="focus-task">
                        <h3>${task.text}</h3>
                        ${task.dueDate ? `<p>Due: ${task.dueDate}</p>` : ''}
                    </div>
                ` : ''}
                
                <div class="pomodoro-display">
                    <div class="timer-mode">${this.getModeLabel(state.mode)}</div>
                    <div class="timer-display">${state.formattedTime}</div>
                    <div class="session-count">Session ${state.currentSession + 1} of ${this.focusManager.pomodoro.config.sessionsBeforeLongBreak}</div>
                </div>
                
                <div class="pomodoro-controls">
                    ${state.isRunning && !state.isPaused ? `
                        <button class="btn-pause" id="pauseTimer">⏸ Pause</button>
                    ` : `
                        <button class="btn-start" id="startTimer">▶ ${state.isPaused ? 'Resume' : 'Start'}</button>
                    `}
                    <button class="btn-stop" id="stopTimer">⏹ Stop</button>
                </div>
                
                <div class="focus-stats">
                    <div class="stat">
                        <span class="stat-value">${state.totalSessions}</span>
                        <span class="stat-label">Sessions Today</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${Math.round(state.totalSessions * 25)}</span>
                        <span class="stat-label">Minutes Focused</span>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    /**
     * Get mode label
     */
    getModeLabel(mode) {
        switch (mode) {
            case 'work': return '🎯 Focus Time';
            case 'shortBreak': return '☕ Short Break';
            case 'longBreak': return '🌟 Long Break';
            default: return mode;
        }
    }

    /**
     * Bind events
     */
    bindEvents() {
        this.container.querySelector('#exitFocus')?.addEventListener('click', () => {
            this.focusManager.exitFocusMode();
            this.render();
        });

        this.container.querySelector('#startTimer')?.addEventListener('click', () => {
            this.focusManager.pomodoro.start(this.focusManager.focusTask?.id);
            this.render();
        });

        this.container.querySelector('#pauseTimer')?.addEventListener('click', () => {
            this.focusManager.pomodoro.pause();
            this.render();
        });

        this.container.querySelector('#stopTimer')?.addEventListener('click', () => {
            this.focusManager.pomodoro.stop();
            this.render();
        });
    }

    /**
     * Subscribe to events
     */
    subscribeToEvents() {
        eventBus.on(EVENTS.FOCUS_TICK, () => this.render());
        eventBus.on(EVENTS.FOCUS_MODE_ENTERED, () => this.render());
        eventBus.on(EVENTS.FOCUS_MODE_EXITED, () => this.render());
        eventBus.on(EVENTS.FOCUS_MODE_SWITCHED, () => this.render());
    }
}

/**
 * Create focus mode system
 */
export function createFocusMode() {
    const manager = new FocusModeManager();
    const ui = new FocusModeUI(manager);
    return { manager, ui, pomodoro: manager.pomodoro };
}
