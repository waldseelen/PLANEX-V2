/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Planner Repository — Supabase
 *
 * Planner domain için Supabase Postgres CRUD katmanı.
 * Tüm yazma/okuma işlemleri Supabase üzerinden yapılır.
 */

import { supabase } from '@/config/supabase'
import {
    listOwnedRows,
    upsertOwnedRow,
    upsertOwnedRows,
    deleteOwnedRows,
    updateOwnedRows,
} from './supabaseRepo'
import type {
    DBCompletionRecord,
    DBCourse,
    DBPersonalTask,
    DBPlannerEvent,
    DBPlannerHabit,
    DBPlannerHabitLog,
    DBTask,
    DBUnit,
    PlannerEventType,
    PlannerFrequencyRule,
    TaskStatus,
} from '@/db/planner/types'
import { captureSecureException } from '@/modules/auth/lib/telemetry'
import { requireCurrentUserId } from './currentUser'

type SC = any
type Json = any

// ============================================
// Helpers
// ============================================

function assertEnabled(): void {
    // Supabase is always enabled in this project configuration
}



function nowISO(): string { return new Date().toISOString() }
function todayKey(): string { return new Date().toISOString().slice(0, 10) }

// ============================================
// Field Mappers — Firestore Row → Dexie Type
// ============================================

