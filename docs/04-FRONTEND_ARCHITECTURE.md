# Frontend Architecture

**Version:** 1.0.0  
**Framework:** React 18 + TypeScript  
**Build Tool:** Vite  
**Styling:** Tailwind CSS

---

## 🎨 Design Philosophy

### Core Principles

```
1. IDENTITY FIRST
   Every screen reinforces who the user is becoming

2. ONE PRIMARY ACTION
   No decision fatigue — one clear action per screen

3. CALM INTENSITY
   Serious but not overwhelming. Focused but not stressful.

4. PROGRESS OVER PERFECTION
   Celebrate showing up, not flawless execution

5. DARK THEME DEFAULT
   Reduced eye strain, focused attention
```

### Visual Identity

```
Color Palette:
├── Background: #0A0A0B (near black)
├── Surface: #141416 (dark gray)
├── Primary: #3B82F6 (calm blue)
├── Success: #10B981 (muted green)
├── Warning: #F59E0B (amber)
├── Error: #EF4444 (soft red)
└── Text: #FAFAFA (off-white)

Typography:
├── Headings: Inter (bold, tight tracking)
├── Body: Inter (regular, relaxed leading)
└── Mono: JetBrains Mono (code, metrics)

Spacing:
├── Base unit: 4px
├── Components: 8px grid
└── Sections: 32px+ whitespace
```

---

## 📁 Project Structure

```
packages/frontend/
│
├── src/
│   │
│   ├── components/              # UI Components
│   │   │
│   │   ├── common/              # Reusable primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── onboarding/          # Onboarding flow
│   │   │   ├── ClarityAssessment.tsx
│   │   │   ├── InterestSelector.tsx
│   │   │   ├── IdentitySuggestion.tsx
│   │   │   └── OnboardingWizard.tsx
│   │   │
│   │   ├── identity/            # Identity management
│   │   │   ├── IdentityCard.tsx
│   │   │   ├── IdentitySelector.tsx
│   │   │   └── IdentityHistory.tsx
│   │   │
│   │   ├── system/              # System builder & management
│   │   │   ├── SystemBuilder.tsx
│   │   │   ├── SystemCard.tsx
│   │   │   ├── SystemList.tsx
│   │   │   ├── SystemDetail.tsx
│   │   │   ├── HabitBuilder.tsx
│   │   │   └── HabitItem.tsx
│   │   │
│   │   ├── daily/               # Daily execution
│   │   │   ├── DailyScreen.tsx
│   │   │   ├── HardThingInput.tsx
│   │   │   ├── HabitList.tsx
│   │   │   ├── HabitCheckbox.tsx
│   │   │   ├── ReflectionPrompt.tsx
│   │   │   └── DayCompleteModal.tsx
│   │   │
│   │   ├── metrics/             # Progress & analytics
│   │   │   ├── MetricsSummary.tsx
│   │   │   ├── DisciplineScore.tsx
│   │   │   ├── StreakDisplay.tsx
│   │   │   ├── WeeklyChart.tsx
│   │   │   └── ProgressCalendar.tsx
│   │   │
│   │   └── layout/              # Layout components
│   │       ├── Header.tsx
│   │       ├── Navigation.tsx
│   │       ├── Sidebar.tsx
│   │       └── PageContainer.tsx
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useIdentity.ts
│   │   ├── useSystem.ts
│   │   ├── useDailyLog.ts
│   │   ├── useMetrics.ts
│   │   ├── useAdaptiveLoad.ts
│   │   └── index.ts
│   │
│   ├── stores/                  # Zustand state stores
│   │   ├── authStore.ts
│   │   ├── systemStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   │
│   ├── lib/                     # Utilities & helpers
│   │   ├── api.ts               # API client (axios)
│   │   ├── utils.ts             # General utilities
│   │   ├── constants.ts         # App constants
│   │   ├── validators.ts        # Zod schemas
│   │   └── formatters.ts        # Date/number formatters
│   │
│   ├── pages/                   # Page components (routes)
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── OnboardingPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── SystemPage.tsx
│   │   ├── DailyPage.tsx
│   │   ├── ProgressPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── types/                   # TypeScript types
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── domain.ts
│   │   └── components.ts
│   │
│   ├── routes/                  # Route configuration
│   │   ├── index.tsx
│   │   ├── protected.tsx
│   │   └── public.tsx
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── public/
│   ├── favicon.ico
│   └── manifest.json
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## 🗂️ Component Hierarchy

```
App
│
├── AuthProvider
│   └── Routes
│       ├── Public Routes
│       │   ├── LandingPage
│       │   ├── LoginPage
│       │   └── RegisterPage
│       │
│       └── Protected Routes
│           ├── OnboardingPage
│           │   └── OnboardingWizard
│           │       ├── ClarityAssessment
│           │       ├── InterestSelector
│           │       └── IdentitySuggestion
│           │
│           ├── DashboardPage (Main Layout)
│           │   ├── Header
│           │   ├── Navigation
│           │   └── PageContainer
│           │       ├── IdentityCard
│           │       ├── SystemList
│           │       └── TodayPreview
│           │
│           ├── DailyPage
│           │   ├── DailyScreen
│           │   │   ├── HardThingInput
│           │   │   ├── HabitList
│           │   │   │   └── HabitCheckbox (multiple)
│           │   │   └── ReflectionPrompt
│           │   └── DayCompleteModal
│           │
│           ├── SystemPage
│           │   ├── SystemDetail
│           │   │   ├── SystemBuilder
│           │   │   └── HabitBuilder
│           │   └── SystemList
│           │
│           └── ProgressPage
│               ├── MetricsSummary
│               │   ├── DisciplineScore
│               │   └── StreakDisplay
│               ├── WeeklyChart
│               └── ProgressCalendar
```

---

## 📊 State Management

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Server State                         │
│              (React Query - API caching)                │
└─────────────────────────────────────────────────────────┘
                         │
                         │ sync
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Client State                         │
│              (Zustand - UI & ephemeral)                 │
└─────────────────────────────────────────────────────────┘
                         │
                         │ drives
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Form State                           │
│              (React Hook Form + Zod)                    │
└─────────────────────────────────────────────────────────┘
```

