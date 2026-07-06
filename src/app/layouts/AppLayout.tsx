import { KeyboardShortcuts } from '@/app/components/KeyboardShortcuts'
import { preloadProtectedRouteModules } from '@/app/lib/routeModules'
import { useTranslation } from '@/i18n'
import { OnboardingOrchestrator } from '@/modules/auth/components/OnboardingOrchestrator'
import { usePlannerAppStore } from '@/modules/planner/store/plannerAppStore'
import {
    FocusModeProvider,
    PWAInstallBanner,
    ScrollToTop,
    SmartFab,
    useToast,
} from '@/shared/components'
import { useAccessiblePage, useDynamicFavicon } from '@/shared/hooks'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { BookOpenIcon, CheckCircleIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNavigation } from '../components/BottomNavigation'
import { Header } from '../components/Header'
import { RightPanel } from '../components/RightPanel'
import { Sidebar } from '../components/SidebarNew'
import { PageTransition } from './PageTransition'
import { PomodoroRuntime } from '@/modules/tracker/components/features/PomodoroRuntime'
import { useReminderScheduler } from '@/modules/tracker/lib/useReminderScheduler'

export function AppLayout() {
    const t = useTranslation('common')
    const tTracker = useTranslation('tracker')
    const tAuth = useTranslation('auth')
    const isDesktop = useMediaQuery('(min-width: 1280px)')
    const isWide = useMediaQuery('(min-width: 1024px)')
    const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1279px)')
    const isMobile = useMediaQuery('(max-width: 767px)')
    const navigate = useNavigate()
    const location = useLocation()
    const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const getCookie = (name: string) => {
            if (typeof document === 'undefined') return null
            const value = `; ${document.cookie}`
            const parts = value.split(`; ${name}=`)
            if (parts.length === 2) return parts.pop()?.split(';').shift()
            return null
        }
        const cookieVal = getCookie('planex-sidebar-collapsed')
        if (cookieVal !== null) {
            return cookieVal === 'true'
        }
        const stored = localStorage.getItem('planex-sidebar-collapsed')
        if (stored !== null) {
            return stored === 'true'
        }
        return isTablet
    })

    useEffect(() => {
        const getCookie = (name: string) => {
            if (typeof document === 'undefined') return null
            const value = `; ${document.cookie}`
            const parts = value.split(`; ${name}=`)
            if (parts.length === 2) return parts.pop()?.split(';').shift()
            return null
        }
        const cookieVal = getCookie('planex-sidebar-collapsed')
        const stored = localStorage.getItem('planex-sidebar-collapsed')
        if (cookieVal === null && stored === null) {
            setSidebarCollapsed(isTablet)
        }
    }, [isTablet])

    const handleToggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => {
            const next = !prev
            localStorage.setItem('planex-sidebar-collapsed', String(next))
            document.cookie = `planex-sidebar-collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`
            return next
        })
    }, [])

    const { checkBackupWarning, backupWarning, setBackupWarning, updateSettings } = usePlannerAppStore()
    const { showToast } = useToast()

    useEffect(() => {
        checkBackupWarning()
    }, [checkBackupWarning])

    useEffect(() => {
        const preloadTimer = window.setTimeout(() => {
            void preloadProtectedRouteModules()
        }, 80)

        return () => {
            window.clearTimeout(preloadTimer)
        }
    }, [])

    useEffect(() => {
        if (backupWarning) {
            showToast(t('app.backupWarning'), {
                variant: 'warning',
                duration: 8000,
            })
            updateSettings({ lastBackupWarningISO: new Date().toISOString() })
            setBackupWarning(false)
        }
    }, [backupWarning, setBackupWarning, showToast, t, updateSettings])

    useDynamicFavicon(false)
    useReminderScheduler()

    const routeTitle = useMemo(() => {
        if (location.pathname === '/planner') return t('navigation.home')
        if (location.pathname === '/planner/courses') return t('navigation.courses')
        if (location.pathname.startsWith('/planner/courses/')) return t('app.courseDetail')
        if (location.pathname === '/planner/tasks') return t('app.planner')
        if (location.pathname === '/planner/statistics') return t('navigation.statistics')
        if (location.pathname === '/habits') return t('navigation.habits')
        if (location.pathname.startsWith('/habits/')) return t('app.habitDetail')
        if (location.pathname === '/tracker') return t('navigation.tracker')
        if (location.pathname === '/tracker/records') return tTracker('tracker.nav.records')
        if (location.pathname === '/tracker/stats') return t('navigation.statistics')
        if (location.pathname === '/tracker/goals') return tTracker('tracker.nav.goals')
        if (location.pathname === '/tracker/activities') return tTracker('tracker.nav.activities')
        if (location.pathname === '/tracker/categories') return tTracker('tracker.nav.categories')
        if (location.pathname === '/settings') return t('navigation.settings')
        if (location.pathname === '/settings/profile') return tAuth('auth.profilePage.title')
        return 'PLAN.EX'
    }, [location.pathname, t, tAuth, tTracker])

    useAccessiblePage(routeTitle, {
        announceMessage: t('a11y.pageChanged', { title: routeTitle }),
    })

    const handleFocusSearch = useCallback(() => {
        const searchInput = document.querySelector('[data-global-search-input="true"]') as HTMLInputElement | null
        searchInput?.focus()
    }, [])

    const fabActions = useMemo(
        () => [
            {
                icon: <ClockIcon className="h-5 w-5" />,
                label: t('fab.startTimer'),
                onClick: () => navigate('/tracker'),
                variant: 'default' as const,
            },
            {
                icon: <BookOpenIcon className="h-5 w-5" />,
                label: t('fab.addTask'),
                onClick: () => navigate('/planner/tasks', { state: { openCreate: true } }),
                variant: 'default' as const,
            },
            {
                icon: <CheckCircleIcon className="h-5 w-5" />,
                label: t('fab.markHabit'),
                onClick: () => navigate('/habits'),
                variant: 'success' as const,
            },
        ],
        [navigate, t],
    )

    return (
        <FocusModeProvider>
            <ScrollToTop />
            <PomodoroRuntime />
            <KeyboardShortcuts
                enabled={!isMobile}
                onFocusSearch={handleFocusSearch}
                onNewTask={() => navigate('/planner/tasks', { state: { openCreate: true } })}
                onStartTimer={() => navigate('/tracker')}
                onGoToOverview={() => navigate('/planner')}
                onGoToCourses={() => navigate('/planner/courses')}
                onGoToTracker={() => navigate('/tracker')}
                onGoToHabits={() => navigate('/habits')}
            />

            <div className="flex h-dvh w-full overflow-hidden bg-primary text-primary">
                {(isDesktop || isTablet) && (
                    <Sidebar 
                        collapsed={sidebarCollapsed} 
                        onToggle={handleToggleSidebar} 
                    />
                )}

                <div className="flex min-w-0 flex-1 flex-col bg-primary">
                    <Header pageTitle={routeTitle} />

                    <main id="planex-main-content" className="min-h-0 flex-1 overflow-hidden bg-primary">
                        {location.pathname.startsWith('/learn') || location.pathname === '/planner' ? (
                            <div className="h-full w-full overflow-hidden bg-primary">
                                <PageTransition transitionKey={location.pathname}>
                                    <Outlet />
                                </PageTransition>
                            </div>
                        ) : (
                            <div className="custom-scrollbar h-full overflow-y-auto overflow-x-hidden pb-28 md:pb-0">
                                <div className="mx-auto max-w-[var(--max-app-shell-width)] px-4 py-6 md:px-6">
                                    <PageTransition transitionKey={location.pathname}>
                                        <Outlet />
                                    </PageTransition>
                                </div>
                            </div>
                        )}
                    </main>
                </div>

                {isWide && (
                    <RightPanel
                        collapsed={rightPanelCollapsed}
                        onToggle={() => setRightPanelCollapsed(previous => !previous)}
                    />
                )}

                {isMobile && <BottomNavigation />}

                <PWAInstallBanner variant="banner" />

                <SmartFab
                    onPrimaryAction={() => undefined}
                    secondaryActions={fabActions}
                    position="bottom-right"
                    icon={<PlusIcon className="h-7 w-7" />}
                />

                <OnboardingOrchestrator />
            </div>
        </FocusModeProvider>
    )
}
