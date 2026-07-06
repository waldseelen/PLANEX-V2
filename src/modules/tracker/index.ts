/**
 * Tracker Module — Public API
 *
 * Time tracking modülünün dışa aktarım noktası.
 */

// Pages
export { ActivitiesPage } from './pages/ActivitiesPage'
export { CategoriesPage } from './pages/CategoriesPage'
export { GoalsPage } from './pages/GoalsPage'
export { RecordsPage } from './pages/RecordsPage'
export { StatsPage } from './pages/StatsPage'
export { TrackerPage } from './pages/TrackerPage'

// Components (Aşama 1)
export { ActivityCard } from './components/ui/ActivityCard'
export { ActivityGrid } from './components/features/ActivityGrid'
export { RunningTimerBar } from './components/features/RunningTimerBar'
export { TimerControls } from './components/ui/TimerControls'

// Components (Aşama 2)
export { RecordEditModal } from './components/features/RecordEditModal'
export { RecordItem } from './components/ui/RecordItem'
export { RecordsFilter } from './components/features/RecordsFilter'
export { RecordsGroupByDate } from './components/features/RecordsGroupByDate'

// Components (Aşama 3)
export { ActivityPieChart } from './components/features/ActivityPieChart'
export { DailyBarChart } from './components/features/DailyBarChart'
export { DateRangePicker } from './components/ui/DateRangePicker'
export { StatsSummaryCard } from './components/ui/StatsSummaryCard'

// Components (Aşama 4)
export { GoalCard } from './components/ui/GoalCard'
export { GoalEditModal } from './components/features/GoalEditModal'
export { GoalProgressBadge } from './components/ui/GoalProgressBadge'

// Components (Aşama 5)
export { ActivityEditModal } from './components/features/ActivityEditModal'
export { CategoryEditModal } from './components/features/CategoryEditModal'

// Store (Aşama 1)
export { useTrackerUIStore } from './store/trackerUIStore'
export type { TrackerUIState } from './store/trackerUIStore'

// Business Logic (Aşama 1)
export { pauseTimer, resumeTimer, startTimer, stopTimer } from './lib/timerService'

// Business Logic (Aşama 6)
export { fireRules, createRule, updateRule, deleteRule } from './lib/ruleEngine'
export { getCurrentSuggestion, getHourlySuggestions } from './lib/suggestionEngine'

// Domain types shared across pages/components/lib
export type { ActivitySuggestion, PeriodKey, PomodoroPhase, RecordsFilterState } from './types'

// Business Logic (Aşama 7)
export {
    startTitleTimer,
    stopTitleTimer,
    requestNotificationPermission,
    sendNotification,
    notifyGoalNearing,
    notifyGoalCompleted,
    scheduleReminder,
} from './lib/notificationService'

// Business Logic (Aşama 8)
export { exportCSV, exportJSON, downloadCSV, downloadJSON } from './lib/exportService'