### Zustand Stores

#### `authStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  clarity_level: 'clear' | 'uncertain' | 'exploring';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      
      setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
      clearUser: () => set({ user: null, isAuthenticated: false, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
```

#### `systemStore.ts`

```typescript
import { create } from 'zustand';

interface System {
  id: number;
  name: string;
  type: string;
  adaptive_load_level: number;
  habits: Habit[];
}

interface SystemState {
  activeSystem: System | null;
  systems: System[];
  isLoading: boolean;
  
  // Actions
  setActiveSystem: (system: System | null) => void;
  setSystems: (systems: System[]) => void;
  updateSystem: (id: number, updates: Partial<System>) => void;
  addHabitToSystem: (systemId: number, habit: Habit) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  activeSystem: null,
  systems: [],
  isLoading: false,
  
  setActiveSystem: (system) => set({ activeSystem: system }),
  setSystems: (systems) => set({ systems }),
  updateSystem: (id, updates) => set((state) => ({
    systems: state.systems.map((s) => s.id === id ? { ...s, ...updates } : s),
    activeSystem: state.activeSystem?.id === id 
      ? { ...state.activeSystem, ...updates } 
      : state.activeSystem
  })),
  addHabitToSystem: (systemId, habit) => set((state) => ({
    systems: state.systems.map((s) => 
      s.id === systemId 
        ? { ...s, habits: [...s.habits, habit] }
        : s
    ),
  })),
}));
```

#### `uiStore.ts`

```typescript
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  modalOpen: boolean;
  modalContent: React.ReactNode | null;
  theme: 'dark' | 'light';
  
  // Actions
  toggleSidebar: () => void;
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  modalOpen: false,
  modalContent: null,
  theme: 'dark',
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (content) => set({ modalOpen: true, modalContent: content }),
  closeModal: () => set({ modalOpen: false, modalContent: null }),
  setTheme: (theme) => set({ theme }),
}));
```

---

## 🔌 API Client (`lib/api.ts`)

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For refresh token cookie
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt refresh
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        // Store new token
        setAccessToken(data.data.access_token);
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout
        useAuthStore.getState().clearUser();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Token management (in memory)
let accessToken: string | null = null;

const getAccessToken = () => accessToken;
const setAccessToken = (token: string) => { accessToken = token; };

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; clarity_level?: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  logout: () => api.post('/auth/logout'),
  
  me: () => api.get('/auth/me'),
};

// Identity API
export const identityAPI = {
  get: () => api.get('/identity'),
  create: (data: { title: string; archetype?: string }) =>
    api.post('/identity', data),
  suggest: (data: { interests: string[]; current_situation: string; goals: string[] }) =>
    api.post('/identity/suggest', data),
  history: () => api.get('/identity/history'),
};

// Systems API
export const systemsAPI = {
  list: (params?: { status?: string; type?: string }) =>
    api.get('/systems', { params }),
  get: (id: number) => api.get(`/systems/${id}`),
  create: (data: { name: string; type: string; habits?: any[] }) =>
    api.post('/systems', data),
  update: (id: number, data: any) => api.put(`/systems/${id}`, data),
  delete: (id: number) => api.delete(`/systems/${id}`),
  getToday: (id: number) => api.get(`/systems/${id}/today`),
};

// Daily API
export const dailyAPI = {
  getToday: () => api.get('/daily/today'),
  update: (id: number, data: any) => api.put(`/daily/${id}`, data),
  completeHabit: (logId: number, habitId: number) =>
    api.post(`/daily/${logId}/habits/${habitId}/complete`),
  completeDay: (id: number, data: any) => api.post(`/daily/${id}/complete`),
  history: (params?: { start_date?: string; end_date?: string; limit?: number }) =>
    api.get('/daily/history', { params }),
};

// Metrics API
export const metricsAPI = {
  summary: () => api.get('/metrics/summary'),
  weekly: (weeks?: number) => api.get('/metrics/weekly', { params: { weeks } }),
  streak: () => api.get('/metrics/streak'),
};

export default api;
```

