/**
 * ActivityEditModal — Aktivite Oluştur/Düzenle Modal
 *
 * İsim, kategori, renk ve ikon seçimini yönetir.
 * Create modunda aktivite şablonlarıyla ön doldurma sunar.
 */

import {
    ACTIVITY_TEMPLATE_CATEGORY_LABEL_KEYS,
    ACTIVITY_TEMPLATE_LABEL_KEYS,
    getTemplatesByCategory,
    type ActivityTemplate,
} from '@/config/activityTemplates'
import { createActivity, updateActivity, useActiveCategories } from '@/db/time-tracking/queries/activityQueries'
import type { Activity } from '@/db/time-tracking/types'
import { useTranslations } from '@/i18n'
import { COURSE_COLORS } from '@/modules/planner/types'
import { EntityIcon, useToast } from '@/shared/components'
import { IconPicker } from '@/shared/components/IconPicker'
import { Modal } from '@/shared/components/Modal'
import { clsx } from 'clsx'
import * as LucideIcons from 'lucide-react'
import { ChevronDown, Save, type LucideProps } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'

interface ActivityEditModalProps {
    activity: Activity | null
    isOpen: boolean
    onClose: () => void
}

interface FormData {
    name: string
    categoryId: string
    color: string
    icon: string
    defaultGoal?: ActivityTemplate['defaultGoal']
}

type CreateMode = 'blank' | 'template'

const DEFAULT_ACTIVITY_ICON = 'BookOpen'
const TEMPLATE_CATEGORIES: ActivityTemplate['category'][] = [
    'Ders',
    'Sağlık',
    'Üretkenlik',
    'Yaşam',
    'Finans',
]

const lucideIconMap =
    LucideIcons as unknown as Record<string, ComponentType<LucideProps>>

function DynamicIcon({ name, ...props }: LucideProps & { name: string }) {
    const Icon = lucideIconMap[name]

    if (!Icon) {
        return <span className="text-xs text-text-muted">{name}</span>
    }

    return <Icon {...props} />
}

function formatTemplateGoal(
    template: ActivityTemplate,
    t: (namespace: 'common' | 'tracker', key: string, params?: Record<string, string | number>) => string
) {
    if (!template.defaultGoal) {
        return null
    }

    return `${t('tracker', `goal.scope.${template.defaultGoal.scope}`)} • ${template.defaultGoal.targetHours} ${t('tracker', 'time.hours')}`
}

function getTemplateCategoryLabel(
    category: ActivityTemplate['category'],
    t: (namespace: 'common' | 'tracker', key: string, params?: Record<string, string | number>) => string
) {
    return t('tracker', ACTIVITY_TEMPLATE_CATEGORY_LABEL_KEYS[category])
}

function getTemplateNameLabel(
    template: ActivityTemplate,
    t: (namespace: 'common' | 'tracker', key: string, params?: Record<string, string | number>) => string
) {
    const translationKey = ACTIVITY_TEMPLATE_LABEL_KEYS[template.name]
    return translationKey ? t('tracker', translationKey) : template.name
}

