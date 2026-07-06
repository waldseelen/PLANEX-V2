/**
 * Auth Store — Supabase Auth & Postgres profiles
 *
 * Spec 2.2: Email/password yok — sadece Google ve GitHub OAuth (email path kod tabanında
 * geriye dönük uyum için bırakıldı, `VITE_ENABLE_EMAIL_AUTH` ile kapatılabilir).
 * Spec 2.4: full_name, occupation (text), student_status zorunlu.
 * Spec 2.6: preferred_locale ve preferred_theme profile'a yazılır.
 * Spec 2.7: v1'de ek rol modeli yok.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/config/supabase'
import type { Session as SupabaseSession, User as SupabaseUser } from '@supabase/supabase-js'
import { clearLocalCacheOwner } from '@/lib/cloud/localCacheOwner'
import {
  buildProfileCompletionUpdate,
  buildProfilePatch,
  isProfileComplete as resolveProfileComplete,
  mapProfileRow,
  shouldStartOnboarding as resolveShouldStartOnboarding,
  type ProfileCompletionInput,
  type StudentStatus,
  type UserProfile,
} from '@/modules/auth/lib/profile'
import {
  clearLastOAuthProvider,
} from '@/modules/auth/lib/oauth'
import {
  isSupportedLocale,
  isSupportedTheme,
  validateAvatarFile,
  checkRateLimit,
} from '@/modules/auth/lib/security'
import { captureSecureException } from '@/modules/auth/lib/telemetry'

export type { StudentStatus, UserProfile } from '@/modules/auth/lib/profile'

export type User = {
  id: string
  email?: string
  displayName?: string
  photoURL?: string
}

export type Session = {
  accessToken?: string
  user: User
}

interface AuthState {
  // ── State ──────────────────────────────────────────────────────────────────
  user: User | null
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  authInitialized: boolean
  dataBootstrapReady: boolean

  // ── Setters ────────────────────────────────────────────────────────────────
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setDataBootstrapReady: (ready: boolean) => void

  // ── Auth methods ───────────────────────────────────────────────────────────
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>
  signOut: () => Promise<void>

  // ── Profile methods ────────────────────────────────────────────────────────
  fetchProfile: (userOverride?: User | null) => Promise<UserProfile | null>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  completeProfile: (data: ProfileCompletionInput) => Promise<void>
  completeOnboarding: () => Promise<void>
  restartOnboarding: () => Promise<void>
  uploadAvatar: (file: File) => Promise<string | null>
  syncProfilePreferences: (locale: string, theme: string) => Promise<void>

  // ── Derived helpers ────────────────────────────────────────────────────────
  isProfileComplete: () => boolean
  shouldStartOnboarding: () => boolean
  ensureProfile: (userOverride?: User | null) => Promise<UserProfile | null>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      authInitialized: false,
      dataBootstrapReady: false,

      // ── Setters ────────────────────────────────────────────────────────────
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setProfile: (profile) => set({ profile }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),
      setDataBootstrapReady: (dataBootstrapReady) => set({ dataBootstrapReady }),

      // ── Supabase Auth ──────────────────────────────────────────────────────
      signInWithEmail: async (email, password) => {
        set({ isLoading: true })
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
        } catch (error) {
          captureSecureException(error, { context: 'AuthStore.signInWithEmail', category: 'network' })
          set({ isLoading: false })
          throw error
        }
      },

      signUpWithEmail: async (email, password) => {
        set({ isLoading: true })
        try {
          const { error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
        } catch (error) {
          captureSecureException(error, { context: 'AuthStore.signUpWithEmail', category: 'network' })
          set({ isLoading: false })
          throw error
        }
      },

      signInWithOAuth: async (providerName) => {
        set({ isLoading: true })
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: providerName,
            options: {
              redirectTo: `${window.location.origin}/auth/callback`,
            },
          })
          if (error) throw error
          // Browser navigates away to the OAuth provider here; state is
          // resolved by the onAuthStateChange listener after redirect back.
        } catch (error) {
          captureSecureException(error, { context: 'AuthStore.signInWithOAuth', category: 'network' })
          set({ isLoading: false })
          throw error
        }
      },

      signOut: async () => {
        set({ isLoading: true })
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
          clearLastOAuthProvider()
          clearLocalCacheOwner()
          set({
            user: null,
            profile: null,
            session: null,
            isAuthenticated: false,
            dataBootstrapReady: true,
          })
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.signOut',
            category: 'network',
            userId: get().user?.id,
          })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      // ── Fetch profile from Postgres ────────────────────────────────────────
      fetchProfile: async (userOverride) => {
        const user = userOverride ?? get().user
        if (!user) return null

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()

          if (error) throw error
          if (!data) {
            set({ profile: null })
            return null
          }

          const profile = mapProfileRow(data as Record<string, unknown>)
          set({ profile })
          return profile
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.fetchProfile',
            category: 'database',
            userId: user.id,
          })
          throw error
        }
      },

      // ── Ensure profile row exists (race-condition-safe) ────────────────────
      ensureProfile: async (userOverride) => {
        const user = userOverride ?? get().user
        const { fetchProfile, profile } = get()
        if (!user) return null
        if (profile?.id === user.id) return profile
        if (profile && profile.id !== user.id) {
          set({ profile: null })
        }

        try {
          const existing = await fetchProfile(user)
          if (existing) {
            return existing
          }

          // The `handle_new_user` DB trigger normally creates this row on
          // sign-up; this upsert only covers the race where it hasn't landed yet.
          const newProfileRow = {
            id: user.id,
            email: user.email ?? '',
            full_name: user.displayName ?? '',
            avatar_url: user.photoURL ?? null,
            plan: 'free',
            profile_completed: false,
            onboarding_completed: false,
            preferred_locale: 'tr',
            preferred_theme: 'system',
          }

          const { data, error } = await supabase
            .from('profiles')
            .upsert(newProfileRow, { onConflict: 'id' })
            .select('*')
            .single()

          if (error) throw error

          const newProfile = mapProfileRow(data as Record<string, unknown>)
          set({ profile: newProfile })
          return newProfile
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.ensureProfile',
            category: 'database',
            userId: user.id,
          })
          throw error
        }
      },

      // ── Update arbitrary profile fields ───────────────────────────────────
      updateProfile: async (updates) => {
        const { user, profile } = get()
        if (!user || !profile) return

        const normalizedUpdates: Partial<UserProfile> = { ...updates }
        if (updates.preferredLocale !== undefined && !isSupportedLocale(updates.preferredLocale)) {
          delete normalizedUpdates.preferredLocale
        }
        if (updates.preferredTheme !== undefined && !isSupportedTheme(updates.preferredTheme)) {
          delete normalizedUpdates.preferredTheme
        }

        const dbUpdates = buildProfilePatch(normalizedUpdates)

        try {
          const { data, error } = await supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', user.id)
            .select('*')
            .single()

          if (error) throw error
          set({ profile: mapProfileRow(data as Record<string, unknown>) })
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.updateProfile',
            category: 'database',
            userId: user.id,
          })
          throw error
        }
      },

      // ── Complete profile setup (first-login flow) ──────────────────────────
      completeProfile: async (input) => {
        const { user } = get()
        if (!user) return
        await get().ensureProfile(user)

        const updates = buildProfileCompletionUpdate(input)

        try {
          const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select('*')
            .single()

          if (error) throw error
          set({ profile: mapProfileRow(data as Record<string, unknown>) })
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.completeProfile',
            category: 'database',
            userId: user.id,
          })
          throw error
        }
      },

      // ── Mark onboarding done ───────────────────────────────────────────────
      completeOnboarding: async () => {
        const { user, profile } = get()
        if (!user) return

        try {
          const { error } = await supabase
            .from('profiles')
            .update({ onboarding_completed: true })
            .eq('id', user.id)

          if (error) throw error
          set({ profile: { ...(profile as UserProfile), onboardingCompleted: true } })
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.completeOnboarding',
            category: 'database',
            userId: user.id,
          })
          throw error
        }
      },

      restartOnboarding: async () => {
        const { user, profile } = get()
        if (!user || !profile) return

        try {
          const { error } = await supabase
            .from('profiles')
            .update({ onboarding_completed: false })
            .eq('id', user.id)

          if (error) throw error
          set({ profile: { ...profile, onboardingCompleted: false } })
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.restartOnboarding',
            category: 'database',
            userId: user.id,
          })
          throw error
        }
      },

      uploadAvatar: async (file) => {
        const { user } = get()
        if (!user) return null

        const fileValidation = validateAvatarFile(file)
        if (!fileValidation.valid) {
          throw new Error(fileValidation.reason)
        }

        if (!checkRateLimit(`avatar:${user.id}`, 3, 60 * 1000)) {
          throw new Error('Too many upload attempts. Please try again in a minute.')
        }

        const extension = fileValidation.extension
        const path = `${user.id}/avatar.${extension}`

        try {
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true, contentType: file.type })

          if (uploadError) throw uploadError

          const { data } = supabase.storage.from('avatars').getPublicUrl(path)
          const publicUrl = `${data.publicUrl}?v=${Date.now()}`

          await get().updateProfile({ avatarUrl: publicUrl })
          return publicUrl
        } catch (uploadError) {
          captureSecureException(uploadError, {
            context: 'AuthStore.uploadAvatar',
            category: 'network',
            userId: user.id,
          })
          throw uploadError
        }
      },

      // ── Sync theme + locale to profile (spec 2.6) ─────────────────────────
      syncProfilePreferences: async (locale, theme) => {
        const { user, profile } = get()
        if (!user || !profile) return
        if (!isSupportedLocale(locale) || !isSupportedTheme(theme)) return

        try {
          const { error } = await supabase
            .from('profiles')
            .update({ preferred_locale: locale, preferred_theme: theme })
            .eq('id', user.id)

          if (error) throw error
          set({ profile: { ...profile, preferredLocale: locale, preferredTheme: theme } })
        } catch (error) {
          captureSecureException(error, {
            context: 'AuthStore.syncProfilePreferences',
            category: 'database',
            userId: user.id,
          })
        }
      },

      // ── Derived helpers ────────────────────────────────────────────────────
      isProfileComplete: () => {
        return resolveProfileComplete(get().profile)
      },

      shouldStartOnboarding: () => {
        return resolveShouldStartOnboarding(get().profile)
      },
    }),
    {
      name: 'planex-auth',
      partialize: () => ({}),
      version: 2,
      migrate: () => ({}),
    }
  )
)

/**
 * TEMP DEV-ONLY BYPASS — remove once done testing.
 * Signs in a real, dedicated dev/test Supabase account via signInWithPassword
 * when VITE_DEV_BYPASS_AUTH=true in .env.local, instead of faking local auth
 * state — a fake session has no real JWT, so Supabase RLS silently rejects
 * every read/write. Requires VITE_DEV_BYPASS_EMAIL/VITE_DEV_BYPASS_PASSWORD
 * for a pre-existing, already-confirmed-and-onboarded account. Only ever
 * active in `npm run dev` (import.meta.env.DEV); never set in
 * .env.production/.env.example, so it cannot reach a real build.
 */
