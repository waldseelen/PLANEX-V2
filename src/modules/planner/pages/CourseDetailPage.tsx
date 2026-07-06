import { updateCourse, useCourse } from '@/db/planner/queries/courseQueries'
import { addEvent, deleteEvent, updateEvent, useEventsByCourse } from '@/db/planner/queries/eventQueries'
import { addTask, deleteTask, reorderTasks, toggleTaskCompletion as toggleTaskCompletionInDb, updateTask, useTasksByCourse } from '@/db/planner/queries/taskQueries'
import { addUnit, useUnitsByCourse } from '@/db/planner/queries/unitQueries'
import type { DBPlannerEvent, DBTask, DBUnit, PlannerEventType, TaskStatus } from '@/db/planner/types'
import { useTranslations } from '@/i18n'
import { useToast } from '@/shared/components/Toast'
import { useCompletionFeedback } from '@/shared/hooks'
import { ArrowLeft, Brain, CalendarDays, CheckCircle2, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExternalSearchButtons } from '../components/features/ExternalSearchButtons'
import { LectureNotes } from '../components/features/LectureNotes'
import { Button, IconButton } from '../components/ui/Button'
import { Badge, Card, EmptyState } from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Modal } from '@/shared/components/Modal'
import { PLANNER_DEFAULT_ICONS, PlannerEntityIcon, PlannerIconField } from '../components/ui/PlannerIconField'
import { cn, formatDateDisplay, getDaysUntil } from '../lib/utils'
import { usePlannerAppStore } from '../store/plannerAppStore'

type TaskWithUnit = { task: DBTask; unit: DBUnit }

