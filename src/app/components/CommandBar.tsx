import { useCourses } from '@/db/planner/queries/courseQueries'
import { useAllEvents } from '@/db/planner/queries/eventQueries'
import { useActiveHabits } from '@/db/planner/queries/habitQueries'
import { useRecentCompletions } from '@/db/planner/queries/statsQueries'
import { useAllTasksForSearch } from '@/db/planner/queries/taskQueries'
import { useActiveActivities } from '@/db/time-tracking/queries/activityQueries'
import { useSessionsByDateRange } from '@/db/time-tracking/queries/sessionQueries'
import { useI18n, useTranslation } from '@/i18n'
import { useSettingsStore } from '@/modules/settings/store/settingsStore'
import { startTimer } from '@/modules/tracker/lib/timerService'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
    Bot,
    Clock3,
    Search,
    TimerReset,
    X,
} from 'lucide-react'

function Youtube({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
    )
}
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'

type SearchSection = 'recent' | 'courses' | 'tasks' | 'activities' | 'habits' | 'calendar'

interface SearchResult {
    id: string
    section: SearchSection
    type: 'recent-session' | 'recent-task' | 'course' | 'unit' | 'task' | 'activity' | 'habit' | 'event'
    title: string
    subtitle?: string
    href?: string
    color?: string
    onSelect?: () => void | Promise<void>
}

const ACTION_SPRING = {
    type: 'spring',
    stiffness: 280,
    damping: 26,
    mass: 0.4,
} as const

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    )
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatElapsedMinutes(totalSec: number): string {
    const totalMinutes = Math.max(1, Math.round(totalSec / 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours === 0) {
        return `${totalMinutes}dk`
    }

    if (minutes === 0) {
        return `${hours}s`
    }

    return `${hours}s ${minutes}dk`
}

function formatRelativeDayLabel(timestamp: number, locale: string, todayLabel: string, yesterdayLabel: string): string {
    const target = new Date(timestamp)
    const today = new Date()
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const diffDays = Math.round((todayDay - targetDay) / 86400000)

    if (diffDays === 0) {
        return todayLabel.toLowerCase()
    }

    if (diffDays === 1) {
        return yesterdayLabel.toLowerCase()
    }

    return target.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).toLowerCase()
}

function highlightText(text: string, query: string) {
    const trimmed = query.trim()
    if (!trimmed) {
        return text
    }

    return text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'gi')).map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase()
            ? (
                <mark
                    key={`${part}-${index}`}
                    className="rounded px-0.5 text-status-blue"
                >
                    {part}
                </mark>
            )
            : part
    )
}

