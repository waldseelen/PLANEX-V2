/**
 * Hand-maintained mirror of supabase/migrations/20260705000000_init_schema.sql.
 * Once `supabase login` + `supabase link` are done locally, replace this file with:
 *   supabase gen types typescript --linked > src/types/supabase.ts
 *
 * Only `profiles` and the handful of tables queried with a literal
 * `supabase.from('...')` call (see plannerRepo.ts's count* helpers) are typed
 * precisely. Every other table flows through the dynamic, runtime-table-name
 * repo layer (supabaseRepo.ts) which is intentionally untyped (`SC = any` in
 * plannerRepo.ts / trackerRepo.ts) — `AnyTable` below satisfies the
 * `GenericTable` constraint for those without hand-typing every column.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

type Timestamps = {
    created_at: string
    updated_at: string
}

type AnyTable = {
    Row: Record<string, any>
    Insert: Record<string, any>
    Update: Record<string, any>
    Relationships: []
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Timestamps & {
                    id: string
                    email: string | null
                    full_name: string | null
                    avatar_url: string | null
                    occupation: string | null
                    student_status: 'student' | 'working' | 'both' | 'other' | null
                    school: string | null
                    department: string | null
                    grade: string | null
                    plan: string
                    profile_completed: boolean
                    onboarding_completed: boolean
                    preferred_locale: string
                    preferred_theme: string
                }
                Insert: Partial<Timestamps> & {
                    id: string
                    email?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    occupation?: string | null
                    student_status?: 'student' | 'working' | 'both' | 'other' | null
                    school?: string | null
                    department?: string | null
                    grade?: string | null
                    plan?: string
                    profile_completed?: boolean
                    onboarding_completed?: boolean
                    preferred_locale?: string
                    preferred_theme?: string
                }
                Update: Partial<Timestamps> & {
                    id?: string
                    email?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    occupation?: string | null
                    student_status?: 'student' | 'working' | 'both' | 'other' | null
                    school?: string | null
                    department?: string | null
                    grade?: string | null
                    plan?: string
                    profile_completed?: boolean
                    onboarding_completed?: boolean
                    preferred_locale?: string
                    preferred_theme?: string
                }
                Relationships: []
            }
            courses: {
                Row: Timestamps & {
                    id: string
                    user_id: string
                    name: string
                    code: string | null
                    icon: string | null
                    color: string
                    bg_gradient: string | null
                    order_index: number
                }
                Insert: Partial<Timestamps> & { id?: string; user_id: string; name: string; code?: string | null; icon?: string | null; color?: string; bg_gradient?: string | null; order_index?: number }
                Update: Partial<Timestamps> & { id?: string; user_id?: string; name?: string; code?: string | null; icon?: string | null; color?: string; bg_gradient?: string | null; order_index?: number }
                Relationships: []
            }
            tasks: {
                Row: Timestamps & {
                    id: string
                    user_id: string
                    course_id: string
                    unit_id: string
                    title: string
                    icon: string | null
                    status: string
                    priority: string | null
                    due_date: string | null
                    completed_at: string | null
                    tags: Json
                    description: string | null
                    order_index: number
                }
                Insert: Partial<Timestamps> & { id?: string; user_id: string; course_id: string; unit_id: string; title: string; icon?: string | null; status?: string; priority?: string | null; due_date?: string | null; completed_at?: string | null; tags?: Json; description?: string | null; order_index?: number }
                Update: Partial<Timestamps> & { id?: string; user_id?: string; course_id?: string; unit_id?: string; title?: string; icon?: string | null; status?: string; priority?: string | null; due_date?: string | null; completed_at?: string | null; tags?: Json; description?: string | null; order_index?: number }
                Relationships: []
            }
            personal_tasks: {
                Row: Timestamps & {
                    id: string
                    user_id: string
                    title: string
                    icon: string | null
                    status: string
                    priority: string | null
                    due_date: string | null
                    completed_at: string | null
                    description: string | null
                    order_index: number
                }
                Insert: Partial<Timestamps> & { id?: string; user_id: string; title: string; icon?: string | null; status?: string; priority?: string | null; due_date?: string | null; completed_at?: string | null; description?: string | null; order_index?: number }
                Update: Partial<Timestamps> & { id?: string; user_id?: string; title?: string; icon?: string | null; status?: string; priority?: string | null; due_date?: string | null; completed_at?: string | null; description?: string | null; order_index?: number }
                Relationships: []
            }
            events: {
                Row: Timestamps & {
                    id: string
                    user_id: string
                    type: 'exam' | 'event'
                    course_id: string | null
                    title: string
                    date: string
                    description: string | null
                    color: string | null
                    completed: boolean
                }
                Insert: Partial<Timestamps> & { id?: string; user_id: string; type: 'exam' | 'event'; course_id?: string | null; title: string; date: string; description?: string | null; color?: string | null; completed?: boolean }
                Update: Partial<Timestamps> & { id?: string; user_id?: string; type?: 'exam' | 'event'; course_id?: string | null; title?: string; date?: string; description?: string | null; color?: string | null; completed?: boolean }
                Relationships: []
            }
            habits: {
                Row: Timestamps & {
                    id: string
                    user_id: string
                    name: string
                    archived: boolean
                    order_index: number
                }
                Insert: Partial<Timestamps> & { id?: string; user_id: string; name: string; archived?: boolean; order_index?: number }
                Update: Partial<Timestamps> & { id?: string; user_id?: string; name?: string; archived?: boolean; order_index?: number }
                Relationships: []
            }
            habit_logs: {
                Row: {
                    id: string
                    user_id: string
                    habit_id: string
                    date: string
                    status: 'done' | 'skipped'
                }
                Insert: { id?: string; user_id: string; habit_id: string; date: string; status: 'done' | 'skipped' }
                Update: { id?: string; user_id?: string; habit_id?: string; date?: string; status?: 'done' | 'skipped' }
                Relationships: []
            }
            units: AnyTable
            completion_records: AnyTable
            categories: AnyTable
            tags: AnyTable
            activities: AnyTable
            time_sessions: AnyTable
            running_timers: AnyTable
            goals: AnyTable
            rules: AnyTable
            reminders: AnyTable
            settings: AnyTable
            pomodoro_configs: AnyTable
            concepts: AnyTable
            concept_mastery: AnyTable
            learn_sessions: AnyTable
            learn_messages: AnyTable
            tutor_events: AnyTable
            error_logs: AnyTable
            sr_cards: AnyTable
            documents: AnyTable
            document_chunks: AnyTable
            mindmaps: AnyTable
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            match_document_chunks: {
                Args: {
                    query_embedding: number[]
                    match_user_id: string
                    match_threshold?: number
                    match_count?: number
                }
                Returns: {
                    id: string
                    content: string
                    metadata: Json
                    similarity: number
                }[]
            }
        }
        Enums: {
            [_ in never]: never
        }
    }
}
