import { getLastOAuthProvider, OAUTH_PROVIDERS, type OAuthProviderId } from '@/modules/auth/lib/oauth'
import { motion } from 'framer-motion'
import { ArrowRight, Mail } from 'lucide-react'
import { useCallback, type ComponentType, type MouseEvent } from 'react'

function GithubIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
    )
}

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    )
}

interface AuthProviderButtonsProps {
    authEnabled: boolean
    loadingProvider: OAuthProviderId | null
    onProvider: (provider: OAuthProviderId) => Promise<void>
    t: (key: string) => string
}

export function AuthProviderButtons({
    authEnabled,
    loadingProvider,
    onProvider,
    t,
}: AuthProviderButtonsProps) {
    const providerIcons: Record<OAuthProviderId, ComponentType<{ className?: string }>> = {
        google: GoogleIcon,
        github: GithubIcon,
        email: Mail,
    }
    const providerDescriptions: Record<OAuthProviderId, string> = {
        google: t('landing.providers.googleHint'),
        github: t('landing.providers.githubHint'),
        email: t('landing.providers.emailHint'),
    }
    const lastProvider = getLastOAuthProvider()

    const handleClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const providerId = event.currentTarget.dataset.provider as OAuthProviderId | undefined
            if (!providerId) {
                return
            }

            void onProvider(providerId)
        },
        [onProvider]
    )

    return (
        <div
            className="grid w-full gap-3"
            role="group"
            aria-label={t('landing.ctaGroupLabel')}
        >
            {OAUTH_PROVIDERS.map(provider => {
                const Icon = providerIcons[provider.id]
                const isDisabled = !authEnabled || !provider.enabled || loadingProvider !== null
                const isLoading = loadingProvider === provider.id
                const isLastProvider = lastProvider === provider.id

                return (
                    <motion.button
                        key={provider.id}
                        type="button"
                        data-provider={provider.id}
                        onClick={handleClick}
                        disabled={isDisabled}
                        whileHover={isDisabled ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={isDisabled ? undefined : { scale: 0.985 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                        className="group glass relative isolate inline-flex min-h-[82px] w-full items-center overflow-hidden rounded-full px-3 py-3 text-left text-text-primary shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)] transition-[transform,background-color,box-shadow] duration-200 hover:bg-surface-200 hover:shadow-[0_10px_30px_rgb(0_0_0/0.16)] disabled:cursor-not-allowed disabled:opacity-55"
                        aria-label={t(provider.labelKey)}
                    >
                        <div
                            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{
                                background:
                                    'linear-gradient(120deg, rgb(255 255 255 / 0.06), transparent 42%, rgb(var(--accent-color-rgb) / 0.08) 100%)',
                            }}
                            aria-hidden
                        />

                        <div className="relative flex w-full items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-surface-100 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]">
                                <Icon className="h-5 w-5 text-text-primary" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold tracking-tight text-text-primary">
                                        {t(provider.labelKey)}
                                    </span>
                                    {isLastProvider && (
                                        <span
                                            className="rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-status-violet"
                                            style={{
                                                background: 'rgb(var(--accent-color-rgb) / 0.1)',
                                                border: '1px solid rgb(var(--accent-color-rgb) / 0.28)',
                                            }}
                                        >
                                            {t('landing.providers.lastUsed')}
                                        </span>
                                    )}
                                </div>
                                <span className="mt-1 block text-[0.75rem] leading-relaxed text-text-muted">
                                    {providerDescriptions[provider.id]}
                                </span>
                            </div>

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-surface-100 text-text-secondary transition-transform duration-200 group-hover:translate-x-1 group-hover:text-text-primary">
                                {isLoading ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-text-primary" />
                                ) : (
                                    <ArrowRight className="h-4 w-4" />
                                )}
                            </div>
                        </div>
                    </motion.button>
                )
            })}
        </div>
    )
}