// ─── Outer component ────────────────────────────────────────────────────────
// Keeps: Zustand subscriptions, activities (for timer), all action handlers,
//        topResult state (updated by inner), and the input bar rendering.
export const CommandBar = memo(function CommandBar() {
    const tCommon = useTranslation('common')
    const tTracker = useTranslation('tracker')
    const { locale } = useI18n()
    const navigate = useNavigate()
    const shouldReduceMotion = useReducedMotion()
    const commandBarPrefixEnabled = useSettingsStore(state => state.commandBarPrefixEnabled)

    // Dexie — kept here because timer action buttons need activities even when dropdown is closed
    const activities = useActiveActivities()

    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    // Propagated upward from CommandBarResults so Enter/Tab work without re-mounting
    const [topResult, setTopResult] = useState<SearchResult | undefined>()
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const closePalette = useCallback(() => {
        setOpen(false)
        setQuery('')
        setTopResult(undefined)
    }, [])

    useEffect(() => {
        function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setOpen(true)
                inputRef.current?.focus()
            }

            if (event.key === 'Escape') {
                setOpen(false)
            }
        }

        window.addEventListener('keydown', handleWindowKeyDown)
        return () => window.removeEventListener('keydown', handleWindowKeyDown)
    }, [])

    useEffect(() => {
        function handleDocumentClick(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleDocumentClick)
        return () => document.removeEventListener('mousedown', handleDocumentClick)
    }, [])

    const handleExternalSearch = useCallback((engine: 'google' | 'youtube' | 'chatgpt') => {
        const trimmed = query.trim()
        if (!trimmed) {
            return
        }

        const urls = {
            google: `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`,
            youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`,
            chatgpt: `https://chat.openai.com/?q=${encodeURIComponent(trimmed)}`,
        }

        window.open(urls[engine], '_blank', 'noopener,noreferrer')
        closePalette()
    }, [closePalette, query])

    const handleTimerAction = useCallback(async () => {
        const trimmed = query.trim().toLowerCase()
        if (!trimmed) {
            navigate('/tracker')
            setOpen(false)
            return
        }

        const matchingActivity = activities.find(activity => activity.name.toLowerCase().includes(trimmed))
        if (matchingActivity) {
            await startTimer(matchingActivity.id)
            closePalette()
            navigate('/tracker')
            return
        }

        navigate('/tracker/activities')
        setOpen(false)
    }, [activities, closePalette, navigate, query])

    const handlePrefixCommand = useCallback(async (rawInput: string) => {
        const normalizedInput = rawInput.trim()
        if (!commandBarPrefixEnabled || !normalizedInput) {
            return false
        }

        if (normalizedInput.startsWith('/timer ')) {
            const name = normalizedInput.slice(7).trim().toLowerCase()
            const match = activities.find(activity => activity.name.toLowerCase().includes(name))
            if (match) {
                await startTimer(match.id)
                navigate('/tracker')
            }
            closePalette()
            return true
        }

        if (normalizedInput === '/ekle görev') {
            navigate('/planner/tasks', { state: { openCreate: true } })
            closePalette()
            return true
        }

        if (normalizedInput === '/ekle ders') {
            navigate('/planner/courses', { state: { openCreate: true } })
            closePalette()
            return true
        }

        if (normalizedInput === '/ekle alışkanlık') {
            navigate('/habits', { state: { openCreate: true } })
            closePalette()
            return true
        }

        const externalPrefixes: Record<string, string> = {
            'g:': 'https://www.google.com/search?q=',
            'yt:': 'https://www.youtube.com/results?search_query=',
            'gpt:': 'https://chat.openai.com/?q=',
        }

        for (const [prefix, baseUrl] of Object.entries(externalPrefixes)) {
            if (normalizedInput.startsWith(prefix)) {
                const searchTerm = normalizedInput.slice(prefix.length).trim()
                window.open(`${baseUrl}${encodeURIComponent(searchTerm)}`, '_blank', 'noopener,noreferrer')
                closePalette()
                return true
            }
        }

        return false
    }, [activities, closePalette, commandBarPrefixEnabled, navigate])

    const handleResultSelection = useCallback(async (result: SearchResult) => {
        if (result.onSelect) {
            await result.onSelect()
        }

        if (result.href) {
            navigate(result.href)
        }

        closePalette()
    }, [closePalette, navigate])

    const handleSubmit = useCallback(async () => {
        const handledPrefix = await handlePrefixCommand(query)
        if (handledPrefix) {
            return
        }

        if (topResult) {
            await handleResultSelection(topResult)
        }
    }, [handlePrefixCommand, handleResultSelection, query, topResult])

    const handleKeyDown = useCallback(async (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            await handleSubmit()
        }

        if (event.key === 'Tab' && topResult) {
            event.preventDefault()
            setQuery(topResult.title)
        }
    }, [handleSubmit, topResult])

    const hasQuery = query.trim().length > 0

    return (
        <div ref={containerRef} data-onboarding-target="command-bar" className="relative flex-1">
            <div className="flex min-h-[44px] items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-surface-100 px-4 transition-colors focus-within:border-[var(--border-strong)] focus-within:bg-surface-100">
                <Search className="h-4 w-4 shrink-0 text-text-muted" />
                <input
                    ref={inputRef}
                    data-global-search-input="true"
                    type="text"
                    value={query}
                    onChange={event => {
                        setQuery(event.target.value)
                        setOpen(true)
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={tCommon('commandBar.placeholder')}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                    aria-label={tCommon('commandBar.ariaLabel')}
                />

                <AnimatePresence initial={false}>
                    {hasQuery ? (
                        <motion.div
                            key="actions"
                            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 }}
                            transition={shouldReduceMotion ? { duration: 0 } : ACTION_SPRING}
                            className="flex items-center gap-1"
                        >
                            <CommandBarActionButton
                                label={tCommon('commandBar.search')}
                                icon={<Search className="h-3.5 w-3.5" />}
                                onClick={() => void handleSubmit()}
                            />
                            <CommandBarActionButton
                                label={tCommon('commandBar.timer')}
                                icon={<TimerReset className="h-3.5 w-3.5" />}
                                onClick={() => void handleTimerAction()}
                            />
                            <CommandBarActionButton
                                label="Google"
                                icon={<GoogleIcon className="h-3.5 w-3.5" />}
                                onClick={() => handleExternalSearch('google')}
                            />
                            <CommandBarActionButton
                                label={tCommon('commandBar.youtube')}
                                icon={<Youtube className="h-3.5 w-3.5" />}
                                onClick={() => handleExternalSearch('youtube')}
                            />
                            <CommandBarActionButton
                                label={tCommon('commandBar.chatgpt')}
                                icon={<Bot className="h-3.5 w-3.5" />}
                                onClick={() => handleExternalSearch('chatgpt')}
                            />
                            <button
                                type="button"
                                onClick={closePalette}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-200 hover:text-text-primary"
                                aria-label={tCommon('common.close')}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </motion.div>
                    ) : (
                        <span className="hidden text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted sm:block">
                            {commandBarPrefixEnabled ? '/timer' : 'Ctrl+K'}
                        </span>
                    )}
                </AnimatePresence>
            </div>

            {/*
             * CommandBarResults mounts only when open.
             * This frees the useActiveHabits and useSessionsByDateRange Dexie
             * subscriptions whenever the palette is closed.
             */}
            <AnimatePresence>
                {open && (
                    <CommandBarResults
                        key="cb-results"
                        query={query}
                        activities={activities}
                        locale={locale}
                        tCommon={tCommon}
                        tTracker={tTracker}
                        shouldReduceMotion={shouldReduceMotion}
                        onResultSelect={handleResultSelection}
                        onTopResultChange={setTopResult}
                    />
                )}
            </AnimatePresence>
        </div>
    )
})