---

## 📄 TypeScript Types (`types/domain.ts`)

```typescript
// User & Auth
export interface User {
  id: number;
  email: string;
  clarity_level: ClarityLevel;
  created_at: string;
  updated_at: string;
}

export type ClarityLevel = 'clear' | 'uncertain' | 'exploring';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// Identity
export interface Identity {
  id: number;
  user_id: number;
  title: string;
  archetype: Archetype | null;
  is_active: boolean;
  created_at: string;
}

export type Archetype = 'rebuilder' | 'explorer' | 'striver' | 'builder';

// Systems
export interface System {
  id: number;
  user_id: number;
  identity_id: number | null;
  name: string;
  type: SystemType;
  duration_days: number;
  adaptive_load_level: number;
  is_active: boolean;
  start_date: string | null;
  created_at: string;
  habits?: Habit[];
  stats?: SystemStats;
}

export type SystemType = 'fitness' | 'career' | 'skill' | 'income' | 'general';

export interface Habit {
  id: number;
  system_id: number;
  name: string;
  type: HabitType;
  frequency: Frequency;
  order_priority: number;
  is_active: boolean;
  created_at: string;
  completed?: boolean;
  completed_at?: string;
}

export type HabitType = 'keystone' | 'supporting' | 'hard_thing';
export type Frequency = 'daily' | 'weekly' | 'custom';

export interface SystemStats {
  total_days: number;
  completed_days: number;
  current_streak: number;
  best_streak: number;
  overall_completion_rate: number;
}

// Daily Logs
export interface DailyLog {
  id: number;
  user_id: number;
  system_id: number | null;
  date: string;
  hard_thing: string | null;
  hard_thing_completed: boolean;
  habits_completed: number;
  habits_total: number;
  reflection_prompt: string | null;
  reflection_response: string | null;
  mood_score: number | null;
  energy_score: number | null;
  created_at: string;
  updated_at: string;
}

// Metrics
export interface UserMetrics {
  id: number;
  user_id: number;
  date: string;
  discipline_score: number;
  consistency_rate: number;
  hard_thing_rate: number;
  recovery_rate: number;
  streak_current: number;
  streak_best: number;
  created_at: string;
}

export interface MetricsSummary {
  discipline_score: number;
  consistency_rate: number;
  hard_thing_rate: number;
  recovery_rate: number;
  streak_current: number;
  streak_best: number;
  total_days_tracked: number;
  total_hard_things_completed: number;
  total_habits_completed: number;
  average_mood: number;
  average_energy: number;
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
```

---

## 🎯 Key Component Implementations

### `DailyScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyAPI } from '@/lib/api';
import { DailyLog, Habit } from '@/types';
import { HardThingInput } from './HardThingInput';
import { HabitList } from './HabitList';
import { ReflectionPrompt } from './ReflectionPrompt';
import { DayCompleteModal } from './DayCompleteModal';

