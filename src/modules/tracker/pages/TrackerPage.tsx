import { useRunningTimerCount } from '@/db/time-tracking/queries/timerQueries'
import { useTranslations } from '@/i18n'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { motion } from 'framer-motion'
import { Clock3, Lightbulb, Plus, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ActivityGrid } from '../components/features/ActivityGrid'
import { PomodoroTimer } from '../components/features/PomodoroTimer'
import { RunningTimerBar } from '../components/features/RunningTimerBar'
import { getCurrentSuggestion } from '../lib/suggestionEngine'
import type { ActivitySuggestion } from '../types'

export function TrackerPage() {
    const t = useTranslations(['common', 'tracker'])
    const runningCount = useRunningTimerCount()
    const [suggestion, setSuggestion] = useState<ActivitySuggestion | null>(null)
    const [searchParams, setSearchParams] = useSearchParams()
    const isWide = useMediaQuery('(min-width: 1024px)')
    const inlinePomodoroMode = useMemo(
        () => !isWide && searchParams.get('mode') === 'pomodoro',
        [isWide, searchParams],
    )

    const requestPomodoroPanelFocus = () => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.set('mode', 'pomodoro')
            return next
        })
    }

    const disableInlinePomodoro = () => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.delete('mode')
            return next
        })
    }

    useEffect(() => {
        getCurrentSuggestion()
            .then(setSuggestion)
            .catch(() => setSuggestion(null))
    }, [])

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-surface-200 text-text-secondary">
                        <Timer className="h-4.5 w-4.5" />
                    </span>
                    <div>
                        <h1 className="text-xl font-semibold text-text-primary">{t('tracker', 'nav.tracker')}</h1>
                        <p className="mt-1 text-sm text-text-secondary">
                            {runningCount > 0
                                ? t('tracker', 'page.summaryActiveTimers', { count: runningCount })
                                : t('tracker', 'page.summarySelectActivity')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={requestPomodoroPanelFocus}
                        title={t('tracker', 'page.pomodoroMode')}
                        className={inlinePomodoroMode ? 'btn-primary gap-2' : 'btn-secondary gap-2'}
                    >
                        <Clock3 className="h-4 w-4" />
                        {t('tracker', 'page.pomodoroMode')}
                    </button>
                    <Link to="/tracker/records" className="btn-secondary">
                        {t('tracker', 'nav.records')}
                    </Link>
                    <Link to="/tracker/stats" className="btn-secondary">
                        {t('tracker', 'nav.stats')}
                    </Link>
                </div>
            </div>

            {runningCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                >
                    <RunningTimerBar />
                </motion.div>
            )}

            {!inlinePomodoroMode ? (
                <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-text-primary">{t('tracker', 'page.activities')}</h2>
                        <Link to="/tracker/activities" className="btn-secondary gap-2">
                            <Plus className="h-4 w-4" />
                            {t('tracker', 'page.newShort')}
                        </Link>
                    </div>

                    {suggestion && suggestion.confidence >= 0.5 && (
                        <div className="card flex items-center gap-3 p-4">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-status-amber/20 bg-status-amber-soft text-status-amber">
                                <Lightbulb className="h-4.5 w-4.5" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-2xs uppercase tracking-[0.12em] text-text-muted">
                                    {t('tracker', 'suggestion.hintLabel')}
                                </p>
                                <p className="truncate text-sm font-medium text-text-primary">{suggestion.activityName}</p>
                            </div>
                        </div>
                    )}

                    <ActivityGrid />
                </section>
            ) : (
                <section className="flex flex-col gap-4">
                    <PomodoroTimer />
                    <button type="button" onClick={disableInlinePomodoro} className="btn-secondary self-center">
                        {t('tracker', 'page.backToActivities')}
                    </button>
                </section>
            )}
        </div>
    )
}