const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export function isDevAuthBypassActive() {
  return DEV_BYPASS_AUTH
}

async function applyDevBypassSession() {
  const email = import.meta.env.VITE_DEV_BYPASS_EMAIL as string | undefined
  const password = import.meta.env.VITE_DEV_BYPASS_PASSWORD as string | undefined

  if (!email || !password) {
    console.error(
      '[DEV_BYPASS_AUTH] VITE_DEV_BYPASS_EMAIL and VITE_DEV_BYPASS_PASSWORD must be set in ' +
      '.env.local (a pre-existing, confirmed, onboarded dev/test Supabase account) for the ' +
      'bypass to work — falling back to unauthenticated state instead of a fake session.'
    )
    setUnauthenticatedState()
    return
  }

  try {
    await useAuthStore.getState().signInWithEmail(email, password)
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    await applySession(data.session)
  } catch (error) {
    captureSecureException(error, {
      context: 'AuthStore.devBypassSignIn',
      category: 'network',
    })
    setUnauthenticatedState()
  }
}

/**
 * Auth state listener — Supabase session değişikliklerini dinler.
 */
let unsubscribeAuthListener: (() => void) | null = null
let authBootstrapPromise: Promise<void> | null = null

function setUnauthenticatedState() {
  clearLocalCacheOwner()
  clearLastOAuthProvider()
  useAuthStore.setState({
    user: null,
    profile: null,
    session: null,
    isAuthenticated: false,
    dataBootstrapReady: true,
  })
}

