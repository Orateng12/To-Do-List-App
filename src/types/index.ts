/**
 * TaskMaster Pro - Core Type Definitions
 * ========================================
 * Complete type safety for the entire application
 */

// ============================================
// TASK TYPES
// ============================================

export type TaskId = string;
export type SubtaskId = string;
export type CategoryId = string;
export type EventId = string;

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';
export type Theme = 'light' | 'dark' | 'system';

export interface Subtask {
  id: SubtaskId;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface Task {
  id: TaskId;
  text: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  recurrence: RecurrencePattern;
  categories: CategoryId[];
  tags: string[];
  subtasks: Subtask[];
  notes?: string;
  attachments?: Attachment[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // Metadata
  version: number;
  createdBy?: string;
  assignedTo?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
}

// ============================================
// CATEGORY TYPES
// ============================================

export interface Category {
  id: CategoryId;
  name: string;
  color: string;
  icon?: string;
  parentId?: CategoryId;
  createdAt: string;
  taskCount?: number;
}

// ============================================
// EVENT SOURCING TYPES
// ============================================

export type EventType = 
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'TASK_COMPLETED'
  | 'TASK_UNDONE'
  | 'SUBTASK_ADDED'
  | 'SUBTASK_COMPLETED'
  | 'SUBTASK_DELETED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_DELETED'
  | 'SETTINGS_CHANGED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'DATA_EXPORTED'
  | 'DATA_IMPORTED'
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED';

export interface DomainEvent {
  id: EventId;
  type: EventType;
  aggregateId: TaskId | CategoryId;
  aggregateType: 'Task' | 'Category' | 'Settings' | 'User';
  payload: Record<string, unknown>;
  metadata: EventMetadata;
  timestamp: string;
  version: number;
  signature?: string; // For encryption verification
}

export interface EventMetadata {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  causationId?: EventId;
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
  clientId?: string;
  sequence?: number;
}

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  getEvents(aggregateId: string): Promise<DomainEvent[]>;
  getEventsSince(timestamp: string): Promise<DomainEvent[]>;
  getAllEvents(): Promise<DomainEvent[]>;
  clear(): Promise<void>;
}

// ============================================
// CQRS TYPES
// ============================================

export interface Command<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload: T;
  metadata: CommandMetadata;
  timestamp: string;
}

export interface CommandMetadata {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  transactionId?: string;
}

export interface Query<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload?: T;
}

export type CommandHandler<T = Record<string, unknown>, R = void> = (command: Command<T>) => Promise<R>;
export type QueryHandler<T = Record<string, unknown>, R = unknown> = (query: Query<T>) => Promise<R>;

// ============================================
// STATE TYPES
// ============================================

export interface AppState {
  tasks: Map<TaskId, Task>;
  categories: Map<CategoryId, Category>;
  settings: AppSettings;
  ui: UIState;
  sync: SyncState;
}

export interface AppSettings {
  theme: Theme;
  defaultPriority: Priority;
  defaultRecurrence: RecurrencePattern;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  timezone: string;
  weekStartsOn: 'sunday' | 'monday';
  dateFormat: string;
  timeFormat: '12h' | '24h';
  encryptionEnabled: boolean;
  encryptionKey?: string; // Encrypted in storage
}

export interface UIState {
  currentFilter: FilterType;
  searchQuery: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  selectedTaskId?: TaskId;
  sidebarOpen: boolean;
  activeModal?: ModalType;
  viewMode: 'list' | 'kanban' | 'calendar';
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncAt?: string;
  pendingChanges: number;
  error?: string;
}

export type FilterType = 'all' | 'active' | 'completed' | 'today' | 'upcoming' | 'overdue';
export type SortField = 'createdAt' | 'dueDate' | 'priority' | 'alphabetical' | 'completedAt';
export type ModalType = 'taskEdit' | 'taskCreate' | 'settings' | 'categoryEdit' | 'deleteConfirm';

