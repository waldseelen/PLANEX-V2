import { useLocale, useTranslations } from '@/i18n'
import { useToast } from '@/shared/components'
import { addEvent, deleteEvent, updateEvent, useAllEvents } from '@/db/planner/queries/eventQueries'
import { useCourses } from '@/db/planner/queries/courseQueries'
import type { DBPlannerEvent, PlannerEventType } from '@/db/planner/types'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, IconButton } from '../components/ui/Button'
import { Card, EmptyState } from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Modal } from '@/shared/components/Modal'
import { useCalendarDayNames, useCalendarGrid } from '../lib/hooks/useCalendarGrid'
import { cn, formatDateDisplay, getDaysUntil } from '../lib/utils'
import { COURSE_COLORS } from '../types'

function toDateISO(date: Date): string {
    return date.toISOString().split('T')[0]
}

type CalendarDay = {
    date: Date
    dateISO: string
    isCurrentMonth: boolean
    isToday: boolean
    items: DBPlannerEvent[]
}

export function CalendarPage() {
    const t = useTranslations(['common', 'calendar', 'planner'])
    const locale = useLocale()
    const { showToast } = useToast()
    const location = useLocation()
    const navigate = useNavigate()

    const courses = useCourses()
    const events = useAllEvents()

    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
    })

    const [selectedDateISO, setSelectedDateISO] = useState<string | null>(null)
    const [eventModalOpen, setEventModalOpen] = useState(false)
    const [editingEvent, setEditingEvent] = useState<DBPlannerEvent | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const calendarGrid = useCalendarGrid(currentDate, locale)
    const weekdayLabels = useCalendarDayNames(locale)
    const [formData, setFormData] = useState<{
        type: PlannerEventType
        title: string
        dateISO: string
        courseId: string
        description: string
        color: string
    }>({
        type: 'event',
        title: '',
        dateISO: '',
        courseId: '',
        description: '',
        color: '#6366f1',
    })

    const todayISO = useMemo(() => toDateISO(new Date()), [])

    const courseOptions = useMemo(
        () => [
            { value: '', label: t('calendar', 'selectCourse') },
            ...courses.map(c => ({ value: c.id, label: c.code ? `${c.code} • ${c.title}` : c.title })),
        ],
        [courses, t]
    )

    const days = useMemo<CalendarDay[]>(() => {
        const itemsByDate = new Map<string, DBPlannerEvent[]>()
        events.forEach(e => {
            if (!itemsByDate.has(e.dateISO)) itemsByDate.set(e.dateISO, [])
            itemsByDate.get(e.dateISO)!.push(e)
        })

        return calendarGrid.days.map(day => ({
            date: day.date,
            dateISO: day.dateISO,
            isCurrentMonth: day.isCurrentMonth,
            isToday: day.isToday,
            items: (itemsByDate.get(day.dateISO) ?? []).slice().sort((a, b) => a.type.localeCompare(b.type)),
        }))
    }, [calendarGrid.days, events])

    const upcomingExams = useMemo(() => {
        const items = events
            .filter(e => e.type === 'exam' && e.courseId)
            .map(e => ({ event: e, daysLeft: getDaysUntil(e.dateISO) }))
            .filter(x => x.daysLeft >= 0)
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 10)

        return items.map(x => ({
            ...x,
            course: courses.find(c => c.id === x.event.courseId) ?? null,
        }))
    }, [events, courses])

    const todayItems = useMemo(() => {
        return events
            .filter(e => e.dateISO === todayISO)
            .slice()
            .sort((a, b) => a.type.localeCompare(b.type))
    }, [events, todayISO])

    const monthLabel = calendarGrid.monthLabel

    const openCreateModal = useCallback((dateISO: string, type: PlannerEventType = 'event') => {
        setSelectedDateISO(dateISO)
        setEditingEvent(null)
        setFormData({
            type,
            title: '',
            dateISO,
            courseId: '',
            description: '',
            color: type === 'exam' ? '#f97316' : '#6366f1',
        })
        setEventModalOpen(true)
    }, [])

    useEffect(() => {
        const state = location.state as undefined | { openCreate?: boolean }
        if (state?.openCreate) {
            openCreateModal(toDateISO(new Date()), 'event')
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [location.state, location.pathname, navigate, openCreateModal])

    const openEditModal = (event: DBPlannerEvent) => {
        setSelectedDateISO(event.dateISO)
        setEditingEvent(event)
        setFormData({
            type: event.type,
            title: event.title,
            dateISO: event.dateISO,
            courseId: event.courseId ?? '',
            description: event.description ?? '',
            color: event.color ?? (event.type === 'exam' ? '#f97316' : '#6366f1'),
        })
        setEventModalOpen(true)
    }

    const save = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title.trim()) {
            showToast(t('calendar', 'validation.titleRequired'), { variant: 'error' })
            return
        }
        if (!formData.dateISO) {
            showToast(t('calendar', 'validation.dateRequired'), { variant: 'error' })
            return
        }
        if (formData.type === 'exam' && !formData.courseId) {
            showToast(t('calendar', 'validation.courseRequiredForExam'), { variant: 'error' })
            return
        }

        setIsSaving(true)
        try {
            if (editingEvent) {
                await updateEvent(editingEvent.id, {
                    type: formData.type,
                    title: formData.title.trim(),
                    dateISO: formData.dateISO,
                    courseId: formData.courseId || undefined,
                    description: formData.description.trim() || undefined,
                    color: formData.color || undefined,
                })
                showToast(t('common', 'toast.updated'), { variant: 'success' })
            } else {
                await addEvent({
                    type: formData.type,
                    title: formData.title.trim(),
                    dateISO: formData.dateISO,
                    courseId: formData.courseId || undefined,
                    description: formData.description.trim() || undefined,
                    color: formData.color || undefined,
                })
                showToast(t('common', 'toast.created'), { variant: 'success' })
            }

            setEventModalOpen(false)
            setEditingEvent(null)
        } catch (error) {
            const message = error instanceof Error && error.message.trim()
                ? error.message
                : t('common', 'toast.error')
            showToast(message, { variant: 'error' })
        } finally {
            setIsSaving(false)
        }
    }

    const deleteSelected = async () => {
        if (!editingEvent) return
        setIsDeleting(true)
        try {
            await deleteEvent(editingEvent.id)
            showToast(t('common', 'toast.deleted'), { variant: 'success' })
            setEventModalOpen(false)
            setEditingEvent(null)
        } catch (error) {
            const message = error instanceof Error && error.message.trim()
                ? error.message
                : t('common', 'toast.error')
            showToast(message, { variant: 'error' })
        } finally {
            setIsDeleting(false)
        }
    }

    const selectedDayItems = useMemo(() => {
        if (!selectedDateISO) return []
        return events
            .filter(e => e.dateISO === selectedDateISO)
            .slice()
            .sort((a, b) => a.type.localeCompare(b.type))
    }, [events, selectedDateISO])

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <CalendarDays className="w-6 h-6" />
                        {t('calendar', 'title')}
                    </h1>
                    <p className="text-secondary mt-1">{t('calendar', 'subtitle')}</p>
                </div>
                <Button onClick={() => openCreateModal(toDateISO(new Date()), 'event')} leftIcon={<Plus className="w-4 h-4" />}>
                    {t('common', 'common.create')}
                </Button>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                <div className="w-full">
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <IconButton variant="secondary" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} title={t('calendar', 'navigation.previousMonth')}>
                                    <ChevronLeft className="w-4 h-4" />
                                </IconButton>
                                <IconButton variant="secondary" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} title={t('calendar', 'navigation.nextMonth')}>
                                    <ChevronRight className="w-4 h-4" />
                                </IconButton>
                                <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>
                                    {t('calendar', 'navigation.today')}
                                </Button>
                            </div>
                            <div className="text-primary font-semibold capitalize">{monthLabel}</div>
                        </div>

                        <div className="grid grid-cols-7 gap-2 text-xs text-secondary mb-2">
                            {weekdayLabels.map(d => (
                                <div key={d} className="text-center py-1">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                            {days.map(day => {
                                const examCount = day.items.filter(i => i.type === 'exam').length
                                const eventCount = day.items.filter(i => i.type === 'event').length

                                return (
                                    <button
                                        key={day.dateISO}
                                        onClick={() => openCreateModal(day.dateISO, 'event')}
                                        className={cn(
                                            'p-2 rounded-xl border text-left min-h-[72px] transition-colors',
                                            'border-default hover:bg-secondary/30',
                                            !day.isCurrentMonth && 'opacity-40',
                                            day.isToday && 'ring-2 ring-[var(--color-accent)]/40'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-primary">{day.date.getDate()}</span>
                                            {(examCount + eventCount) > 0 && (
                                                <span className="text-[10px] text-tertiary">{examCount + eventCount}</span>
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-col gap-1">
                                            {examCount > 0 && (
                                                <span className="text-[10px] text-orange-300">{t('calendar', 'eventType.exam')}: {examCount}</span>
                                            )}
                                            {eventCount > 0 && (
                                                <span className="text-[10px] text-blue-300">{t('calendar', 'eventType.event')}: {eventCount}</span>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-primary">{t('calendar', 'sections.todayEvents')}</h2>
                            <Button variant="ghost" size="sm" onClick={() => openCreateModal(todayISO, 'event')}>
                                {t('common', 'common.create')}
                            </Button>
                        </div>

                        {todayItems.length === 0 ? (
                            <EmptyState
                                icon={<CalendarDays className="w-8 h-8 text-tertiary" />}
                                title={t('calendar', 'empty.noEventsToday')}
                                description={t('calendar', 'empty.noEventsDescription')}
                            />
                        ) : (
                            <div className="space-y-2">
                                {todayItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={cn('p-3 rounded-xl border flex items-start gap-3', 'border-default bg-secondary/20')}
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: item.color ?? '#6366f1' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-primary truncate">{item.title}</p>
                                            <p className="text-sm text-secondary">{item.type === 'exam' ? t('calendar', 'eventType.exam') : t('calendar', 'eventType.event')}</p>
                                        </div>
                                        <IconButton size="sm" onClick={() => openEditModal(item)} title={t('common', 'common.edit')}>
                                            <Pencil className="w-4 h-4" />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-primary">{t('calendar', 'sections.upcomingExams')}</h2>
                        </div>

                        {upcomingExams.length === 0 ? (
                            <EmptyState
                                icon={<CalendarDays className="w-8 h-8 text-tertiary" />}
                                title={t('calendar', 'empty.noUpcomingExams')}
                                description={t('calendar', 'empty.noUpcomingExamsDescription')}
                            />
                        ) : (
                            <div className="space-y-2">
                                {upcomingExams.map(({ event, course, daysLeft }) => (
                                    <div
                                        key={event.id}
                                        className={cn('p-3 rounded-xl border flex items-start gap-3', 'border-default bg-secondary/20')}
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: course?.color ?? '#f97316' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-primary truncate">{event.title}</p>
                                            <p className="text-sm text-secondary truncate">{course?.title ?? t('planner', 'course.title')}</p>
                                            <p className="text-xs text-tertiary mt-1">{formatDateDisplay(event.dateISO)}</p>
                                        </div>
                                        <span className={cn(
                                            'font-mono text-[0.6rem] tracking-wide uppercase rounded-full border px-2 py-0.5 flex-shrink-0',
                                            daysLeft <= 3
                                                ? 'text-status-red border-status-red/30 bg-status-red-soft animate-pulse'
                                                : daysLeft <= 7
                                                    ? 'text-status-amber border-status-amber/30 bg-status-amber-soft'
                                                    : 'text-status-blue border-status-blue/30 bg-status-blue-soft'
                                        )}>
                                            {daysLeft === 0 ? t('calendar', 'daysUntil.today') : daysLeft === 1 ? t('calendar', 'daysUntil.tomorrow') : t('calendar', 'daysUntil.days', { count: daysLeft })}
                                        </span>
                                        <IconButton size="sm" onClick={() => openEditModal(event)} title={t('common', 'common.edit')}>
                                            <Pencil className="w-4 h-4" />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <Modal
                isOpen={eventModalOpen}
                onClose={() => {
                    setEventModalOpen(false)
                    setEditingEvent(null)
                }}
                title={editingEvent ? t('common', 'common.edit') : t('common', 'common.create')}
                subtitle={selectedDateISO ? formatDateDisplay(selectedDateISO) : undefined}
                footer={
                    <div className="flex justify-between gap-2">
                        <div>
                            {editingEvent && (
                                <Button variant="danger" onClick={() => void deleteSelected()} leftIcon={<Trash2 className="w-4 h-4" />} isLoading={isDeleting}>
                                    {t('common', 'common.delete')}
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setEventModalOpen(false)} disabled={isSaving || isDeleting}>{t('common', 'common.cancel')}</Button>
                            <Button form="calendar-event-form" type="submit" isLoading={isSaving}>
                                {editingEvent ? t('common', 'common.update') : t('common', 'common.add')}
                            </Button>
                        </div>
                    </div>
                }
            >
                <form id="calendar-event-form" onSubmit={save} className="space-y-4">
                    <Select
                        label={t('calendar', 'event.type')}
                        value={formData.type}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as PlannerEventType }))}
                        options={[
                            { value: 'event', label: t('calendar', 'eventType.event') },
                            { value: 'exam', label: t('calendar', 'eventType.exam') },
                        ]}
                    />
                    <Input
                        label={t('calendar', 'event.name')}
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        autoFocus
                    />
                    <Input
                        label={t('calendar', 'event.date')}
                        type="date"
                        value={formData.dateISO}
                        onChange={(e) => setFormData(prev => ({ ...prev, dateISO: e.target.value }))}
                    />
                    <Select
                        label={t('calendar', 'event.course')}
                        value={formData.courseId}
                        onChange={(e) => setFormData(prev => ({ ...prev, courseId: e.target.value }))}
                        options={courseOptions}
                    />
                    <div>
                        <label className="block text-sm font-medium text-primary mb-2">{t('calendar', 'event.color')}</label>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
                            {COURSE_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                                    className={cn(
                                        'w-9 h-9 rounded-full border border-white/10 transition-transform duration-150 shadow-sm',
                                        formData.color === color
                                            ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#0f1117] scale-110'
                                            : 'hover:scale-105'
                                    )}
                                    style={{ backgroundColor: color }}
                                    aria-label={`${t('planner', 'course.color')} ${color}`}
                                />
                            ))}
                        </div>
                    </div>
                    <Textarea
                        label={`${t('calendar', 'event.description')} ${t('common', 'common.optional')}`}
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                    />

                    {selectedDayItems.length > 0 && (
                        <div className="pt-4 border-t border-default">
                            <p className="text-sm font-semibold text-primary mb-2">{t('calendar', 'sections.thisDay')}</p>
                            <div className="space-y-2">
                                {selectedDayItems.map(item => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        onClick={() => openEditModal(item)}
                                        className="w-full p-3 rounded-xl border border-default bg-secondary/20 hover:bg-secondary/30 text-left flex items-start gap-3"
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: item.color ?? (item.type === 'exam' ? '#f97316' : '#6366f1') }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-primary truncate">{item.title}</p>
                                            <p className="text-xs text-secondary">{item.type === 'exam' ? t('calendar', 'eventType.exam') : t('calendar', 'eventType.event')}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </form>
            </Modal>
        </div>
    )
}











