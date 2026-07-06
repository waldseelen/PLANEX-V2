import { useTranslation } from '@/i18n'
import { clsx } from 'clsx'
import type { PeriodKey } from '../../types'

interface DateRangePickerProps {
    startDate: string
    endDate: string
    activePeriod: PeriodKey
    onPeriodChange: (period: PeriodKey) => void
    onCustomRange: (start: string, end: string) => void
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

export function getPeriodRange(period: PeriodKey): { start: string; end: string } {
    const now = new Date()
    const today = todayISO()

    switch (period) {
        case 'day':
            return { start: today, end: today }
        case 'week': {
            const day = now.getDay() === 0 ? 6 : now.getDay() - 1
            const start = new Date(now)
            start.setDate(now.getDate() - day)
            return { start: start.toISOString().slice(0, 10), end: today }
        }
        case 'month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            return { start: start.toISOString().slice(0, 10), end: today }
        }
        case 'year':
            return { start: `${now.getFullYear()}-01-01`, end: today }
        case 'custom':
            return { start: today, end: today }
    }
}

const PERIODS: PeriodKey[] = ['day', 'week', 'month', 'year', 'custom']

export function DateRangePicker({
    startDate,
    endDate,
    activePeriod,
    onPeriodChange,
    onCustomRange,
}: DateRangePickerProps) {
    const t = useTranslation('tracker')

    return (
        <div className="card flex flex-col gap-4 p-4">
            <div className="flex flex-wrap gap-2">
                {PERIODS.map(period => (
                    <button
                        key={period}
                        type="button"
                        onClick={() => onPeriodChange(period)}
                        className={clsx(
                            'rounded-md px-3 py-2 text-xs font-medium transition-colors',
                            activePeriod === period
                                ? 'bg-surface-300 text-text-primary'
                                : 'bg-surface-100 text-text-secondary hover:bg-surface-200 hover:text-text-primary',
                        )}
                    >
                        {t(`stats.period.${period}`)}
                    </button>
                ))}
            </div>

            {activePeriod === 'custom' && (
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] md:items-center">
                    <input
                        type="date"
                        value={startDate}
                        onChange={event => onCustomRange(event.target.value, endDate)}
                        className="input"
                    />
                    <span className="text-center text-sm text-text-muted">—</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={event => onCustomRange(startDate, event.target.value)}
                        className="input"
                    />
                </div>
            )}
        </div>
    )
}
