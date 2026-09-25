import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { DailyEarningsLedgerEntry, DashboardData } from '../lib/types'
import { buildDailyEarningsLedger } from '../lib/analytics/dailyEarnings'
import { downloadEarnings } from '../lib/earningsExport'
import { loadHistoricalEthUsd, readHistoricalPriceCache } from '../lib/historicalPrices'
import { DailyEarningsTable } from './DailyEarningsTable'

vi.mock('../lib/analytics/dailyEarnings', () => ({
  buildDailyEarningsLedger: vi.fn(),
}))

vi.mock('../lib/earningsExport', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/earningsExport')>(),
  downloadEarnings: vi.fn(),
}))

vi.mock('../lib/historicalPrices', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/historicalPrices')>(),
  loadHistoricalEthUsd: vi.fn(),
  readHistoricalPriceCache: vi.fn(),
}))

const mockedBuilder = vi.mocked(buildDailyEarningsLedger)
const mockedDownload = vi.mocked(downloadEarnings)
const mockedLoadPrices = vi.mocked(loadHistoricalEthUsd)
const mockedReadPrices = vi.mocked(readHistoricalPriceCache)

const day = 86_400
const start = Math.floor(new Date(2026, 0, 1).getTime() / 1000)
const entries: DailyEarningsLedgerEntry[] = Array.from({ length: 31 }, (_, index) => {
  const timestamp = start + index * day
  const date = new Date(timestamp * 1000)
  return {
    date: `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`,
    timestamp,
    earnedEth: 0.001 + index / 1_000_000,
    annualizedYield: 0.04,
    balanceEth: 10 + index / 10,
  }
}).reverse()

const data = {
  address: '0x1111111111111111111111111111111111111111' as Address,
  transfers: [],
  rates: [],
  market: {
    ethFiat: { USD: 3_000 },
  },
} as unknown as DashboardData

describe('DailyEarningsTable', () => {
  beforeEach(() => {
    mockedBuilder.mockReturnValue(entries)
    mockedDownload.mockReset()
    mockedReadPrices.mockResolvedValue([])
    mockedLoadPrices.mockResolvedValue([])
  })

  it('paginates thirty rows at a time', async () => {
    render(<DailyEarningsTable data={data} fiatCurrency="USD" />)

    expect(screen.getAllByRole('row')).toHaveLength(31)
    expect(screen.getByRole('option', { name: 'Page 1 of 2' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByRole('combobox', { name: 'Page' })).toHaveValue('2')
    await waitFor(() => expect(mockedLoadPrices).toHaveBeenCalledOnce())
  })

  it('exports the complete ledger instead of only the current page', () => {
    render(<DailyEarningsTable data={data} fiatCurrency="EUR" />)

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }))

    expect(mockedDownload).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([expect.objectContaining({ date: entries[0].date })]),
      'csv',
      data.address,
      'EUR',
    )
    expect(mockedDownload.mock.calls[0][0]).toHaveLength(31)
    expect(mockedDownload.mock.calls[1][0]).toHaveLength(31)
    expect(mockedDownload.mock.calls[1][3]).toBe('EUR')
  })

  it('labels value columns with the selected fiat currency', () => {
    render(<DailyEarningsTable data={data} fiatCurrency="JPY" />)

    expect(screen.getByRole('columnheader', { name: 'Value (JPY)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ETH Price (JPY)' })).toBeInTheDocument()
  })

  it('shows a first-day empty state when there are no earning days', () => {
    mockedBuilder.mockReturnValue([])
    render(<DailyEarningsTable data={data} fiatCurrency="USD" />)

    expect(screen.getByRole('status')).toHaveTextContent('Waiting on the first earning day')
    expect(screen.getByText(/accrues yield overnight/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
