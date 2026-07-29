/**
 * GlobalSearchBoxes Component
 *
 * Ana sayfada Google, YouTube ve ChatGPT aramaları için
 * 3 ayrı search input bileşeni.
 *
 * Davranış:
 * - Input'a yaz → Enter
 * - Yeni sekmede arama açılır
 */

import { useTranslation } from '@/i18n'
import { Bot, Search } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/utils'

function Youtube({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
    )
}

interface SearchBoxProps {
    type: 'google' | 'youtube' | 'chatgpt'
    placeholder: string
    ariaLabel: string
    searchLabel: string
    icon: React.ReactNode
    bgColor: string
    onSearch: (query: string) => void
}

function SearchBox({ type: _type, placeholder, ariaLabel, searchLabel, icon, bgColor, onSearch }: SearchBoxProps) {
    const [query, setQuery] = useState('')

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            onSearch(query.trim())
            setQuery('')
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && query.trim()) {
            onSearch(query.trim())
            setQuery('')
        }
    }

    return (
        <form onSubmit={handleSubmit} className="relative">
            <div
                className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                    'border-white/10 bg-white/5 hover:bg-white/8 focus-within:border-white/20 focus-within:bg-white/10'
                )}
            >
                <div
                    className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                        bgColor
                    )}
                >
                    {icon}
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={cn(
                        'flex-1 bg-transparent border-none outline-none text-sm',
                        'text-white placeholder-gray-400'
                    )}
                    aria-label={ariaLabel}
                />
                <button
                    type="submit"
                    className={cn(
                        'p-2 rounded-lg transition-colors',
                        'hover:bg-white/10 text-slate-300 hover:text-white',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    disabled={!query.trim()}
                    aria-label={searchLabel}
                >
                    <Search className="w-4 h-4" />
                </button>
            </div>
        </form>
    )
}

export function GlobalSearchBoxes() {
    const t = useTranslation('planner')

    const openGoogleSearch = (query: string) => {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const openYouTubeSearch = (query: string) => {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const openChatGPTSearch = (query: string) => {
        const url = `https://chat.openai.com/?q=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 mb-3">{t('search.quickSearch')}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SearchBox
                    type="google"
                    placeholder={t('search.searchGoogle')}
                    ariaLabel={t('search.searchAriaLabel', { type: 'Google' })}
                    searchLabel={t('search.searchButton')}
                    icon={<Search className="w-4 h-4 text-white" />}
                    bgColor="bg-blue-500"
                    onSearch={openGoogleSearch}
                />

                <SearchBox
                    type="youtube"
                    placeholder={t('search.searchYouTube')}
                    ariaLabel={t('search.searchAriaLabel', { type: 'YouTube' })}
                    searchLabel={t('search.searchButton')}
                    icon={<Youtube className="w-4 h-4 text-white" />}
                    bgColor="bg-red-500"
                    onSearch={openYouTubeSearch}
                />

                <SearchBox
                    type="chatgpt"
                    placeholder={t('search.askChatGPT')}
                    ariaLabel={t('search.searchAriaLabel', { type: 'ChatGPT' })}
                    searchLabel={t('search.searchButton')}
                    icon={<Bot className="w-4 h-4 text-white" />}
                    bgColor="bg-emerald-500"
                    onSearch={openChatGPTSearch}
                />
            </div>
        </div>
    )
}
