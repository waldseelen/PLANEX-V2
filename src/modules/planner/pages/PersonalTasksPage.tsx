import {
    addPersonalTask,
    deletePersonalTask,
    updatePersonalTask,
    usePersonalTasks,
} from '@/db/planner/queries/personalTaskQueries'
import type { DBPersonalTask, TaskStatus } from '@/db/planner/types'
import { useTranslations } from '@/i18n'
import { useToast } from '@/shared/components/Toast'
import { AnimatePresence, motion } from 'framer-motion'
import {
    CalendarDays,
    CheckCircle,
    Circle,
    Clock,
    Edit2,
    ListTodo,
    Plus,
    Trash2,
    LayoutGrid,
    List,
    BarChart3
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarView } from '../components/features/CalendarView'
import { ExternalSearchButtons } from '../components/features/ExternalSearchButtons'
import { KanbanBoard } from '../components/features/KanbanBoard'
import { TimelineView } from '../components/features/TimelineView'
import { Button, IconButton } from '../components/ui/Button'
import { Badge, Card, EmptyState } from '../components/ui/Card'
import { PlannerEntityIcon, PlannerIconField, PLANNER_DEFAULT_ICONS } from '../components/ui/PlannerIconField'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Modal } from '@/shared/components/Modal'
import { cn, formatDateDisplay } from '../lib/utils'

const statusColors: Record<TaskStatus, string> = {
    todo: '#94a3b8',
    'in-progress': '#3b82f6',
    review: '#f59e0b',
    done: '#22c55e',
    blocked: '#ef4444',
    planning: '#818cf8',
    'permits-awaited': '#f59e0b',
}

const statusDotClass: Record<TaskStatus, string> = {
    todo: 'bg-text-muted',
    'in-progress': 'bg-status-amber',
    review: 'bg-status-blue',
    done: 'bg-status-green',
    blocked: 'bg-red-500',
    planning: 'bg-indigo-400',
    'permits-awaited': 'bg-amber-500',
}

