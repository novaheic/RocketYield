import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import { DashboardError, type DashboardData } from './lib/types'
import { useRocketYield } from './hooks/useRocketYield'
import App from './App'

vi.mock('./hooks/useRocketYield', () => ({
  useRocketYield: vi.fn(),
}))

vi.mock('./components/AnalyticsCharts', () => ({
  AnalyticsCharts: () => <section aria-label="Position history charts" />,
}))

const mockedHook = vi.mocked(useRocketYield)
const refresh = vi.fn()
const now = Math.floor(Date.now() / 1000)
const dashboard: DashboardData = {
  input: 'averylongwalletlabelaverylongwalletlabelaverylongwalletlabel.eth',
  address: '0x1111111111111111111111111111111111111111' as Address,
  ensName: 'averylongwalletlabelaverylongwalletlabelaverylongwalletlabel.eth',
  currentReth: 0n,
  currentRate: 1_200_000_000_000_000_000n,
  currentEth: 0n,
  transfers: [],
  rates: [
    { blockNumber: 1n, timestamp: now - 86_400, rate: 1_199_000_000_000_000_000n },
    { blockNumber: 2n, timestamp: now, rate: 1_200_000_000_000_000_000n },
  ],
  analytics: {
    earnings: { today: 0n, sevenDays: 0n, thirtyDays: 0n, ninetyDays: 0n, lifetime: 0n },
    yields: { apr7d: 0.04, apy7d: 0.041, apr30d: 0.038, apy30d: 0.039 },
    projections: {
      current: { day: 0n, month: 0n, year: 0n },
      thirtyDayAverage: { day: 0n, month: 0n, year: 0n },
    },
    rateSeries: [],
    valueSeries: [],
    dailyEarnings: [],
    milestone: null,
    smoothedEthPerSecond: 0,
  },
  market: {
    ethUsd: null,
    marketRate: null,
    premiumPercent: null,
    fetchedAt: null,
    fiatError: 'USD price unavailable',
  },
  chainBlock: 24_000_000n,
  rateUpdatedAt: now,
  expectedNextUpdateAt: now + 86_400,
}

describe('App live-data states', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    mockedHook.mockReturnValue({
      data: null,
      error: null,
      progress: { phase: 'idle', label: 'Waiting for an address' },
      refresh,
    })
  })

  it('shows the specific address entry proposition', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /see what your reth is worth/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no wallet connection, signature, or account/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Methodology' })).toHaveAttribute('href', '/methodology')
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum')
    expect(screen.getAllByRole('link', { name: /datenschutz/i })[0]).toHaveAttribute('href', '/privacy')
  })

  it('shows history indexing progress without fabricated values', () => {
    window.history.replaceState({}, '', '/?address=rocketpool.eth')
    mockedHook.mockReturnValue({
      data: null,
      error: null,
      progress: {
        phase: 'transfers',
        label: 'Reading rETH transfers',
        completed: 5,
        total: 20,
      },
      refresh,
    })

    render(<App />)
    expect(screen.getByRole('heading', { name: 'Reading rETH transfers' })).toBeInTheDocument()
    expect(screen.getByText('25% of block ranges')).toBeInTheDocument()
    expect(screen.queryByText(/current position/i)).not.toBeInTheDocument()
  })

  it('explains an archive RPC failure and offers a retry', () => {
    window.history.replaceState({}, '', '/?address=rocketpool.eth')
    mockedHook.mockReturnValue({
      data: null,
      error: new DashboardError(
        'archive_required',
        'This endpoint cannot serve the required historical Ethereum data.',
      ),
      progress: { phase: 'error', label: 'Live data request failed' },
      refresh,
    })

    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('historical Ethereum data')
    expect(screen.getByRole('button', { name: /try the live request again/i })).toBeInTheDocument()
  })

  it('shows zero-holdings and partial-market states without hiding on-chain data', () => {
    window.history.replaceState({}, '', '/?address=averylongwalletlabel.eth')
    mockedHook.mockReturnValue({
      data: dashboard,
      error: null,
      progress: { phase: 'ready', label: 'Live data ready' },
      refresh,
    })

    render(<App />)
    expect(screen.getByText(/currently holds no reth/i)).toBeInTheDocument()
    expect(screen.getByText(/on-chain figures are complete/i)).toBeInTheDocument()
    expect(screen.getByText('Current position')).toBeInTheDocument()
  })
})
