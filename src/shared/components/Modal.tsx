import { useTranslation } from '@/i18n'
import { clsx } from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal — the single canonical dialog for the whole app.
 *
 * Every module (planner + tracker + settings) renders through this one
 * component so open/close transitions, positioning, focus handling and
 * close affordances stay identical everywhere. Do not reimplement a modal
 * shell with framer-motion + `.modal-backdrop` in a feature component;
 * compose this instead (pass the form as children and the actions as
 * `footer`).
 *
 * Behaviour:
 * - Centered, portal-rendered above the app.
 * - framer-motion enter/exit (0.18s standard easing), reduced-motion aware.
 * - ESC + backdrop click to close (backdrop opt-out via disableOutsideClick).
 * - Focus trap while open, focus restored to the trigger on close.
 * - Body scroll locked while open.
 */

interface ModalProps {
    /** Whether the modal is visible */
    isOpen: boolean
    /** Close callback (ESC, backdrop, close button) */
    onClose: () => void
    /** Optional header title */
    title?: string
    /** Optional header subtitle under the title */
    subtitle?: string
    /** Modal body */
    children: ReactNode
    /** Max-width preset */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    /** Footer area for actions */
    footer?: ReactNode
    /** Extra classes on the modal card */
    className?: string
    /** Show the header close button (default true) */
    showCloseButton?: boolean
    /** Force-hide the header close button (takes precedence) */
    hideCloseButton?: boolean
    /** Disable closing when clicking the backdrop */
    disableOutsideClick?: boolean
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
}

export const Modal = memo(function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    size = 'md',
    footer,
    className,
    showCloseButton = true,
    hideCloseButton = false,
    disableOutsideClick = false,
}: ModalProps) {
    const tc = useTranslation('common')
    const reduceMotion = useReducedMotion()
    const modalRef = useRef<HTMLDivElement>(null)
    const previousActiveElement = useRef<HTMLElement | null>(null)

    const closeButtonVisible = !hideCloseButton && showCloseButton

    // ESC ile kapanma
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
        }
    }, [onClose])

    // Focus trap — Tab ile modal dışına çıkmayı engelle
    const handleTabKey = useCallback((e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !modalRef.current) return

        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements.length === 0) return
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
        }
    }, [])

    useEffect(() => {
        if (!isOpen) return

        previousActiveElement.current = document.activeElement as HTMLElement
        document.addEventListener('keydown', handleEscape)
        document.addEventListener('keydown', handleTabKey)
        document.body.style.overflow = 'hidden'

        const raf = requestAnimationFrame(() => modalRef.current?.focus())

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.removeEventListener('keydown', handleTabKey)
            document.body.style.overflow = ''
            cancelAnimationFrame(raf)
            previousActiveElement.current?.focus()
        }
    }, [isOpen, handleEscape, handleTabKey])

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (!disableOutsideClick && e.target === e.currentTarget) {
            onClose()
        }
    }

    const cardEnter = reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, scale: 0.97, y: 8 }
    const cardVisible = { opacity: 1, scale: 1, y: 0 }

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="modal-backdrop"
                    style={{ animation: 'none' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    onClick={handleBackdropClick}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={title ? 'modal-title' : undefined}
                >
                    <motion.div
                        ref={modalRef}
                        tabIndex={-1}
                        className={clsx(
                            'modal-content flex flex-col overflow-hidden p-0 focus:outline-none',
                            sizeClasses[size],
                            className
                        )}
                        style={{ animation: 'none' }}
                        initial={cardEnter}
                        animate={cardVisible}
                        exit={cardEnter}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(title || closeButtonVisible) && (
                            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-6 py-4 flex-shrink-0">
                                <div className="min-w-0">
                                    {title && (
                                        <h2 id="modal-title" className="text-lg font-bold text-text-primary">
                                            {title}
                                        </h2>
                                    )}
                                    {subtitle && (
                                        <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
                                    )}
                                </div>
                                {closeButtonVisible && (
                                    <button
                                        onClick={onClose}
                                        className="btn-icon flex-shrink-0 rounded-lg"
                                        aria-label={tc('common.close')}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="modal-body flex-1 overflow-y-auto overscroll-contain px-6 py-5">
                            {children}
                        </div>

                        {footer && (
                            <div className="modal-footer border-t border-[var(--border-subtle)] px-6 py-4 flex-shrink-0">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    )
})
