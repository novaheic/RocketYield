import { describe, expect, it } from 'vitest'
import type { DailyEarningsLedgerRow } from './types'
import { serializeEarningsCsv, serializeEarningsJson } from './earningsExport'

const rows: DailyEarningsLedgerRow[] = [
  {
    date: '2026-09-22',
    timestamp: 1_790_000_000,
    earnedEth: 0.001234,
    fiatValue: 3.702,
    ethPrice: 3_000,
    annualizedYield: 0.0412,
    balanceEth: 12.345,
  },
]

describe('earnings exports', () => {
  it('serializes all displayed columns to CSV', () => {
    const csv = serializeEarningsCsv(rows, 'USD')

    expect(csv).toContain('Date,Change (ETH),Value (USD),ETH Price (USD)')
    expect(csv).toContain('2026-09-22,0.001234,3.702,3000,4.12,12.345')
  })

  it('labels CSV columns with the selected currency', () => {
    expect(serializeEarningsCsv(rows, 'EUR')).toContain('Value (EUR),ETH Price (EUR)')
  })

  it('serializes JSON with primitive, explicitly named values', () => {
    expect(JSON.parse(serializeEarningsJson(rows, 'EUR'))).toEqual([
      {
        date: '2026-09-22',
        changeEth: 0.001234,
        fiatValue: 3.702,
        ethPrice: 3_000,
        currency: 'EUR',
        annualizedYieldPercent: 4.12,
        balanceEth: 12.345,
      },
    ])
  })

  it('keeps unavailable historical prices explicit in JSON and blank in CSV', () => {
    const unavailable = [{ ...rows[0], fiatValue: null, ethPrice: null }]

    expect(serializeEarningsCsv(unavailable, 'USD')).toContain('2026-09-22,0.001234,,,4.12,12.345')
    expect(JSON.parse(serializeEarningsJson(unavailable, 'USD'))[0].ethPrice).toBeNull()
  })
})
