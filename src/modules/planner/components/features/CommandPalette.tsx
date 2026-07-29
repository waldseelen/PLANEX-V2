import { useCoursesWithProgress } from '@/db/planner/queries/courseQueries'
import { useAllTasksForSearch } from '@/db/planner/queries/taskQueries'
import { Bot, Calendar, ListTodo, Search, Target } from 'lucide-react'

function Youtube({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
    )
}
import { useTranslation } from '@/i18n'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface LocalResult {
    type: 'course' | 'unit' | 'task'
    id: string
    title: string
    subtitle?: string
    courseId?: string
    unitId?: string
}

interface CommandItem {
    id: string
    label: string
    description?: string
    icon: React.ReactNode
    onRun: () => void
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value)
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])
    return debouncedValue
}

export function CommandPalette() {
    const t = useTranslation('planner')
    const navigate = useNavigate()
    const courses = useCoursesWithProgress()
    const allTasksForSearch = useAllTasksForSearch()
    const [query, setQuery] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const [activeEngine, setActiveEngine] = useState<'google' | 'youtube' | 'chatgpt'>('google')

    const debouncedQuery = useDebounce(query.trim(), 200)

    const quickActions = useMemo<CommandItem[]>(() => ([
        {
            id: 'new-task',
            label: t('commandPalette.actions.newTask.label'),
            description: t('commandPalette.actions.newTask.description'),
            icon: <ListTodo className="w-4 h-4 text-cyan-300" />,
            onRun: () => navigate('/planner/tasks', { state: { openCreate: true } }),
        },
        {
            id: 'open-calendar',
            label: t('commandPalette.actions.openCalendar.label'),
            description: t('commandPalette.actions.openCalendar.description'),
            icon: <Calendar className="w-4 h-4 text-purple-300" />,
            onRun: () => navigate('/calendar'),
        },
        {
            id: 'open-habits',
            label: t('commandPalette.actions.openHabits.label'),
            description: t('commandPalette.actions.openHabits.description'),
            icon: <Target className="w-4 h-4 text-orange-300" />,
            onRun: () => navigate('/habits', { state: { openCreate: true } }),
        },
    ]), [navigate, t])

    const localResults = useMemo<LocalResult[]>(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) return []
        const q = debouncedQuery.toLowerCase()
        const results: LocalResult[] = []

        courses.forEach(course => {
            if (course.title.toLowerCase().includes(q) ||
                (course.code && course.code.toLowerCase().includes(q))) {
                results.push({
                    type: 'course',
                    id: course.id,
                    title: course.title,
                    subtitle: course.code || `${course.unitCount} ${t('commandPalette.types.unit').toLowerCase()}`,
                })
            }
        })

        const seenUnitIds = new Set<string>()
        allTasksForSearch.forEach(({ task, course, unit }) => {
            if (!seenUnitIds.has(unit.id) && unit.title.toLowerCase().includes(q)) {
                seenUnitIds.add(unit.id)
                results.push({
                    type: 'unit',
                    id: unit.id,
                    title: unit.title,
                    subtitle: course.title,
                    courseId: course.id,
                })
            }

            if (task.text.toLowerCase().includes(q)) {
                results.push({
                    type: 'task',
                    id: task.id,
                    title: task.text,
                    subtitle: `${course.title} > ${unit.title}`,
                    courseId: course.id,
                    unitId: unit.id,
                })
            }
        })

        return results.slice(0, 8)
    }, [allTasksForSearch, courses, debouncedQuery, t])

    const engines = useMemo(() => ([
        {
            id: 'google' as const,
            label: 'Google',
            icon: <Search className="w-4 h-4" />,
            color: 'text-blue-300',
        },
        {
            id: 'youtube' as const,
            label: 'YouTube',
            icon: <Youtube className="w-4 h-4" />,
            color: 'text-red-300',
        },
        {
            id: 'chatgpt' as const,
            label: 'ChatGPT',
            icon: <Bot className="w-4 h-4" />,
            color: 'text-emerald-300',
        },
    ]), [])

    const runExternalSearch = useCallback((engine: 'google' | 'youtube' | 'chatgpt', value: string) => {
        const trimmed = value.trim()
        if (!trimmed) return
        const encoded = encodeURIComponent(trimmed)
        if (engine === 'google') {
            window.open(`https://www.google.com/search?q=${encoded}`, '_blank', 'noopener,noreferrer')
            return
        }
        if (engine === 'youtube') {
            window.open(`https://www.youtube.com/results?search_query=${encoded}`, '_blank', 'noopener,noreferrer')
            return
        }
        window.open(`https://chat.openai.com/?q=${encoded}`, '_blank', 'noopener,noreferrer')
    }, [])

    const showResults = isFocused && (debouncedQuery.length > 0 || localResults.length > 0)

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Tab') {
            event.preventDefault()
            const currentIndex = engines.findIndex(engine => engine.id === activeEngine)
            const next = engines[(currentIndex + 1) % engines.length]
            setActiveEngine(next.id)
            return
        }
        if (event.key === 'Enter') {
            runExternalSearch(activeEngine, query)
        }
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300">{t('commandPalette.title')}</h3>

            <div className="relative">
                <div
                    className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                        'border-white/10 bg-white/5 hover:bg-white/8 focus-within:border-cyan-400/50 focus-within:bg-white/10'
                    )}
                >
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                        placeholder={t('commandPalette.placeholder')}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-gray-400"
                        aria-label={t('commandPalette.ariaLabel')}
                    />
                    <div className="flex items-center gap-2">
                        {engines.map(engine => (
                            <button
                                key={engine.id}
                                type="button"
                                onClick={() => {
                                    setActiveEngine(engine.id)
                                    runExternalSearch(engine.id, query)
                                }}
                                className={cn(
                                    'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                                    'border-white/10 bg-white/5 hover:bg-white/10',
                                    activeEngine === engine.id && 'border-cyan-400/50 bg-white/10'
                                )}
                            >
                                <span className={engine.color}>{engine.icon}</span>
                                {engine.label}
                            </button>
                        ))}
                    </div>
                </div>

                {showResults && (
                    <div className="mt-2 space-y-3">
                        <div className="bg-[#13131a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                            <div className="px-3 py-2 border-b border-white/5 text-xs text-slate-400">
                                {debouncedQuery.length >= 2 ? t('commandPalette.results') : t('commandPalette.quickActions')}
                            </div>

                            {debouncedQuery.length < 2 && (
                                <div className="divide-y divide-white/5">
                                    {quickActions.map(action => (
                                        <button
                                            key={action.id}
                                            onClick={action.onRun}
                                            className="w-full px-4 py-3 hover:bg-white/5 transition-colors text-left flex items-start gap-3"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                                {action.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm text-white">{action.label}</p>
                                                {action.description && (
                                                    <p className="text-xs text-slate-400">{action.description}</p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {debouncedQuery.length >= 2 && (
                                <div className="divide-y divide-white/5">
                                    {localResults.map(result => (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            onClick={() => navigate(`/planner/courses/${result.courseId || result.id}`)}
                                            className="w-full px-4 py-3 hover:bg-white/5 transition-colors text-left flex items-start gap-3"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                                <Search className="w-4 h-4 text-cyan-300" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm text-white truncate">{result.title}</p>
                                                {result.subtitle && (
                                                    <p className="text-xs text-slate-400 truncate">{result.subtitle}</p>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 uppercase">
                                                {result.type === 'course'
                                                    ? t('commandPalette.types.course')
                                                    : result.type === 'unit'
                                                        ? t('commandPalette.types.unit')
                                                        : t('commandPalette.types.task')}
                                            </span>
                                        </button>
                                    ))}

                                    {localResults.length === 0 && (
                                        <div className="px-4 py-6 text-center text-sm text-slate-400">
                                            {t('commandPalette.noResults')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
