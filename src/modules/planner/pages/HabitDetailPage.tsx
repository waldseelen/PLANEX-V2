import { deleteHabit, logHabit, updateHabit, useHabitLogs, useHabitWithStats } from '@/db/planner/queries/habitQueries';
import type { DBPlannerHabit } from '@/db/planner/types';
import { useTranslations } from '@/i18n';
import { useToast } from '@/shared/components';
import {
    ArrowLeft,
    BarChart3,
    CheckCircle,
    Circle,
    Edit2,
    Flame,
    Target,
    Trash2,
    TrendingUp
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, IconButton } from '../components/ui/Button';
import { Card, CardHeader, EmptyState, ProgressRing } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '@/shared/components/Modal';
import { PLANNER_DEFAULT_ICONS, PlannerEntityIcon, PlannerIconField } from '../components/ui/PlannerIconField';
import { cn, formatDateDisplay, getLastNDays } from '../lib/utils';

export function HabitDetailPage() {
    const { habitId } = useParams<{ habitId: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const t = useTranslations(['common', 'habits']);

    const stats = useHabitWithStats(habitId ?? '')
    const habit = stats?.habit
    const logs = useHabitLogs(habitId ?? '')

    const [heatmapMonths] = useState(3);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<DBPlannerHabit> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTogglingToday, setIsTogglingToday] = useState(false);

    // Generate heatmap data for last N months
    const heatmapData = useMemo(() => {
        if (!habit) return [];

        const days = heatmapMonths * 30;
        const lastNDays = getLastNDays(days);
        const logMap = new Map(logs.map(l => [l.dateISO, l]));

        return lastNDays.map(dateISO => {
            const log = logMap.get(dateISO);
            const date = new Date(dateISO);
            return {
                dateISO,
                date,
                done: log?.done || false,
                value: log?.value,
                dayOfWeek: date.getDay(),
            };
        });
    }, [habit, logs, heatmapMonths]);

    // Group heatmap by weeks
    const heatmapWeeks = useMemo(() => {
        const weeks: typeof heatmapData[] = [];
        let currentWeek: typeof heatmapData = [];

        heatmapData.forEach((day, index) => {
            if (index === 0) {
                // Pad first week with empty cells
                for (let i = 0; i < day.dayOfWeek; i++) {
                    currentWeek.push(null as unknown as (typeof heatmapData)[number]);
                }
            }
            currentWeek.push(day);
            if (day.dayOfWeek === 6 || index === heatmapData.length - 1) {
                weeks.push([...currentWeek]);
                currentWeek = [];
            }
        });

        return weeks;
    }, [heatmapData]);

    // Weekly progress for bar chart
    const weeklyProgress = useMemo(() => {
        const weeks: { weekStart: string; completed: number; total: number }[] = [];
        const last8Weeks = getLastNDays(56);
        const logMap = new Map(logs.map(l => [l.dateISO, l]));

        for (let i = 0; i < 8; i++) {
            const weekDays = last8Weeks.slice(i * 7, (i + 1) * 7);
            let completed = 0;
            weekDays.forEach(day => {
                const log = logMap.get(day);
                if (log?.done || (habit?.type === 'numeric' && log?.value && log.value >= (habit?.target || 0))) {
                    completed++;
                }
            });
            weeks.push({
                weekStart: weekDays[0],
                completed,
                total: 7,
            });
        }

        return weeks.reverse();
    }, [logs, habit]);

    if (!habit || !stats) {
        return (
            <div className="animate-fade-in">
                <EmptyState
                    icon={<Target className="w-8 h-8 text-tertiary" />}
                    title={t('habits', 'detail.notFound')}
                    action={
                        <Link to="/habits">
                            <Button>
                                {t('habits', 'detail.backToHabits')}
                            </Button>
                        </Link>
                    }
                />
            </div>
        );
    }

    const openEditModal = () => {
        setEditFormData({
            title: habit.title,
            description: habit.description,
            emoji: habit.emoji,
            icon: habit.icon,
        });
        setIsEditModalOpen(true);
    };

    const handleEditSave = async () => {
        if (!editFormData?.title?.trim()) return;
        setIsSaving(true);
        try {
            await updateHabit(habit.id, {
                ...editFormData,
                title: editFormData.title.trim(),
                description: editFormData.description?.trim() || undefined,
            });
            showToast(t('habits', 'toast.updated'), { variant: 'success' });
            setIsEditModalOpen(false);
            setEditFormData(null);
        } catch (error) {
            const message = error instanceof Error && error.message.trim()
                ? error.message
                : t('common', 'toast.error');
            showToast(message, { variant: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteHabit(habit.id);
            showToast(t('habits', 'toast.deleted'), { variant: 'success' });
            navigate('/habits');
        } catch (error) {
            const message = error instanceof Error && error.message.trim()
                ? error.message
                : t('common', 'toast.error');
            showToast(message, { variant: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];
    const todayLog = logs.find(l => l.dateISO === today);
    const isCompletedToday = todayLog?.done ||
        (habit.type === 'numeric' && todayLog?.value !== undefined && todayLog.value >= (habit.target || 0));

    const toggleToday = async () => {
        if (!isCompletedToday) {
            setIsTogglingToday(true);
            try {
                await logHabit(habit.id, today, true, habit.type === 'numeric' ? habit.target : undefined);
            } catch (error) {
                const message = error instanceof Error && error.message.trim()
                    ? error.message
                    : t('common', 'toast.error');
                showToast(message, { variant: 'error' });
            } finally {
                setIsTogglingToday(false);
            }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/habits">
                    <IconButton variant="secondary">
                        <ArrowLeft className="w-5 h-5" />
                    </IconButton>
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <span
                            className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-surface-100"
                            style={{ color: habit.color }}
                        >
                            {habit.icon ? (
                                <PlannerEntityIcon
                                    icon={habit.icon}
                                    fallbackIcon={PLANNER_DEFAULT_ICONS.habit}
                                    size={22}
                                    color={habit.color}
                                />
                            ) : (
                                <span className="text-3xl">{habit.emoji}</span>
                            )}
                        </span>
                        <div>
                            <h1 className="text-2xl font-bold text-primary">{habit.title}</h1>
                            {habit.description && (
                                <p className="text-secondary mt-1">{habit.description}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <IconButton
                        variant="secondary"
                        onClick={openEditModal}
                        title={t('common', 'common.edit')}
                    >
                        <Edit2 className="w-5 h-5" />
                    </IconButton>
                    <IconButton
                        variant="danger"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        title={t('common', 'common.delete')}
                    >
                        <Trash2 className="w-5 h-5" />
                    </IconButton>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="text-center" style={{ borderColor: habit.color + '40' }}>
                    <div className="p-3 rounded-full w-fit mx-auto mb-2" style={{ backgroundColor: habit.color + '20' }}>
                        <Flame className="w-6 h-6" style={{ color: habit.color }} />
                    </div>
                    <p className="text-3xl font-bold text-primary">{stats.currentStreak}</p>
                    <p className="text-sm text-secondary">{t('habits', 'detail.currentStreak')}</p>
                </Card>

                <Card className="text-center">
                    <div className="p-3 rounded-full bg-status-blue-soft w-fit mx-auto mb-2">
                        <TrendingUp className="w-6 h-6 text-status-blue" />
                    </div>
                    <p className="text-3xl font-bold text-primary">{stats.longestStreak}</p>
                    <p className="text-sm text-secondary">{t('habits', 'detail.longestStreak')}</p>
                </Card>

                <Card className="text-center">
                    <div className="p-3 rounded-full bg-status-green-soft w-fit mx-auto mb-2">
                        <CheckCircle className="w-6 h-6 text-status-green" />
                    </div>
                    <p className="text-3xl font-bold text-primary">{stats.totalCompletions}</p>
                    <p className="text-sm text-secondary">{t('habits', 'detail.totalCompletions')}</p>
                </Card>

                <Card className="text-center">
                    <div className="p-3 rounded-full bg-status-blue-soft w-fit mx-auto mb-2">
                        <BarChart3 className="w-6 h-6 text-status-blue" />
                    </div>
                    <p className="text-3xl font-bold text-primary">{stats.score}%</p>
                    <p className="text-sm text-secondary">{t('habits', 'detail.successRate')}</p>
                </Card>
            </div>

            <div className="grid lg:grid-cols-[1fr_300px] gap-6">
                {/* Heatmap */}
                <Card>
                    <CardHeader
                        title={t('habits', 'detail.activityMap')}
                        subtitle={t('habits', 'detail.lastNMonths', { count: heatmapMonths })}
                    />

                    <div className="flex gap-1 mt-4 overflow-x-auto pb-2">
                        <div className="flex flex-col gap-1 mr-2 text-xs text-tertiary">
                            {(t('habits', 'weekdaysShort') as unknown as string[]).map((day: string, i: number) => (
                                <div key={day} className="h-4 flex items-center">
                                    {i % 2 === 1 && day}
                                </div>
                            ))}
                        </div>

                        {heatmapWeeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-1">
                                {week.map((day, dayIndex) => (
                                    <div
                                        key={`${weekIndex}-${dayIndex}`}
                                        className={cn(
                                            'w-4 h-4 rounded-sm',
                                            day ? 'cursor-pointer' : ''
                                        )}
                                        style={{
                                            backgroundColor: day ? (
                                                day.done ? habit.color : 'var(--color-bg-secondary)'
                                            ) : 'transparent',
                                            opacity: day?.done ? 1 : 0.5,
                                        }}
                                        title={day ? `${formatDateDisplay(day.dateISO)}${day.done ? ' ✓' : ''}` : ''}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-default text-sm text-secondary">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm bg-secondary" />
                            <span>{t('habits', 'detail.notDone')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: habit.color }} />
                            <span>{t('habits', 'detail.done')}</span>
                        </div>
                    </div>
                </Card>

                {/* Today's Status */}
                <div className="space-y-4">
                    <Card className="text-center">
                        <h3 className="font-semibold text-primary mb-4">{t('common', 'common.today')}</h3>

                        <ProgressRing
                            value={isCompletedToday ? 100 : 0}
                            size={120}
                            strokeWidth={10}
                            color={habit.color}
                        >
                            <button onClick={() => void toggleToday()} className="p-2" disabled={isTogglingToday}>
                                {isCompletedToday ? (
                                    <CheckCircle className="w-12 h-12" style={{ color: habit.color }} />
                                ) : (
                                    <Circle className="w-12 h-12 text-secondary hover:text-primary transition-colors" />
                                )}
                            </button>
                        </ProgressRing>

                        <p className="text-secondary mt-4">
                            {isCompletedToday ? t('habits', 'detail.todayCompleted') : t('habits', 'detail.todayClickToComplete')}
                        </p>
                    </Card>

                    {/* Weekly Trend */}
                    <Card>
                        <CardHeader title={t('habits', 'detail.weeklyTrend')} />

                        <div className="flex items-end justify-between gap-2 h-24 mt-4">
                            {weeklyProgress.map((week, index) => {
                                const height = (week.completed / week.total) * 100;
                                return (
                                    <div key={index} className="flex-1 flex flex-col items-center">
                                        <div className="relative w-full h-20 flex flex-col justify-end">
                                            <div
                                                className="w-full rounded-t transition-all"
                                                style={{
                                                    height: `${height}%`,
                                                    backgroundColor: habit.color,
                                                    opacity: index === weeklyProgress.length - 1 ? 1 : 0.6,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-tertiary mt-1">
                                            {week.completed}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditFormData(null);
                }}
                title={t('habits', 'detail.editHabit')}
            >
                {editFormData && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">{t('habits', 'habit.emoji')}</label>
                            <Input
                                type="text"
                                value={editFormData.emoji || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, emoji: e.target.value })}
                                placeholder="😊"
                                maxLength={2}
                            />
                        </div>

                        <Input
                            label={t('habits', 'habit.name')}
                            value={editFormData.title || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                            placeholder={t('habits', 'form.titlePlaceholder')}
                        />

                        <PlannerIconField
                            value={editFormData.icon}
                            onChange={(icon) => setEditFormData({ ...editFormData, icon })}
                            fallbackIcon={PLANNER_DEFAULT_ICONS.habit}
                            previewColor={habit.color}
                        />

                        <Input
                            label={t('habits', 'form.descriptionOptional')}
                            value={editFormData.description || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                            placeholder={t('habits', 'form.descriptionPlaceholder')}
                        />

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setEditFormData(null);
                                }}
                                disabled={isSaving}
                            >
                                {t('common', 'common.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => void handleEditSave()}
                                disabled={!editFormData.title?.trim()}
                                isLoading={isSaving}
                            >
                                {t('common', 'common.save')}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                title={t('habits', 'detail.deleteHabit')}
            >
                <div className="space-y-4">
                    <p className="text-secondary">
                        {t('habits', 'detail.deleteConfirmMessage', { name: habit.title })}
                    </p>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setIsDeleteConfirmOpen(false)}
                            disabled={isDeleting}
                        >
                            {t('common', 'common.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => void handleDelete()}
                            isLoading={isDeleting}
                        >
                            {t('habits', 'detail.confirmDelete')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
