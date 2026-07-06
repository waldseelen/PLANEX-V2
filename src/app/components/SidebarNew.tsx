import { useTranslation } from '@/i18n'
import { clsx } from 'clsx'
import type { ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { APP_NAV_ITEMS, isNavItemActive, MAIN_SIDEBAR_SECTIONS } from './navItems'

interface SidebarProps {
    collapsed?: boolean
    onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
    const t = useTranslation('common')
    const { pathname } = useLocation()

    const settingsItem = APP_NAV_ITEMS[APP_NAV_ITEMS.length - 1]

    return (
        <aside
            className={clsx(
                'hidden shrink-0 border-r border-[var(--border-subtle)] bg-primary md:flex md:flex-col transition-all duration-300',
                collapsed ? 'w-[56px]' : 'w-[220px]',
            )}
            aria-label={t('app.mainNavigation')}
        >
            <div className="flex h-14 items-center justify-between px-3">
                <Link
                    to="/planner"
                    className={clsx(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-200',
                        collapsed && 'justify-center',
                    )}
                >
                    <span className="brand-logo text-xs text-text-primary">{collapsed ? 'PX' : 'PLAN.EX'}</span>
                </Link>

                {onToggle && (
                    <button
                        onClick={onToggle}
                        className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-subtle)] hover:bg-surface-200 text-text-secondary transition-colors"
                        title={collapsed ? t('common.expand') : t('common.collapse')}
                    >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col justify-between">
                <div>
                    {!collapsed && (
                        <p className="px-[10px] pb-1 text-2xs font-semibold uppercase tracking-widest text-text-muted">
                            Workspace
                        </p>
                    )}

                    <nav className="space-y-0.5" role="navigation" aria-label={t('app.mainNavigation')}>
                        {MAIN_SIDEBAR_SECTIONS.map(section => {
                            if (section.kind === 'item') {
                                const item = section.item
                                return (
                                    <SidebarItem
                                        key={item.id}
                                        href={item.href}
                                        label={t(item.labelKey)}
                                        targetId={`nav-${item.id}`}
                                        collapsed={collapsed}
                                        active={isNavItemActive(pathname, item.href)}
                                        icon={item.icon}
                                    />
                                )
                            }

                            return (
                                <div key={section.labelKey} className="pt-2 first:pt-0">
                                    {!collapsed && (
                                        <p className="px-[10px] pb-1 pt-1 text-[0.6rem] font-semibold uppercase tracking-widest text-text-muted/70">
                                            {t(section.labelKey)}
                                        </p>
                                    )}
                                    {section.items.map(item => (
                                        <SidebarItem
                                            key={item.id}
                                            href={item.href}
                                            label={t(item.labelKey)}
                                            targetId={`nav-${item.id}`}
                                            collapsed={collapsed}
                                            active={isNavItemActive(pathname, item.href)}
                                            icon={item.icon}
                                        />
                                    ))}
                                </div>
                            )
                        })}
                    </nav>
                </div>

                <div className="mt-auto border-t border-[var(--border-subtle)] pt-2.5">
                    {!collapsed && (
                        <p className="px-[10px] pb-1 text-2xs font-semibold uppercase tracking-widest text-text-muted">
                            Preferences
                        </p>
                    )}

                    <nav className="space-y-0.5">
                        <SidebarItem
                            href={settingsItem.href}
                            label={t(settingsItem.labelKey)}
                            targetId={`nav-${settingsItem.id}`}
                            collapsed={collapsed}
                            active={isNavItemActive(pathname, settingsItem.href)}
                            icon={settingsItem.icon}
                        />
                    </nav>
                </div>
            </div>
        </aside>
    )
}

interface SidebarItemProps {
    href: string
    label: string
    targetId: string
    icon: ComponentType<{ className?: string }>
    active: boolean
    collapsed: boolean
}

function SidebarItem({ href, label, targetId, icon: Icon, active, collapsed }: SidebarItemProps) {
    return (
        <Link
            to={href}
            data-onboarding-target={targetId}
            aria-current={active ? 'page' : undefined}
            className={clsx(
                'group relative flex h-9 items-center gap-2 rounded-md px-[10px] text-sm transition-colors',
                collapsed ? 'justify-center px-0' : 'justify-start',
                active
                    ? 'text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-200 hover:text-text-primary',
            )}
            title={collapsed ? label : undefined}
        >
            {active && <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-[var(--color-accent)]" aria-hidden />}
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
        </Link>
    )
}
