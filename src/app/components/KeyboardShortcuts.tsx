import { useTranslation } from '@/i18n'
import { isAnyModalOpen, Modal } from '@/shared/components'
import { useEffect, useMemo, useState } from 'react'

interface KeyboardShortcutsProps {
    enabled?: boolean
    onFocusSearch: () => void
    onNewTask: () => void
    onStartTimer: () => void
    onGoToOverview: () => void
    onGoToCourses: () => void
    onGoToTracker: () => void
    onGoToHabits: () => void
}

type PendingSequence = 'g' | null

export function KeyboardShortcuts({
    enabled = true,
    onFocusSearch,
    onNewTask,
    onStartTimer,
    onGoToOverview,
    onGoToCourses,
    onGoToTracker,
    onGoToHabits,
}: KeyboardShortcutsProps) {
    const t = useTranslation('common')
    const [isOpen, setIsOpen] = useState(false)
    const [pendingSequence, setPendingSequence] = useState<PendingSequence>(null)

    const groups = useMemo(() => [
        {
            title: t('keyboard.general'),
            shortcuts: [
                { keys: 'Ctrl+K', description: t('keyboard.focusCommandBar') },
                { keys: '?', description: t('keyboard.showShortcuts') },
                { keys: 'Esc', description: t('keyboard.closeModal') },
            ],
        },
        {
            title: t('keyboard.navigation'),
            shortcuts: [
                { keys: 'G O', description: t('keyboard.goOverview') },
                { keys: 'G C', description: t('keyboard.goCourses') },
                { keys: 'G T', description: t('keyboard.goTracker') },
                { keys: 'G H', description: t('keyboard.goHabits') },
            ],
        },
        {
            title: t('keyboard.actions'),
            shortcuts: [
                { keys: 'N', description: t('keyboard.newTask') },
                { keys: 'T', description: t('keyboard.startTimer') },
                { keys: 'Ctrl+/', description: t('keyboard.focusSearch') },
            ],
        },
    ], [t])

    useEffect(() => {
        if (!enabled) {
            return
        }

        let timer: ReturnType<typeof setTimeout> | undefined

        function isInputTarget(target: EventTarget | null) {
            if (!(target instanceof HTMLElement)) {
                return false
            }

            return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (isAnyModalOpen()) {
                return
            }

            const inputFocused = isInputTarget(event.target)

            if (event.key === '?' && !event.ctrlKey && !event.metaKey && !inputFocused) {
                event.preventDefault()
                setIsOpen(true)
                return
            }

            if ((event.ctrlKey || event.metaKey) && event.key === '/') {
                event.preventDefault()
                onFocusSearch()
                return
            }

            if (inputFocused) {
                return
            }

            if (pendingSequence === 'g') {
                const nextKey = event.key.toLowerCase()
                const sequenceActions: Record<string, () => void> = {
                    o: onGoToOverview,
                    c: onGoToCourses,
                    t: onGoToTracker,
                    h: onGoToHabits,
                }

                const action = sequenceActions[nextKey]
                setPendingSequence(null)
                if (timer) {
                    clearTimeout(timer)
                }

                if (action) {
                    event.preventDefault()
                    action()
                }
                return
            }

            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'g') {
                setPendingSequence('g')
                timer = setTimeout(() => setPendingSequence(null), 1400)
                return
            }

            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'n') {
                event.preventDefault()
                onNewTask()
                return
            }

            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 't') {
                event.preventDefault()
                onStartTimer()
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            if (timer) {
                clearTimeout(timer)
            }
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [
        enabled,
        onFocusSearch,
        onGoToCourses,
        onGoToHabits,
        onGoToOverview,
        onGoToTracker,
        onNewTask,
        onStartTimer,
        pendingSequence,
    ])

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title={t('keyboard.title')}
            size="lg"
        >
            <div className="grid gap-4 md:grid-cols-3">
                {groups.map(group => (
                    <section key={group.title} className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-surface-100 p-4">
                        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-text-muted">
                            {group.title}
                        </p>
                        <div className="mt-4 space-y-3">
                            {group.shortcuts.map(shortcut => (
                                <div key={shortcut.keys} className="flex items-start justify-between gap-3">
                                    <span className="text-sm text-text-secondary">{shortcut.description}</span>
                                    <kbd className="rounded-lg border border-[var(--border-subtle)] bg-surface-200 px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-text-primary">
                                        {shortcut.keys}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </Modal>
    )
}