function courseFromRow(row: SC['courses']['Row']): DBCourse {
    return {
        id: row.id,
        code: row.code ?? undefined,
        title: row.name,
        icon: row.icon ?? undefined,
        color: row.color ?? undefined,
        bgGradient: row.bg_gradient ?? undefined,
        order: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function unitFromRow(row: SC['units']['Row']): DBUnit {
    return {
        id: row.id,
        courseId: row.course_id,
        title: row.name,
        order: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function taskFromRow(row: SC['tasks']['Row']): DBTask {
    return {
        id: row.id,
        courseId: row.course_id ?? '',
        unitId: row.unit_id ?? '',
        text: row.title,
        icon: row.icon ?? undefined,
        status: (row.status as TaskStatus) ?? 'todo',
        isPriority: row.priority === 'high',
        dueDateISO: row.due_date ?? undefined,
        completedAt: row.completed_at ?? undefined,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        note: row.description ?? undefined,
        order: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function personalTaskFromRow(row: SC['personal_tasks']['Row']): DBPersonalTask {
    return {
        id: row.id,
        text: row.title,
        icon: row.icon ?? undefined,
        status: (row.status as TaskStatus) ?? 'todo',
        isPriority: row.priority === 'high',
        dueDateISO: row.due_date ?? undefined,
        completedAt: row.completed_at ?? undefined,
        note: row.description ?? undefined,
        order: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function eventFromRow(row: SC['events']['Row']): DBPlannerEvent {
    return {
        id: row.id,
        type: (row.type as PlannerEventType) ?? 'event',
        courseId: row.course_id ?? undefined,
        title: row.title,
        dateISO: row.date,
        description: row.description ?? undefined,
        color: row.color ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function habitFromRow(row: SC['habits']['Row']): DBPlannerHabit {
    const targetDays = (row.target_days as Record<string, unknown> | null) ?? {}
    const frequency: PlannerFrequencyRule = {
        type: (row.frequency as PlannerFrequencyRule['type']) ?? 'weeklyTarget',
        timesPerWeek: typeof targetDays.timesPerWeek === 'number' ? targetDays.timesPerWeek : undefined,
        days: Array.isArray(targetDays.days) ? (targetDays.days as number[]) : undefined,
        interval: typeof targetDays.interval === 'number' ? targetDays.interval : undefined,
    }

    return {
        id: row.id,
        title: row.name,
        description: row.description ?? undefined,
        emoji: row.emoji,
        icon: row.icon ?? undefined,
        type: (row.habit_type as DBPlannerHabit['type']) ?? 'boolean',
        target: row.target_value ?? undefined,
        unit: row.target_unit ?? undefined,
        color: row.color ?? undefined,
        frequency,
        isArchived: row.archived,
        order: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function habitLogFromRow(row: SC['habit_logs']['Row']): DBPlannerHabitLog {
    return {
        id: row.id,
        habitId: row.habit_id,
        dateISO: row.date,
        done: row.status === 'done',
        value: row.value ?? undefined,
        createdAt: row.created_at,
    }
}

function completionRecordFromRow(row: SC['completion_records']['Row']): DBCompletionRecord {
    return {
        id: row.id,
        taskId: row.task_id,
        completedAt: row.completed_at,
        dateKey: row.date_key,
    }
}

// ============================================
// Field Mappers — Dexie Type → Firestore Insert
// ============================================

function frequencyTargetDays(freq: PlannerFrequencyRule): { [key: string]: Json | undefined } {
    switch (freq.type) {
        case 'weeklyTarget': return { timesPerWeek: freq.timesPerWeek ?? 7 }
        case 'specificDays': return { days: freq.days ?? [] }
        case 'everyXDays': return { interval: freq.interval ?? 1 }
        default: return {}
    }
}

// ============================================
// Courses
// ============================================

export async function plannerGetCourses(): Promise<DBCourse[]> {
    assertEnabled()
    const data = await listOwnedRows('courses', { orderBy: 'order_index', ascending: true })
    return data.map(courseFromRow)
}

export async function plannerGetCourseById(id: string): Promise<DBCourse | undefined> {
    assertEnabled()
    const data = await listOwnedRows('courses', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? courseFromRow(data[0]) : undefined
}

export async function plannerAddCourse(input: {
    title: string
    code?: string
    icon?: string
    color?: string
}, orderIndex = 0): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowISO()
    const courseInsert = {
        id,
        name: input.title,
        code: input.code ?? null,
        color: input.color ?? '#6366f1',
        icon: input.icon ?? null,
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
    }
    await upsertOwnedRow('courses', courseInsert)
    return id
}

export async function plannerUpdateCourse(
    id: string,
    updates: Partial<Omit<DBCourse, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['courses']['Update']> = { updated_at: nowISO() }
    if (updates.title !== undefined) patch.name = updates.title
    if (updates.code !== undefined) patch.code = updates.code
    if (updates.icon !== undefined) patch.icon = updates.icon ?? null
    if (updates.color !== undefined) patch.color = updates.color
    if (updates.bgGradient !== undefined) patch.bg_gradient = updates.bgGradient
    if (updates.order !== undefined) patch.order_index = updates.order
    await updateOwnedRows('courses', patch, [{ column: 'id', value: id }])
}

export async function plannerDeleteCourse(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('courses', [{ column: 'id', value: id }])
    await deleteOwnedRows('units', [{ column: 'course_id', value: id }])
    await deleteOwnedRows('tasks', [{ column: 'course_id', value: id }])
    await deleteOwnedRows('events', [{ column: 'course_id', value: id }])
}

export async function plannerReorderCourses(orderedIds: string[]): Promise<void> {
    assertEnabled()
    const userId = requireCurrentUserId()
    const updates = orderedIds.map((id, idx) => ({
        id,
        user_id: userId,
        order_index: idx,
        updated_at: nowISO(),
    }))
    await upsertOwnedRows('courses', updates as unknown as Array<SC['courses']['Insert']>)
}

// ============================================
// Units
// ============================================

export async function plannerGetUnitsByCourse(courseId: string): Promise<DBUnit[]> {
    assertEnabled()
    const data = await listOwnedRows('units', {
        filters: [{ column: 'course_id', value: courseId }],
        orderBy: 'order_index',
        ascending: true
    })
    return data.map(unitFromRow)
}

export async function plannerGetUnitById(id: string): Promise<DBUnit | undefined> {
    assertEnabled()
    const data = await listOwnedRows('units', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? unitFromRow(data[0]) : undefined
}

export async function plannerAddUnit(input: {
    courseId: string
    title: string
}, orderIndex = 0): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowISO()
    await upsertOwnedRow('units', {
        id,
        course_id: input.courseId,
        name: input.title,
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function plannerUpdateUnit(
    id: string,
    updates: Partial<Omit<DBUnit, 'id' | 'courseId' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['units']['Update']> = { updated_at: nowISO() }
    if (updates.title !== undefined) patch.name = updates.title
    if (updates.order !== undefined) patch.order_index = updates.order
    await updateOwnedRows('units', patch, [{ column: 'id', value: id }])
}

export async function plannerDeleteUnit(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('units', [{ column: 'id', value: id }])
    await deleteOwnedRows('tasks', [{ column: 'unit_id', value: id }])
}

// ============================================
// Tasks
// ============================================

export async function plannerGetTasksByUnit(courseId: string, unitId: string): Promise<DBTask[]> {
    assertEnabled()
    const data = await listOwnedRows('tasks', {
        filters: [
            { column: 'course_id', value: courseId },
            { column: 'unit_id', value: unitId }
        ],
        orderBy: 'order_index',
        ascending: true
    })
    return data.map(taskFromRow)
}

export async function plannerGetTasksByCourse(courseId: string): Promise<DBTask[]> {
    assertEnabled()
    const data = await listOwnedRows('tasks', {
        filters: [{ column: 'course_id', value: courseId }],
        orderBy: 'order_index',
        ascending: true
    })
    return data.map(taskFromRow)
}

export async function plannerGetTaskById(id: string): Promise<DBTask | undefined> {
    assertEnabled()
    const data = await listOwnedRows('tasks', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? taskFromRow(data[0]) : undefined
}

export async function plannerGetTasksByDueDateRange(startISO: string, endISO: string): Promise<DBTask[]> {
    assertEnabled()
    const data = await listOwnedRows('tasks')
    const filtered = data.filter(row => {
        const dueDate = row.due_date
        if (!dueDate) return false
        return dueDate >= startISO && dueDate <= endISO
    })
    return filtered.map(taskFromRow)
}

export async function plannerGetOverdueTasks(): Promise<DBTask[]> {
    assertEnabled()
    const today = todayKey()
    const data = await listOwnedRows('tasks')
    const filtered = data.filter(row => {
        return row.status !== 'done' && row.due_date && row.due_date < today
    })
    return filtered.map(taskFromRow)
}

export async function plannerGetAllTasks(): Promise<DBTask[]> {
    assertEnabled()
    const data = await listOwnedRows('tasks', { orderBy: 'order_index', ascending: true })
    return data.map(taskFromRow)
}

export async function plannerGetAllUnits(): Promise<DBUnit[]> {
    assertEnabled()
    const data = await listOwnedRows('units', { orderBy: 'order_index', ascending: true })
    return data.map(unitFromRow)
}

export async function plannerAddTask(input: {
    courseId: string
    unitId: string
    text: string
    icon?: string
    status?: TaskStatus
    isPriority?: boolean
    dueDateISO?: string
    tags?: string[]
    note?: string
}, orderIndex = 0): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowISO()
    const taskInsert = {
        id,
        course_id: input.courseId,
        unit_id: input.unitId,
        title: input.text,
        icon: input.icon ?? null,
        status: input.status ?? 'todo',
        priority: input.isPriority ? 'high' : null,
        due_date: input.dueDateISO ?? null,
        completed_at: null,
        tags: input.tags ?? [],
        description: input.note ?? null,
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
    }
    await upsertOwnedRow('tasks', taskInsert)
    return id
}

export async function plannerUpdateTask(
    id: string,
    updates: Partial<Omit<DBTask, 'id' | 'courseId' | 'unitId' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['tasks']['Update']> = { updated_at: nowISO() }
    if (updates.text !== undefined) patch.title = updates.text
    if (updates.icon !== undefined) patch.icon = updates.icon ?? null
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.isPriority !== undefined) patch.priority = updates.isPriority ? 'high' : null
    if (updates.dueDateISO !== undefined) patch.due_date = updates.dueDateISO ?? null
    if (updates.completedAt !== undefined) patch.completed_at = updates.completedAt ?? null
    if (updates.tags !== undefined) patch.tags = updates.tags
    if (updates.note !== undefined) patch.description = updates.note ?? null
    if (updates.order !== undefined) patch.order_index = updates.order
    await updateOwnedRows('tasks', patch, [{ column: 'id', value: id }])
}

export async function plannerDeleteTask(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('tasks', [{ column: 'id', value: id }])
    await deleteOwnedRows('completion_records', [{ column: 'task_id', value: id }])
}

export async function plannerReorderTasks(orderedIds: string[]): Promise<void> {
    assertEnabled()
    const userId = requireCurrentUserId()
    const updates = orderedIds.map((taskId, idx) => ({
        id: taskId,
        user_id: userId,
        order_index: idx,
        updated_at: nowISO(),
    }))
    await upsertOwnedRows('tasks', updates as unknown as Array<SC['tasks']['Insert']>)
}

// ============================================
// Personal Tasks
// ============================================

export async function plannerGetPersonalTasks(): Promise<DBPersonalTask[]> {
    assertEnabled()
    const data = await listOwnedRows('personal_tasks', { orderBy: 'order_index', ascending: true })
    return data.map(personalTaskFromRow)
}

export async function plannerGetPersonalTaskById(id: string): Promise<DBPersonalTask | undefined> {
    assertEnabled()
    const data = await listOwnedRows('personal_tasks', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? personalTaskFromRow(data[0]) : undefined
}

export async function plannerAddPersonalTask(input: {
    text: string
    icon?: string
    status?: TaskStatus
    isPriority?: boolean
    dueDateISO?: string
    note?: string
}, orderIndex = 0): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowISO()
    const personalTaskInsert = {
        id,
        title: input.text,
        icon: input.icon ?? null,
        status: input.status ?? 'todo',
        priority: input.isPriority ? 'high' : null,
        due_date: input.dueDateISO ?? null,
        completed_at: null,
        description: input.note ?? null,
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
    }
    await upsertOwnedRow('personal_tasks', personalTaskInsert)
    return id
}

export async function plannerUpdatePersonalTask(
    id: string,
    updates: Partial<Omit<DBPersonalTask, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['personal_tasks']['Update']> = { updated_at: nowISO() }
    if (updates.text !== undefined) patch.title = updates.text
    if (updates.icon !== undefined) patch.icon = updates.icon ?? null
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.isPriority !== undefined) patch.priority = updates.isPriority ? 'high' : null
    if (updates.dueDateISO !== undefined) patch.due_date = updates.dueDateISO ?? null
    if (updates.completedAt !== undefined) patch.completed_at = updates.completedAt ?? null
    if (updates.note !== undefined) patch.description = updates.note ?? null
    if (updates.order !== undefined) patch.order_index = updates.order
    await updateOwnedRows('personal_tasks', patch, [{ column: 'id', value: id }])
}

export async function plannerDeletePersonalTask(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('personal_tasks', [{ column: 'id', value: id }])
}

// ============================================
// Events
// ============================================

export async function plannerGetEventsByDateRange(startISO: string, endISO: string): Promise<DBPlannerEvent[]> {
    assertEnabled()
    const data = await listOwnedRows('events')
    const filtered = data.filter(row => {
        return row.date >= startISO && row.date <= endISO
    })
    filtered.sort((a, b) => a.date.localeCompare(b.date))
    return filtered.map(eventFromRow)
}

export async function plannerGetEventsByDate(dateISO: string): Promise<DBPlannerEvent[]> {
    assertEnabled()
    const data = await listOwnedRows('events', {
        filters: [{ column: 'date', value: dateISO }]
    })
    return data.map(eventFromRow)
}

export async function plannerGetEventsByCourse(courseId: string): Promise<DBPlannerEvent[]> {
    assertEnabled()
    const data = await listOwnedRows('events', {
        filters: [{ column: 'course_id', value: courseId }]
    })
    data.sort((a, b) => a.date.localeCompare(b.date))
    return data.map(eventFromRow)
}

export async function plannerGetAllEvents(): Promise<DBPlannerEvent[]> {
    assertEnabled()
    const data = await listOwnedRows('events')
    data.sort((a, b) => a.date.localeCompare(b.date))
    return data.map(eventFromRow)
}

export async function plannerGetEventById(id: string): Promise<DBPlannerEvent | undefined> {
    assertEnabled()
    const data = await listOwnedRows('events', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? eventFromRow(data[0]) : undefined
}

export async function plannerGetUpcomingExams(limit = 10): Promise<DBPlannerEvent[]> {
    assertEnabled()
    const today = todayKey()
    const data = await listOwnedRows('events', {
        filters: [{ column: 'type', value: 'exam' }]
    })
    const filtered = data.filter(row => row.date >= today)
    filtered.sort((a, b) => a.date.localeCompare(b.date))
    return filtered.slice(0, limit).map(eventFromRow)
}

export async function plannerAddEvent(input: {
    type: PlannerEventType
    title: string
    dateISO: string
    courseId?: string
    description?: string
    color?: string
}): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowISO()
    await upsertOwnedRow('events', {
        id,
        type: input.type,
        title: input.title,
        date: input.dateISO,
        course_id: input.courseId ?? null,
        description: input.description ?? null,
        color: input.color ?? null,
        completed: false,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function plannerUpdateEvent(
    id: string,
    updates: Partial<Omit<DBPlannerEvent, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['events']['Update']> = { updated_at: nowISO() }
    if (updates.type !== undefined) patch.type = updates.type
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.dateISO !== undefined) patch.date = updates.dateISO
    if (updates.courseId !== undefined) patch.course_id = updates.courseId ?? null
    if (updates.description !== undefined) patch.description = updates.description ?? null
    if (updates.color !== undefined) patch.color = updates.color ?? null
    await updateOwnedRows('events', patch, [{ column: 'id', value: id }])
}

export async function plannerDeleteEvent(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('events', [{ column: 'id', value: id }])
}

export async function plannerDeleteEventsByCourse(courseId: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('events', [{ column: 'course_id', value: courseId }])
}

// ============================================
// Habits
// ============================================

export async function plannerGetAllHabits(): Promise<DBPlannerHabit[]> {
    assertEnabled()
    const data = await listOwnedRows('habits', { orderBy: 'order_index', ascending: true })
    return data.map(habitFromRow)
}

export async function plannerGetHabitById(id: string): Promise<DBPlannerHabit | undefined> {
    assertEnabled()
    const data = await listOwnedRows('habits', {
        filters: [{ column: 'id', value: id }]
    })
    return data[0] ? habitFromRow(data[0]) : undefined
}

export async function plannerAddHabit(input: Omit<DBPlannerHabit, 'id' | 'createdAt' | 'updatedAt' | 'order'>, orderIndex = 0): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowISO()
    const habitInsert = {
        id,
        name: input.title,
        description: input.description ?? null,
        emoji: input.emoji,
        icon: input.icon ?? null,
        habit_type: input.type,
        target_value: input.target ?? null,
        target_unit: input.unit ?? null,
        color: input.color ?? '#6366f1',
        frequency: input.frequency.type,
        target_days: frequencyTargetDays(input.frequency),
        archived: input.isArchived,
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
    }
    await upsertOwnedRow('habits', habitInsert)
    return id
}

export async function plannerUpdateHabit(
    id: string,
    updates: Partial<Omit<DBPlannerHabit, 'id' | 'createdAt'>>,
): Promise<void> {
    assertEnabled()
    const patch: Partial<SC['habits']['Update']> = { updated_at: nowISO() }
    if (updates.title !== undefined) patch.name = updates.title
    if (updates.description !== undefined) patch.description = updates.description ?? null
    if (updates.emoji !== undefined) patch.emoji = updates.emoji
    if (updates.icon !== undefined) patch.icon = updates.icon ?? null
    if (updates.type !== undefined) patch.habit_type = updates.type
    if (updates.target !== undefined) patch.target_value = updates.target ?? null
    if (updates.unit !== undefined) patch.target_unit = updates.unit ?? null
    if (updates.color !== undefined) patch.color = updates.color ?? null
    if (updates.frequency !== undefined) {
        patch.frequency = updates.frequency.type
        patch.target_days = frequencyTargetDays(updates.frequency)
    }
    if (updates.isArchived !== undefined) patch.archived = updates.isArchived
    if (updates.order !== undefined) patch.order_index = updates.order
    await updateOwnedRows('habits', patch, [{ column: 'id', value: id }])
}

export async function plannerDeleteHabit(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('habit_logs', [{ column: 'habit_id', value: id }])
    await deleteOwnedRows('habits', [{ column: 'id', value: id }])
}

// ============================================
// Habit Logs
// ============================================

export async function plannerGetHabitLogs(habitId: string): Promise<DBPlannerHabitLog[]> {
    assertEnabled()
    const data = await listOwnedRows('habit_logs', {
        filters: [{ column: 'habit_id', value: habitId }]
    })
    data.sort((a, b) => a.date.localeCompare(b.date))
    return data.map(habitLogFromRow)
}

export async function plannerGetHabitLogForDate(habitId: string, dateISO: string): Promise<DBPlannerHabitLog | undefined> {
    assertEnabled()
    const data = await listOwnedRows('habit_logs', {
        filters: [
            { column: 'habit_id', value: habitId },
            { column: 'date', value: dateISO }
        ]
    })
    return data[0] ? habitLogFromRow(data[0]) : undefined
}

export async function plannerGetHabitLogsByDate(dateISO: string): Promise<DBPlannerHabitLog[]> {
    assertEnabled()
    const data = await listOwnedRows('habit_logs', {
        filters: [{ column: 'date', value: dateISO }]
    })
    return data.map(habitLogFromRow)
}

export async function plannerGetAllHabitLogs(): Promise<DBPlannerHabitLog[]> {
    assertEnabled()
    const data = await listOwnedRows('habit_logs')
    data.sort((a, b) => a.date.localeCompare(b.date))
    return data.map(habitLogFromRow)
}

export async function plannerGetHabitLogsByHabitAndDateRange(
    habitId: string,
    startISO: string,
    endISO: string,
): Promise<DBPlannerHabitLog[]> {
    assertEnabled()
    const data = await listOwnedRows('habit_logs', {
        filters: [{ column: 'habit_id', value: habitId }]
    })
    const filtered = data.filter(row => row.date >= startISO && row.date <= endISO)
    filtered.sort((a, b) => a.date.localeCompare(b.date))
    return filtered.map(habitLogFromRow)
}

export async function plannerUpsertHabitLog(input: {
    habitId: string
    dateISO: string
    done: boolean
    value?: number
}): Promise<string> {
    assertEnabled()
    const existing = await plannerGetHabitLogForDate(input.habitId, input.dateISO)
    if (existing) {
        await updateOwnedRows('habit_logs', {
            status: input.done ? 'done' : 'skipped',
            value: input.value ?? null,
            updated_at: nowISO(),
        }, [{ column: 'id', value: existing.id }])
        return existing.id
    }
    const id = crypto.randomUUID()
    const now = nowISO()
    await upsertOwnedRow('habit_logs', {
        id,
        habit_id: input.habitId,
        date: input.dateISO,
        status: input.done ? 'done' : 'skipped',
        value: input.value ?? null,
        notes: null,
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function plannerDeleteHabitLog(id: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('habit_logs', [{ column: 'id', value: id }])
}

// ============================================
// Completion Records
// ============================================

export async function plannerAddCompletionRecord(taskId: string): Promise<string> {
    assertEnabled()
    const id = crypto.randomUUID()
    const now = nowISO()
    await upsertOwnedRow('completion_records', {
        id,
        task_id: taskId,
        completed_at: now,
        date_key: todayKey(),
        created_at: now,
        updated_at: now,
    })
    return id
}

export async function plannerDeleteCompletionRecordsByTaskId(taskId: string): Promise<void> {
    assertEnabled()
    await deleteOwnedRows('completion_records', [{ column: 'task_id', value: taskId }])
}

export async function plannerGetCompletionRecordsByDateRange(startISO: string, endISO: string): Promise<DBCompletionRecord[]> {
    assertEnabled()
    const data = await listOwnedRows('completion_records')
    const filtered = data.filter(row => row.date_key >= startISO && row.date_key <= endISO)
    return filtered.map(completionRecordFromRow)
}

export async function plannerGetCompletionRecordsByDate(dateISO: string): Promise<DBCompletionRecord[]> {
    assertEnabled()
    const data = await listOwnedRows('completion_records', {
        filters: [{ column: 'date_key', value: dateISO }]
    })
    return data.map(completionRecordFromRow)
}

// ============================================
// Stats (aggregate)
// ============================================

export async function plannerCountCourses(): Promise<number> {
    assertEnabled()
    const userId = requireCurrentUserId()
    const { count, error } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
    if (error) throw error
    return count ?? 0
}

export async function plannerCountTasks(courseId?: string): Promise<{ total: number; completed: number }> {
    assertEnabled()
    const userId = requireCurrentUserId()

    let q = supabase.from('tasks').select('status', { count: 'exact' }).eq('user_id', userId)
    if (courseId) {
        q = q.eq('course_id', courseId)
    }

    const { data, count, error } = await q
    if (error) throw error
    const completed = (data ?? []).filter((row: any) => row.status === 'done').length

    return {
        total: count ?? 0,
        completed
    }
}

export async function plannerCountActiveHabits(): Promise<number> {
    assertEnabled()
    const userId = requireCurrentUserId()
    const { count, error } = await supabase
        .from('habits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('archived', false)
    if (error) throw error
    return count ?? 0
}

export async function plannerCountTodayCompletedHabits(): Promise<number> {
    assertEnabled()
    const userId = requireCurrentUserId()
    const today = todayKey()
    const { count, error } = await supabase
        .from('habit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date', today)
        .eq('status', 'done')
    if (error) throw error
    return count ?? 0
}

export async function plannerCountUpcomingExams(): Promise<number> {
    assertEnabled()
    const userId = requireCurrentUserId()
    const today = todayKey()
    const { count, error } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'exam')
        .gte('date', today)
    if (error) throw error
    return count ?? 0
}

export async function plannerCountPersonalTasks(): Promise<number> {
    assertEnabled()
    const userId = requireCurrentUserId()
    const { count, error } = await supabase
        .from('personal_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
    if (error) throw error
    return count ?? 0
}