export function DailyScreen() {
  const queryClient = useQueryClient();
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Fetch today's log
  const { data: dailyLog, isLoading } = useQuery({
    queryKey: ['daily', 'today'],
    queryFn: () => dailyAPI.getToday().then((res) => res.data.data),
  });

  // Update daily log mutation
  const updateLogMutation = useMutation({
    mutationFn: (data: Partial<DailyLog>) =>
      dailyAPI.update(dailyLog!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily'] });
    },
  });

  // Complete habit mutation
  const completeHabitMutation = useMutation({
    mutationFn: ({ habitId, completed }: { habitId: number; completed: boolean }) =>
      dailyAPI.completeHabit(dailyLog!.id, habitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily'] });
    },
  });

  // Handle day completion
  const handleCompleteDay = (data: { reflection_response: string; mood_score: number; energy_score: number }) => {
    updateLogMutation.mutate(data, {
      onSuccess: () => setShowCompleteModal(true),
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Identity Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Today as a {identity?.title}
        </h1>
        <p className="text-gray-400">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Hard Thing Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">💀</span>
          Hard Thing
        </h2>
        <HardThingInput
          value={dailyLog?.hard_thing || ''}
          completed={dailyLog?.hard_thing_completed || false}
          onChange={(hard_thing) => updateLogMutation.mutate({ hard_thing })}
          onToggleComplete={() => 
            updateLogMutation.mutate({ 
              hard_thing_completed: !dailyLog?.hard_thing_completed 
            })
          }
        />
      </section>

      {/* Habits Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🔁</span>
          System Habits
        </h2>
        <HabitList
          habits={dailyLog?.habits || []}
          onToggleComplete={(habitId, completed) => 
            completeHabitMutation.mutate({ habitId, completed })
          }
        />
      </section>

      {/* Reflection Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📓</span>
          Reflection
        </h2>
        <ReflectionPrompt
          prompt={dailyLog?.reflection_prompt || ''}
          value={dailyLog?.reflection_response || ''}
          onChange={(reflection_response) => 
            updateLogMutation.mutate({ reflection_response })
          }
        />
      </section>

      {/* Complete Day Button */}
      <button
        onClick={() => handleCompleteDay({
          reflection_response: dailyLog?.reflection_response || '',
          mood_score: dailyLog?.mood_score || 3,
          energy_score: dailyLog?.energy_score || 3,
        })}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
      >
        Complete Day
      </button>

      {/* Success Modal */}
      {showCompleteModal && (
        <DayCompleteModal
          metrics={{
            habitsCompleted: dailyLog?.habits_completed || 0,
            hardThingDone: dailyLog?.hard_thing_completed || false,
          }}
          onClose={() => setShowCompleteModal(false)}
        />
      )}
    </div>
  );
}
```

### `HardThingInput.tsx`

```typescript
import React, { useState } from 'react';

interface HardThingInputProps {
  value: string;
  completed: boolean;
  onChange: (value: string) => void;
  onToggleComplete: () => void;
}

export function HardThingInput({ 
  value, 
  completed, 
  onChange, 
  onToggleComplete 
}: HardThingInputProps) {
  const [isEditing, setIsEditing] = useState(!value);

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      {/* Question Prompt */}
      <p className="text-gray-400 text-sm mb-4">
        What uncomfortable action moves your life forward today?
      </p>

      {isEditing ? (
        <div className="space-y-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g., Apply to 3 jobs, Have difficult conversation, Start the project..."
            className="w-full bg-gray-800 text-white rounded-lg p-4 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            rows={3}
            autoFocus
            onBlur={() => setIsEditing(!value)}
          />
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <button
            onClick={onToggleComplete}
            className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
              completed
                ? 'bg-green-600 border-green-600'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            {completed && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1">
            <p className={`text-lg ${completed ? 'text-gray-500 line-through' : 'text-white'}`}>
              {value}
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-500 hover:text-gray-400 text-sm mt-2"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### `DisciplineScore.tsx`

```typescript
import React from 'react';

interface DisciplineScoreProps {
  score: number; // 0-100
  trend?: 'up' | 'down' | 'stable';
}

export function DisciplineScore({ score, trend = 'stable' }: DisciplineScoreProps) {
  // Calculate color based on score
  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStrokeColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#3B82F6';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  // SVG circle calculations
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      {/* Circular Progress */}
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#1F2937"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={getStrokeColor(score)}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        
        {/* Score in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${getColor(score)}`}>
            {score}
          </span>
          <span className="text-gray-500 text-sm">Discipline</span>
        </div>
      </div>

      {/* Trend indicator */}
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {trend === 'up' && (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          )}
          {trend === 'down' && (
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          )}
          <span className={`text-sm ${
            trend === 'up' ? 'text-green-500' : 
            trend === 'down' ? 'text-red-500' : 'text-gray-500'
          }`}>
            {trend === 'up' ? '+5% from last week' : 
             trend === 'down' ? '-3% from last week' : 'No change'}
          </span>
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 Tailwind Configuration

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0B',
        surface: '#141416',
        'surface-light': '#1E1E22',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
```

---

## 📋 Next Steps

1. **[Deployment Guide](./05-DEPLOYMENT_GUIDE.md)** — Environment setup, CI/CD, monitoring
2. **Implementation** — Start building with the foundation docs as reference

**Last Updated:** 2026-02-23
