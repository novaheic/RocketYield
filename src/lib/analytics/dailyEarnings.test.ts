import { describe, expect, it } from 'vitest'
import type { Address, Hash } from 'viem'
import type { RatePoint, TransferPoint } from '../types'
import { buildDailyEarningsLedger } from './dailyEarnings'
import { WAD } from './timeline'

const wallet = '0x1111111111111111111111111111111111111111' as Address
const other = '0x2222222222222222222222222222222222222222' as Address

function localTime(year: number, month: number, day: number, hour = 0) {
  return Math.floor(new Date(year, month - 1, day, hour).getTime() / 1000)
}

function rate(blockNumber: bigint, value: number, timestamp: number): RatePoint {
  return { blockNumber, timestamp, rate: BigInt(Math.round(value * 1e9)) * 10n ** 9n }
}

function transfer(
  blockNumber: bigint,
  deltaReth: number,
  timestamp: number,
  logIndex = 0,
): TransferPoint {
  const incoming = deltaReth > 0
  const value = BigInt(Math.abs(deltaReth)) * WAD
  return {
    blockNumber,
    transactionHash: `0x${blockNumber.toString().padStart(64, '0')}` as Hash,
    logIndex,
    timestamp,
    from: incoming ? other : wallet,
    to: incoming ? wallet : other,
    value,
    delta: incoming ? value : -value,
  }
}

describe('buildDailyEarningsLedger', () => {
  it('allocates sparse rate growth across browser-local calendar days', () => {
    const start = localTime(2026, 1, 10)
    const end = localTime(2026, 1, 13)
    const result = buildDailyEarningsLedger(
      [transfer(1n, 1, start)],
      [rate(1n, 1, start), rate(2n, 1.3, end)],
      end,
    )

    expect(result.map((row) => row.date)).toEqual([
      '2026-01-12',
      '2026-01-11',
      '2026-01-10',
    ])
    expect(result.reduce((sum, row) => sum + row.earnedEth, 0)).toBeCloseTo(0.3, 8)
    expect(result[0].balanceEth).toBeCloseTo(1.3, 8)
    expect(result.every((row) => row.annualizedYield > 0)).toBe(true)
  })

  it('weights earnings around transfers within a day', () => {
    const start = localTime(2026, 2, 5)
    const midday = localTime(2026, 2, 5, 12)
    const end = localTime(2026, 2, 6)
    const result = buildDailyEarningsLedger(
      [transfer(2n, 2, midday)],
      [
        rate(1n, 1, start),
        rate(2n, 1.1, midday),
        rate(3n, 1.2, end),
      ],
      end,
    )

    expect(result).toHaveLength(1)
    expect(result[0].earnedEth).toBeCloseTo(0.2, 8)
    expect(result[0].balanceEth).toBeCloseTo(2.4, 8)
  })

  it('uses the actual local-day duration across a possible DST transition', () => {
    const start = localTime(2026, 3, 28)
    const end = localTime(2026, 3, 30)
    const result = buildDailyEarningsLedger(
      [transfer(1n, 1, start)],
      [rate(1n, 1, start), rate(2n, 1.02, end)],
      end,
    )

    expect(result.map((row) => row.date)).toEqual(['2026-03-29', '2026-03-28'])
    expect(result.reduce((sum, row) => sum + row.earnedEth, 0)).toBeCloseTo(0.02, 8)
    expect(result.every((row) => Number.isFinite(row.annualizedYield))).toBe(true)
  })

  it('omits the current incomplete local day', () => {
    const start = localTime(2026, 4, 2)
    const now = localTime(2026, 4, 2, 12)
    const end = localTime(2026, 4, 3)
    const result = buildDailyEarningsLedger(
      [transfer(1n, 1, start)],
      [rate(1n, 1, start), rate(2n, 1.1, end)],
      now,
    )

    expect(result).toEqual([])
  })

  it('does not create rows while the wallet holds no rETH', () => {
    const start = localTime(2026, 5, 1)
    const end = localTime(2026, 5, 3)
    const result = buildDailyEarningsLedger(
      [],
      [rate(1n, 1, start), rate(2n, 1.1, end)],
      end,
    )

    expect(result).toEqual([])
  })
})
