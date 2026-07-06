import { useTranslation } from '@/i18n'
import { sanitizeRemoteImageUrl } from '@/modules/auth/lib/security'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { LanguageToggle, ThemeToggle } from '@/shared/components'
import { ChevronRight, LogOut } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CommandBar } from './CommandBar'

interface HeaderProps {
    pageTitle: string
}

function ProfileAvatarButton() {
    const t = useTranslation('common')
    const navigate = useNavigate()
    const profile = useAuthStore(state => state.profile)
    const signOut = useAuthStore(state => state.signOut)
    const [isOpen, setIsOpen] = useState(false)

    const safeAvatarUrl = sanitizeRemoteImageUrl(profile?.avatarUrl)
    const displayLabel = profile?.fullName ?? profile?.email ?? 'PX'
    const initials = displayLabel
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('')

    const handleLogout = async () => {
        await signOut()
        navigate('/')
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-surface-100 text-xs font-semibold text-text-primary transition-colors hover:border-[var(--border-medium)] hover:bg-surface-200"
                aria-label="Profile menu"
            >
                {safeAvatarUrl ? (
                    <img
                        src={safeAvatarUrl}
                        alt={displayLabel}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    initials || 'PX'
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-lg border border-[var(--border-subtle)] bg-surface-200 shadow-lg z-50">
                    <Link
                        to="/settings/profile"
                        onClick={() => setIsOpen(false)}
                        className="block w-full px-4 py-2 text-sm text-left text-text-primary hover:bg-surface-300 first:rounded-t-md transition-colors"
                    >
                        {t('navigation.settings')}
                    </Link>
                    <button
                        onClick={() => {
                            void handleLogout()
                            setIsOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-surface-300 last:rounded-b-md transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Çıkış Yap
                    </button>
                </div>
            )}
        </div>
    )
}

export const Header = memo(function Header({ pageTitle }: HeaderProps) {
    const t = useTranslation('common')
    const location = useLocation()

    const breadcrumb = useMemo(() => {
        if (location.pathname.startsWith('/planner')) {
            return t('app.planner')
        }
        if (location.pathname.startsWith('/tracker')) {
            return t('navigation.tracker')
        }
        if (location.pathname.startsWith('/habits')) {
            return t('navigation.habits')
        }
        if (location.pathname.startsWith('/settings')) {
            return t('navigation.settings')
        }

        return 'PLAN.EX'
    }, [location.pathname, t])

    return (
        <header
            className="border-b border-[var(--border-subtle)] bg-primary"
            data-onboarding-target="header-shell"
        >
            <div className="mx-auto flex h-14 max-w-[var(--max-app-shell-width)] items-center gap-4 px-4 md:px-6">
                <div className="min-w-0 shrink-0">
                    <div className="flex items-center gap-2 text-sm">
                        {breadcrumb !== pageTitle && (
                            <>
                                <span className="truncate text-text-secondary">{breadcrumb}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                            </>
                        )}
                        <span className="truncate font-semibold text-text-primary">{pageTitle}</span>
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <CommandBar />
                </div>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <LanguageToggle showLabel={false} />
                    <ProfileAvatarButton />
                </div>
            </div>
        </header>
    )
})
