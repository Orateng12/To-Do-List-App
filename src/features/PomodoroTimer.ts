/**
 * Pomodoro Timer Module
 * ======================
 * Focus timer with customizable work/break intervals
 * Integrates with tasks for time tracking
 */

import type { TaskId } from '../types';

export type TimerStateType = 'idle' | 'running' | 'paused' | 'completed';
export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
  workDuration: number;      // minutes (default: 25)
  shortBreakDuration: number; // minutes (default: 5)
  longBreakDuration: number;  // minutes (default: 15)
  sessionsBeforeLongBreak: number; // default: 4
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

export interface TimerSession {
  id: string;
  taskId?: TaskId;
  mode: TimerMode;
  startTime: string;
  endTime?: string;
  duration: number; // seconds
  completed: boolean;
  interruptions: number;
}

export interface TimerStateInfo {
  currentState: TimerStateType;
  currentMode: TimerMode;
  timeRemaining: number; // seconds
  currentSession: number;
  totalSessions: number;
  activeTaskId?: TaskId;
}

export class PomodoroTimer {
  private settings: TimerSettings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false
  };

  private state: TimerStateInfo = {
    currentState: 'idle',
    currentMode: 'work',
    timeRemaining: 25 * 60,
    currentSession: 0,
    totalSessions: 0
  };

  private timerId: number | null = null;
  private sessionHistory: TimerSession[] = [];
  private onTickCallbacks: Array<(timeRemaining: number) => void> = [];
  private onCompleteCallbacks: Array<(session: TimerSession) => void> = [];

  /**
   * Update timer settings
   */
  updateSettings(settings: Partial<TimerSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    // Update time remaining if idle
    if (this.state.currentState === 'idle') {
      this.state.timeRemaining = this.settings.workDuration * 60;
    }
  }

  /**
   * Start timer
   */
  start(taskId?: TaskId): void {
    if (this.state.currentState === 'running') return;

    this.state.currentState = 'running';
    
    // Start session tracking
    const session: TimerSession = {
      id: this.generateId(),
      taskId,
      mode: this.state.currentMode,
      startTime: new Date().toISOString(),
      duration: this.getTimeForMode(this.state.currentMode),
      completed: false,
      interruptions: 0
    };

    this.startTimer(session);
  }

  /**
   * Pause timer
   */
  pause(): void {
    if (this.state.currentState !== 'running') return;
    
    this.state.currentState = 'paused';
    this.stopTimer();
    
    // Update current session
    const currentSession = this.sessionHistory[this.sessionHistory.length - 1];
    if (currentSession) {
      currentSession.interruptions++;
    }
  }

  /**
   * Resume paused timer
   */
  resume(): void {
    if (this.state.currentState !== 'paused') return;
    
    this.state.currentState = 'running';
    this.startTimer();
  }

  /**
   * Stop timer and reset
   */
  stop(): void {
    this.stopTimer();
    this.state.currentState = 'idle';
    this.state.currentMode = 'work';
    this.state.timeRemaining = this.settings.workDuration * 60;
  }

  /**
   * Skip to next session
   */
  skip(): void {
    this.stopTimer();
    this.advanceToNextSession();
  }

  /**
   * Register tick callback
   */
  onTick(callback: (timeRemaining: number) => void): () => void {
    this.onTickCallbacks.push(callback);
    return () => {
      this.onTickCallbacks = this.onTickCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register session complete callback
   */
  onComplete(callback: (session: TimerSession) => void): () => void {
    this.onCompleteCallbacks.push(callback);
    return () => {
      this.onCompleteCallbacks = this.onCompleteCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Get current state
   */
  getState(): TimerStateInfo {
    return { ...this.state };
  }

  /**
   * Get session history
   */
  getHistory(): TimerSession[] {
    return [...this.sessionHistory];
  }

  /**
   * Get today's stats
   */
  getTodayStats(): { completedSessions: number; totalFocusTime: number; interruptions: number } {
    const today = new Date().toDateString();
    const todaySessions = this.sessionHistory.filter(
      s => new Date(s.startTime).toDateString() === today
    );

    const completedSessions = todaySessions.filter(s => s.completed).length;
    const totalFocusTime = todaySessions
      .filter(s => s.mode === 'work' && s.completed)
      .reduce((acc, s) => acc + s.duration, 0);
    const interruptions = todaySessions.reduce((acc, s) => acc + s.interruptions, 0);

    return { completedSessions, totalFocusTime, interruptions };
  }

  /**
   * Get weekly stats
   */
  getWeeklyStats(): { dailySessions: Record<string, number>; averageDaily: number } {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weekSessions = this.sessionHistory.filter(
      s => new Date(s.startTime) >= weekAgo && s.mode === 'work' && s.completed
    );

    const dailySessions: Record<string, number> = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => { dailySessions[day] = 0; });

    weekSessions.forEach(session => {
      const dayIndex = new Date(session.startTime).getDay();
      const day = days[dayIndex]!;
      dailySessions[day]++;
    });

    const averageDaily = weekSessions.length / 7;

    return { dailySessions, averageDaily };
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.stop();
    this.sessionHistory = [];
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private startTimer(session?: TimerSession): void {
    if (session) {
      this.sessionHistory.push(session);
    }

    this.timerId = window.setInterval(() => {
      if (this.state.timeRemaining > 0) {
        this.state.timeRemaining--;
        this.onTickCallbacks.forEach(cb => cb(this.state.timeRemaining));
      } else {
        this.completeSession();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private completeSession(): void {
    this.stopTimer();
    
    // Mark session as complete
    const currentSession = this.sessionHistory[this.sessionHistory.length - 1];
    if (currentSession) {
      currentSession.completed = true;
      currentSession.endTime = new Date().toISOString();
    }

    // Update state
    if (this.state.currentMode === 'work') {
      this.state.totalSessions++;
      this.state.currentSession++;
    }

    // Notify callbacks
    if (currentSession) {
      this.onCompleteCallbacks.forEach(cb => cb(currentSession));
    }

    // Advance to next session
    this.advanceToNextSession();
  }

  private advanceToNextSession(): void {
    const isLongBreakTime = this.state.currentSession % this.settings.sessionsBeforeLongBreak === 0;
    
    if (this.state.currentMode === 'work') {
      // Switch to break
      this.state.currentMode = isLongBreakTime ? 'longBreak' : 'shortBreak';
      this.state.timeRemaining = isLongBreakTime 
        ? this.settings.longBreakDuration * 60 
        : this.settings.shortBreakDuration * 60;
      
      if (this.settings.autoStartBreaks) {
        this.startTimer();
      }
    } else {
      // Switch to work
      this.state.currentMode = 'work';
      this.state.timeRemaining = this.settings.workDuration * 60;
      
      if (this.settings.autoStartWork) {
        this.startTimer();
      }
    }

    this.state.currentState = this.timerId ? 'running' : 'idle';
  }

  private getTimeForMode(mode: TimerMode): number {
    switch (mode) {
      case 'work': return this.settings.workDuration * 60;
      case 'shortBreak': return this.settings.shortBreakDuration * 60;
      case 'longBreak': return this.settings.longBreakDuration * 60;
    }
  }

  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const pomodoroTimer = new PomodoroTimer();
