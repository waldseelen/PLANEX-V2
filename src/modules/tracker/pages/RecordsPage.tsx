import { useActiveActivities, useActiveCategories } from '@/db/time-tracking/queries/activityQueries'
import { deleteSession, useSessionsByDateRange } from '@/db/time-tracking/queries/sessionQueries'
import { formatDuration } from '@/db/time-tracking/queries/timerQueries'
import { useTranslations } from '@/i18n'
import { ArrowLeft, ClipboardList, Inbox } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RecordEditModal } from '../components/features/RecordEditModal'
import { RecordsFilter } from '../components/features/RecordsFilter'
import { RecordsGroupByDate } from '../components/features/RecordsGroupByDate'
import type { RecordsFilterState } from '../types'

function daysAgo(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().slice(0, 10)
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

export function RecordsPage() {
    const t = useTranslations(['common', 'tracker'])
    const [filter, setFilter] = useState<RecordsFilterState>({
        activityIds: [],
        startDate: daysAgo(6),
        endDate: todayISO(),
    })
    const [filterOpen, setFilterOpen] = useState(false)
    const [editSessionId, setEditSessionId] = useState<string | null>(null)
    const [editModalOpen, setEditModalOpen] = useState(false)

    const sessions = useSessionsByDateRange(filter.startDate, filter.endDate)
    const activities = useActiveActivities()
    const categories = useActiveCategories()

    const activityMap = useMemo(() => new Map(activities.map(activity => [activity.id, activity])), [activities])
    const categoryMap = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories])

    const filteredSessions = useMemo(() => {
        if (filter.activityIds.length === 0) {
            return sessions
        }

        const idSet = new Set(filter.activityIds)
        return sessions.filter(session => idSet.has(session.activityId))
    }, [filter.activityIds, sessions])

    const totalDuration = useMemo(
        () => filteredSessions.reduce((sum, session) => sum + session.durationSec, 0),
        [filteredSessions],
    )

    const handleEdit = useCallback((sessionId: string) => {
        setEditSessionId(sessionId)
        setEditModalOpen(true)
    }, [])

    const handleDelete = useCallback(async (sessionId: string) => {
        await deleteSession(sessionId)
    }, [])

    const handleCloseEdit = useCallback(() => {
        setEditModalOpen(false)
        setEditSessionId(null)
    }, [])

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <Link to="/tracker" className="btn-icon" aria-label={t('common', 'common.back')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-surface-200 text-text-secondary">
                        <ClipboardList className="h-4.5 w-4.5" />
                    </span>
                    <div>
                        <h1 className="text-xl font-semibold text-text-primary">{t('tracker', 'record.title')}</h1>
                        <p className="mt-1 text-sm text-text-secondary">
                            {t('tracker', 'page.recordsSummary', {
                                count: filteredSessions.length,
                                duration: formatDuration(totalDuration),
                            })}
                        </p>
                    </div>
                </div>

                <RecordsFilter
                    filter={filter}
                    onChange={setFilter}
                    isOpen={filterOpen}
                    onToggle={() => setFilterOpen(open => !open)}
                />
            </div>

            {filteredSessions.length > 0 ? (
                <RecordsGroupByDate
                    sessions={filteredSessions}
                    activityMap={activityMap}
                    categoryMap={categoryMap}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            ) : (
                <div className="card flex flex-col items-center gap-3 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-surface-100 text-text-muted">
                        <Inbox className="h-6 w-6" />
                    </span>
                    <p className="text-sm text-text-primary">{t('tracker', 'record.noRecords')}</p>
                    <p className="text-xs text-text-secondary">{t('tracker', 'page.recordsEmptyDescription')}</p>
                </div>
            )}

            <RecordEditModal sessionId={editSessionId} isOpen={editModalOpen} onClose={handleCloseEdit} />
        </div>
    )
}
