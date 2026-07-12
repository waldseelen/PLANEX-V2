/**
 * LifeFlow - Merkezi Sabitler ve Yapılandırma
 *
 * Bu dosya tüm uygulama genelinde kullanılan sabitleri ve
 * varsayılan değerleri içerir. Magic strings/numbers kullanımını önler.
 */

// ============================================
// Event Type Constants
// ============================================

export const EVENT_TYPES = {
    // Timer Events
    TIMER_STARTED: 'TIMER_STARTED',
    TIMER_STOPPED: 'TIMER_STOPPED',
    TIMER_PAUSED: 'TIMER_PAUSED',
    TIMER_RESUMED: 'TIMER_RESUMED',

    // Session Events
    SESSION_CREATED: 'SESSION_CREATED',
    SESSION_UPDATED: 'SESSION_UPDATED',
    SESSION_DELETED: 'SESSION_DELETED',
    SESSION_MERGED: 'SESSION_MERGED',

    // Habit Events
    HABIT_CHECKED: 'HABIT_CHECKED',
    HABIT_UNCHECKED: 'HABIT_UNCHECKED',
    HABIT_SKIPPED: 'HABIT_SKIPPED',
    STREAK_UPDATED: 'STREAK_UPDATED',

    // Pomodoro Events
    POMODORO_STARTED: 'POMODORO_STARTED',
    POMODORO_COMPLETED: 'POMODORO_COMPLETED',
    POMODORO_STOPPED: 'POMODORO_STOPPED',
    POMODORO_BREAK_STARTED: 'POMODORO_BREAK_STARTED',

    // Goal Events
    GOAL_PROGRESS: 'GOAL_PROGRESS',
    GOAL_REACHED: 'GOAL_REACHED',

    // System Events
    DAY_ROLLOVER: 'DAY_ROLLOVER',
    DATA_SYNCED: 'DATA_SYNCED',
    APP_INITIALIZED: 'APP_INITIALIZED',
} as const

export type EventTypeKey = keyof typeof EVENT_TYPES
export type EventTypeValue = (typeof EVENT_TYPES)[EventTypeKey]

// ============================================
// Rule Action Types
// ============================================

export const RULE_ACTIONS = {
    NOTIFY: 'NOTIFY',
    LOG_MESSAGE: 'LOG_MESSAGE',
    START_TIMER: 'START_TIMER',
    STOP_TIMER: 'STOP_TIMER',
    TRIGGER_BREAK: 'TRIGGER_BREAK',
    UPDATE_GOAL: 'UPDATE_GOAL',
    CHECK_HABIT: 'CHECK_HABIT',
} as const

export type RuleActionKey = keyof typeof RULE_ACTIONS
export type RuleActionValue = (typeof RULE_ACTIONS)[RuleActionKey]

// ============================================
// Timer Modes
// ============================================

export const TIMER_MODES = {
    NORMAL: 'normal',
    POMODORO: 'pomodoro',
} as const

export type TimerMode = (typeof TIMER_MODES)[keyof typeof TIMER_MODES]

// ============================================
// Pomodoro Phases
// ============================================

export const POMODORO_PHASES = {
    IDLE: 'idle',
    WORK: 'work',
    SHORT_BREAK: 'shortBreak',
    LONG_BREAK: 'longBreak',
} as const

export type PomodoroPhase = (typeof POMODORO_PHASES)[keyof typeof POMODORO_PHASES]

// ============================================
// Habit Log Status
// ============================================

export const HABIT_STATUS = {
    DONE: 'done',
    SKIPPED: 'skipped',
    MISSED: 'missed',
} as const

export type HabitStatus = (typeof HABIT_STATUS)[keyof typeof HABIT_STATUS]

// ============================================
// Default Application Settings
// ============================================

export const DEFAULT_SETTINGS = {
    /** Gün dönüşü saati (0-23) - Varsayılan: 04:00 */
    ROLLOVER_HOUR: 4,

    /** Hafta başlangıç günü (0: Pazar, 1: Pazartesi, ...) */
    WEEK_START: 1,

    /** Varsayılan tema */
    THEME: 'system' as const,

    /** Varsayılan dil */
    LANGUAGE: 'tr' as const,

    /** Çoklu zamanlayıcı desteği */
    MULTITASKING_ENABLED: false,

    /** Oturum birleştirme eşiği (dakika) */
    MERGE_THRESHOLD_MINUTES: 5,

    /** Event geçmişi maksimum boyutu */
    EVENT_HISTORY_SIZE: 100,
} as const

// ============================================
// Default Pomodoro Configuration
// ============================================

export const DEFAULT_POMODORO = {
    /** Çalışma süresi (saniye) - 25 dakika */
    WORK_DURATION: 25 * 60,

    /** Kısa mola süresi (saniye) - 5 dakika */
    SHORT_BREAK_DURATION: 5 * 60,

    /** Uzun mola süresi (saniye) - 15 dakika */
    LONG_BREAK_DURATION: 15 * 60,

    /** Uzun mola öncesi seans sayısı */
    SESSIONS_BEFORE_LONG_BREAK: 4,

    /** Molaları otomatik başlat */
    AUTO_START_BREAKS: true,

    /** Çalışmayı otomatik başlat */
    AUTO_START_WORK: false,
} as const

// ============================================
// UI Constants
// ============================================

export const UI_CONSTANTS = {
    /** Timer güncelleme aralığı (ms) */
    TIMER_TICK_INTERVAL: 1000,

    /** Toast gösterim süresi (ms) */
    TOAST_DURATION: 3000,

    /** Debounce gecikmesi (ms) */
    DEBOUNCE_DELAY: 300,

    /** Animasyon süresi (ms) */
    ANIMATION_DURATION: 200,

    /** Minimum dokunmatik alan boyutu (px) */
    MIN_TOUCH_TARGET: 44,

    /** Maksimum içerik genişliği (px) */
    MAX_CONTENT_WIDTH: 1200,
} as const

// ============================================
// Database Constants
// ============================================

export const DB_CONSTANTS = {
    /** Veritabanı adı */
    DB_NAME: 'LifeFlowDB',

    /** Şema versiyonu */
    SCHEMA_VERSION: 1,

    /** Varsayılan Pomodoro config ID */
    DEFAULT_POMODORO_ID: 'default-pomodoro',
} as const

// ============================================
// Notification Constants
// ============================================

export const NOTIFICATION_CONSTANTS = {
    /** Varsayılan bildirim ikonu */
    DEFAULT_ICON: '/pwa-192x192.png',

    /** Bildirim başlığı */
    DEFAULT_TITLE: 'LifeFlow Bildirimi',
} as const

// ============================================
// Validation Constants
// ============================================

export const VALIDATION = {
    /** Minimum aktivite adı uzunluğu */
    MIN_NAME_LENGTH: 1,

    /** Maksimum aktivite adı uzunluğu */
    MAX_NAME_LENGTH: 100,

    /** Minimum seans süresi (saniye) */
    MIN_SESSION_DURATION: 1,

    /** Maksimum seans süresi (saniye) - 24 saat */
    MAX_SESSION_DURATION: 24 * 60 * 60,
} as const
