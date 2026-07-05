import { supabase } from '@/config/supabase'
import { requireCurrentUserId } from './currentUser'

// This layer operates on table names chosen at runtime by callers
// (plannerRepo.ts, trackerRepo.ts, settingsStore.ts), so it can't be
// narrowed to the generated `Database['public']['Tables']` union — the
// erased-type client is the correct tool here, not a shortcut.
function table(tableName: string) {
    return (supabase as any).from(tableName)
}

interface Filter {
    column: string
    value: any
}

interface ListOptions {
    filters?: Filter[]
    orderBy?: string
    ascending?: boolean
}

export async function listOwnedRows(
    tableName: string,
    options: ListOptions = {}
): Promise<any[]> {
    const userId = requireCurrentUserId()

    let q = table(tableName).select('*').eq('user_id', userId)

    if (options.filters) {
        for (const filter of options.filters) {
            q = q.eq(filter.column, filter.value)
        }
    }

    if (options.orderBy) {
        q = q.order(options.orderBy, { ascending: options.ascending ?? true })
    }

    const { data, error } = await q
    if (error) throw error
    return data ?? []
}

export async function upsertOwnedRow(
    tableName: string,
    row: Record<string, any>,
    options?: { onConflict?: string },
): Promise<any> {
    const userId = requireCurrentUserId()
    const onConflict = options?.onConflict ?? 'id'
    const payload: Record<string, any> = {
        ...row,
        user_id: userId,
    }
    // Only synthesize a client-side id when the conflict target is the
    // default primary key; composite-key upserts (e.g. settings on
    // user_id,key) let the DB default fill `id` on first insert.
    if (onConflict === 'id' && !payload.id) {
        payload.id = crypto.randomUUID()
    }

    const { data, error } = await table(tableName)
        .upsert(payload, { onConflict })
        .select('*')
        .single()

    if (error) throw error
    return data
}

export async function upsertOwnedRows(
    tableName: string,
    rows: Array<Record<string, any>>,
    options?: { onConflict?: string },
): Promise<any[]> {
    if (rows.length === 0) return []

    const userId = requireCurrentUserId()
    const onConflict = options?.onConflict ?? 'id'
    const payloads = rows.map(row => {
        const payload: Record<string, any> = { ...row, user_id: userId }
        if (onConflict === 'id' && !payload.id) {
            payload.id = crypto.randomUUID()
        }
        return payload
    })

    const { data, error } = await table(tableName)
        .upsert(payloads, { onConflict })
        .select('*')

    if (error) throw error
    return data ?? []
}

export async function updateOwnedRows(
    tableName: string,
    patch: Record<string, any>,
    filters: Filter[] = []
): Promise<any[]> {
    const userId = requireCurrentUserId()

    let q = table(tableName).update(patch).eq('user_id', userId)

    for (const filter of filters) {
        q = q.eq(filter.column, filter.value)
    }

    const { data, error } = await q.select('*')
    if (error) throw error
    return data ?? []
}

export async function deleteOwnedRows(
    tableName: string,
    filters: Filter[] = []
): Promise<void> {
    const userId = requireCurrentUserId()

    let q = table(tableName).delete().eq('user_id', userId)

    for (const filter of filters) {
        q = q.eq(filter.column, filter.value)
    }

    const { error } = await q
    if (error) throw error
}
