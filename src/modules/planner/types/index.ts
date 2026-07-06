import { z } from 'zod';

// ================== PLANNER TYPES ==================

export const TaskStatusSchema = z.enum(['todo', 'in-progress', 'review', 'done', 'blocked', 'planning', 'permits-awaited']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
    id: z.string(),
    text: z.string().max(500),
    status: TaskStatusSchema,
    isPriority: z.boolean().optional(),
    startDateISO: z.string().optional(),
    dueDateISO: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    note: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const UnitSchema = z.object({
    id: z.string(),
    title: z.string().max(200),
    order: z.number(),
    tasks: z.array(TaskSchema),
});
export type Unit = z.infer<typeof UnitSchema>;

// Planner Event (exam or event)
export const PlannerEventTypeSchema = z.enum(['exam', 'event']);
export type PlannerEventType = z.infer<typeof PlannerEventTypeSchema>;

export const PlannerEventSchema = z.object({
    id: z.string(),
    type: PlannerEventTypeSchema,
    courseId: z.string().optional(),
    title: z.string().max(200),
    dateISO: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type PlannerEvent = z.infer<typeof PlannerEventSchema>;

export const CourseSchema = z.object({
    id: z.string(),
    code: z.string().optional(),
    title: z.string().max(200),
    color: z.string().optional(),
    bgGradient: z.string().optional(),
    units: z.array(UnitSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type Course = z.infer<typeof CourseSchema>;

export const LectureNoteMetaSchema = z.object({
    id: z.string(),
    courseId: z.string(),
    name: z.string(),
    fileName: z.string(),
    uploadDateISO: z.string(),
    unitTitle: z.string().optional(),
    fileSize: z.number(),
});
export type LectureNoteMeta = z.infer<typeof LectureNoteMetaSchema>;

export const CompletionStateSchema = z.object({
    completedTaskIds: z.array(z.string()),
    completionHistory: z.record(z.string(), z.string()),
});
export type CompletionState = z.infer<typeof CompletionStateSchema>;

export const UndoSnapshotSchema = z.object({
    timestamp: z.string(),
    completedTaskIds: z.array(z.string()),
    completionHistory: z.record(z.string(), z.string()),
});
export type UndoSnapshot = z.infer<typeof UndoSnapshotSchema>;

export const PersonalTaskSchema = TaskSchema;
export type PersonalTask = Task;

// ================== HABITS TYPES ==================

export const FrequencyTypeSchema = z.enum(['weeklyTarget', 'specificDays', 'everyXDays']);
export type FrequencyType = z.infer<typeof FrequencyTypeSchema>;

export const FrequencyRuleSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('weeklyTarget'),
        timesPerWeek: z.number().min(1).max(7),
    }),
    z.object({
        type: z.literal('specificDays'),
        days: z.array(z.number().min(0).max(6)),
    }),
    z.object({
        type: z.literal('everyXDays'),
        interval: z.number().min(1).max(365),
    }),
]);
export type FrequencyRule = z.infer<typeof FrequencyRuleSchema>;

export const HabitTypeSchema = z.enum(['boolean', 'numeric']);
export type HabitType = z.infer<typeof HabitTypeSchema>;

export const SortModeSchema = z.enum(['manual', 'name', 'colorGroup']);
export type SortMode = z.infer<typeof SortModeSchema>;

export const HabitSchema = z.object({
    id: z.string(),
    title: z.string().max(200),
    description: z.string().max(500).optional(),
    emoji: z.string().max(4).default('✨'),
    type: HabitTypeSchema,
    target: z.number().optional(),
    unit: z.string().optional(),
    color: z.string().optional(),
    frequency: FrequencyRuleSchema,
    sortMode: SortModeSchema.optional(),
    manualOrder: z.number().optional(),
    isArchived: z.boolean().default(false),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type Habit = z.infer<typeof HabitSchema>;

export const HabitLogSchema = z.object({
    habitId: z.string(),
    dateISO: z.string(),
    done: z.boolean().optional(),
    value: z.number().optional(),
    timestamp: z.string(),
});
export type HabitLog = z.infer<typeof HabitLogSchema>;

// ================== SETTINGS TYPES ==================

export const PomodoroSettingsSchema = z.object({
    workDuration: z.number().min(1).max(120),
    shortBreakDuration: z.number().min(1).max(60),
    longBreakDuration: z.number().min(1).max(120),
    sessionsUntilLongBreak: z.number().min(1).max(10),
    autoStartBreaks: z.boolean(),
    autoStartWork: z.boolean(),
});
export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>;

export const NotificationSettingsSchema = z.object({
    enabled: z.boolean(),
    habitReminderTime: z.string().optional(),
    examReminder: z.boolean(),
    examReminderDays: z.number().optional(),
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

export const AppSettingsSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']),
    soundEnabled: z.boolean(),
    rightPanelOpen: z.boolean(),
    language: z.enum(['tr', 'en']),
    pomodoro: PomodoroSettingsSchema,
    notifications: NotificationSettingsSchema,
    lastBackupISO: z.string().optional(),
    lastBackupWarningISO: z.string().optional(),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ================== BACKUP TYPES ==================

export const BackupDataSchema = z.object({
    version: z.string(),
    exportedAt: z.string(),
    courses: z.array(CourseSchema),
    completionState: CompletionStateSchema,
    personalTasks: z.array(PersonalTaskSchema),
    habits: z.array(HabitSchema),
    settings: AppSettingsSchema,
    lectureNotesMeta: z.array(LectureNoteMetaSchema).optional(),
});
export type BackupData = z.infer<typeof BackupDataSchema>;

// ================== UI TYPES ==================

export interface SearchResult {
    type: 'course' | 'unit' | 'task' | 'exam' | 'habit';
    id: string;
    title: string;
    subtitle?: string;
    courseId?: string;
    unitId?: string;
}

export interface DailyStats {
    date: string;
    completedTasks: number;
    totalTasks: number;
    habitsCompleted: number;
    totalHabits: number;
    pomodoroSessions: number;
}

export interface CourseProgress {
    courseId: string;
    title: string;
    totalTasks: number;
    completedTasks: number;
    percentage: number;
    color?: string;
}

export interface UpcomingExam {
    event: PlannerEvent;
    course: Course;
    daysLeft: number;
}

// ================== CONSTANTS ==================

export const LIMITS = {
    MAX_COURSES: 20,
    MAX_UNITS_PER_COURSE: 30,
    MAX_TASKS_PER_UNIT: 100,
    MAX_TASK_TEXT_LENGTH: 500,
    MAX_EVENTS: 500,
    MAX_HABITS: 50,
    MAX_PERSONAL_TASKS: 100,
    MAX_UNDO_STACK: 15,
    MAX_PDF_SIZE_MB: 50,
} as const;

export const COURSE_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#78716c', '#64748b', '#737373',
] as const;

export const HABIT_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#78716c', '#64748b', '#737373',
] as const;

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
    theme: 'system',
    soundEnabled: true,
    rightPanelOpen: true,
    language: 'tr',
    pomodoro: DEFAULT_POMODORO_SETTINGS,
    notifications: {
        enabled: false,
        habitReminderTime: '20:00',
        examReminder: true,
        examReminderDays: 3,
    },
    lastBackupISO: undefined,
    lastBackupWarningISO: undefined,
};
