import { useTranslation } from '@/i18n'
import { AuthBootstrap } from '@/modules/auth/components/AuthBootstrap'
import { ProtectedRoute } from '@/modules/auth/components/ProtectedRoute'
import { PublicLandingRedirect } from '@/modules/auth/components/PublicLandingRedirect'
import {
    AUTH_CALLBACK_ROUTE,
    LEGACY_PROFILE_COMPLETION_ROUTE,
    PROFILE_COMPLETION_ROUTE,
    PUBLIC_LANDING_ROUTE,
} from '@/modules/auth/lib/routes'
import { GlobalErrorBoundary, PageErrorBoundary, ToastProvider } from '@/shared/components'
import { Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import {
    LazyActivities,
    LazyCategories,
    LazyCourseDetail,
    LazyCourses,
    LazyDashboard,
    LazyGoals,
    LazyHabitDetail,
    LazyHabits,
    LazyProfileSettings,
    LazyRecords,
    LazySettings,
    LazyStatistics,
    LazyTasks,
    LazyTracker,
    LazyTrackerStats,
    LazyLearnChat,
    LazyMindmap,
} from './lib/routeModules'
import { AppLayout } from './layouts/AppLayout'
import { ProfilePreferencesSync } from './providers/ProfilePreferencesSync'
import { CloudDataBootstrap } from './providers/CloudDataBootstrap'
import { SettingsI18nSync } from './providers/SettingsI18nSync'
import { ThemeProvider } from './providers/ThemeProvider'

// Auth pages — not lazy (small, needed immediately)
import { AuthCallbackPage } from '@/modules/auth/pages/AuthCallbackPage'
import { ProfileCompletionPage } from '@/modules/auth/pages/ProfileCompletionPage'
import { PublicLandingPage } from '@/modules/auth/pages/PublicLandingPage'

function LoadingFallback() {
    const t = useTranslation('common')
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-3 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border-medium)] border-t-text-primary mx-auto"></div>
                <p className="text-sm text-text-muted">{t('common.loading')}</p>
            </div>
        </div>
    )
}

function PublicRouteLayer() {
    return <Outlet />
}

function ProtectedAppShell() {
    return (
        <>
            <ProfilePreferencesSync />
            <AppLayout />
        </>
    )
}

export function App() {
    const t = useTranslation('common')
    return (
        <GlobalErrorBoundary>
            <ThemeProvider>
                <SettingsI18nSync />
                <AuthBootstrap>
                    <ToastProvider>
                        <CloudDataBootstrap />
                        <BrowserRouter>
                            <Routes>
                                <Route element={<PublicRouteLayer />}>
                                    <Route
                                        path={PUBLIC_LANDING_ROUTE}
                                        element={(
                                            <PublicLandingRedirect>
                                                <PublicLandingPage />
                                            </PublicLandingRedirect>
                                        )}
                                    />
                                    <Route path={AUTH_CALLBACK_ROUTE} element={<AuthCallbackPage />} />
                                    <Route path={PROFILE_COMPLETION_ROUTE} element={<ProfileCompletionPage />} />
                                    <Route
                                        path={LEGACY_PROFILE_COMPLETION_ROUTE}
                                        element={<Navigate to={PROFILE_COMPLETION_ROUTE} replace />}
                                    />
                                </Route>

                                {/* ── Protected app routes ── */}
                                <Route
                                    element={
                                        <ProtectedRoute>
                                            <ProtectedAppShell />
                                        </ProtectedRoute>
                                    }
                                >
                                    <Route path="planner">
                                        <Route index element={
                                            <PageErrorBoundary pageName={t('navigation.home')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyDashboard />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="courses" element={
                                            <PageErrorBoundary pageName={t('navigation.courses')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyCourses />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="courses/:courseId" element={
                                            <PageErrorBoundary pageName={t('app.courseDetail')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyCourseDetail />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="tasks" element={
                                            <PageErrorBoundary pageName={t('navigation.tasks')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyTasks />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="statistics" element={
                                            <PageErrorBoundary pageName={t('navigation.statistics')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyStatistics />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                    </Route>

                                    {/* Calendar is unified into the Planner (Tasks) page's "Takvim" view tab */}
                                    <Route path="calendar" element={<Navigate to="/planner/tasks" replace />} />
                                    <Route path="tasks" element={<Navigate to="/planner/tasks" replace />} />
                                    <Route path="habits" element={
                                        <PageErrorBoundary pageName={t('navigation.habits')}>
                                            <Suspense fallback={<LoadingFallback />}>
                                                <LazyHabits />
                                            </Suspense>
                                        </PageErrorBoundary>
                                    } />
                                    <Route path="habits/:habitId" element={
                                        <PageErrorBoundary pageName={t('app.habitDetail')}>
                                            <Suspense fallback={<LoadingFallback />}>
                                                <LazyHabitDetail />
                                            </Suspense>
                                        </PageErrorBoundary>
                                    } />
                                    <Route path="statistics" element={<Navigate to="/planner/statistics" replace />} />

                                    {/* ── Tracker Module ── */}
                                    <Route path="tracker">
                                        <Route index element={
                                            <PageErrorBoundary pageName={t('navigation.tracker')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyTracker />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="records" element={
                                            <PageErrorBoundary pageName={t('navigation.trackerRecords')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyRecords />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="stats" element={
                                            <PageErrorBoundary pageName={t('navigation.statistics')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyTrackerStats />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="goals" element={
                                            <PageErrorBoundary pageName={t('navigation.trackerGoals')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyGoals />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="activities" element={
                                            <PageErrorBoundary pageName={t('navigation.trackerActivities')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyActivities />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="categories" element={
                                            <PageErrorBoundary pageName={t('navigation.trackerCategories')}>
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyCategories />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                    </Route>
                                    {/* ── /Tracker Module ── */}

                                    {/* ── Learn Module ── */}
                                    <Route path="learn">
                                        <Route index element={
                                            <PageErrorBoundary pageName="STEMA Çalışma Alanı">
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyLearnChat />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                        <Route path="chat" element={<Navigate to="/learn" replace />} />
                                        <Route path="feynman" element={<Navigate to="/learn?mode=feynman" replace />} />
                                        <Route path="flashcards" element={<Navigate to="/learn" replace />} />
                                        <Route path="map" element={
                                            <PageErrorBoundary pageName="STEMA Zihin Haritası">
                                                <Suspense fallback={<LoadingFallback />}>
                                                    <LazyMindmap />
                                                </Suspense>
                                            </PageErrorBoundary>
                                        } />
                                    </Route>
                                    {/* ── /Learn Module ── */}

                                    <Route path="settings">
                                        <Route
                                            index
                                            element={
                                                <PageErrorBoundary pageName={t('navigation.settings')}>
                                                    <Suspense fallback={<LoadingFallback />}>
                                                        <LazySettings />
                                                    </Suspense>
                                                </PageErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="profile"
                                            element={
                                                <PageErrorBoundary pageName={t('navigation.settings')}>
                                                    <Suspense fallback={<LoadingFallback />}>
                                                        <LazyProfileSettings />
                                                    </Suspense>
                                                </PageErrorBoundary>
                                            }
                                        />
                                    </Route>
                                </Route>

                                {/* Fallback */}
                                <Route path="*" element={<Navigate to={PUBLIC_LANDING_ROUTE} replace />} />
                            </Routes>
                        </BrowserRouter>
                    </ToastProvider>
                </AuthBootstrap>
            </ThemeProvider>
        </GlobalErrorBoundary>
    )
}
