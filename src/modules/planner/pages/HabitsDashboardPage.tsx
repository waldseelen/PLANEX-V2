import {
    addHabit,
    deleteHabit,
    logHabit,
    updateHabit,
    useHabits,
    useTodayHabitsWithStatus,
} from '@/db/planner/queries/habitQueries'
import type { DBPlannerHabit, PlannerFrequencyRule } from '@/db/planner/types'
import { useTranslations } from '@/i18n'
import { useToast } from '@/shared/components/Toast'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Archive,
    ArchiveRestore,
    BarChart3,
    CheckCircle,
    Circle,
    Edit2,
    Flame,
    MoreVertical,
    Plus,
    Target,
    Trash2,
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, IconButton } from '../components/ui/Button'
import { Badge, Card, EmptyState, ProgressBar } from '../components/ui/Card'
import { PlannerEntityIcon, PlannerIconField, PLANNER_DEFAULT_ICONS } from '../components/ui/PlannerIconField'
import { Input, Select } from '../components/ui/Input'
import { Modal } from '@/shared/components/Modal'
import { cn } from '../lib/utils'
import { HABIT_COLORS } from '../types'

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function HabitsDashboardPage() {
    const t = useTranslations(['common', 'habits'])
    const location = useLocation()
    const navigate = useNavigate()
    const { showToast } = useToast()

    const allHabits = useHabits()
    const todayHabitsWithStatus = useTodayHabitsWithStatus()
    const allWithStatus = useMemo(
        () => todayHabitsWithStatus ?? [],
        [todayHabitsWithStatus],
    )

    const [showArchived, setShowArchived] = useState(false)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingHabit, setEditingHabit] = useState<DBPlannerHabit | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [openMenu, setOpenMenu] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null)
    const [loggingHabitId, setLoggingHabitId] = useState<string | null>(null)
    const [archivingHabitId, setArchivingHabitId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        emoji: '✨',
        icon: undefined as string | undefined,
        color: HABIT_COLORS[0] as string,
        type: 'boolean' as 'boolean' | 'numeric',
        target: 1,
        unit: '',
        frequencyType: 'weeklyTarget' as PlannerFrequencyRule['type'],
        weeklyTarget: 7,
        specificDays: [1, 2, 3, 4, 5] as number[],
        everyXDays: 1,
    })

    useEffect(() => {
        const state = location.state as undefined | { openCreate?: boolean }
        if (state?.openCreate) {
            setIsAddModalOpen(true)
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [location.state, location.pathname, navigate])

    const dueHabitsWithStatus = useMemo(
        () => allWithStatus.filter(habit => habit.isDueToday),
        [allWithStatus],
    )
    const todayCompleted = useMemo(
        () => dueHabitsWithStatus.filter(habit => habit.isCompletedToday).length,
        [dueHabitsWithStatus],
    )

    const displayHabits = useMemo(() => {
        if (showArchived) {
            return allHabits
                .filter(habit => habit.isArchived)
                .map(habit => ({
                    habit,
                    currentStreak: 0,
                    score: 0,
                    isDueToday: false,
                    isCompletedToday: false,
                }))
        }
        return allWithStatus
            .filter(entry => !entry.habit.isArchived)
            .map(entry => ({
                habit: entry.habit,
                currentStreak: entry.currentStreak,
                score: Math.min(100, Math.round((entry.currentStreak / 30) * 100)),
                isDueToday: entry.isDueToday,
                isCompletedToday: entry.isCompletedToday,
            }))
    }, [allHabits, allWithStatus, showArchived])

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()

        if (!formData.title.trim()) {
            showToast(t('habits', 'toast.nameRequired'), { variant: 'error' })
            return
        }

        let frequency: PlannerFrequencyRule
        switch (formData.frequencyType) {
            case 'weeklyTarget':
                frequency = { type: 'weeklyTarget', timesPerWeek: formData.weeklyTarget }
                break
            case 'specificDays':
                frequency = { type: 'specificDays', days: formData.specificDays }
                break
            case 'everyXDays':
                frequency = { type: 'everyXDays', interval: formData.everyXDays }
                break
        }

        const habitData = {
            title: formData.title.trim(),
            description: formData.description.trim() || undefined,
            emoji: formData.emoji,
            icon: formData.icon,
            color: formData.color,
            type: formData.type,
            target: formData.type === 'numeric' ? formData.target : undefined,
            unit: formData.type === 'numeric' ? formData.unit.trim() || undefined : undefined,
            frequency,
        }

        setIsSubmitting(true)
        try {
            if (editingHabit) {
                await updateHabit(editingHabit.id, habitData)
                showToast(t('habits', 'toast.updated'), { variant: 'success' })
            } else {
                await addHabit(habitData)
                showToast(t('habits', 'toast.created'), { variant: 'success' })
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
        setEditingHabit(null)
        setFormData({
            title: '',
            description: '',
            emoji: '✨',
            icon: undefined,
            color: HABIT_COLORS[0] as string,
            type: 'boolean',
            target: 1,
            unit: '',
            frequencyType: 'weeklyTarget',
            weeklyTarget: 7,
            specificDays: [1, 2, 3, 4, 5],
            everyXDays: 1,
        })
    }

    function openEditModal(habit: DBPlannerHabit) {
        setEditingHabit(habit)
        setIsAddModalOpen(true)
        setFormData({
            title: habit.title,
            description: habit.description || '',
            emoji: habit.emoji,
            icon: habit.icon,
            color: habit.color || HABIT_COLORS[0],
            type: habit.type,
            target: habit.target || 1,
            unit: habit.unit || '',
            frequencyType: habit.frequency.type,
            weeklyTarget: habit.frequency.type === 'weeklyTarget' ? habit.frequency.timesPerWeek ?? 7 : 7,
            specificDays: habit.frequency.type === 'specificDays' ? habit.frequency.days ?? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5],
            everyXDays: habit.frequency.type === 'everyXDays' ? habit.frequency.interval ?? 1 : 1,
        })
        setOpenMenu(null)
    }

    async function toggleHabit(habit: DBPlannerHabit, isCompleted: boolean) {
        setLoggingHabitId(habit.id)
        try {
            await logHabit(
                habit.id,
                new Date().toISOString().split('T')[0],
                !isCompleted,
                !isCompleted && habit.type === 'numeric' ? habit.target : undefined,
            )
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setLoggingHabitId(null)
        }
    }

    async function handleDelete(id: string) {
        setDeletingHabitId(id)
        try {
            await deleteHabit(id)
            setDeleteConfirm(null)
            showToast(t('habits', 'toast.deleted'), { variant: 'success' })
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setDeletingHabitId(null)
        }
    }

    async function toggleArchive(habit: DBPlannerHabit) {
        setArchivingHabitId(habit.id)
        try {
            await updateHabit(habit.id, { isArchived: !habit.isArchived })
            showToast(habit.isArchived ? t('habits', 'toast.restored') : t('habits', 'toast.archived'), { variant: 'success' })
            setOpenMenu(null)
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setArchivingHabitId(null)
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-primary">{t('habits', 'title')}</h1>
                    <p className="mt-1 text-secondary">
                        {t('habits', 'dashboard.todayCompleted', { completed: todayCompleted, total: dueHabitsWithStatus.length })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => setShowArchived(!showArchived)}
                        leftIcon={<Archive className="h-4 w-4" />}
                    >
                        {showArchived ? t('habits', 'dashboard.showActive') : t('habits', 'dashboard.showArchived')}
                    </Button>
                    <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                        {t('habits', 'dashboard.addHabit')}
                    </Button>
                </div>
            </div>

            {!showArchived && dueHabitsWithStatus.length > 0 && (
                <Card>
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-semibold text-primary">{t('habits', 'dashboard.todayProgress')}</h3>
                        <span className="text-sm text-secondary">
                            {Math.round((todayCompleted / dueHabitsWithStatus.length) * 100)}%
                        </span>
                    </div>
                    <ProgressBar
                        value={(todayCompleted / dueHabitsWithStatus.length) * 100}
                        color="var(--status-green)"
                    />
                </Card>
            )}

            {displayHabits.length === 0 ? (
                <EmptyState
                    icon={<Target className="h-8 w-8 text-tertiary" />}
                    title={showArchived ? t('habits', 'dashboard.emptyArchived') : t('habits', 'empty.noHabits')}
                    description={t('habits', 'dashboard.emptyDescription')}
                    action={
                        !showArchived && (
                            <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                                {t('habits', 'dashboard.addFirstHabit')}
                            </Button>
                        )
                    }
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {displayHabits.map((habitEntry) => {
                            const isCompletedToday = habitEntry.isCompletedToday
                            const isDueToday = habitEntry.isDueToday
                            const isLogging = loggingHabitId === habitEntry.habit.id
                            const isArchiving = archivingHabitId === habitEntry.habit.id

                            return (
                                <motion.div
                                    key={habitEntry.habit.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    layout
                                >
                                    <Card
                                        className={cn(
                                            'relative overflow-hidden transition-all',
                                            habitEntry.habit.isArchived && 'opacity-60',
                                        )}
                                        style={{ borderColor: `${habitEntry.habit.color ?? ''}40` }}
                                    >
                                        <div
                                            className="absolute left-0 right-0 top-0 h-1"
                                            style={{ backgroundColor: habitEntry.habit.color ?? 'transparent' }}
                                        />

                                        <div className="flex items-start gap-3 pt-2">
                                            {isDueToday && !habitEntry.habit.isArchived && (
                                                <button
                                                    onClick={() => void toggleHabit(habitEntry.habit, isCompletedToday)}
                                                    className={cn(
                                                        'mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-all',
                                                        isCompletedToday
                                                            ? 'border-status-green/20 bg-status-green-soft text-status-green'
                                                            : 'border-default text-secondary hover:text-primary',
                                                    )}
                                                    aria-label={isCompletedToday ? t('habits', 'actions.markUndone') : t('habits', 'actions.markDone')}
                                                    disabled={isLogging}
                                                >
                                                    {isCompletedToday ? (
                                                        <CheckCircle className="h-4 w-4" />
                                                    ) : (
                                                        <Circle className="h-4 w-4" />
                                                    )}
                                                </button>
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    to={`/habits/${habitEntry.habit.id}`}
                                                    className="group flex items-center gap-3"
                                                >
                                                    <span
                                                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-surface-100"
                                                        style={{ color: habitEntry.habit.color ?? '#6366f1' }}
                                                    >
                                                        {habitEntry.habit.icon ? (
                                                            <PlannerEntityIcon
                                                                icon={habitEntry.habit.icon}
                                                                fallbackIcon={PLANNER_DEFAULT_ICONS.habit}
                                                                size={18}
                                                                color={habitEntry.habit.color ?? '#6366f1'}
                                                            />
                                                        ) : (
                                                            <span className="text-xl">{habitEntry.habit.emoji}</span>
                                                        )}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <h3 className="truncate font-semibold text-primary transition-colors group-hover:text-[var(--color-accent)]">
                                                            {habitEntry.habit.title}
                                                        </h3>
                                                        {habitEntry.habit.description && (
                                                            <p className="mt-1 line-clamp-1 text-sm text-secondary">
                                                                {habitEntry.habit.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </Link>

                                                <div className="mt-3 flex items-center gap-4">
                                                    <div className="flex items-center gap-1">
                                                        <Flame className="h-4 w-4 text-status-amber" />
                                                        <span className="text-sm font-medium text-primary">
                                                            {habitEntry.currentStreak}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <BarChart3 className="h-4 w-4 text-status-blue" />
                                                        <span className="text-sm font-medium text-primary">
                                                            {habitEntry.score}%
                                                        </span>
                                                    </div>
                                                    {!isDueToday && !habitEntry.habit.isArchived && (
                                                        <Badge size="sm" color="#94a3b8">
                                                            {t('habits', 'dashboard.notDueToday')}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <IconButton
                                                    size="sm"
                                                    onClick={() => setOpenMenu(openMenu === habitEntry.habit.id ? null : habitEntry.habit.id)}
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </IconButton>

                                                {openMenu === habitEntry.habit.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-10"
                                                            onClick={() => setOpenMenu(null)}
                                                        />
                                                        <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-default bg-primary py-1 shadow-lg">
                                                            <button
                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-secondary hover:bg-secondary"
                                                                onClick={() => openEditModal(habitEntry.habit)}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                                {t('habits', 'dashboard.editMenu')}
                                                            </button>
                                                            <button
                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-secondary hover:bg-secondary"
                                                                onClick={() => void toggleArchive(habitEntry.habit)}
                                                                disabled={isArchiving}
                                                            >
                                                                {habitEntry.habit.isArchived ? (
                                                                    <>
                                                                        <ArchiveRestore className="h-4 w-4" />
                                                                        {t('habits', 'habit.unarchive')}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Archive className="h-4 w-4" />
                                                                        {t('habits', 'habit.archive')}
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button
                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-status-red hover:bg-secondary"
                                                                onClick={() => {
                                                                    setDeleteConfirm(habitEntry.habit.id)
                                                                    setOpenMenu(null)
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                {t('common', 'common.delete')}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            )}

            <Modal
                isOpen={isAddModalOpen || !!editingHabit}
                onClose={closeModal}
                title={editingHabit ? t('habits', 'habit.edit') : t('habits', 'habit.create')}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label={t('habits', 'habit.name')}
                        placeholder={t('habits', 'form.titlePlaceholder')}
                        value={formData.title}
                        onChange={(event) => setFormData(current => ({ ...current, title: event.target.value }))}
                        autoFocus
                    />

                    <PlannerIconField
                        value={formData.icon}
                        onChange={(icon) => setFormData(current => ({ ...current, icon }))}
                        fallbackIcon={PLANNER_DEFAULT_ICONS.habit}
                        previewColor={formData.color}
                    />

                    <Input
                        label={t('habits', 'form.descriptionOptional')}
                        placeholder={t('habits', 'form.descriptionPlaceholder')}
                        value={formData.description}
                        onChange={(event) => setFormData(current => ({ ...current, description: event.target.value }))}
                    />

                    <div>
                        <label className="mb-2 block text-sm font-medium text-secondary">{t('habits', 'habit.color')}</label>
                        <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-10">
                            {HABIT_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    className={cn(
                                        'h-9 w-9 rounded-full border border-white/10 shadow-sm transition-transform duration-150',
                                        formData.color === color
                                            ? 'scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-surface-100'
                                            : 'hover:scale-105',
                                    )}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setFormData(current => ({ ...current, color }))}
                                    aria-label={color}
                                />
                            ))}
                        </div>
                    </div>

                    <Select
                        label={t('habits', 'form.typeLabel')}
                        value={formData.type}
                        onChange={(event) => setFormData(current => ({ ...current, type: event.target.value as 'boolean' | 'numeric' }))}
                        options={[
                            { value: 'boolean', label: t('habits', 'form.booleanType') },
                            { value: 'numeric', label: t('habits', 'form.numericType') },
                        ]}
                    />

                    {formData.type === 'numeric' && (
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                type="number"
                                label={t('habits', 'form.dailyTarget')}
                                min={1}
                                value={formData.target}
                                onChange={(event) => setFormData(current => ({ ...current, target: parseInt(event.target.value, 10) || 1 }))}
                            />
                            <Input
                                label={t('habits', 'habit.unit')}
                                placeholder={t('habits', 'form.unitPlaceholder')}
                                value={formData.unit}
                                onChange={(event) => setFormData(current => ({ ...current, unit: event.target.value }))}
                            />
                        </div>
                    )}

                    <Select
                        label={t('habits', 'frequency.title')}
                        value={formData.frequencyType}
                        onChange={(event) => setFormData(current => ({ ...current, frequencyType: event.target.value as PlannerFrequencyRule['type'] }))}
                        options={[
                            { value: 'weeklyTarget', label: t('habits', 'frequencyType.weeklyTarget') },
                            { value: 'specificDays', label: t('habits', 'frequencyType.specificDays') },
                            { value: 'everyXDays', label: t('habits', 'frequencyType.everyXDays') },
                        ]}
                    />

                    {formData.frequencyType === 'weeklyTarget' && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-secondary">
                                {t('habits', 'dashboard.weeklyTargetQuestion')}
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={7}
                                value={formData.weeklyTarget}
                                onChange={(event) => setFormData(current => ({ ...current, weeklyTarget: parseInt(event.target.value, 10) }))}
                                className="w-full"
                            />
                            <p className="mt-1 text-center text-sm text-secondary">{t('habits', 'dashboard.weeklyTargetValue', { count: formData.weeklyTarget })}</p>
                        </div>
                    )}

                    {formData.frequencyType === 'specificDays' && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-secondary">{t('habits', 'dashboard.daysLabel')}</label>
                            <div className="flex gap-2">
                                {(t('habits', 'weekdaysShort') as unknown as string[]).map((label, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className={cn(
                                            'h-10 w-10 rounded-full text-sm font-medium transition-colors',
                                            formData.specificDays.includes(index)
                                                ? 'bg-[var(--color-accent)] text-white'
                                                : 'bg-secondary text-secondary',
                                        )}
                                        onClick={() => {
                                            const days = formData.specificDays.includes(index)
                                                ? formData.specificDays.filter(day => day !== index)
                                                : [...formData.specificDays, index].sort()
                                            setFormData(current => ({ ...current, specificDays: days }))
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {formData.frequencyType === 'everyXDays' && (
                        <Input
                            type="number"
                            label={t('habits', 'dashboard.everyXDaysQuestion')}
                            min={1}
                            max={30}
                            value={formData.everyXDays}
                            onChange={(event) => setFormData(current => ({ ...current, everyXDays: parseInt(event.target.value, 10) || 1 }))}
                        />
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>
                            {t('common', 'common.cancel')}
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>{editingHabit ? t('common', 'common.update') : t('common', 'common.add')}</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={t('habits', 'dashboard.deleteTitle')}
                size="sm"
            >
                <p className="mb-6 text-secondary">
                    {t('habits', 'dashboard.deleteConfirm')}
                </p>
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={!!deletingHabitId}>
                        {t('common', 'common.cancel')}
                    </Button>
                    <Button
                        variant="danger"
                        isLoading={deleteConfirm !== null && deletingHabitId === deleteConfirm}
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
