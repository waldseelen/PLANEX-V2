import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import { DateTime } from 'luxon'
import { useMemo, useState } from 'react'

// ============================================
// Types
// ============================================

type PresetKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last7Days' | 'last30Days' | 'last90Days'

interface DateRange {
    start: DateTime
    end: DateTime
}

interface DateRangePickerProps {
    /** Seçili tarih aralığı */
    value: DateRange
    /** Değişim handler'ı */
    onChange: (range: DateRange) => void
    /** Önceden tanımlı aralıkları göster */
    showPresets?: boolean
    /** Gösterilecek preset'ler */
    presets?: PresetKey[]
    /** Takvimi göster */
    showCalendar?: boolean
    /** Minimum tarih */
    minDate?: DateTime | undefined
    /** Maksimum tarih */
    maxDate?: DateTime | undefined
    /** Hafta başlangıç günü (1=Pazartesi, 7=Pazar) */
    weekStartsOn?: number
    /** Ek CSS sınıfı */
    className?: string | undefined
}

// ============================================
// Presets
// ============================================

const presetConfigs: Record<PresetKey, { label: string; getRange: () => DateRange }> = {
    today: {
        label: 'Bugün',
        getRange: () => ({
            start: DateTime.now().startOf('day'),
            end: DateTime.now().endOf('day'),
        }),
    },
    yesterday: {
        label: 'Dün',
        getRange: () => ({
            start: DateTime.now().minus({ days: 1 }).startOf('day'),
            end: DateTime.now().minus({ days: 1 }).endOf('day'),
        }),
    },
    thisWeek: {
        label: 'Bu Hafta',
        getRange: () => ({
            start: DateTime.now().startOf('week'),
            end: DateTime.now().endOf('week'),
        }),
    },
    lastWeek: {
        label: 'Geçen Hafta',
        getRange: () => ({
            start: DateTime.now().minus({ weeks: 1 }).startOf('week'),
            end: DateTime.now().minus({ weeks: 1 }).endOf('week'),
        }),
    },
    thisMonth: {
        label: 'Bu Ay',
        getRange: () => ({
            start: DateTime.now().startOf('month'),
            end: DateTime.now().endOf('month'),
        }),
    },
    lastMonth: {
        label: 'Geçen Ay',
        getRange: () => ({
            start: DateTime.now().minus({ months: 1 }).startOf('month'),
            end: DateTime.now().minus({ months: 1 }).endOf('month'),
        }),
    },
    last7Days: {
        label: 'Son 7 Gün',
        getRange: () => ({
            start: DateTime.now().minus({ days: 6 }).startOf('day'),
            end: DateTime.now().endOf('day'),
        }),
    },
    last30Days: {
        label: 'Son 30 Gün',
        getRange: () => ({
            start: DateTime.now().minus({ days: 29 }).startOf('day'),
            end: DateTime.now().endOf('day'),
        }),
    },
    last90Days: {
        label: 'Son 90 Gün',
        getRange: () => ({
            start: DateTime.now().minus({ days: 89 }).startOf('day'),
            end: DateTime.now().endOf('day'),
        }),
    },
}

const defaultPresets: PresetKey[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'last7Days', 'last30Days']

// ============================================
// Component
// ============================================

/**
 * Akıllı tarih seçici bileşeni
 * Hızlı seçim butonları (chips) ve takvim desteği
 */
