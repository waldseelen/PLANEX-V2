/**
 * ReminderEditModal — Hatırlatma Oluştur/Düzenle Modal
 */

import { createReminder, deleteReminder, updateReminder } from '@/db/time-tracking/queries/reminderQueries'
import type { Reminder, ReminderKind } from '@/db/time-tracking/types'
import { useTranslations } from '@/i18n'
import { useToast } from '@/shared/components'
import { Modal } from '@/shared/components/Modal'
import { Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface ReminderEditModalProps {
    reminder: Reminder | null
    isOpen: boolean
    onClose: () => void
}

interface FormData {
    title: string
    message: string
    time: string
    kind: ReminderKind
    enabled: boolean
}

export function ReminderEditModal({ reminder, isOpen, onClose }: ReminderEditModalProps) {
    const t = useTranslations(['common', 'tracker'])
    const { showToast } = useToast()
    const isEditing = reminder != null

    const [form, setForm] = useState<FormData>({
        title: '',
        message: '',
        time: '08:00',
        kind: 'custom',
        enabled: true,
    })
    const [saving, setSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (reminder) {
            setForm({
                title: reminder.title,
                message: reminder.message,
                time: reminder.schedule.time,
                kind: reminder.kind,
                enabled: reminder.enabled,
            })
        } else {
            setForm({ title: '', message: '', time: '08:00', kind: 'custom', enabled: true })
        }
        setErrorMessage(null)
    }, [reminder, isOpen])

    const handleSave = useCallback(async () => {
        if (!form.title.trim()) return
        setSaving(true)
        try {
            const data = {
                kind: form.kind,
                title: form.title.trim(),
                message: form.message.trim(),
                schedule: { time: form.time },
                enabled: form.enabled,
            }
            if (isEditing && reminder) {
                await updateReminder(reminder.id, data)
            } else {
                await createReminder(data)
            }
            showToast(
                isEditing ? t('common', 'toast.updated') : t('common', 'toast.created'),
                { variant: 'success' },
            )
            onClose()
        } catch (error) {
            const message = error instanceof Error && error.message.trim()
                ? error.message
                : t('common', 'toast.error')
            setErrorMessage(message)
            showToast(message, { variant: 'error' })
        } finally {
            setSaving(false)
        }
    }, [form, isEditing, reminder, onClose, showToast, t])

    const handleDelete = useCallback(async () => {
        if (!reminder) return
        setSaving(true)
        try {
            await deleteReminder(reminder.id)
            showToast(t('common', 'toast.deleted'), { variant: 'success' })
            onClose()
        } catch (error) {
            const message = error instanceof Error && error.message.trim()
                ? error.message
                : t('common', 'toast.error')
            showToast(message, { variant: 'error' })
        } finally {
            setSaving(false)
        }
    }, [reminder, onClose, showToast, t])

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('tracker', 'reminder.edit') : t('tracker', 'reminder.new')}
            size="md"
            footer={
                <div className="flex justify-between gap-2">
                    {isEditing ? (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-status-red hover:bg-status-red-soft disabled:opacity-40 transition-colors"
                        >
                            <Trash2 size={14} />
                            {t('common', 'common.delete')}
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs text-text-secondary hover:bg-surface-100 transition-colors"
                        >
                            {t('common', 'common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !form.title.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white dark:text-black bg-black dark:bg-white hover:opacity-90 disabled:opacity-40 transition-colors"
                        >
                            <Save size={14} />
                            {saving ? t('tracker', 'modal.saving') : t('common', 'common.save')}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                {/* Title */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        {t('tracker', 'reminder.title')}
                    </label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder={t('tracker', 'reminder.title')}
                        className="w-full rounded-xl bg-surface-100 border border-[var(--border-subtle)] px-3 py-2.5 text-sm text-text-primary placeholder:text-surface-600 focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] outline-none transition-all"
                        autoFocus
                    />
                </div>

                {/* Message */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        {t('tracker', 'reminder.message')}
                    </label>
                    <input
                        type="text"
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder={t('tracker', 'reminder.message')}
                        className="w-full rounded-xl bg-surface-100 border border-[var(--border-subtle)] px-3 py-2.5 text-sm text-text-primary placeholder:text-surface-600 focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] outline-none transition-all"
                    />
                </div>

                {/* Time */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        {t('tracker', 'reminder.time')}
                    </label>
                    <input
                        type="time"
                        value={form.time}
                        onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                        className="rounded-xl bg-surface-100 border border-[var(--border-subtle)] px-3 py-2.5 text-sm text-text-primary focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] outline-none transition-all"
                    />
                </div>

                {/* Enabled */}
                <label className="flex cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                        className="h-4 w-4 rounded"
                    />
                    <span className="text-sm text-text-secondary">
                        {t('tracker', 'reminder.enabled')}
                    </span>
                </label>

                {errorMessage && (
                    <p className="text-xs text-status-red">{errorMessage}</p>
                )}
            </div>
        </Modal>
    )
}
