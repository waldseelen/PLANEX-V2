import {
    Activity,
    BarChart2,
    BookOpen,
    Brain,
    Home,
    ListTodo,
    Settings,
    Timer,
    type LucideIcon,
} from 'lucide-react'

export interface AppNavItem {
    id: 'overview' | 'courses' | 'tasks' | 'habits' | 'tracker' | 'stats' | 'settings' | 'learn'
    labelKey: string
    icon: LucideIcon
    href: string
}

// Tasks + Calendar are unified into one page (Planlayıcı) — see PersonalTasksPage's
// 'calendar' view tab — so there is no standalone 'calendar' nav id anymore.
export const APP_NAV_ITEMS: AppNavItem[] = [
    { id: 'overview', labelKey: 'navigation.home', icon: Home, href: '/planner' },
    { id: 'tasks', labelKey: 'app.planner', icon: ListTodo, href: '/planner/tasks' },
    { id: 'habits', labelKey: 'navigation.habits', icon: Activity, href: '/habits' },
    { id: 'tracker', labelKey: 'navigation.tracker', icon: Timer, href: '/tracker' },
    { id: 'courses', labelKey: 'navigation.courses', icon: BookOpen, href: '/planner/courses' },
    { id: 'learn', labelKey: 'navigation.learn', icon: Brain, href: '/learn' },
    { id: 'stats', labelKey: 'navigation.statistics', icon: BarChart2, href: '/planner/statistics' },
    { id: 'settings', labelKey: 'navigation.settings', icon: Settings, href: '/settings' },
]

export const MOBILE_PRIMARY_NAV_IDS: AppNavItem['id'][] = ['overview', 'courses', 'tracker', 'habits']

function findNavItem(id: AppNavItem['id']): AppNavItem {
    const item = APP_NAV_ITEMS.find(i => i.id === id)
    if (!item) {
        throw new Error(`Unknown nav item id: ${id}`)
    }
    return item
}

export type SidebarSection =
    | { kind: 'item'; item: AppNavItem }
    | { kind: 'group'; labelKey: string; items: AppNavItem[] }

// Desktop sidebar grouping: Habits and Tracker stay standalone (different usage
// rhythm — daily check-off vs. active session), Courses + Learn are clustered
// under one "Öğrenme" heading since both are learning-content surfaces.
export const MAIN_SIDEBAR_SECTIONS: SidebarSection[] = [
    { kind: 'item', item: findNavItem('overview') },
    { kind: 'item', item: findNavItem('tasks') },
    { kind: 'item', item: findNavItem('habits') },
    { kind: 'item', item: findNavItem('tracker') },
    { kind: 'group', labelKey: 'navigation.learningGroup', items: [findNavItem('courses'), findNavItem('learn')] },
    { kind: 'item', item: findNavItem('stats') },
]

export function isNavItemActive(pathname: string, href: string) {
    if (href === '/planner') {
        return pathname === '/planner'
    }

    return pathname === href || pathname.startsWith(`${href}/`)
}