// ============================================
// ENCRYPTION TYPES
// ============================================

export interface EncryptedData {
  iv: string;
  data: string;
  salt?: string;
  authTag?: string;
}

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedTask {
  id: TaskId;
  encrypted: EncryptedData;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INDEXEDDB TYPES
// ============================================

export interface DBSchema {
  tasks: {
    key: TaskId;
    value: Task;
    indexes: {
      byStatus: TaskStatus;
      byDueDate: string;
      byPriority: Priority;
      byCategory: CategoryId;
      byCreatedAt: string;
    };
  };
  categories: {
    key: CategoryId;
    value: Category;
  };
  events: {
    key: EventId;
    value: DomainEvent;
    indexes: {
      byAggregateId: string;
      byTimestamp: string;
      byType: EventType;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
  encryptedTasks: {
    key: TaskId;
    value: EncryptedTask;
  };
}

// ============================================
// WEB WORKER TYPES
// ============================================

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: unknown;
  id?: string;
}

export type WorkerMessageType =
  | 'SEARCH'
  | 'FILTER'
  | 'SORT'
  | 'ANALYZE'
  | 'ENCRYPT'
  | 'DECRYPT'
  | 'COMPRESS'
  | 'DECOMPRESS';

export interface WorkerResponse {
  id?: string;
  type: WorkerMessageType;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================
// NLP TYPES
// ============================================

export interface ParsedTask {
  text: string;
  dueDate?: Date;
  priority?: Priority;
  categories?: string[];
  tags?: string[];
  estimatedMinutes?: number;
  recurrence?: RecurrencePattern;
  confidence: number;
  rawInput: string;
}

export interface NLPResult {
  parsed: ParsedTask;
  entities: NLPEntity[];
  intents: string[];
}

export interface NLPEntity {
  type: 'date' | 'time' | 'priority' | 'category' | 'duration' | 'recurrence';
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface Analytics {
  productivity: ProductivityMetrics;
  trends: TrendData;
  goals: GoalProgress[];
  heatmap: { dates: Record<string, number>; maxCount: number };
  categories: Array<{ name: string; total: number; completed: number; completionRate: number; averageCompletionTime: number }>;
  priorities: Array<{ priority: Priority; total: number; completed: number; completionRate: number; overdue: number }>;
}

export interface ProductivityMetrics {
  completionRate: number;
  averageCompletionTime: number;
  tasksCompletedToday: number;
  tasksCompletedThisWeek: number;
  tasksCompletedThisMonth: number;
  streakDays: number;
  bestDayOfWeek: string;
  worstDayOfWeek: string;
  priorityDistribution: Record<Priority, number>;
  categoryDistribution: Record<string, number>;
}

export interface TrendData {
  daily: DailyTrend[];
  weekly: WeeklyTrend[];
  monthly: MonthlyTrend[];
}

export interface DailyTrend {
  date: string;
  completed: number;
  created: number;
  overdue: number;
}

export interface WeeklyTrend {
  week: string;
  completed: number;
  completionRate: number;
}

export interface MonthlyTrend {
  month: string;
  completed: number;
  averageDaily: number;
}

export interface GoalProgress {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline?: string;
  progress: number;
  onTrack: boolean;
}

// ============================================
// TIME BLOCKING TYPES
// ============================================

export interface TimeBlock {
  id: string;
  taskId?: TaskId;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  color: string;
  completed: boolean;
  estimatedMinutes: number;
  actualMinutes?: number;
  priority: 'low' | 'medium' | 'high';
}

export interface DaySchedule {
  date: string;
  blocks: TimeBlock[];
  totalScheduled: number;
  totalAvailable: number;
  utilization: number;
}

// ============================================
// CLOUD SYNC TYPES
// ============================================

export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncAt?: string;
  pendingChanges: number;
  error?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// ============================================
// EXPORT TYPE ALIASES FOR EASE OF USE
// ============================================

export type { Task as TaskType, Category as CategoryType };
