import { addCourse, deleteCourse, updateCourse, useCoursesWithProgress } from '@/db/planner/queries/courseQueries'
import { useAllEvents } from '@/db/planner/queries/eventQueries'
import type { CourseWithProgress } from '@/db/planner/types'
import { useTranslations } from '@/i18n'
import { useToast } from '@/shared/components/Toast'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit2, GraduationCap, Plus, Trash2 } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, IconButton } from '../components/ui/Button'
import { Card, EmptyState, ProgressBar } from '../components/ui/Card'
import { PlannerEntityIcon, PlannerIconField, PLANNER_DEFAULT_ICONS } from '../components/ui/PlannerIconField'
import { Input } from '../components/ui/Input'
import { Modal } from '@/shared/components/Modal'
import { cn } from '../lib/utils'
import { COURSE_COLORS } from '../types'

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function CoursesPage() {
    const t = useTranslations(['common', 'planner', 'calendar'])
    const location = useLocation()
    const navigate = useNavigate()
    const { showToast } = useToast()

    const courses = useCoursesWithProgress()
    const events = useAllEvents()

    const examCountByCourseId = useMemo(() => {
        const map = new Map<string, number>()
        events.forEach(e => {
            if (e.type !== 'exam' || !e.courseId) return
            map.set(e.courseId, (map.get(e.courseId) ?? 0) + 1)
        })
        return map
    }, [events])

    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingCourse, setEditingCourse] = useState<CourseWithProgress | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        title: '',
        code: '',
        icon: undefined as string | undefined,
        color: COURSE_COLORS[0] as string,
    })

    useEffect(() => {
        const state = location.state as undefined | { openCreate?: boolean }
        if (state?.openCreate) {
            setIsAddModalOpen(true)
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [location.state, location.pathname, navigate])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (!formData.title.trim()) {
            showToast(t('planner', 'validation.courseNameRequired'), { variant: 'error' })
            return
        }

        setIsSubmitting(true)
        try {
            if (editingCourse) {
                await updateCourse(editingCourse.id, {
                    title: formData.title.trim(),
                    code: formData.code.trim() || undefined,
                    icon: formData.icon,
                    color: formData.color,
                })
                showToast(t('common', 'toast.updated'), { variant: 'success' })
            } else {
                await addCourse({
                    title: formData.title.trim(),
                    code: formData.code.trim() || undefined,
                    icon: formData.icon,
                    color: formData.color,
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
        setEditingCourse(null)
        setFormData({
            title: '',
            code: '',
            icon: undefined,
            color: COURSE_COLORS[0] as string,
        })
    }

    function openEditModal(course: CourseWithProgress) {
        setEditingCourse(course)
        setFormData({
            title: course.title,
            code: course.code || '',
            icon: course.icon,
            color: course.color || COURSE_COLORS[0],
        })
    }

    async function handleDelete(id: string) {
        setDeletingCourseId(id)
        try {
            await deleteCourse(id)
            setDeleteConfirm(null)
            showToast(t('common', 'toast.deleted'), { variant: 'success' })
        } catch (error) {
            showToast(getErrorMessage(error, t('common', 'toast.error')), { variant: 'error' })
        } finally {
            setDeletingCourseId(null)
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-primary">{t('common', 'navigation.courses')}</h1>
                    <p className="mt-1 text-secondary">{t('common', 'app.courseCount', { count: courses.length })}</p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                    {t('common', 'app.addCourse')}
                </Button>
            </div>

            {courses.length === 0 ? (
                <EmptyState
                    icon={<GraduationCap className="h-8 w-8 text-tertiary" />}
                    title={t('common', 'emptyState.noCourses')}
                    description={t('common', 'app.startAcademicPlanning')}
                    action={
                        <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                            {t('common', 'app.addFirstCourse')}
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {courses.map((course, index) => (
                            <motion.div
                                key={course.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card hoverable className="group relative overflow-hidden !p-0">
                                    <div
                                        className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl"
                                        style={{ backgroundColor: course.color }}
                                    />

                                    <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                                        <div className="flex gap-1">
                                            <IconButton
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    openEditModal(course)
                                                }}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </IconButton>
                                            <IconButton
                                                size="sm"
                                                variant="danger"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    setDeleteConfirm(course.id)
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </IconButton>
                                        </div>
                                    </div>

                                    <Link to={`/planner/courses/${course.id}`}>
                                        <div className="px-4 py-4 pl-5">
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                                                    style={{ backgroundColor: `${course.color}20` }}
                                                >
                                                    <PlannerEntityIcon
                                                        icon={course.icon}
                                                        fallbackIcon={PLANNER_DEFAULT_ICONS.course}
                                                        size={20}
                                                        color={course.color}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="truncate font-semibold text-primary">{course.title}</h3>
                                                    {course.code && <p className="text-sm text-secondary">{course.code}</p>}
                                                </div>
                                            </div>

                                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                                <div className="rounded-lg bg-surface-200 p-2">
                                                    <p className="text-lg font-semibold text-primary">{course.unitCount}</p>
                                                    <p className="text-xs text-secondary">{t('planner', 'unit.title')}</p>
                                                </div>
                                                <div className="rounded-lg bg-surface-200 p-2">
                                                    <p className="text-lg font-semibold text-primary">{course.totalTasks}</p>
                                                    <p className="text-xs text-secondary">{t('planner', 'task.title')}</p>
                                                </div>
                                                <div className="rounded-lg bg-surface-200 p-2">
                                                    <p className="text-lg font-semibold text-primary">{examCountByCourseId.get(course.id) ?? 0}</p>
                                                    <p className="text-xs text-secondary">{t('calendar', 'eventType.exam')}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="text-secondary">{t('planner', 'progress.title')}</span>
                                                    <span className="font-medium text-primary">{course.progressPercent}%</span>
                                                </div>
                                                <ProgressBar value={course.progressPercent} color={course.color} />
                                            </div>
                                        </div>
                                    </Link>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            <Modal
                isOpen={isAddModalOpen || !!editingCourse}
                onClose={closeModal}
                title={editingCourse ? t('planner', 'course.edit') : t('planner', 'course.create')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label={t('planner', 'course.name')}
                        placeholder={t('planner', 'examples.courseName')}
                        value={formData.title}
                        onChange={(event) => setFormData(current => ({ ...current, title: event.target.value }))}
                        autoFocus
                    />

                    <Input
                        label={`${t('planner', 'course.code')} ${t('common', 'common.optional')}`}
                        placeholder={t('planner', 'examples.courseCode')}
                        value={formData.code}
                        onChange={(event) => setFormData(current => ({ ...current, code: event.target.value }))}
                    />

                    <PlannerIconField
                        value={formData.icon}
                        onChange={(icon) => setFormData(current => ({ ...current, icon }))}
                        fallbackIcon={PLANNER_DEFAULT_ICONS.course}
                        previewColor={formData.color}
                    />

                    <div>
                        <label className="mb-2 block text-sm font-medium text-primary">{t('planner', 'course.color')}</label>
                        <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-10">
                            {COURSE_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    title={color}
                                    aria-label={color}
                                    onClick={() => setFormData(current => ({ ...current, color }))}
                                    className={cn(
                                        'h-9 w-9 rounded-full border border-white/10 shadow-sm transition-transform duration-150',
                                        formData.color === color
                                            ? 'scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-[var(--bg-surface-200)]'
                                            : 'hover:scale-105',
                                    )}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>
                            {t('common', 'common.cancel')}
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            {editingCourse ? t('common', 'common.update') : t('common', 'common.add')}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={t('planner', 'course.delete')}
                size="sm"
            >
                <p className="mb-6 text-secondary">{t('planner', 'course.deleteConfirm')}</p>
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={!!deletingCourseId}>
                        {t('common', 'common.cancel')}
                    </Button>
                    <Button
                        variant="danger"
                        isLoading={deleteConfirm !== null && deletingCourseId === deleteConfirm}
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