function sortTasksForList(tasks: TaskWithUnit[]): TaskWithUnit[] {
    return [...tasks].sort((a, b) => {
        const aDue = a.task.dueDateISO ? new Date(a.task.dueDateISO).getTime() : Infinity
        const bDue = b.task.dueDateISO ? new Date(b.task.dueDateISO).getTime() : Infinity
        if (aDue !== bDue) return aDue - bDue
        return a.task.createdAt.localeCompare(b.task.createdAt)
    })
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function CourseDetailPage() {
    const t = useTranslations(['common', 'planner', 'habits'])
    const { courseId } = useParams<{ courseId: string }>()
    const navigate = useNavigate()
    const { showToast } = useToast()

    const course = useCourse(courseId ?? '')
    const units = useUnitsByCourse(courseId ?? '')
    const allTasks = useTasksByCourse(courseId ?? '')
    const courseEvents = useEventsByCourse(courseId ?? '')

    const settings = usePlannerAppStore(state => state.settings)
    const { triggerCompletionFeedback } = useCompletionFeedback({
        soundEnabled: settings.soundEnabled,
    })

    const [showConfetti, setShowConfetti] = useState(false)
    const [isEditCourseOpen, setIsEditCourseOpen] = useState(false)
    const [courseForm, setCourseForm] = useState({
        title: '',
        code: '',
        icon: undefined as string | undefined,
        color: '#6366f1',
    })
    const [isSavingCourse, setIsSavingCourse] = useState(false)

    const [taskModalOpen, setTaskModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<{ task: DBTask; unitId: string } | null>(null)
    const [taskForm, setTaskForm] = useState({
        text: '',
        icon: undefined as string | undefined,
        status: 'todo' as TaskStatus,
        dueDateISO: '',
        note: '',
        unitId: '',
    })
    const [isSavingTask, setIsSavingTask] = useState(false)
    const [pendingTaskDeleteId, setPendingTaskDeleteId] = useState<string | null>(null)
    const [isReorderingTasks, setIsReorderingTasks] = useState(false)

    const [eventModalOpen, setEventModalOpen] = useState(false)
    const [editingEvent, setEditingEvent] = useState<DBPlannerEvent | null>(null)
    const [eventForm, setEventForm] = useState({
        type: 'exam' as PlannerEventType,
        title: '',
        dateISO: '',
        description: '',
        color: '#f97316',
    })
    const [isSavingEvent, setIsSavingEvent] = useState(false)
    const [pendingEventDeleteId, setPendingEventDeleteId] = useState<string | null>(null)

    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
    const dragOverTaskId = useRef<string | null>(null)
    const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)

    const handleToggleTask = useCallback(async (task: DBTask) => {
        if (togglingTaskId) return
        setTogglingTaskId(task.id)
        try {
            const isNowCompleted = await toggleTaskCompletionInDb(task.id)
            if (isNowCompleted) {
                triggerCompletionFeedback()
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 1000)
            }
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setTogglingTaskId(null)
        }
    }, [showToast, t, togglingTaskId, triggerCompletionFeedback])

    const tasks = useMemo((): TaskWithUnit[] => {
        const unitMap = new Map(units.map(unit => [unit.id, unit]))
        const withUnits = allTasks
            .map(task => ({ task, unit: unitMap.get(task.unitId) }))
            .filter((entry): entry is TaskWithUnit => entry.unit !== undefined)
        return sortTasksForList(withUnits)
    }, [allTasks, units])

    const nextEvent = useMemo(() => {
        const upcoming = courseEvents
            .map(event => ({ event, daysLeft: getDaysUntil(event.dateISO) }))
            .filter(item => item.daysLeft >= 0)
            .sort((a, b) => a.daysLeft - b.daysLeft)
        return upcoming[0] ?? null
    }, [courseEvents])

    const handleDragStart = useCallback((event: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', taskId)
    }, [])

    const handleDragOver = useCallback((event: React.DragEvent, taskId: string) => {
        event.preventDefault()
        dragOverTaskId.current = taskId
    }, [])

    const handleDragEnd = useCallback(async () => {
        if (!draggedTaskId || !dragOverTaskId.current || !course) {
            setDraggedTaskId(null)
            return
        }

        const sourceTask = tasks.find(taskEntry => taskEntry.task.id === draggedTaskId)
        const targetTask = tasks.find(taskEntry => taskEntry.task.id === dragOverTaskId.current)

        if (sourceTask && targetTask && sourceTask.unit.id === targetTask.unit.id) {
            const unit = units.find(item => item.id === sourceTask.unit.id)
            if (unit) {
                const unitTasks = tasks.filter(taskEntry => taskEntry.unit.id === unit.id).map(taskEntry => taskEntry.task)
                const sourceIndex = unitTasks.findIndex(task => task.id === draggedTaskId)
                const targetIndex = unitTasks.findIndex(task => task.id === dragOverTaskId.current)
                if (sourceIndex !== -1 && targetIndex !== -1) {
                    const reordered = [...unitTasks]
                    const [removed] = reordered.splice(sourceIndex, 1)
                    reordered.splice(targetIndex, 0, removed)
                    setIsReorderingTasks(true)
                    try {
                        await reorderTasks(course.id, unit.id, reordered.map(task => task.id))
                    } catch (error) {
                        showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
                    } finally {
                        setIsReorderingTasks(false)
                    }
                }
            }
        }

        setDraggedTaskId(null)
        dragOverTaskId.current = null
    }, [course, draggedTaskId, showToast, t, tasks, units])

    if (!courseId || !course) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="space-y-4 text-center">
                    <p className="text-secondary">{t('planner', 'courseDetail.notFound')}</p>
                    <Link to="/planner/courses">
                        <Button>{t('planner', 'courseDetail.backToCourses')}</Button>
                    </Link>
                </div>
            </div>
        )
    }

    const activeCourse = course
    const unitOptions = units.map(unit => ({ value: unit.id, label: unit.title }))

    async function openNewTask() {
        try {
            let unitId: string | undefined = units.at(0)?.id
            if (!unitId) {
                unitId = await addUnit({ courseId: activeCourse.id, title: t('planner', 'courseDetail.unitFallback') })
            }
            setEditingTask(null)
            setTaskForm({
                text: '',
                icon: undefined,
                status: 'todo',
                dueDateISO: '',
                note: '',
                unitId: unitId || '',
            })
            setTaskModalOpen(true)
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        }
    }

    function openEditTask(task: DBTask, unitId: string) {
        setEditingTask({ task, unitId })
        setTaskForm({
            text: task.text,
            icon: task.icon,
            status: task.status,
            dueDateISO: task.dueDateISO ?? '',
            note: task.note ?? '',
            unitId,
        })
        setTaskModalOpen(true)
    }

    async function saveTask(event: React.FormEvent) {
        event.preventDefault()
        if (!taskForm.text.trim()) {
            showToast(t('planner', 'validation.taskTextRequired'), { variant: 'error' })
            return
        }
        const unitId = taskForm.unitId || units[0]?.id
        if (!unitId) return

        setIsSavingTask(true)
        try {
            if (editingTask) {
                await updateTask(editingTask.task.id, {
                    text: taskForm.text.trim(),
                    icon: taskForm.icon,
                    status: taskForm.status,
                    dueDateISO: taskForm.dueDateISO || undefined,
                    note: taskForm.note.trim() || undefined,
                })
                showToast(t('common', 'toast.updated'), { variant: 'success' })
            } else {
                await addTask({
                    courseId: activeCourse.id,
                    unitId,
                    text: taskForm.text.trim(),
                    icon: taskForm.icon,
                    status: taskForm.status,
                    dueDateISO: taskForm.dueDateISO || undefined,
                    note: taskForm.note.trim() || undefined,
                })
                showToast(t('common', 'toast.created'), { variant: 'success' })
            }

            setTaskModalOpen(false)
            setEditingTask(null)
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setIsSavingTask(false)
        }
    }

    async function handleDeleteTask(taskId: string) {
        setPendingTaskDeleteId(taskId)
        try {
            await deleteTask(taskId)
            showToast(t('common', 'toast.deleted'), { variant: 'success' })
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setPendingTaskDeleteId(null)
        }
    }

    function openNewEvent(type: PlannerEventType = 'event') {
        setEditingEvent(null)
        setEventForm({
            type,
            title: '',
            dateISO: '',
            description: '',
            color: type === 'exam' ? '#f97316' : '#6366f1',
        })
        setEventModalOpen(true)
    }

    function openEditEvent(event: DBPlannerEvent) {
        setEditingEvent(event)
        setEventForm({
            type: event.type,
            title: event.title,
            dateISO: event.dateISO,
            description: event.description ?? '',
            color: event.color ?? (event.type === 'exam' ? '#f97316' : '#6366f1'),
        })
        setEventModalOpen(true)
    }

    async function saveEvent(event: React.FormEvent) {
        event.preventDefault()
        if (!eventForm.title.trim()) {
            showToast(t('planner', 'eventModal.errors.titleRequired'), { variant: 'error' })
            return
        }
        if (!eventForm.dateISO) {
            showToast(t('planner', 'eventModal.errors.dateRequired'), { variant: 'error' })
            return
        }

        setIsSavingEvent(true)
        try {
            if (editingEvent) {
                await updateEvent(editingEvent.id, {
                    type: eventForm.type,
                    title: eventForm.title.trim(),
                    dateISO: eventForm.dateISO,
                    description: eventForm.description.trim() || undefined,
                    color: eventForm.color || undefined,
                    courseId: activeCourse.id,
                })
                showToast(t('common', 'toast.updated'), { variant: 'success' })
            } else {
                await addEvent({
                    type: eventForm.type,
                    courseId: activeCourse.id,
                    title: eventForm.title.trim(),
                    dateISO: eventForm.dateISO,
                    description: eventForm.description.trim() || undefined,
                    color: eventForm.color || undefined,
                })
                showToast(t('common', 'toast.created'), { variant: 'success' })
            }

            setEventModalOpen(false)
            setEditingEvent(null)
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setIsSavingEvent(false)
        }
    }

    async function handleDeleteEvent(eventId: string) {
        setPendingEventDeleteId(eventId)
        try {
            await deleteEvent(eventId)
            showToast(t('common', 'toast.deleted'), { variant: 'success' })
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setPendingEventDeleteId(null)
        }
    }

    function openEditCourse() {
        setCourseForm({
            title: activeCourse.title,
            code: activeCourse.code ?? '',
            icon: activeCourse.icon,
            color: activeCourse.color ?? '#6366f1',
        })
        setIsEditCourseOpen(true)
    }

    async function saveCourse(event: React.FormEvent) {
        event.preventDefault()
        if (!courseForm.title.trim()) return

        setIsSavingCourse(true)
        try {
            await updateCourse(activeCourse.id, {
                title: courseForm.title.trim(),
                code: courseForm.code.trim() || undefined,
                icon: courseForm.icon,
                color: courseForm.color,
            })
            showToast(t('common', 'toast.updated'), { variant: 'success' })
            setIsEditCourseOpen(false)
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setIsSavingCourse(false)
        }
    }

    return (
        <div className="relative space-y-6 animate-fade-in">
            {showConfetti && (
                <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
                    {Array.from({ length: 20 }).map((_, index) => {
                        const colors = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899']
                        return (
                            <div
                                key={index}
                                className="absolute h-2 w-2 animate-confetti rounded-full"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    backgroundColor: colors[index % 5],
                                    animationDelay: `${Math.random() * 0.3}s`,
                                    animationDuration: `${0.6 + Math.random() * 0.4}s`,
                                }}
                            />
                        )
                    })}
                </div>
            )}

            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <IconButton variant="ghost" onClick={() => navigate('/planner/courses')} title={t('common', 'common.back')}>
                        <ArrowLeft className="h-5 w-5" />
                    </IconButton>
                    <div>
                        <div className="flex items-center gap-3">
                            <span
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-surface-100"
                                style={{ color: activeCourse.color ?? '#6366f1' }}
                            >
                                <PlannerEntityIcon
                                    icon={activeCourse.icon}
                                    fallbackIcon={PLANNER_DEFAULT_ICONS.course}
                                    size={20}
                                    color={activeCourse.color ?? '#6366f1'}
                                />
                            </span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeCourse.color ?? '#6366f1' }} />
                                    <h1 className="text-2xl font-bold text-primary">{activeCourse.title}</h1>
                                </div>
                                {activeCourse.code && <p className="mt-1 text-secondary">{activeCourse.code}</p>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => navigate('/learn')} leftIcon={<Brain className="h-4 w-4 text-violet-500" />} className="text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/10">
                        Learn ile Keşfet
                    </Button>
                    <Button variant="secondary" onClick={() => openNewEvent('exam')} leftIcon={<Plus className="h-4 w-4" />}>
                        {t('planner', 'courseDetail.addExamOrEvent')}
                    </Button>
                    <IconButton variant="secondary" onClick={openEditCourse} title={t('planner', 'courseDetail.editCourseTitle')}>
                        <Pencil className="h-4 w-4" />
                    </IconButton>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-secondary">{t('planner', 'courseDetail.nextDeadline')}</p>
                            <p className="text-2xl font-bold text-primary">
                                {nextEvent ? t('common', 'app.daysLeft', { count: nextEvent.daysLeft }) : '—'}
                            </p>
                            {nextEvent && (
                                <p className="mt-1 text-sm text-secondary">
                                    {nextEvent.event.type === 'exam' ? t('planner', 'courseDetail.eventType.exam') : t('planner', 'courseDetail.eventType.event')} • {nextEvent.event.title} • {formatDateDisplay(nextEvent.event.dateISO)}
                                </p>
                            )}
                        </div>
                        <CalendarDays className="h-10 w-10 text-tertiary" />
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-secondary">{t('planner', 'courseDetail.totalTasks')}</p>
                            <p className="text-2xl font-bold text-primary">{tasks.length}</p>
                            {isReorderingTasks && <p className="mt-1 text-xs text-secondary">{t('common', 'common.loading')}</p>}
                        </div>
                        <CheckCircle2 className="h-10 w-10 text-tertiary" />
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-primary">{t('planner', 'courseDetail.tasks')}</h2>
                        <Button size="sm" onClick={() => void openNewTask()} leftIcon={<Plus className="h-4 w-4" />}>
                            {t('planner', 'courseDetail.addTask')}
                        </Button>
                    </div>

                    {tasks.length === 0 ? (
                        <EmptyState
                            icon={<CheckCircle2 className="h-8 w-8 text-tertiary" />}
                            title={t('planner', 'courseDetail.emptyTasksTitle')}
                            description={t('planner', 'courseDetail.emptyTasksDescription')}
                            action={<Button onClick={() => void openNewTask()} leftIcon={<Plus className="h-4 w-4" />}>{t('planner', 'courseDetail.addFirstTask')}</Button>}
                        />
                    ) : (
                        <div className="space-y-2">
                            {tasks.map(({ task, unit }) => {
                                const isCompleted = task.status === 'done'
                                const isDragging = draggedTaskId === task.id
                                const isDeleting = pendingTaskDeleteId === task.id
                                return (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={(event) => handleDragStart(event, task.id)}
                                        onDragOver={(event) => handleDragOver(event, task.id)}
                                        onDragEnd={() => void handleDragEnd()}
                                        className={cn(
                                            'flex items-start gap-3 rounded-xl border p-3',
                                            'cursor-grab border-default bg-secondary/20 transition-all hover:bg-secondary/30 active:cursor-grabbing',
                                            isDragging && 'scale-[0.98] opacity-50 ring-2 ring-cyan-400/50',
                                        )}
                                    >
                                        <div className="mt-0.5 cursor-grab text-tertiary hover:text-secondary">
                                            <GripVertical className="h-4 w-4" />
                                        </div>

                                        <button
                                            onClick={() => void handleToggleTask(task)}
                                            disabled={togglingTaskId === task.id}
                                            className={cn(
                                                'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                                                isCompleted ? 'border-green-500 bg-green-500' : 'border-default',
                                            )}
                                            aria-label={isCompleted ? t('planner', 'task.status.done') : t('habits', 'actions.markDone')}
                                        >
                                            {isCompleted && <CheckCircle2 className="h-4 w-4 text-white" />}
                                        </button>

                                        <div
                                            className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-surface-100"
                                            style={{ color: activeCourse.color ?? '#6366f1' }}
                                        >
                                            <PlannerEntityIcon
                                                icon={task.icon}
                                                fallbackIcon={PLANNER_DEFAULT_ICONS.courseTask}
                                                size={18}
                                                color={activeCourse.color ?? '#6366f1'}
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className={cn('font-medium text-primary', isCompleted && 'line-through opacity-60')}>
                                                {task.text}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-secondary">
                                                <span>{unit.title}</span>
                                                {task.dueDateISO && <span>• {formatDateDisplay(task.dueDateISO)}</span>}
                                                <span className="capitalize">• {t('planner', `task.status.${task.status === 'in-progress' ? 'inProgress' : task.status}`)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <ExternalSearchButtons title={task.text} description={task.note} />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    navigate(`/learn/chat?conceptId=${task.id}&conceptName=${encodeURIComponent(task.text)}`)
                                                }}
                                                className="rounded-md p-1.5 opacity-60 hover:opacity-100 transition-all duration-150 hover:bg-violet-500/20 hover:text-violet-500 dark:hover:text-violet-400 hover:scale-110 active:scale-95"
                                                title="Sokratik Çöz"
                                                aria-label="Sokratik Çöz"
                                            >
                                                <Brain className="h-3.5 w-3.5" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <IconButton size="sm" onClick={() => openEditTask(task, unit.id)} title={t('common', 'common.edit')}>
                                                <Pencil className="h-4 w-4" />
                                            </IconButton>
                                            <IconButton
                                                size="sm"
                                                variant="danger"
                                                onClick={() => void handleDeleteTask(task.id)}
                                                title={t('common', 'common.delete')}
                                                disabled={isDeleting}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </IconButton>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Card>

                <Card>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-primary">{t('planner', 'courseDetail.calendar')}</h2>
                        <Button size="sm" onClick={() => openNewEvent('event')} leftIcon={<Plus className="h-4 w-4" />}>
                            {t('planner', 'courseDetail.addEvent')}
                        </Button>
                    </div>

                    {courseEvents.length === 0 ? (
                        <EmptyState
                            icon={<CalendarDays className="h-8 w-8 text-tertiary" />}
                            title={t('planner', 'courseDetail.emptyEventsTitle')}
                            description={t('planner', 'courseDetail.emptyEventsDescription')}
                            action={<Button onClick={() => openNewEvent('exam')} leftIcon={<Plus className="h-4 w-4" />}>{t('planner', 'courseDetail.addFirstExam')}</Button>}
                        />
                    ) : (
                        <div className="space-y-2">
                            {courseEvents.map(event => {
                                const daysLeft = getDaysUntil(event.dateISO)
                                const isPast = daysLeft < 0
                                const badgeColor = event.type === 'exam' ? '#f97316' : '#6366f1'
                                const urgencyClass = event.type === 'exam' && !isPast
                                    ? daysLeft <= 3
                                        ? 'animate-pulse border-status-red/30 bg-status-red-soft text-status-red'
                                        : daysLeft <= 7
                                            ? 'border-status-amber/30 bg-status-amber-soft text-status-amber'
                                            : 'border-[var(--border-subtle)] text-text-muted'
                                    : null
                                const isDeleting = pendingEventDeleteId === event.id
                                return (
                                    <div
                                        key={event.id}
                                        className={cn(
                                            'flex items-start gap-3 rounded-xl border p-3',
                                            'border-default bg-secondary/20 transition-colors hover:bg-secondary/30',
                                        )}
                                    >
                                        <div
                                            className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                            style={{ backgroundColor: event.color ?? badgeColor }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium text-primary">{event.title}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary">
                                                <span>{event.type === 'exam' ? t('planner', 'courseDetail.eventType.exam') : t('planner', 'courseDetail.eventType.event')}</span>
                                                <span>• {formatDateDisplay(event.dateISO)}</span>
                                                {!isPast && (
                                                    urgencyClass ? (
                                                        <span className={cn(
                                                            'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide',
                                                            urgencyClass,
                                                        )}>
                                                            {t('common', 'app.daysLeft', { count: daysLeft })}
                                                        </span>
                                                    ) : (
                                                        <Badge color={badgeColor}>
                                                            {t('common', 'app.daysLeft', { count: daysLeft })}
                                                        </Badge>
                                                    )
                                                )}
                                                {isPast && <span className="text-tertiary">{t('planner', 'courseDetail.eventType.past')}</span>}
                                            </div>
                                            {event.description && (
                                                <p className="mt-2 line-clamp-2 text-sm text-secondary">{event.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <IconButton size="sm" onClick={() => openEditEvent(event)} title={t('common', 'common.edit')}>
                                                <Pencil className="h-4 w-4" />
                                            </IconButton>
                                            <IconButton
                                                size="sm"
                                                variant="danger"
                                                onClick={() => void handleDeleteEvent(event.id)}
                                                title={t('common', 'common.delete')}
                                                disabled={isDeleting}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </IconButton>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Card>

                <LectureNotes courseId={activeCourse.id} courseName={activeCourse.title} />
            </div>

            <Modal isOpen={isEditCourseOpen} onClose={() => !isSavingCourse && setIsEditCourseOpen(false)} title={t('planner', 'courseDetail.editCourse')}>
                <form onSubmit={saveCourse} className="space-y-4">
                    <Input label={t('planner', 'course.name')} value={courseForm.title} onChange={(event) => setCourseForm(current => ({ ...current, title: event.target.value }))} autoFocus />
                    <Input label={t('planner', 'courseDetail.courseCodeOptional')} value={courseForm.code} onChange={(event) => setCourseForm(current => ({ ...current, code: event.target.value }))} />
                    <PlannerIconField
                        value={courseForm.icon}
                        onChange={(icon) => setCourseForm(current => ({ ...current, icon }))}
                        fallbackIcon={PLANNER_DEFAULT_ICONS.course}
                        previewColor={courseForm.color}
                    />
                    <Input label={t('planner', 'course.color')} type="color" value={courseForm.color} onChange={(event) => setCourseForm(current => ({ ...current, color: event.target.value }))} />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => setIsEditCourseOpen(false)} disabled={isSavingCourse}>{t('common', 'common.cancel')}</Button>
                        <Button type="submit" isLoading={isSavingCourse}>{t('common', 'common.save')}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={taskModalOpen} onClose={() => { if (!isSavingTask) { setTaskModalOpen(false); setEditingTask(null) } }} title={editingTask ? t('planner', 'courseDetail.taskModalTitleEdit') : t('planner', 'courseDetail.taskModalTitleCreate')}>
                <form onSubmit={saveTask} className="space-y-4">
                    <Input label={t('planner', 'courseDetail.taskLabel')} value={taskForm.text} onChange={(event) => setTaskForm(current => ({ ...current, text: event.target.value }))} autoFocus />
                    <PlannerIconField
                        value={taskForm.icon}
                        onChange={(icon) => setTaskForm(current => ({ ...current, icon }))}
                        fallbackIcon={PLANNER_DEFAULT_ICONS.courseTask}
                        previewColor={activeCourse.color ?? '#6366f1'}
                    />
                    <Select
                        label={t('common', 'app.status')}
                        value={taskForm.status}
                        onChange={(event) => setTaskForm(current => ({ ...current, status: event.target.value as TaskStatus }))}
                        options={[
                            { value: 'todo', label: t('planner', 'task.status.todo') },
                            { value: 'in-progress', label: t('planner', 'task.status.inProgress') },
                            { value: 'review', label: t('planner', 'task.status.review') },
                            { value: 'done', label: t('planner', 'task.status.done') },
                        ]}
                    />
                    <Select
                        label={t('planner', 'courseDetail.unitLabel')}
                        value={taskForm.unitId}
                        onChange={(event) => setTaskForm(current => ({ ...current, unitId: event.target.value }))}
                        options={unitOptions.length > 0 ? unitOptions : [{ value: '', label: t('planner', 'courseDetail.unitFallback') }]}
                    />
                    <Input label={t('planner', 'courseDetail.dueDateOptional')} type="date" value={taskForm.dueDateISO} onChange={(event) => setTaskForm(current => ({ ...current, dueDateISO: event.target.value }))} />
                    <Textarea label={t('planner', 'courseDetail.noteOptional')} value={taskForm.note} onChange={(event) => setTaskForm(current => ({ ...current, note: event.target.value }))} rows={3} />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => { setTaskModalOpen(false); setEditingTask(null) }} disabled={isSavingTask}>{t('common', 'common.cancel')}</Button>
                        <Button type="submit" isLoading={isSavingTask}>{editingTask ? t('common', 'common.update') : t('common', 'common.add')}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={eventModalOpen} onClose={() => { if (!isSavingEvent) { setEventModalOpen(false); setEditingEvent(null) } }} title={editingEvent ? t('planner', 'courseDetail.eventModalTitleEdit') : t('planner', 'courseDetail.eventModalTitleCreate')}>
                <form onSubmit={saveEvent} className="space-y-4">
                    <Select
                        label={t('planner', 'courseDetail.typeLabel')}
                        value={eventForm.type}
                        onChange={(event) => setEventForm(current => ({ ...current, type: event.target.value as PlannerEventType }))}
                        options={[
                            { value: 'event', label: t('planner', 'courseDetail.eventType.event') },
                            { value: 'exam', label: t('planner', 'courseDetail.eventType.exam') },
                        ]}
                    />
                    <Input label={t('planner', 'courseDetail.titleLabel')} value={eventForm.title} onChange={(event) => setEventForm(current => ({ ...current, title: event.target.value }))} autoFocus={!editingEvent} />
                    <Input label={t('planner', 'courseDetail.dateLabel')} type="date" value={eventForm.dateISO} onChange={(event) => setEventForm(current => ({ ...current, dateISO: event.target.value }))} />
                    <Input label={t('planner', 'course.color')} type="color" value={eventForm.color} onChange={(event) => setEventForm(current => ({ ...current, color: event.target.value }))} />
                    <Textarea label={t('planner', 'courseDetail.descriptionOptional')} value={eventForm.description} onChange={(event) => setEventForm(current => ({ ...current, description: event.target.value }))} rows={3} />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => { setEventModalOpen(false); setEditingEvent(null) }} disabled={isSavingEvent}>{t('common', 'common.cancel')}</Button>
                        <Button type="submit" isLoading={isSavingEvent}>{editingEvent ? t('common', 'common.update') : t('common', 'common.add')}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
