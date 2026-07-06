import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../src/i18n'
import { ActivityEditModal } from '../../src/modules/tracker/components/features/ActivityEditModal'
import { ToastProvider } from '../../src/shared/components'

const activityQueryMocks = vi.hoisted(() => ({
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    useActiveCategories: vi.fn(),
}))

vi.mock('@/db/time-tracking/queries/activityQueries', () => activityQueryMocks)

function renderModal() {
    return render(
        <I18nProvider initialLocale="en">
            <ToastProvider>
                <ActivityEditModal activity={null} isOpen={true} onClose={() => { }} />
            </ToastProvider>
        </I18nProvider>,
    )
}

describe('ActivityEditModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        activityQueryMocks.createActivity.mockResolvedValue('activity-1')
        activityQueryMocks.updateActivity.mockResolvedValue(undefined)
        activityQueryMocks.useActiveCategories.mockReturnValue([
            {
                id: 'category-1',
                name: 'General',
                color: '#3b82f6',
                icon: 'FolderOpen',
                archived: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ])
    })

    it('renders translated icon category headings in english locale', () => {
        renderModal()

        // Open the icon picker to reveal category headings
        fireEvent.click(screen.getByRole('button', { name: /BookOpen/i }))

        expect(screen.getByText('Study & Education')).toBeInTheDocument()
        expect(screen.getByText('Health & Fitness')).toBeInTheDocument()
    })

    it('fills the form with translated template content after selection', async () => {
        renderModal()

        fireEvent.click(screen.getByRole('button', { name: 'Choose Template' }))

        expect(screen.getByText('Template Category')).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Study' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Mathematics/i }))

        await waitFor(() => {
            expect(screen.getByDisplayValue('Mathematics')).toBeInTheDocument()
        })

        expect(screen.queryByText('Template Category')).not.toBeInTheDocument()
    })
})
