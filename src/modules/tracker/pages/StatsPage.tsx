import { useStatsForRange } from '@/db/time-tracking/queries/statsQueries'
import { formatDuration } from '@/db/time-tracking/queries/timerQueries'
import { useTranslations } from '@/i18n'
import { ArrowLeft, BarChart2, Inbox } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityPieChart } from '../components/features/ActivityPieChart'
import { DailyBarChart } from '../components/features/DailyBarChart'
import { DateRangePicker, getPeriodRange } from '../components/ui/DateRangePicker'
import { StatsSummaryCard } from '../components/ui/StatsSummaryCard'
import { TagValueBreakdown } from '../components/features/TagValueBreakdown'
import type { PeriodKey } from '../types'

export function StatsPage() {
    const t = useTranslations(['common', 'tracker'])
    const [period, setPeriod] = useState<PeriodKey>('week')
    const [dateRange, setDateRange] = useState(getPeriodRange('week'))
    const stats = useStatsForRange(dateRange.start, dateRange.end)
    const hasData = stats.totalSec > 0

    const handlePeriodChange = useCallback((next: PeriodKey) => {
        setPeriod(next)
        if (next !== 'custom') {
            setDateRange(getPeriodRange(next))
        }
    }, [])

    const handleCustomRange = useCallback((start: string, end: string) => {
        setDateRange({ start, end })
    }, [])

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
            <div className="flex items-start gap-3">
                <Link to="/tracker" className="btn-icon" aria-label={t('common', 'common.back')}>
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-surface-200 text-text-secondary">
                    <BarChart2 className="h-4.5 w-4.5" />
                </span>
                <div>
                    <h1 className="text-xl font-semibold text-text-primary">{t('tracker', 'stats.title')}</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        {hasData
                            ? t('tracker', 'page.statsSummary', { duration: formatDuration(stats.totalSec) })
                            : t('tracker', 'page.statsNoDataSummary')}
                    </p>
                </div>
            </div>

            <DateRangePicker
                startDate={dateRange.start}
                endDate={dateRange.end}
                activePeriod={period}
                onPeriodChange={handlePeriodChange}
                onCustomRange={handleCustomRange}
            />

            <TagValueBreakdown byTag={stats.byTag} />

            {hasData ? (
                <>
                    <StatsSummaryCard stats={stats} />
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <ActivityPieChart data={stats.byActivity} />
                        <DailyBarChart data={stats.byDay} />
                    </div>

                    <div className="card p-5">
                        <h3 className="text-2xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                            {t('tracker', 'page.activityDetails')}
                        </h3>
                        <div className="mt-4 flex flex-col gap-3">
                            {stats.byActivity.map((item, index) => {
                                const percent = stats.totalSec > 0
                                    ? Math.round((item.totalSec / stats.totalSec) * 100)
                                    : 0
                                const fillColor = index === 0 ? 'var(--color-accent-2)' : 'var(--color-accent)'

                                return (
                                    <div key={item.activityId} className="flex items-center gap-3">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fillColor }} />
                                        <span className="flex-1 truncate text-sm text-text-secondary">{item.activityName}</span>
                                        <span className="text-xs text-text-muted tabular-nums">{percent}%</span>
                                        <span className="font-mono text-sm tabular-nums text-text-primary">
                                            {formatDuration(item.totalSec)}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            ) : (
                <div className="card flex flex-col items-center gap-3 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-surface-100 text-text-muted">
                        <Inbox className="h-6 w-6" />
                    </span>
                    <p className="text-sm text-text-primary">{t('tracker', 'stats.noData')}</p>
                    <p className="text-xs text-text-secondary">{t('tracker', 'page.statsEmptyDescription')}</p>
                </div>
            )}
        </div>
    )
}
