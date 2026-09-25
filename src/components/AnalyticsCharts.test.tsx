import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { DashboardData } from '../lib/types'
import { AnalyticsCharts } from './AnalyticsCharts'

vi.mock('lightweight-charts', () => ({
  ColorType: { Solid: 'solid' },
  HistogramSeries: 'HistogramSeries',
  LineSeries: 'LineSeries',
  createChart: vi.fn(() => ({
    applyOptions: vi.fn(),
    addSeries: vi.fn(() => ({ setData: vi.fn(), update: vi.fn() })),
    removeSeries: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn(), setVisibleRange: vi.fn() }),
  })),
  createSeriesMarkers: vi.fn(),
}))

vi.mock('../lib/analytics/dailyEarnings', () => ({
  buildDailyEarningsLedger: vi.fn(() => []),
  estimateTodayEarnings: vi.fn(() => ({
    realizedEth: 0,
    tickFrom: Math.floor(Date.now() / 1000),
    ethAt: 0,
  })),
}))

const emptyData = {
  address: '0x1111111111111111111111111111111111111111' as Address,
  transfers: [],
  rates: [],
  analytics: {
    valueSeries: [
      { timestamp: 1_700_000_000, valueEth: 0, balanceReth: 0 },
    ],
    smoothedEthPerSecond: 0,
  },
} as unknown as DashboardData

describe('AnalyticsCharts empty states', () => {
  it('shows the value empty state when the address never held rETH', () => {
    render(<AnalyticsCharts data={emptyData} />)

    expect(screen.getByRole('status')).toHaveTextContent('No position to chart')
    expect(screen.getByText(/no reth holdings in the scanned history/i)).toBeInTheDocument()
  })

  it('shows the earnings empty state when there is nothing to plot', () => {
    render(<AnalyticsCharts data={emptyData} />)

    fireEvent.click(screen.getByRole('button', { name: 'Earnings' }))

    expect(screen.getByRole('status')).toHaveTextContent('No daily earnings yet')
    expect(screen.getByText(/accrues yield while held/i)).toBeInTheDocument()
  })
})
