import { describe, expect, it } from 'vitest'
import type { DailyEarningsLedgerRow } from './types'
import { serializeEarningsCsv, serializeEarningsJson } from './earningsExport'

const rows: DailyEarningsLedgerRow[] = [
  {
    date: '2026-09-22',
    timestamp: 1_790_000_000,
    earnedEth: 0.001234,
    dollarValueUsd: 3.702,
    ethPriceUsd: 3_000,
    annualizedYield: 0.0412,
    balanceEth: 12.345,
  },
]

describe('earnings exports', () => {
  it('serializes all displayed columns to CSV', () => {
    const csv = serializeEarningsCsv(rows)

    expect(csv).toContain('Date,Change (ETH),Dollar Value (USD),ETH Price (USD)')
    expect(csv).toContain('2026-09-22,0.001234,3.702,3000,4.12,12.345')
  })

  it('serializes JSON with primitive, explicitly named values', () => {
    expect(JSON.parse(serializeEarningsJson(rows))).toEqual([
      {
        date: '2026-09-22',
        changeEth: 0.001234,
        dollarValueUsd: 3.702,
        ethPriceUsd: 3_000,
        annualizedYieldPercent: 4.12,
        balanceEth: 12.345,
      },
    ])
  })

  it('keeps unavailable historical prices explicit in JSON and blank in CSV', () => {
    const unavailable = [{ ...rows[0], dollarValueUsd: null, ethPriceUsd: null }]

    expect(serializeEarningsCsv(unavailable)).toContain('2026-09-22,0.001234,,,4.12,12.345')
    expect(JSON.parse(serializeEarningsJson(unavailable))[0].ethPriceUsd).toBeNull()
  })
})