export function ActivityEditModal({ activity, isOpen, onClose }: ActivityEditModalProps) {
    const t = useTranslations(['common', 'tracker'])
    const { showToast } = useToast()
    const categories = useActiveCategories()
    const isEditing = activity != null

    const [form, setForm] = useState<FormData>({
        name: '',
        categoryId: '',
        color: categories[0]?.color ?? COURSE_COLORS[0],
        icon: DEFAULT_ACTIVITY_ICON,
    })
    const [saving, setSaving] = useState(false)
    const [createMode, setCreateMode] = useState<CreateMode>('blank')
    const [templateCategory, setTemplateCategory] = useState<ActivityTemplate['category']>('Ders')
    const [showIconPicker, setShowIconPicker] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const categoryMap = useMemo(
        () => new Map(categories.map(category => [category.id, category])),
        [categories],
    )

    const filteredTemplates = useMemo(
        () => getTemplatesByCategory(templateCategory),
        [templateCategory],
    )

    useEffect(() => {
        if (!isOpen) {
            return
        }

        if (activity) {
            const matchedCategory = categoryMap.get(activity.categoryId)
            setForm({
                name: activity.name,
                categoryId: activity.categoryId,
                color: activity.color ?? matchedCategory?.color ?? COURSE_COLORS[0],
                icon: activity.icon ?? DEFAULT_ACTIVITY_ICON,
                defaultGoal: undefined,
            })
        } else {
            const defaultCategoryId = categories[0]?.id ?? ''
            const defaultCategoryColor = categories[0]?.color ?? COURSE_COLORS[0]

            setForm({
                name: '',
                categoryId: defaultCategoryId,
                color: defaultCategoryColor,
                icon: DEFAULT_ACTIVITY_ICON,
                defaultGoal: undefined,
            })
        }

        setCreateMode('blank')
        setTemplateCategory('Ders')
        setShowIconPicker(false)
        setErrorMessage(null)
    }, [activity, categories, categoryMap, isOpen])

    const handleSave = useCallback(async () => {
        if (!form.name.trim() || !form.categoryId) {
            return
        }

        setSaving(true)
        try {
            if (isEditing && activity) {
                await updateActivity(activity.id, {
                    name: form.name.trim(),
                    categoryId: form.categoryId,
                    color: form.color,
                    icon: form.icon,
                })
            } else {
                await createActivity({
                    name: form.name.trim(),
                    categoryId: form.categoryId,
                    color: form.color,
                    icon: form.icon,
                    defaultGoal: form.defaultGoal,
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
    }, [activity, form, isEditing, onClose, showToast, t])

    const handleTemplateSelect = useCallback((template: ActivityTemplate) => {
        setForm(currentForm => ({
            ...currentForm,
            name: getTemplateNameLabel(template, t),
            color: template.color,
            icon: template.icon,
            defaultGoal: template.defaultGoal,
        }))
        setCreateMode('blank')
        setShowIconPicker(false)
    }, [t])

    const footerContent = (
        <div className="flex justify-end gap-2">
            <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-100 disabled:opacity-50"
            >
                {t('common', 'common.cancel')}
            </button>
            <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.categoryId}
                className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-black"
            >
                <Save size={14} />
                {saving ? t('tracker', 'modal.saving') : t('common', 'common.save')}
            </button>
        </div>
    )

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('tracker', 'activity.edit') : t('tracker', 'activity.new')}
            size="xl"
            footer={footerContent}
        >
                            <div className="flex flex-col gap-4">
                                {!isEditing && (
                                    <div className="flex flex-col gap-3">
                                        <div className="inline-flex w-full rounded-2xl border border-[var(--border-subtle)] bg-surface-100 p-1 sm:w-auto">
                                            <button
                                                type="button"
                                                onClick={() => setCreateMode('blank')}
                                                className={clsx(
                                                    'flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
                                                    createMode === 'blank'
                                                        ? 'bg-surface-200 text-text-primary'
                                                        : 'text-text-secondary hover:text-text-primary',
                                                )}
                                            >
                                                {t('tracker', 'activity.startBlank')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCreateMode('template')}
                                                className={clsx(
                                                    'flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
                                                    createMode === 'template'
                                                        ? 'bg-surface-200 text-text-primary'
                                                        : 'text-text-secondary hover:text-text-primary',
                                                )}
                                            >
                                                {t('tracker', 'activity.startFromTemplate')}
                                            </button>
                                        </div>

                                        {createMode === 'template' && (
                                            <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface-100 p-4">
                                                <div className="flex flex-col gap-3">
                                                    <div className="w-full sm:w-56">
                                                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                                                            {t('tracker', 'activity.templateCategory')}
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                value={templateCategory}
                                                                onChange={event => setTemplateCategory(event.target.value as ActivityTemplate['category'])}
                                                                className="input w-full appearance-none pr-9"
                                                            >
                                                                {TEMPLATE_CATEGORIES.map(category => (
                                                                    <option key={category} value={category}>
                                                                        {getTemplateCategoryLabel(category, t)}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                                                        </div>
                                                    </div>

                                                    {filteredTemplates.length > 0 ? (
                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                            {filteredTemplates.map(template => {
                                                                const goalLabel = formatTemplateGoal(template, t)

                                                                return (
                                                                    <button
                                                                        key={`${template.category}-${template.name}`}
                                                                        type="button"
                                                                        onClick={() => handleTemplateSelect(template)}
                                                                        className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-primary px-3 py-3 text-left transition-all hover:border-[var(--border-medium)] hover:bg-surface-200"
                                                                    >
                                                                        <span
                                                                            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[var(--border-subtle)]"
                                                                            style={{ backgroundColor: `${template.color}1A`, color: template.color }}
                                                                        >
                                                                            <DynamicIcon name={template.icon} size={18} />
                                                                        </span>
                                                                        <span className="min-w-0 flex-1">
                                                                            <span className="block truncate text-sm font-medium text-text-primary">
                                                                                {getTemplateNameLabel(template, t)}
                                                                            </span>
                                                                            <span className="mt-0.5 block text-xs text-text-muted">
                                                                                {getTemplateCategoryLabel(template.category, t)}
                                                                            </span>
                                                                            {goalLabel && (
                                                                                <span className="mt-2 inline-flex rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-text-secondary">
                                                                                    {goalLabel}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-sm text-text-secondary">
                                                            {t('tracker', 'activity.templateEmpty')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                                        {t('tracker', 'activity.name')}
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={event => setForm(currentForm => ({ ...currentForm, name: event.target.value }))}
                                        placeholder={t('tracker', 'activity.name')}
                                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-surface-100 px-3 py-2.5 text-sm text-text-primary outline-none transition-all placeholder:text-surface-600 focus:border-[var(--border-medium)] focus:ring-1 focus:ring-[var(--border-medium)]"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                                        {t('tracker', 'activity.category')}
                                    </label>
                                    {categories.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {categories.map(category => (
                                                <button
                                                    key={category.id}
                                                    type="button"
                                                    onClick={() => setForm(currentForm => ({ ...currentForm, categoryId: category.id }))}
                                                    className={clsx(
                                                        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all',
                                                        form.categoryId === category.id
                                                            ? 'text-text-primary'
                                                            : 'bg-surface-100 text-text-secondary hover:bg-surface-200',
                                                    )}
                                                    style={
                                                        form.categoryId === category.id
                                                            ? { backgroundColor: `${category.color}33`, border: `1px solid ${category.color}55` }
                                                            : undefined
                                                    }
                                                >
                                                    <span className="flex h-4 w-4 items-center justify-center">
                                                        <EntityIcon name={category.icon} fallback="•" className="h-4 w-4" size={14} />
                                                    </span>
                                                    {category.name}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-surface-100 px-3 py-3 text-xs text-text-secondary">
                                            <span>{t('tracker', 'page.noCategory')}</span>
                                            <Link
                                                to="/tracker/categories"
                                                onClick={onClose}
                                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-200"
                                            >
                                                {t('tracker', 'nav.categories')} →
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 xl:grid-cols-[220px,minmax(0,1fr)]">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                                            {t('tracker', 'activity.color')}
                                        </label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {COURSE_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setForm(currentForm => ({ ...currentForm, color }))}
                                                    className={clsx(
                                                        'h-9 w-9 rounded-xl border border-[var(--border-subtle)] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-medium)]',
                                                        form.color === color
                                                            ? 'scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-surface-100'
                                                            : 'hover:scale-105',
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                    aria-label={color}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="mb-0 block text-xs font-medium text-text-secondary">
                                                {t('tracker', 'activity.icon')}
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowIconPicker(current => !current)}
                                                aria-expanded={showIconPicker}
                                                className="inline-flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-surface-100 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-200"
                                            >
                                                <span
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-primary"
                                                    style={{ color: form.color }}
                                                >
                                                    <EntityIcon name={form.icon} fallback={DEFAULT_ACTIVITY_ICON} className="h-4 w-4" size={16} />
                                                </span>
                                                <span className="truncate">{form.icon}</span>
                                                <ChevronDown className={clsx('h-4 w-4 text-text-muted transition-transform', showIconPicker && 'rotate-180')} />
                                            </button>
                                        </div>

                                        {showIconPicker && (
                                            <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-surface-100 p-3">
                                                <IconPicker
                                                    value={form.icon}
                                                    onSelect={icon => {
                                                        setForm(currentForm => ({ ...currentForm, icon }))
                                                        setShowIconPicker(false)
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {errorMessage && (
                                    <p className="text-xs text-status-red">{errorMessage}</p>
                                )}
                            </div>
        </Modal>
    )
}
