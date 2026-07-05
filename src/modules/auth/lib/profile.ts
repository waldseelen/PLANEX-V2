import type { Database } from '@/types/supabase'
import type { Session, User } from '@/modules/auth/store/authStore'
import { sanitizeRemoteImageUrl } from '@/modules/auth/lib/security'

export type StudentStatus = 'student' | 'working' | 'both' | 'other'

export interface UserProfile {
    id: string
    email: string
    fullName?: string
    avatarUrl?: string
    occupation?: string
    studentStatus: StudentStatus
    school?: string
    department?: string
    grade?: string
    plan: string
    profileCompleted: boolean
    onboardingCompleted: boolean
    preferredLocale: string
    preferredTheme: string
    createdAt: string
    updatedAt: string
}

export interface ProfileCompletionInput {
    fullName: string
    occupation: string
    studentStatus: StudentStatus
    school?: string
    department?: string
    grade?: string
}

export interface AuthBootstrapSnapshot {
    authInitialized: boolean
    dataBootstrapReady: boolean
    isAuthenticated: boolean
    isLoading: boolean
    profile: UserProfile | null
    session: Session | null
    user: User | null
}

export type AuthResolution =
    | 'initializing'
    | 'redirectPending'
    | 'profileLoading'
    | 'bootstrapLoading'
    | 'unauthenticated'
    | 'requiresProfileCompletion'
    | 'authenticated'

export function mapProfileRow(row: Record<string, unknown>): UserProfile {
    return {
        id: row.id as string,
        email: row.email as string,
        fullName: (row.full_name as string | null) ?? undefined,
        avatarUrl: sanitizeRemoteImageUrl(row.avatar_url as string | null) ?? undefined,
        occupation: (row.occupation as string | null) ?? undefined,
        studentStatus: (row.student_status as StudentStatus) ?? 'other',
        school: (row.school as string | null) ?? undefined,
        department: (row.department as string | null) ?? undefined,
        grade: (row.grade as string | null) ?? undefined,
        plan: (row.plan as string) ?? 'free',
        profileCompleted: Boolean(row.profile_completed),
        onboardingCompleted: Boolean(row.onboarding_completed),
        preferredLocale: (row.preferred_locale as string) ?? 'tr',
        preferredTheme: (row.preferred_theme as string) ?? 'system',
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    }
}

export function isProfileStudentScoped(studentStatus: StudentStatus | '' | null | undefined) {
    return studentStatus === 'student' || studentStatus === 'both'
}

export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
    if (!profile) {
        return false
    }

    return profile.profileCompleted
}

export function shouldStartOnboarding(profile: UserProfile | null | undefined): boolean {
    return false
}

export function buildProfileCompletionUpdate(input: ProfileCompletionInput) {
    const updates: Database['public']['Tables']['profiles']['Update'] = {
        full_name: input.fullName.trim(),
        occupation: input.occupation.trim(),
        student_status: input.studentStatus,
        school: isProfileStudentScoped(input.studentStatus) ? input.school?.trim() || null : null,
        department: isProfileStudentScoped(input.studentStatus) ? input.department?.trim() || null : null,
        grade: isProfileStudentScoped(input.studentStatus) ? input.grade?.trim() || null : null,
        profile_completed: true,
    }

    return updates
}

export function buildProfilePatch(updates: Partial<UserProfile>) {
    const dbUpdates: Database['public']['Tables']['profiles']['Update'] = {}

    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = sanitizeRemoteImageUrl(updates.avatarUrl) ?? null
    if (updates.occupation !== undefined) dbUpdates.occupation = updates.occupation
    if (updates.studentStatus !== undefined) dbUpdates.student_status = updates.studentStatus
    if (updates.school !== undefined) dbUpdates.school = updates.school
    if (updates.department !== undefined) dbUpdates.department = updates.department
    if (updates.grade !== undefined) dbUpdates.grade = updates.grade
    if (updates.preferredLocale !== undefined) dbUpdates.preferred_locale = updates.preferredLocale
    if (updates.preferredTheme !== undefined) dbUpdates.preferred_theme = updates.preferredTheme

    return dbUpdates
}

export function resolveAuthState(snapshot: AuthBootstrapSnapshot): AuthResolution {
    if (!snapshot.authInitialized) {
        return 'initializing'
    }

    if (snapshot.isLoading && !snapshot.isAuthenticated) {
        return 'redirectPending'
    }

    if (!snapshot.isAuthenticated || !snapshot.user) {
        return 'unauthenticated'
    }

    if (!snapshot.dataBootstrapReady) {
        return 'bootstrapLoading'
    }

    if (!snapshot.profile) {
        return 'profileLoading'
    }

    if (!snapshot.profile.profileCompleted) {
        return 'requiresProfileCompletion'
    }

    return 'authenticated'
}
