/**
 * TagEditModal — Etiket Oluştur/Düzenle Modal
 */

import { useTranslations } from '@/i18n'
import { CATEGORY_COLORS } from '@/config/defaults'
import { createTag, updateTag } from '@/db/time-tracking/queries/activityQueries'
import type { Tag } from '@/db/time-tracking/types'
import { Modal } from '@/shared/components/Modal'
import { useToast } from '@/shared/components'
import { clsx } from 'clsx'
import { Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface TagEditModalProps {
    tag: Tag | null
    isOpen: boolean
    onClose: () => void
}

interface FormData {
    name: string
    color: string
    groupId: string
}

export function TagEditModal({ tag, isOpen, onClose }: TagEditModalProps) {
    const t = useTranslations(['common', 'tracker'])
    const { showToast } = useToast()
    const isEditing = tag != null

    const [form, setForm] = useState<FormData>({
        name: '',
        color: CATEGORY_COLORS[0].value,
        groupId: '',
    })
    const [saving, setSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (tag) {
            setForm({ name: tag.name, color: tag.color, groupId: tag.groupId ?? '' })
        } else {
            setForm({ name: '', color: CATEGORY_COLORS[0].value, groupId: '' })
        }
        setErrorMessage(null)
    }, [tag, isOpen])

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) return
        setSaving(true)
        try {
            const groupId = form.groupId.trim() || undefined
            if (isEditing && tag) {
                await updateTag(tag.id, {
                    name: form.name.trim(),
                    color: form.color,
                    groupId,
                })
            } else {
                await createTag({
                    name: form.name.trim(),
                    color: form.color,
                    groupId,
                })
            }
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
    }, [form, tag, isEditing, onClose, showToast, t])

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('tracker', 'tag.edit') : t('tracker', 'tag.new')}
            size="md"
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs text-text-secondary hover:bg-surface-100 transition-colors">
                        {t('common', 'common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !form.name.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white dark:text-black bg-black dark:bg-white hover:opacity-90 disabled:opacity-40 transition-colors"
                    >
                        <Save size={14} />
                        {saving ? t('tracker', 'modal.saving') : t('common', 'common.save')}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                {/* İsim */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('tracker', 'tag.name')}</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder={t('tracker', 'tag.placeholder')}
                        className="w-full rounded-xl bg-surface-100 border border-[var(--border-subtle)] px-3 py-2.5 text-sm text-text-primary placeholder:text-surface-600 focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] outline-none transition-all"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                    />
                </div>

                {/* Renk */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('tracker', 'activity.color')}</label>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORY_COLORS.map(c => (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, color: c.value }))}
                                className={clsx(
                                    'w-8 h-8 rounded-lg transition-all',
                                    form.color === c.value
                                        ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-100 scale-110'
                                        : 'hover:scale-105',
                                )}
                                style={{ backgroundColor: c.value }}
                                title={c.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Grup */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        {t('tracker', 'tag.group')} <span className="text-text-muted font-normal">{t('common', 'common.optional')}</span>
                    </label>
                    <input
                        type="text"
                        value={form.groupId}
                        onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}
                        placeholder={t('tracker', 'tag.groupPlaceholder')}
                        className="w-full rounded-xl bg-surface-100 border border-[var(--border-subtle)] px-3 py-2.5 text-sm text-text-primary placeholder:text-surface-600 focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)] outline-none transition-all"
                    />
                </div>

                {errorMessage && (
                    <p className="text-xs text-status-red">{errorMessage}</p>
                )}
            </div>
        </Modal>
    )
}