const statusBorderClass: Record<TaskStatus, string> = {
    todo: 'border-l-transparent',
    'in-progress': 'border-l-status-amber',
    review: 'border-l-status-blue',
    done: 'border-l-status-green',
    blocked: 'border-l-red-500',
    planning: 'border-l-indigo-400',
    'permits-awaited': 'border-l-amber-500',
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function PersonalTasksPage() {
    const t = useTranslations(['common', 'planner'])
    const location = useLocation()
    const navigate = useNavigate()
    const { showToast } = useToast()

    const personalTasks = usePersonalTasks()

    const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'timeline' | 'calendar'>('list')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<DBPersonalTask | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
    const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        text: '',
        icon: undefined as string | undefined,
        status: 'todo' as TaskStatus,
        isPriority: false,
        dueDateISO: '',
        note: '',
    })

    const statusLabels: Record<TaskStatus, string> = {
        todo: t('planner', 'task.status.todo'),
        'in-progress': t('planner', 'task.status.inProgress'),
        review: t('planner', 'task.status.review'),
        done: t('planner', 'task.status.done'),
        blocked: 'Blocked',
        planning: 'Planning',
        'permits-awaited': 'Permits awaited',
    }

    useEffect(() => {
        const state = location.state as undefined | { openCreate?: boolean }
        if (state?.openCreate) {
            setIsAddModalOpen(true)
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [location.state, location.pathname, navigate])

    const filteredTasks = personalTasks.filter(
        task => filter === 'all' || task.status === filter,
    )

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (!formData.text.trim()) {
            showToast(t('planner', 'validation.taskTextRequired'), { variant: 'error' })
            return
        }

        setIsSubmitting(true)
        try {
            if (editingTask) {
                await updatePersonalTask(editingTask.id, {
                    text: formData.text.trim(),
                    icon: formData.icon,
                    status: formData.status,
                    isPriority: formData.isPriority,
                    dueDateISO: formData.dueDateISO || undefined,
                    note: formData.note.trim() || undefined,
                })
                showToast(t('common', 'toast.updated'), { variant: 'success' })
            } else {
                await addPersonalTask({
                    text: formData.text.trim(),
                    icon: formData.icon,
                    status: formData.status,
                    isPriority: formData.isPriority,
                    dueDateISO: formData.dueDateISO || undefined,
                    note: formData.note.trim() || undefined,
                })
                showToast(t('common', 'toast.created'), { variant: 'success' })
            }

            closeModal()
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setIsSubmitting(false)
        }
    }

    function closeModal() {
        if (isSubmitting) return
        setIsAddModalOpen(false)
        setEditingTask(null)
        setFormData({
            text: '',
            icon: undefined,
            status: 'todo',
            isPriority: false,
            dueDateISO: '',
            note: '',
        })
    }

    function openEditModal(task: DBPersonalTask) {
        setEditingTask(task)
        setFormData({
            text: task.text,
            icon: task.icon,
            status: task.status,
            isPriority: task.isPriority || false,
            dueDateISO: task.dueDateISO || '',
            note: task.note || '',
        })
    }

    async function toggleTaskStatus(task: DBPersonalTask) {
        const newStatus = task.status === 'done' ? 'todo' : 'done'
        setTogglingTaskId(task.id)
        try {
            await updatePersonalTask(task.id, { status: newStatus })
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setTogglingTaskId(null)
        }
    }

    async function handleDelete(id: string) {
        setDeletingTaskId(id)
        try {
            await deletePersonalTask(id)
            setDeleteConfirm(null)
            showToast(t('common', 'toast.deleted'), { variant: 'success' })
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setDeletingTaskId(null)
        }
    }

    const handleAddTaskInStatus = (status: TaskStatus) => {
        setFormData(current => ({
            ...current,
            status
        }))
        setIsAddModalOpen(true)
    }

    const handleUpdateStatus = async (id: string, status: TaskStatus) => {
        try {
            await updatePersonalTask(id, { status })
            showToast(t('common', 'toast.updated'), { variant: 'success' })
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header section */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-primary">{t('planner', 'personalTask.title')}</h1>
                    <p className="mt-1 text-secondary">{t('common', 'app.taskCount', { count: personalTasks.length })}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Switcher Tabs */}
                    <div className="flex bg-surface-200 p-0.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold">
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                                viewMode === 'list' 
                                    ? "bg-surface-50 text-text-primary shadow-sm" 
                                    : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <List className="h-3.5 w-3.5" />
                            <span>List</span>
                        </button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                                viewMode === 'kanban' 
                                    ? "bg-surface-50 text-text-primary shadow-sm" 
                                    : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span>Kanban</span>
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                                viewMode === 'timeline'
                                    ? "bg-surface-50 text-text-primary shadow-sm"
                                    : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Timeline</span>
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all",
                                viewMode === 'calendar'
                                    ? "bg-surface-50 text-text-primary shadow-sm"
                                    : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <CalendarDays className="h-3.5 w-3.5" />
                            <span>Takvim</span>
                        </button>
                    </div>

                    <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                        {t('planner', 'personalTask.create')}
                    </Button>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <>
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'todo', 'in-progress', 'review', 'done', 'blocked', 'planning', 'permits-awaited'] as const).map((status) => (
                            <Button
                                key={status}
                                variant={filter === status ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setFilter(status)}
                            >
                                {status === 'all' ? t('common', 'common.all') : statusLabels[status]}
                            </Button>
                        ))}
                    </div>

                    {filteredTasks.length === 0 ? (
                        <EmptyState
                            icon={<ListTodo className="h-8 w-8 text-tertiary" />}
                            title={filter === 'all' ? t('planner', 'personalTask.emptyTitle') : t('common', 'app.noTasksForFilter')}
                            description={t('planner', 'personalTask.emptyDescription')}
                            action={
                                filter === 'all' && (
                                    <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                                        {t('common', 'app.addFirstTask')}
                                    </Button>
                                )
                            }
                        />
                    ) : (
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {filteredTasks.map((task) => (
                                    <motion.div
                                        key={task.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        layout
                                    >
                                        <Card
                                            className={cn(
                                                'group relative border-l-2 transition-colors',
                                                statusBorderClass[task.status],
                                                task.status === 'done' && 'opacity-60',
                                            )}
                                        >
                                            {task.isPriority && (
                                                <span className="absolute top-3 right-12 h-1.5 w-1.5 rounded-full bg-status-amber" />
                                            )}
                                            <div className="flex items-start gap-4">
                                                <div className="mt-1.5 flex flex-shrink-0 items-center gap-2">
                                                    <span className={cn('h-2 w-2 rounded-full', statusDotClass[task.status])} />
                                                    <button
                                                        type="button"
                                                        onClick={() => void toggleTaskStatus(task)}
                                                        disabled={togglingTaskId === task.id}
                                                    >
                                                        {task.status === 'done' ? (
                                                            <CheckCircle className="h-5 w-5 text-status-green" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-text-muted transition-colors hover:text-text-primary" />
                                                        )}
                                                    </button>
                                                </div>

                                                <div
                                                    className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-surface-100"
                                                    style={{ color: statusColors[task.status] }}
                                                >
                                                    <PlannerEntityIcon
                                                        icon={task.icon}
                                                        fallbackIcon={PLANNER_DEFAULT_ICONS.personalTask}
                                                        size={18}
                                                        color={statusColors[task.status]}
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p
                                                        className={cn(
                                                            'font-medium',
                                                            task.status === 'done'
                                                                ? 'text-secondary line-through'
                                                                : 'text-primary',
                                                        )}
                                                    >
                                                        {task.text}
                                                    </p>

                                                    {task.note && (
                                                        <p className="mt-1 line-clamp-2 text-sm text-secondary">
                                                            {task.note}
                                                        </p>
                                                    )}

                                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                                        {task.dueDateISO && (
                                                            <span className="flex items-center gap-1 font-mono text-sm text-text-muted">
                                                                <Clock className="h-3.5 w-3.5" />
                                                                {formatDateDisplay(task.dueDateISO)}
                                                            </span>
                                                        )}
                                                        <Badge color={statusColors[task.status]}>
                                                            {statusLabels[task.status]}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <ExternalSearchButtons title={task.text} description={task.note} />

                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <IconButton size="sm" onClick={() => openEditModal(task)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="sm"
                                                        variant="danger"
                                                        onClick={() => setDeleteConfirm(task.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </IconButton>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </>
            )}

            {/* Kanban Pano Görünümü */}
            {viewMode === 'kanban' && (
                <KanbanBoard
                    tasks={personalTasks}
                    onUpdateStatus={handleUpdateStatus}
                    onSelectTask={openEditModal}
                    onAddTaskInStatus={handleAddTaskInStatus}
                />
            )}

            {/* Timeline Görünümü */}
            {viewMode === 'timeline' && (
                <TimelineView
                    tasks={personalTasks}
                    onSelectTask={openEditModal}
                />
            )}

            {/* Takvim Görünümü (etkinlikler + sınavlar) */}
            {viewMode === 'calendar' && <CalendarView />}

            {/* Task Add / Edit Modal */}
            <Modal
                isOpen={isAddModalOpen || !!editingTask}
                onClose={closeModal}
                title={editingTask ? t('planner', 'task.edit') : t('planner', 'task.create')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label={t('planner', 'task.title')}
                        placeholder={t('planner', 'examples.taskDescription')}
                        value={formData.text}
                        onChange={(event) => setFormData(current => ({ ...current, text: event.target.value }))}
                        autoFocus
                    />

                    <PlannerIconField
                        value={formData.icon}
                        onChange={(icon) => setFormData(current => ({ ...current, icon }))}
                        fallbackIcon={PLANNER_DEFAULT_ICONS.personalTask}
                        previewColor={statusColors[formData.status]}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label={t('common', 'app.status')}
                            value={formData.status}
                            onChange={(event) => setFormData(current => ({ ...current, status: event.target.value as TaskStatus }))}
                            options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
                        />
                        <Input
                            type="date"
                            label={t('planner', 'task.dueDate')}
                            value={formData.dueDateISO}
                            onChange={(event) => setFormData(current => ({ ...current, dueDateISO: event.target.value }))}
                        />
                    </div>

                    <label className="flex cursor-pointer items-center gap-3">
                        <input
                            type="checkbox"
                            checked={formData.isPriority}
                            onChange={(event) => setFormData(current => ({ ...current, isPriority: event.target.checked }))}
                            className="h-4 w-4 rounded border-default text-[var(--color-accent)]"
                        />
                        <span className="text-secondary">{t('common', 'app.priority')}</span>
                    </label>

                    <Textarea
                        label={`${t('planner', 'task.note')} ${t('common', 'common.optional')}`}
                        placeholder={t('planner', 'examples.additionalNotes')}
                        value={formData.note}
                        onChange={(event) => setFormData(current => ({ ...current, note: event.target.value }))}
                        rows={3}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>
                            {t('common', 'common.cancel')}
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            {editingTask ? t('common', 'common.update') : t('common', 'common.add')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={t('planner', 'task.delete')}
                size="sm"
            >
                <p className="mb-6 text-secondary">{t('planner', 'task.deleteConfirm')}</p>
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={!!deletingTaskId}>
                        {t('common', 'common.cancel')}
                    </Button>
                    <Button
                        variant="danger"
                        isLoading={deleteConfirm !== null && deletingTaskId === deleteConfirm}
                        onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                        disabled={deleteConfirm === null}
                    >
                        {t('common', 'common.delete')}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
