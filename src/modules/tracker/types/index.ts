// ============================================
// Tracker domain types shared across pages, components, and lib
// ============================================

export interface RecordsFilterState {
    activityIds: string[]
    startDate: string   // YYYY-MM-DD
    endDate: string     // YYYY-MM-DD
}

export type PeriodKey = 'day' | 'week' | 'month' | 'year' | 'custom'

export interface ActivitySuggestion {
    activityId: string
    activityName: string
    confidence: number    // 0-1 arası
    hourOfDay: number     // 0-23
    count: number         // Bu saatte kaç kez yapılmış
}

export type PomodoroPhase = 'work' | 'break'
