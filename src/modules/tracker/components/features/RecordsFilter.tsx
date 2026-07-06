/**
 * RecordsFilter — Filtre Paneli
 *
 * Kayıtları aktivite, tarih aralığına göre filtreler.
 * Roadmap: aktiviteId, tagIds, dateRange filtresi.
 */

import { useActiveActivities, useActivitiesGroupedByCategory } from '@/db/time-tracking/queries/activityQueries'
import { useTranslations } from '@/i18n'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Filter, RotateCcw } from 'lucide-react'
import type { RecordsFilterState } from '../../types'

interface RecordsFilterProps {
    filter: RecordsFilterState
    onChange: (filter: RecordsFilterState) => void
    isOpen: boolean
    onToggle: () => void
}

// ============================================
// Tarih yardımcıları
// ============================================

function daysAgo(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

// ============================================
// Bileşen
// ============================================

export function RecordsFilter({ filter, onChange, isOpen, onToggle }: RecordsFilterProps) {
    const t = useTranslations(['common', 'tracker'])
    const grouped = useActivitiesGroupedByCategory()
    const allActivities = useActiveActivities()

    const hasActiveFilter = filter.activityIds.length > 0

    const presetRanges = [
        { label: t('tracker', 'stats.period.day'), start: todayISO(), end: todayISO() },
        { label: t('tracker', 'filter.last7Days'), start: daysAgo(6), end: todayISO() },
        { label: t('tracker', 'filter.last30Days'), start: daysAgo(29), end: todayISO() },
        { label: t('common', 'common.thisMonth'), start: todayISO().slice(0, 8) + '01', end: todayISO() },
    ]

    function toggleActivity(activityId: string) {
        const ids = filter.activityIds.includes(activityId)
            ? filter.activityIds.filter(id => id !== activityId)
            : [...filter.activityIds, activityId]
        onChange({ ...filter, activityIds: ids })
    }

    function clearFilter() {
        onChange({ activityIds: [], startDate: daysAgo(6), endDate: todayISO() })
    }

    return (
        <div>
            {/* Toggle butonu */}
            <button
                onClick={onToggle}
                className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all',
                    hasActiveFilter || isOpen
                        ? 'bg-status-blue-soft text-status-blue border border-status-blue/20'
                        : 'bg-surface-100 text-text-secondary hover:bg-surface-200 hover:text-text-primary',
                )}
            >
                <Filter size={13} />
                {t('tracker', 'record.filter')}
                {hasActiveFilter && (
                    <span className="w-4 h-4 rounded-full bg-status-blue text-white text-[10px] font-bold flex items-center justify-center">
                        {filter.activityIds.length}
                    </span>
                )}
            </button>

            {/* Filtre panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 p-4 rounded-2xl border border-[var(--border-subtle)] bg-surface-100">
                            {/* Tarih aralığı preset'leri */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-text-secondary mb-2">
                                    {t('tracker', 'filter.dateRange')}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {presetRanges.map(preset => {
                                        const isActive = filter.startDate === preset.start && filter.endDate === preset.end
                                        return (
                                            <button
                                                key={preset.label}
                                                onClick={() => onChange({ ...filter, startDate: preset.start, endDate: preset.end })}
                                                className={clsx(
                                                    'px-3 py-1.5 rounded-lg text-xs transition-all',
                                                    isActive
                                                        ? 'bg-surface-300 text-text-primary'
                                                        : 'bg-surface-100 text-text-secondary hover:bg-surface-200',
                                                )}
                                            >
                                                {preset.label}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Özel tarih input'ları */}
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="date"
                                        value={filter.startDate}
                                        onChange={e => onChange({ ...filter, startDate: e.target.value })}
                                        className="flex-1 rounded-lg bg-surface-100 border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-[var(--border-medium)]"
                                    />
                                    <span className="text-text-muted text-xs self-center">–</span>
                                    <input
                                        type="date"
                                        value={filter.endDate}
                                        onChange={e => onChange({ ...filter, endDate: e.target.value })}
                                        className="flex-1 rounded-lg bg-surface-100 border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-[var(--border-medium)]"
                                    />
                                </div>
                            </div>

                            {/* Aktivite filtresi */}
                            {allActivities.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-2">
                                        {t('tracker', 'filter.activity')}
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                        {grouped.map(({ category, activities }) =>
                                            activities.map(activity => {
                                                const isSelected = filter.activityIds.includes(activity.id)
                                                return (
                                                    <button
                                                        key={activity.id}
                                                        onClick={() => toggleActivity(activity.id)}
                                                        className={clsx(
                                                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all',
                                                            isSelected
                                                                ? 'text-text-primary'
                                                                : 'bg-surface-100 text-text-secondary hover:bg-surface-200',
                                                        )}
                                                        style={
                                                            isSelected
                                                                ? { backgroundColor: category.color + '33', border: `1px solid ${category.color}55` }
                                                                : undefined
                                                        }
                                                    >
                                                        <span
                                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: category.color }}
                                                        />
                                                        {activity.name}
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Temizle butonu */}
                            {hasActiveFilter && (
                                <button
                                    onClick={clearFilter}
                                    className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-surface-100 transition-colors"
                                >
                                    <RotateCcw size={12} />
                                    {t('tracker', 'record.clearFilter')}
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
