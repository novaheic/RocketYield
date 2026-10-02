import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VisitorChart } from '../components/VisitorChart'
import type { VisitorStats } from '../lib/stats'
import { StatsPage } from './StatsPage'

const daily = Array.from({ length: 30 }, (_, index) => ({
  day: `2026-09-${String(index + 1).padStart(2, '0')}`,
  visitors: index * 2,
  pageViews: index * 3,
}))

const stats: VisitorStats = {
  range: '30d',
  years: [2027, 2026],
  daily,
  totals: { visitors: 5_432_100, pageViews: 9_876_543 },
  today: { visitors: 58, pageViews: 87 },
  allTime: { visitors: 12_345_678, pageViews: 23_456_789, since: '2026-09-01' },
  updatedAt: '2026-09-30T12:00:00.000Z',
}

function respondWith(body: VisitorStats) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('StatsPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders visitor totals and the privacy boundary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respondWith(stats)))

    render(<StatsPage />)

    expect(await screen.findByText('12,345,678')).toBeInTheDocument()
    expect(screen.getByText('5,432,100')).toBeInTheDocument()
    expect(screen.getByText('9,876,543')).toBeInTheDocument()
    expect(screen.getByText('58')).toBeInTheDocument()
    expect(screen.getByText(/no wallet addresses/i)).toBeInTheDocument()
  })

  it('shows the hovered day in a tooltip', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respondWith(stats)))
    render(<StatsPage />)
    const plot = await screen.findByRole('group', { name: /daily visitors/i })

    fireEvent.focus(plot)
    const tooltip = screen.getByRole('status')
    expect(tooltip).toHaveTextContent('Sep 30, 2026')
    expect(tooltip).toHaveTextContent('58 visitors')
    expect(tooltip).toHaveTextContent('87 page views')

    fireEvent.keyDown(plot, { key: 'Home' })
    expect(within(screen.getByRole('status')).getByText('0 visitors')).toBeInTheDocument()
  })

  it('loads a calendar year when one is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respondWith(stats))
    vi.stubGlobal('fetch', fetchMock)
    render(<StatsPage />)

    fireEvent.click(await screen.findByRole('button', { name: '2026' }))

    expect(fetchMock).toHaveBeenLastCalledWith('/api/visitors?range=2026', expect.anything())
    expect(screen.getByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a specific setup message when the local Functions backend is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

    render(<StatsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('npm run cf:dev')
  })
})

describe('VisitorChart axis', () => {
  const axisLabels = (visitors: number[]) => {
    const { container, unmount } = render(
      <VisitorChart daily={visitors.map((count, index) => ({
        day: `2026-09-${String(index + 1).padStart(2, '0')}`,
        visitors: count,
        pageViews: count,
      }))} />,
    )
    const labels = [...container.querySelectorAll('.visitor-axis span')].map((node) => node.textContent)
    unmount()
    return labels
  }

  it('keeps gridlines on whole numbers', () => {
    expect(axisLabels([0, 0])).toEqual(['0', '1', '2', '3', '4'])
    expect(axisLabels([3, 58])).toEqual(['0', '20', '40', '60', '80'])
    expect(axisLabels([1234])).toEqual(['0', '500', '1,000', '1,500', '2,000'])
  })
})
