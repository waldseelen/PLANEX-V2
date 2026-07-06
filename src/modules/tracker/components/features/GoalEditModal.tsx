import { useActiveActivities } from '@/db/time-tracking/queries/activityQueries'
import { createGoal, deleteGoal, updateGoal } from '@/db/time-tracking/queries/goalQueries'
import type { Goal, GoalScope } from '@/db/time-tracking/types'
import { useTranslations } from '@/i18n'
import { Modal } from '@/shared/components/Modal'
import { useToast } from '@/shared/components/Toast'
import { clsx } from 'clsx'
import { Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface GoalEditModalProps {
    goal: Goal | null
    isOpen: boolean
    onClose: () => void
}

interface FormData {
    name: string
    scope: GoalScope
    targetHours: number
    targetMinutes: number
    activityId: string
}

export function GoalEditModal({ goal, isOpen, onClose }: GoalEditModalProps) {
    const t = useTranslations(['common', 'tracker'])
    const { showToast } = useToast()
    const activities = useActiveActivities()
    const isEditing = goal != null

    const [form, setForm] = useState<FormData>({
        name: '',
        scope: 'daily',
        targetHours: 1,
        targetMinutes: 0,
        activityId: '',
    })
    const [saving, setSaving] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const scopes: Array<{ key: GoalScope; label: string }> = [
        { key: 'daily', label: t('tracker', 'goal.scope.daily') },
        { key: 'weekly', label: t('tracker', 'goal.scope.weekly') },
        { key: 'monthly', label: t('tracker', 'goal.scope.monthly') },
        { key: 'yearly', label: t('tracker', 'goal.scope.yearly') },
    ]

    useEffect(() => {
        if (goal) {
            const totalMinutes = Math.floor(goal.targetValue / 60)
            setForm({
                name: goal.name,
                scope: goal.scope,
                targetHours: Math.floor(totalMinutes / 60),
                targetMinutes: totalMinutes % 60,
                activityId: goal.activityId ?? '',
            })
        } else {
            setForm({ name: '', scope: 'daily', targetHours: 1, targetMinutes: 0, activityId: '' })
        }
        setConfirmDelete(false)
    }, [goal, isOpen])

    useEffect(() => {
        if (!isOpen) {
            return
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = ''
            }
        }
    }, [isOpen])

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) {
            return
        }

        const targetValue = form.targetHours * 3600 + form.targetMinutes * 60
        if (targetValue <= 0) {
            return
        }

        setSaving(true)
        try {
            if (isEditing && goal) {
                await updateGoal(goal.id, {
                    name: form.name.trim(),
                    scope: form.scope,
                    targetValue,
                    activityId: form.activityId || undefined,
                })
            } else {
                await createGoal({
                    name: form.name.trim(),
                    scope: form.scope,
                    metric: 'time',
                    targetValue,
                    activityId: form.activityId || undefined,
                    enabled: true,
                })
            }

            onClose()
        } finally {
            setSaving(false)
        }
    }, [form, goal, isEditing, onClose])

    const handleDelete = useCallback(async () => {
        if (!goal) {
            return
        }

        if (!confirmDelete) {
            setConfirmDelete(true)
            return
        }

        setSaving(true)
        try {
            await deleteGoal(goal.id)
            showToast(t('tracker', 'goal.deletedSuccess'), { variant: 'success' })
            onClose()
        } catch (error) {
            showToast(error instanceof Error ? error.message : t('common', 'toast.error'), { variant: 'error' })
            setConfirmDelete(false)
        } finally {
            setSaving(false)
        }
    }, [confirmDelete, goal, onClose, showToast, t])

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('tracker', 'goal.edit') : t('tracker', 'goal.new')}
            size="md"
            footer={
                <div className="flex items-center justify-between">
                    {isEditing ? (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="btn-ghost gap-2 text-status-red"
                        >
                            <Trash2 className="h-4 w-4" />
                            {confirmDelete ? t('tracker', 'modal.confirmDelete') : t('common', 'common.delete')}
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">
                            {t('common', 'common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !form.name.trim()}
                            className="btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? t('tracker', 'modal.saving') : t('common', 'common.save')}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="form-label">{t('tracker', 'goal.name')}</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                        placeholder={t('tracker', 'goal.name')}
                        className="input"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="form-label">{t('tracker', 'goal.progress')}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {scopes.map(scope => (
                            <button
                                key={scope.key}
                                type="button"
                                onClick={() => setForm(current => ({ ...current, scope: scope.key }))}
                                className={clsx(
                                    'rounded-md px-3 py-2 text-xs font-medium transition-colors',
                                    form.scope === scope.key
                                        ? 'bg-surface-300 text-text-primary'
                                        : 'bg-surface-100 text-text-secondary hover:bg-surface-200',
                                )}
                            >
                                {scope.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="form-label">{t('tracker', 'goal.targetTime')}</label>
                    <div className="grid grid-cols-[88px_1fr_88px_1fr] items-center gap-2">
                        <input
                            type="number"
                            min={0}
                            max={24}
                            value={form.targetHours}
                            onChange={event => setForm(current => ({ ...current, targetHours: Number(event.target.value) }))}
                            className="input text-center"
                        />
                        <span className="text-xs text-text-muted">{t('tracker', 'time.hours')}</span>
                        <input
                            type="number"
                            min={0}
                            max={59}
                            value={form.targetMinutes}
                            onChange={event => setForm(current => ({ ...current, targetMinutes: Number(event.target.value) }))}
                            className="input text-center"
                        />
                        <span className="text-xs text-text-muted">{t('tracker', 'time.minutes')}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="form-label">
                        {t('tracker', 'activity.title')} {t('common', 'common.optional')}
                    </label>
                    <select
                        value={form.activityId}
                        onChange={event => setForm(current => ({ ...current, activityId: event.target.value }))}
                        className="input"
                    >
                        <option value="">{t('tracker', 'tag.allActivities')}</option>
                        {activities.map(activity => (
                            <option key={activity.id} value={activity.id}>
                                {activity.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </Modal>
    )
}
