import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PublicStats } from '../lib/stats'
import { StatsPage } from './StatsPage'

const daily = Array.from({ length: 30 }, (_, index) => ({
  day: `2026-09-${String(index + 1).padStart(2, '0')}`,
  pageViews: index * 3,
  dashboardLoads: index,
  uniqueVisitors: index * 2,
  successfulVisitors: index,
}))

const stats: PublicStats = {
  totals: {
    uniqueVisitors: 12_345_678,
    pageViews: 98_765_432,
    dashboardLoads: 5_432_100,
    successfulVisitors: 4_321_000,
    successRate: 0.35,
  },
  daily,
  updatedAt: '2026-09-21T12:00:00.000Z',
}

describe('StatsPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders public aggregate totals and the privacy boundary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(stats), { status: 200 }),
    ))

    render(<StatsPage />)

    expect(await screen.findByText('12,345,678')).toBeInTheDocument()
    expect(screen.getByText('98,765,432')).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()
    expect(screen.getByText(/does not send wallet addresses/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/unique visitors and/i)).toHaveLength(30)
  })

  it('shows a specific setup message when the local Functions backend is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

    render(<StatsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('npm run cf:dev')
  })
})