function mapSupabaseUser(sbUser: SupabaseUser): User {
  return {
    id: sbUser.id,
    email: sbUser.email || undefined,
    displayName: (sbUser.user_metadata?.full_name as string | undefined) || (sbUser.user_metadata?.name as string | undefined) || undefined,
    photoURL: (sbUser.user_metadata?.avatar_url as string | undefined) || undefined,
  }
}

async function applySession(sbSession: SupabaseSession | null) {
  const store = useAuthStore.getState()

  if (!sbSession?.user) {
    setUnauthenticatedState()
    return
  }

  const mappedUser = mapSupabaseUser(sbSession.user)

  const session: Session = {
    accessToken: sbSession.access_token,
    user: mappedUser,
  }

  clearLastOAuthProvider()
  useAuthStore.setState({ dataBootstrapReady: false, profile: null })
  store.setSession(session)
  store.setUser(mappedUser)
  await store.ensureProfile(mappedUser)
  // dataBootstrapReady is flipped to true by CloudDataBootstrap once its own
  // local-to-cloud sync/migration pass finishes — do not set it here.
}

export async function ensureInitialAuthBootstrap() {
  if (authBootstrapPromise) {
    return authBootstrapPromise
  }

  authBootstrapPromise = (async () => {
    useAuthStore.getState().setLoading(true)
    try {
      if (DEV_BYPASS_AUTH) {
        await applyDevBypassSession()
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      await applySession(data.session)
    } catch (error) {
      captureSecureException(error, {
        context: 'AuthStore.bootstrap',
        category: 'network',
      })
      setUnauthenticatedState()
    } finally {
      useAuthStore.setState({ authInitialized: true, isLoading: false })
    }
  })()

  return authBootstrapPromise
}

export const ensureAuthBootstrapped = ensureInitialAuthBootstrap

export function initAuthListener() {
  if (unsubscribeAuthListener) {
    return unsubscribeAuthListener
  }

  void ensureInitialAuthBootstrap()

  const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, sbSession) => {
    useAuthStore.getState().setLoading(true)
    try {
      await applySession(sbSession)
    } catch (error) {
      captureSecureException(error, {
        context: 'AuthStore.stateSync',
        category: 'network',
      })
    } finally {
      useAuthStore.setState({ authInitialized: true, isLoading: false })
    }
  })

  unsubscribeAuthListener = () => {
    subscription.subscription.unsubscribe()
    unsubscribeAuthListener = null
  }

  return unsubscribeAuthListener
}