// ─── Inner component ─────────────────────────────────────────────────────────
// Only mounted when the palette is open.  Dexie subscriptions live here so
// they are automatically freed when the palette closes.

interface CommandBarResultsProps {
    query: string
    activities: Array<{ id: string; name: string }>
    locale: string
    tCommon: (key: string, params?: Record<string, string | number>) => string
    tTracker: (key: string, params?: Record<string, string | number>) => string
    shouldReduceMotion: boolean | null
    onResultSelect: (result: SearchResult) => Promise<void>
    onTopResultChange: (result: SearchResult | undefined) => void
}

function CommandBarResults({
    query,
    activities,
    locale,
    tCommon,
    tTracker,
    shouldReduceMotion,
    onResultSelect,
    onTopResultChange,
}: CommandBarResultsProps) {
    // Dexie subscriptions — only active while palette is open
    const courses = useCourses()
    const events = useAllEvents()
    const allTasksForSearch = useAllTasksForSearch()
    const recentCompletions = useRecentCompletions(4)
    const plannerHabits = useActiveHabits()
    const recentWindowEnd = useMemo(() => new Date().toISOString().slice(0, 10), [])
    const recentWindowStart = useMemo(() => {
        const date = new Date()
        date.setDate(date.getDate() - 6)
        return date.toISOString().slice(0, 10)
    }, [])
    const recentSessions = useSessionsByDateRange(recentWindowStart, recentWindowEnd)

    // O(1) lookups
    const activityMap = useMemo(
        () => new Map(activities.map(activity => [activity.id, activity])),
        [activities]
    )

    // O(1) course lookup for event subtitles (Phase 3.3)
    const courseById = useMemo(
        () => new Map(courses.map(c => [c.id, c])),
        [courses]
    )

    const recentActions = useMemo<SearchResult[]>(() => {
        const recentSessionResults = [...recentSessions]
            .sort((left, right) => right.endAt - left.endAt)
            .slice(0, 2)
            .map<SearchResult>(session => {
                const activity = activityMap.get(session.activityId)
                return {
                    id: `session-${session.id}`,
                    section: 'recent' as const,
                    type: 'recent-session' as const,
                    title: activity?.name ?? tTracker('suggestion.unknownActivity'),
                    subtitle: `${formatRelativeDayLabel(session.endAt, locale, tCommon('common.today'), tCommon('common.yesterday'))}, ${formatElapsedMinutes(session.durationSec)}`,
                    href: '/tracker/records',
                }
            })

        const recentTaskResults = recentCompletions
            .slice(0, 2)
            .reduce<SearchResult[]>((results, { taskId, completedAt }) => {
                const match = allTasksForSearch.find(entry => entry.task.id === taskId)
                if (!match) {
                    return results
                }

                results.push({
                    id: `task-${taskId}`,
                    section: 'recent' as const,
                    type: 'recent-task' as const,
                    title: match.task.text,
                    subtitle: `${formatRelativeDayLabel(new Date(completedAt).getTime(), locale, tCommon('common.today'), tCommon('common.yesterday'))}, ${match.course.title}`,
                    href: `/planner/courses/${match.course.id}`,
                    color: match.course.color,
                })

                return results
            }, [])

        return [...recentSessionResults, ...recentTaskResults].slice(0, 4)
    }, [activityMap, allTasksForSearch, locale, recentCompletions, recentSessions, tCommon, tTracker])

    const searchResults = useMemo<SearchResult[]>(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (normalizedQuery.length < 2) {
            return []
        }

        const output: SearchResult[] = []

        for (const course of courses) {
            if (course.title.toLowerCase().includes(normalizedQuery) || course.code?.toLowerCase().includes(normalizedQuery)) {
                output.push({
                    id: `course-${course.id}`,
                    section: 'courses',
                    type: 'course',
                    title: course.title,
                    subtitle: course.code,
                    href: `/planner/courses/${course.id}`,
                    color: course.color,
                })
            }
        }

        const seenUnitIds = new Set<string>()
        for (const entry of allTasksForSearch) {
            if (!seenUnitIds.has(entry.unit.id) && entry.unit.title.toLowerCase().includes(normalizedQuery)) {
                seenUnitIds.add(entry.unit.id)
                output.push({
                    id: `unit-${entry.unit.id}`,
                    section: 'courses',
                    type: 'unit',
                    title: entry.unit.title,
                    subtitle: entry.course.title,
                    href: `/planner/courses/${entry.course.id}`,
                    color: entry.course.color,
                })
            }
            if (entry.task.text.toLowerCase().includes(normalizedQuery)) {
                output.push({
                    id: `planner-task-${entry.task.id}`,
                    section: 'tasks',
                    type: 'task',
                    title: entry.task.text,
                    subtitle: `${entry.course.title} • ${entry.unit.title}`,
                    href: `/planner/courses/${entry.course.id}`,
                    color: entry.course.color,
                })
            }
        }

        for (const activity of activities) {
            if (activity.name.toLowerCase().includes(normalizedQuery)) {
                output.push({
                    id: `activity-${activity.id}`,
                    section: 'activities',
                    type: 'activity',
                    title: activity.name,
                    subtitle: tTracker('nav.tracker'),
                    href: '/tracker',
                    onSelect: () => startTimer(activity.id),
                })
            }
        }

        for (const habit of plannerHabits ?? []) {
            if (habit.title.toLowerCase().includes(normalizedQuery)) {
                output.push({
                    id: `habit-${habit.id}`,
                    section: 'habits',
                    type: 'habit',
                    title: habit.title,
                    subtitle: tCommon('navigation.habits'),
                    href: `/habits/${habit.id}`,
                    color: habit.color,
                })
            }
        }

        for (const event of events) {
            if (event.title.toLowerCase().includes(normalizedQuery)) {
                // O(1) course lookup instead of courses.find()
                const course = event.courseId ? courseById.get(event.courseId) : undefined
                output.push({
                    id: `event-${event.id}`,
                    section: 'calendar',
                    type: 'event',
                    title: event.title,
                    subtitle: course ? `${course.title} • ${event.dateISO}` : event.dateISO,
                    href: '/calendar',
                    color: course?.color ?? event.color,
                })
            }
        }

        return output.slice(0, 16)
    }, [activities, allTasksForSearch, courseById, courses, events, plannerHabits, query, tCommon, tTracker])

    const visibleSections = useMemo(() => {
        const sectionMap = new Map<SearchSection, SearchResult[]>()
        const baseResults = query.trim().length >= 2 ? searchResults : recentActions

        for (const result of baseResults) {
            if (!sectionMap.has(result.section)) {
                sectionMap.set(result.section, [])
            }
            sectionMap.get(result.section)?.push(result)
        }

        return sectionMap
    }, [query, recentActions, searchResults])

    const topResult = useMemo(
        () => Array.from(visibleSections.values())[0]?.[0],
        [visibleSections]
    )

    // Propagate topResult to outer so Enter/Tab work without keeping data in parent
    useEffect(() => {
        onTopResultChange(topResult)
    }, [topResult, onTopResultChange])

    const sectionLabels = useMemo<Record<SearchSection, string>>(() => ({
        recent: tCommon('commandBar.recentActions'),
        courses: tCommon('commandBar.coursesUnits'),
        tasks: tCommon('commandBar.tasks'),
        activities: tCommon('commandBar.activities'),
        habits: tCommon('commandBar.habits'),
        calendar: tCommon('commandBar.calendarEvents'),
    }), [tCommon])

    // Always render the motion.div so AnimatePresence can handle exit animation.
    // Render nothing inside when there are no sections.
    return (
            <motion.div
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10, scale: shouldReduceMotion ? 1 : 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 10, scale: shouldReduceMotion ? 1 : 0.98 }}
                transition={shouldReduceMotion ? { duration: 0.1 } : { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute inset-x-0 top-[calc(100%+0.65rem)] z-[80] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-surface-100 shadow-[var(--shadow-card-elevated)]"
            >
            {visibleSections.size > 0 && (
                <div className="max-h-[24rem] overflow-y-auto py-2">
                    {Array.from(visibleSections.entries()).map(([section, items]) => (
                        <div key={section}>
                            <p className="px-4 pb-1 pt-3 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-text-muted">
                                {sectionLabels[section]}
                            </p>
                            <div className="space-y-0.5 px-2 pb-1">
                                {items.map(result => (
                                    <button
                                        key={result.id}
                                        type="button"
                                        onClick={() => void onResultSelect(result)}
                                        className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left transition-colors hover:bg-surface-200"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-200 text-text-secondary">
                                            {result.type === 'recent-session' ? (
                                                <Clock3 className="h-4 w-4" />
                                            ) : result.type === 'activity' ? (
                                                <TimerReset className="h-4 w-4" />
                                            ) : (
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: result.color ?? 'var(--status-blue)' }}
                                                />
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-text-primary">
                                                {highlightText(result.title, query)}
                                            </p>
                                            {result.subtitle && (
                                                <p className="truncate text-xs text-text-muted">
                                                    {result.subtitle}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    )
}

interface CommandBarActionButtonProps {
    label: string
    icon: ReactNode
    onClick: () => void
}

function CommandBarActionButton({ label, icon, onClick }: CommandBarActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-surface-100 px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-200 hover:text-text-primary"
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}