export function DateRangePicker({
    value,
    onChange,
    showPresets = true,
    presets = defaultPresets,
    showCalendar = true,
    minDate,
    maxDate,
    weekStartsOn = 1,
    className,
}: DateRangePickerProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [calendarMonth, setCalendarMonth] = useState(DateTime.now())

    // Aktif preset'i bul
    const activePreset = useMemo(() => {
        for (const key of presets) {
            const range = presetConfigs[key].getRange()
            if (
                value.start.hasSame(range.start, 'day') &&
                value.end.hasSame(range.end, 'day')
            ) {
                return key
            }
        }
        return null
    }, [value, presets])

    const handlePresetClick = (key: PresetKey) => {
        onChange(presetConfigs[key].getRange())
    }

    const formatRange = () => {
        if (value.start.hasSame(value.end, 'day')) {
            return value.start.toLocaleString({ day: 'numeric', month: 'short', year: 'numeric' })
        }
        return `${value.start.toLocaleString({ day: 'numeric', month: 'short' })} - ${value.end.toLocaleString({ day: 'numeric', month: 'short', year: 'numeric' })}`
    }

    return (
        <div className={clsx('space-y-3', className)}>
            {/* Preset Chips */}
            {showPresets && (
                <div className="flex flex-wrap gap-2">
                    {presets.map(key => (
                        <button
                            key={key}
                            onClick={() => handlePresetClick(key)}
                            className={clsx(
                                'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                                activePreset === key
                                    ? 'bg-primary-500 text-white shadow-md'
                                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                            )}
                        >
                            {presetConfigs[key].label}
                        </button>
                    ))}
                </div>
            )}

            {/* Calendar Toggle */}
            {showCalendar && (
                <div className="relative">
                    <button
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2.5 rounded-xl w-full',
                            'bg-white/80 dark:bg-surface-800/60 border border-primary-200/50 dark:border-primary-700/40',
                            'text-surface-700 dark:text-surface-300',
                            'transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-600'
                        )}
                    >
                        <CalendarDaysIcon className="w-5 h-5 text-primary-500" />
                        <span className="flex-1 text-left text-sm font-medium">{formatRange()}</span>
                        <ChevronRightIcon
                            className={clsx(
                                'w-4 h-4 text-surface-400 transition-transform duration-200',
                                isCalendarOpen && 'rotate-90'
                            )}
                        />
                    </button>

                    {/* Calendar Dropdown */}
                    {isCalendarOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-20">
                            <CalendarDropdown
                                value={value}
                                onChange={onChange}
                                calendarMonth={calendarMonth}
                                setCalendarMonth={setCalendarMonth}
                                minDate={minDate}
                                maxDate={maxDate}
                                weekStartsOn={weekStartsOn}
                                onClose={() => setIsCalendarOpen(false)}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ============================================
// Calendar Dropdown
// ============================================

interface CalendarDropdownProps {
    value: DateRange
    onChange: (range: DateRange) => void
    calendarMonth: DateTime
    setCalendarMonth: (month: any) => void
    minDate?: DateTime | undefined
    maxDate?: DateTime | undefined
    weekStartsOn: number
    onClose: () => void
}

function CalendarDropdown({
    value,
    onChange,
    calendarMonth,
    setCalendarMonth,
    minDate,
    maxDate,
    weekStartsOn: _weekStartsOn,
    onClose,
}: CalendarDropdownProps) {
    // _weekStartsOn is available for future customization of week start day
    void _weekStartsOn
    const [selecting, setSelecting] = useState<'start' | 'end' | null>(null)
    const [tempStart, setTempStart] = useState<DateTime | null>(null)

    // Takvim günlerini oluştur
    const days = useMemo(() => {
        const start = calendarMonth.startOf('month').startOf('week')
        const end = calendarMonth.endOf('month').endOf('week')
        const result: DateTime[] = []

        let current = start
        while (current <= end) {
            result.push(current)
            current = current.plus({ days: 1 })
        }

        return result
    }, [calendarMonth])

    const handleDayClick = (day: DateTime) => {
        if (selecting === null || selecting === 'start') {
            setTempStart(day)
            setSelecting('end')
        } else {
            const start = tempStart!
            const end = day

            if (end < start) {
                onChange({ start: end.startOf('day'), end: start.endOf('day') })
            } else {
                onChange({ start: start.startOf('day'), end: end.endOf('day') })
            }

            setSelecting(null)
            setTempStart(null)
            onClose()
        }
    }

    const isInRange = (day: DateTime) => {
        if (selecting === 'end' && tempStart) {
            return day >= tempStart && day <= value.end
        }
        return day >= value.start && day <= value.end
    }

    const isSelected = (day: DateTime) => {
        return day.hasSame(value.start, 'day') || day.hasSame(value.end, 'day')
    }

    const isDisabled = (day: DateTime) => {
        if (minDate && day < minDate) return true
        if (maxDate && day > maxDate) return true
        return false
    }

    const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

    return (
        <div className="card p-4 shadow-xl animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => setCalendarMonth(calendarMonth.minus({ months: 1 }))}
                    className="btn-icon"
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="font-semibold text-surface-900 dark:text-white">
                    {calendarMonth.toLocaleString({ month: 'long', year: 'numeric' })}
                </span>
                <button
                    onClick={() => setCalendarMonth(calendarMonth.plus({ months: 1 }))}
                    className="btn-icon"
                >
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(day => (
                    <div
                        key={day}
                        className="text-center text-xs font-medium text-surface-500 py-1"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isCurrentMonth = day.month === calendarMonth.month
                    const disabled = isDisabled(day)
                    const selected = isSelected(day)
                    const inRange = isInRange(day)
                    const isToday = day.hasSame(DateTime.now(), 'day')

                    return (
                        <button
                            key={day.toISODate()}
                            onClick={() => !disabled && handleDayClick(day)}
                            disabled={disabled}
                            className={clsx(
                                'w-9 h-9 rounded-lg text-sm font-medium transition-all duration-150',
                                !isCurrentMonth && 'text-surface-300 dark:text-surface-600',
                                isCurrentMonth && !selected && !inRange && 'text-surface-700 dark:text-surface-300',
                                inRange && !selected && 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
                                selected && 'bg-primary-500 text-white',
                                isToday && !selected && 'ring-2 ring-primary-400 ring-inset',
                                disabled && 'opacity-30 cursor-not-allowed',
                                !disabled && !selected && 'hover:bg-surface-100 dark:hover:bg-surface-700'
                            )}
                        >
                            {day.day}
                        </button>
                    )
                })}
            </div>

            {/* Selection hint */}
            {selecting === 'end' && (
                <p className="text-xs text-center text-primary-500 mt-3">
                    Bitiş tarihini seçin
                </p>
            )}
        </div>
    )
}

// ============================================
// Simple Date Picker (tek tarih)
// ============================================

interface DatePickerProps {
    value: DateTime
    onChange: (date: DateTime) => void
    showPresets?: boolean
    minDate?: DateTime | undefined
    maxDate?: DateTime | undefined
    className?: string | undefined
}

export function DatePicker({
    value,
    onChange,
    showPresets = true,
    minDate,
    maxDate,
    className,
}: DatePickerProps) {
    return (
        <DateRangePicker
            value={{ start: value, end: value }}
            onChange={(range) => onChange(range.start)}
            showPresets={showPresets}
            presets={['today', 'yesterday']}
            minDate={minDate}
            maxDate={maxDate}
            className={className}
        />
    )
}
