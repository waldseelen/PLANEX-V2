/**
 * ExternalSearchButtons Component
 *
 * Görev/Task itemları içinde Google, YouTube, ChatGPT
 * arama butonları için küçük icon button bileşeni.
 *
 * Davranış:
 * - Buton → task başlığı + açıklaması ile arama yapar
 * - Yeni sekmede açılır
 * - UI minimal, icon-only, hover tooltip'li
 */

import { useTranslation } from '@/i18n'
import { Bot, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

function Youtube({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
    )
}

interface ExternalSearchButtonsProps {
    /** Arama yapılacak ana metin (görev başlığı) */
    title: string
    /** Opsiyonel açıklama (varsa aramaya eklenir) */
    description?: string
    /** Buton boyutu */
    size?: 'sm' | 'md'
    /** Ek CSS class */
    className?: string
}

export function ExternalSearchButtons({
    title,
    description,
    size = 'sm',
    className,
}: ExternalSearchButtonsProps) {
    const t = useTranslation('planner')

    // Arama metnini oluştur
    const getSearchQuery = () => {
        const parts = [title]
        if (description?.trim()) {
            parts.push(description.trim())
        }
        return parts.join(' ')
    }

    const openGoogleSearch = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const query = getSearchQuery()
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const openYouTubeSearch = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const query = getSearchQuery()
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const openChatGPTSearch = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const query = getSearchQuery()
        const url = `https://chat.openai.com/?q=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
    const buttonSize = size === 'sm' ? 'p-1.5' : 'p-2'

    const buttonClass = cn(
        'rounded-md transition-all duration-150',
        'hover:scale-110 active:scale-95',
        'opacity-60 hover:opacity-100',
        buttonSize
    )

    return (
        <div className={cn('flex items-center gap-0.5', className)}>
            <button
                type="button"
                onClick={openGoogleSearch}
                className={cn(buttonClass, 'hover:bg-blue-500/20 hover:text-blue-400')}
                title={t('search.searchOnGoogle')}
                aria-label={t('search.searchFor', { title, provider: 'Google' })}
            >
                <Search className={iconSize} />
            </button>

            <button
                type="button"
                onClick={openYouTubeSearch}
                className={cn(buttonClass, 'hover:bg-red-500/20 hover:text-red-400')}
                title={t('search.searchOnYouTube')}
                aria-label={t('search.searchFor', { title, provider: 'YouTube' })}
            >
                <Youtube className={iconSize} />
            </button>

            <button
                type="button"
                onClick={openChatGPTSearch}
                className={cn(buttonClass, 'hover:bg-emerald-500/20 hover:text-emerald-400')}
                title={t('search.askOnChatGPT')}
                aria-label={t('search.askFor', { title })}
            >
                <Bot className={iconSize} />
            </button>
        </div>
    )
}
