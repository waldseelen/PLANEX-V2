/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Tracker Repository — Supabase
 *
 * Tracker domain için Supabase Postgres CRUD katmanı.
 * Tüm yazma/okuma işlemleri Supabase üzerinden yapılır.
 */

import type {
    Activity,
    Category,
    Goal,
    GoalMetric,
    GoalScope,
    Reminder,
    ReminderKind,
    ReminderSchedule,
    Rule,
    RuleActionConfig,
    RuleCondition,
    RuleTrigger,
    RunningTimer,
    Tag,
    TimeSession,
    TimerMode,
} from '@/db/time-tracking/types'
import { captureSecureException } from '@/modules/auth/lib/telemetry'
import { requireCurrentUserId } from './currentUser'
import {
    listOwnedRows,
    upsertOwnedRow,
    deleteOwnedRows,
    updateOwnedRows,
} from './supabaseRepo'

type SC = any

// ============================================
// Helpers
// ============================================

function assertEnabled(): void {
    // Supabase is always enabled in this project configuration
}



function nowMs(): number { return Date.now() }

// ============================================
// Field Mappers — Firestore Row → Dexie Type
// ============================================

function categoryFromRow(row: SC['categories']['Row']): Category {
    return {
        id: row.id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        archived: row.archived,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function tagFromRow(row: SC['tags']['Row']): Tag {
    return {
        id: row.id,
        name: row.name,
        color: row.color,
        groupId: row.group_id ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function activityFromRow(row: SC['activities']['Row']): Activity {
    return {
        id: row.id,
        name: row.name,
        categoryId: row.category_id,
        color: row.color ?? undefined,
        icon: row.icon ?? undefined,
        tagIds: Array.isArray(row.tag_ids) ? (row.tag_ids as string[]) : [],
        archived: row.archived,
        defaultGoalIds: Array.isArray(row.default_goal_ids) ? (row.default_goal_ids as string[]) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function sessionFromRow(row: SC['time_sessions']['Row']): TimeSession {
    return {
        id: row.id,
        activityId: row.activity_id,
        startAt: row.start_at,
        endAt: row.end_at,
        durationSec: row.duration_sec,
        note: row.note,
        dateKey: row.date_key,
        mergedFromIds: Array.isArray(row.merged_from_ids) ? (row.merged_from_ids as string[]) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function goalFromRow(row: SC['goals']['Row']): Goal {
    return {
        id: row.id,
        name: row.name,
        scope: (row.scope as GoalScope) ?? 'daily',
        metric: (row.metric as GoalMetric) ?? 'time',
        minTarget: row.min_target ?? undefined,
        maxTarget: row.max_target ?? undefined,
        targetValue: row.target_value,
        activityId: row.activity_id ?? undefined,
        habitId: row.habit_id ?? undefined,
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function runningTimerFromRow(row: SC['running_timers']['Row']): RunningTimer {
    return {
        id: row.id,
        activityId: row.activity_id,
        startedAt: row.started_at,
        pausedAt: row.paused_at ?? undefined,
        accumulatedSec: row.accumulated_sec,
        mode: (row.mode as TimerMode) ?? 'normal',
        pomodoroConfigId: row.pomodoro_config_id ?? undefined,
        createdAt: row.created_at,
    }
}

// ============================================
// Categories
// ============================================

export async function trackerGetCategories(): Promise<Category[]> {
    assertEnabled()
    const data = await listOwnedRows('categories', { orderBy: 'name', ascending: true })
    return data.map(categoryFromRow)
}

export async function trackerGetActiveCategories(): Promise<Category[]> {
    assertEnabled()
    const data = await listOwnedRows('categories', {
        filters: [{ column: 'archived', value: false }],
        orderBy: 'name',
        ascending: true
    })
    return data.map(categoryFromRow)
}

export async function trackerGetCategoryById(id: string): Promise<Category | undefined> {
    assertEnabled()
    const data = await listOwnedRows('categories', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? categoryFromRow(data[0]) : undefined
}

export async function trackerCreateCategory(input: {
    name: string
    color: string
    icon: string
}): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowMs()
    await upsertOwnedRow('categories', {
        id,
        name: input.name,
        color: input.color,
        icon: input.icon,
        archived: false,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function trackerUpdateCategory(
    id: string,
    changes: Partial<Omit<Category, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['categories']['Update']> = { updated_at: nowMs() }
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.color !== undefined) patch.color = changes.color
    if (changes.icon !== undefined) patch.icon = changes.icon
    if (changes.archived !== undefined) patch.archived = changes.archived
    await updateOwnedRows('categories', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteCategory(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('categories', [{ column: 'id', value: id }])
}

// ============================================
// Tags
// ============================================

export async function trackerGetAllTags(): Promise<Tag[]> {
    assertEnabled()
    const data = await listOwnedRows('tags', { orderBy: 'name', ascending: true })
    return data.map(tagFromRow)
}

export async function trackerCreateTag(input: {
    name: string
    color: string
    groupId?: string
}): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowMs()
    await upsertOwnedRow('tags', {
        id,
        name: input.name,
        color: input.color,
        group_id: input.groupId ?? null,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function trackerUpdateTag(
    id: string,
    changes: Partial<Omit<Tag, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['tags']['Update']> = { updated_at: nowMs() }
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.color !== undefined) patch.color = changes.color
    if (changes.groupId !== undefined) patch.group_id = changes.groupId ?? null
    await updateOwnedRows('tags', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteTag(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('tags', [{ column: 'id', value: id }])
}

// ============================================
// Activities
// ============================================

export async function trackerGetActiveActivities(): Promise<Activity[]> {
    assertEnabled()
    const data = await listOwnedRows('activities', {
        filters: [{ column: 'archived', value: false }],
        orderBy: 'created_at',
        ascending: true
    })
    return data.map(activityFromRow)
}

export async function trackerGetAllActivities(): Promise<Activity[]> {
    assertEnabled()
    const data = await listOwnedRows('activities', { orderBy: 'name', ascending: true })
    return data.map(activityFromRow)
}

export async function trackerGetActivityById(id: string): Promise<Activity | undefined> {
    assertEnabled()
    const data = await listOwnedRows('activities', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? activityFromRow(data[0]) : undefined
}

export async function trackerGetActivitiesByCategory(categoryId: string): Promise<Activity[]> {
    assertEnabled()
    const data = await listOwnedRows('activities', {
        filters: [
            { column: 'category_id', value: categoryId },
            { column: 'archived', value: false }
        ],
        orderBy: 'created_at',
        ascending: true
    })
    return data.map(activityFromRow)
}

export async function trackerGetArchivedActivities(): Promise<Activity[]> {
    assertEnabled()
    const data = await listOwnedRows('activities', {
        filters: [{ column: 'archived', value: true }],
        orderBy: 'name',
        ascending: true
    })
    return data.map(activityFromRow)
}

export async function trackerCreateActivity(input: {
    name: string
    categoryId: string
    color?: string
    icon?: string
    tagIds?: string[]
    defaultGoalIds?: string[]
}): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowMs()
    await upsertOwnedRow('activities', {
        id,
        category_id: input.categoryId,
        name: input.name,
        color: input.color ?? null,
        icon: input.icon ?? null,
        tag_ids: input.tagIds ?? [],
        archived: false,
        default_goal_ids: input.defaultGoalIds ?? [],
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function trackerUpdateActivity(
    id: string,
    changes: Partial<Omit<Activity, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['activities']['Update']> = { updated_at: nowMs() }
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.categoryId !== undefined) patch.category_id = changes.categoryId
    if (changes.color !== undefined) patch.color = changes.color ?? null
    if (changes.icon !== undefined) patch.icon = changes.icon ?? null
    if (changes.tagIds !== undefined) patch.tag_ids = changes.tagIds
    if (changes.archived !== undefined) patch.archived = changes.archived
    if (changes.defaultGoalIds !== undefined) patch.default_goal_ids = changes.defaultGoalIds
    await updateOwnedRows('activities', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteActivity(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('activities', [{ column: 'id', value: id }])
}

// ============================================
// Time Sessions
// ============================================

export async function trackerGetSessionsByDate(dateKey: string): Promise<TimeSession[]> {
    assertEnabled()
    const data = await listOwnedRows('time_sessions', {
        filters: [{ column: 'date_key', value: dateKey }],
        orderBy: 'start_at',
        ascending: true
    })
    return data.map(sessionFromRow)
}

export async function trackerGetSessionsByDateRange(startISO: string, endISO: string): Promise<TimeSession[]> {
    assertEnabled()
    const data = await listOwnedRows('time_sessions')
    const filtered = data.filter(row => row.date_key >= startISO && row.date_key <= endISO)
    filtered.sort((a, b) => a.start_at - b.start_at)
    return filtered.map(sessionFromRow)
}

export async function trackerGetSessionsByActivity(
    activityId: string,
    startISO?: string,
    endISO?: string,
): Promise<TimeSession[]> {
    assertEnabled()
    const data = await listOwnedRows('time_sessions', {
        filters: [{ column: 'activity_id', value: activityId }]
    })
    const filtered = data.filter(row => {
        if (startISO && row.date_key < startISO) return false
        if (endISO && row.date_key > endISO) return false
        return true
    })
    filtered.sort((a, b) => a.start_at - b.start_at)
    return filtered.map(sessionFromRow)
}

export async function trackerGetSessionById(id: string): Promise<TimeSession | undefined> {
    assertEnabled()
    const data = await listOwnedRows('time_sessions', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? sessionFromRow(data[0]) : undefined
}

export async function trackerCreateSession(
    session: Omit<TimeSession, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowMs()
    await upsertOwnedRow('time_sessions', {
        id,
        activity_id: session.activityId,
        start_at: session.startAt,
        end_at: session.endAt,
        duration_sec: session.durationSec,
        note: session.note,
        date_key: session.dateKey,
        merged_from_ids: session.mergedFromIds,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function trackerUpdateSession(
    id: string,
    changes: Partial<Omit<TimeSession, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['time_sessions']['Update']> = { updated_at: nowMs() }
    if (changes.activityId !== undefined) patch.activity_id = changes.activityId
    if (changes.startAt !== undefined) patch.start_at = changes.startAt
    if (changes.endAt !== undefined) patch.end_at = changes.endAt
    if (changes.durationSec !== undefined) patch.duration_sec = changes.durationSec
    if (changes.note !== undefined) patch.note = changes.note
    if (changes.dateKey !== undefined) patch.date_key = changes.dateKey
    if (changes.mergedFromIds !== undefined) patch.merged_from_ids = changes.mergedFromIds
    await updateOwnedRows('time_sessions', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteSession(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('time_sessions', [{ column: 'id', value: id }])
}

// ============================================
// Goals
// ============================================

export async function trackerGetEnabledGoals(): Promise<Goal[]> {
    assertEnabled()
    const data = await listOwnedRows('goals', { filters: [{ column: 'enabled', value: true }] })
    return data.map(goalFromRow)
}

export async function trackerGetAllGoals(): Promise<Goal[]> {
    assertEnabled()
    const data = await listOwnedRows('goals', { orderBy: 'created_at', ascending: true })
    return data.map(goalFromRow)
}

export async function trackerGetGoalById(id: string): Promise<Goal | undefined> {
    assertEnabled()
    const data = await listOwnedRows('goals', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? goalFromRow(data[0]) : undefined
}

export async function trackerGetGoalsForActivity(activityId: string): Promise<Goal[]> {
    assertEnabled()
    const data = await listOwnedRows('goals', {
        filters: [
            { column: 'activity_id', value: activityId },
            { column: 'enabled', value: true }
        ]
    })
    return data.map(goalFromRow)
}

export async function trackerCreateGoal(
    goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowMs()
    await upsertOwnedRow('goals', {
        id,
        name: goal.name,
        scope: goal.scope,
        metric: goal.metric,
        min_target: goal.minTarget ?? null,
        max_target: goal.maxTarget ?? null,
        target_value: goal.targetValue,
        activity_id: goal.activityId ?? null,
        habit_id: goal.habitId ?? null,
        enabled: goal.enabled,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function trackerUpdateGoal(
    id: string,
    changes: Partial<Omit<Goal, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['goals']['Update']> = { updated_at: nowMs() }
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.scope !== undefined) patch.scope = changes.scope
    if (changes.metric !== undefined) patch.metric = changes.metric
    if (changes.minTarget !== undefined) patch.min_target = changes.minTarget ?? null
    if (changes.maxTarget !== undefined) patch.max_target = changes.maxTarget ?? null
    if (changes.targetValue !== undefined) patch.target_value = changes.targetValue
    if (changes.activityId !== undefined) patch.activity_id = changes.activityId ?? null
    if (changes.habitId !== undefined) patch.habit_id = changes.habitId ?? null
    if (changes.enabled !== undefined) patch.enabled = changes.enabled
    await updateOwnedRows('goals', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteGoal(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('goals', [{ column: 'id', value: id }])
}

// ============================================
// Running Timers
// ============================================

export async function trackerGetRunningTimers(): Promise<RunningTimer[]> {
    assertEnabled()
    const data = await listOwnedRows('running_timers', { orderBy: 'started_at', ascending: true })
    return data.map(runningTimerFromRow)
}

export async function trackerGetRunningTimerForActivity(activityId: string): Promise<RunningTimer | undefined> {
    assertEnabled()
    const data = await listOwnedRows('running_timers', {
        filters: [{ column: 'activity_id', value: activityId }]
    })
    return data[0] ? runningTimerFromRow(data[0]) : undefined
}

export async function trackerCreateRunningTimer(
    timer: Omit<RunningTimer, 'id'>,
): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    await upsertOwnedRow('running_timers', {
        id,
        activity_id: timer.activityId,
        started_at: timer.startedAt,
        paused_at: timer.pausedAt ?? null,
        accumulated_sec: timer.accumulatedSec,
        mode: timer.mode,
        pomodoro_config_id: timer.pomodoroConfigId ?? null,
        created_at: timer.createdAt,
    })
    return id
}

export async function trackerUpdateRunningTimer(
    id: string,
    changes: Partial<Omit<RunningTimer, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['running_timers']['Update']> = {}
    if (changes.activityId !== undefined) patch.activity_id = changes.activityId
    if (changes.startedAt !== undefined) patch.started_at = changes.startedAt
    if (changes.pausedAt !== undefined) patch.paused_at = changes.pausedAt ?? null
    if (changes.accumulatedSec !== undefined) patch.accumulated_sec = changes.accumulatedSec
    if (changes.mode !== undefined) patch.mode = changes.mode
    if (changes.pomodoroConfigId !== undefined) patch.pomodoro_config_id = changes.pomodoroConfigId ?? null
    await updateOwnedRows('running_timers', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteRunningTimer(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('running_timers', [{ column: 'id', value: id }])
}

export async function trackerDeleteRunningTimerForActivity(activityId: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('running_timers', [{ column: 'activity_id', value: activityId }])
}

// ============================================
// Stats (aggregate)
// ============================================

export async function trackerGetTodayTotalSec(dateKey: string): Promise<number> {
    assertEnabled()
    const data = await listOwnedRows('time_sessions', {
        filters: [{ column: 'date_key', value: dateKey }]
    })
    return data.reduce((sum, row) => sum + row.duration_sec, 0)
}

// ============================================
// Rules
// ============================================

function ruleFromRow(row: SC['rules']['Row']): Rule {
    return {
        id: row.id,
        name: row.name,
        trigger: row.trigger as RuleTrigger,
        conditions: Array.isArray(row.conditions) ? (row.conditions as unknown as RuleCondition[]) : [],
        actions: Array.isArray(row.actions) ? (row.actions as unknown as RuleActionConfig[]) : [],
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export async function trackerGetRulesByTrigger(trigger: RuleTrigger): Promise<Rule[]> {
    assertEnabled()
    const data = await listOwnedRows('rules', {
        filters: [
            { column: 'trigger', value: trigger },
            { column: 'enabled', value: true }
        ]
    })
    return data.map(ruleFromRow)
}

export async function trackerGetEnabledRules(): Promise<Rule[]> {
    assertEnabled()
    const data = await listOwnedRows('rules', { filters: [{ column: 'enabled', value: true }] })
    return data.map(ruleFromRow)
}

export async function trackerCreateRule(
    data: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowMs()
    await upsertOwnedRow('rules', {
        id,
        name: data.name,
        trigger: data.trigger,
        conditions: data.conditions as unknown as import('@/types/supabase').Json,
        actions: data.actions as unknown as import('@/types/supabase').Json,
        enabled: data.enabled,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function trackerUpdateRule(
    id: string,
    changes: Partial<Omit<Rule, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['rules']['Update']> = { updated_at: nowMs() }
    if (changes.name !== undefined) patch.name = changes.name
    if (changes.trigger !== undefined) patch.trigger = changes.trigger
    if (changes.conditions !== undefined) patch.conditions = changes.conditions as unknown as import('@/types/supabase').Json
    if (changes.actions !== undefined) patch.actions = changes.actions as unknown as import('@/types/supabase').Json
    if (changes.enabled !== undefined) patch.enabled = changes.enabled
    await updateOwnedRows('rules', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteRule(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('rules', [{ column: 'id', value: id }])
}

export async function trackerGetAllRules(): Promise<Rule[]> {
    assertEnabled()
    const data = await listOwnedRows('rules', { orderBy: 'created_at', ascending: true })
    return data.map(ruleFromRow)
}

export async function trackerGetRuleById(id: string): Promise<Rule | undefined> {
    assertEnabled()
    const data = await listOwnedRows('rules', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? ruleFromRow(data[0]) : undefined
}

// ============================================
// Reminders
// ============================================

function reminderFromRow(row: SC['reminders']['Row']): Reminder {
    return {
        id: row.id,
        title: row.title,
        message: row.message,
        kind: row.kind as ReminderKind,
        schedule: row.schedule as unknown as ReminderSchedule,
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export async function trackerGetEnabledReminders(): Promise<Reminder[]> {
    assertEnabled()
    const data = await listOwnedRows('reminders', { filters: [{ column: 'enabled', value: true }] })
    return data.map(reminderFromRow)
}

export async function trackerGetAllReminders(): Promise<Reminder[]> {
    assertEnabled()
    const data = await listOwnedRows('reminders', { orderBy: 'created_at', ascending: true })
    return data.map(reminderFromRow)
}

export async function trackerGetReminderById(id: string): Promise<Reminder | undefined> {
    assertEnabled()
    const data = await listOwnedRows('reminders', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? reminderFromRow(data[0]) : undefined
}

export async function trackerCreateReminder(
    data: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowMs()
    await upsertOwnedRow('reminders', {
        id,
        title: data.title,
        message: data.message,
        kind: data.kind,
        schedule: data.schedule as unknown as import('@/types/supabase').Json,
        enabled: data.enabled,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function trackerUpdateReminder(
    id: string,
    changes: Partial<Omit<Reminder, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['reminders']['Update']> = { updated_at: nowMs() }
    if (changes.title !== undefined) patch.title = changes.title
    if (changes.message !== undefined) patch.message = changes.message
    if (changes.kind !== undefined) patch.kind = changes.kind
    if (changes.schedule !== undefined) patch.schedule = changes.schedule as unknown as import('@/types/supabase').Json
    if (changes.enabled !== undefined) patch.enabled = changes.enabled
    await updateOwnedRows('reminders', patch, [{ column: 'id', value: id }])
}

export async function trackerDeleteReminder(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('reminders', [{ column: 'id', value: id }])
}
