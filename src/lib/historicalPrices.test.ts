import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyEarningsLedgerEntry } from './types'

const idb = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

vi.mock('idb-keyval', () => idb)

import {
  joinHistoricalPrices,
  loadHistoricalEthUsd,
  readHistoricalPriceCache,
} from './historicalPrices'

const DAY = 86_400

function localDateKey(timestamp: number) {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('historical ETH prices', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', {})
    idb.get.mockReset()
    idb.set.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a covering IndexedDB series without a network request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    idb.get.mockResolvedValue({
      version: 1,
      items: [
        { timestamp: 10 * DAY, price: 2_000 },
        { timestamp: 11 * DAY, price: 2_100 },
      ],
    })

    const result = await loadHistoricalEthUsd(10 * DAY, 11 * DAY)

    expect(result).toHaveLength(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refetches when the cache cannot match the newest requested day', async () => {
    // Mirrors UTC+2: cache ends at UTC day N, newest ledger midnight is ~N+1d22h later.
    // Old floored coversRange (last >= end - 1d) treated that as covered; nearestPrice
    // then left the newest local day blank (>1.5d from the last candle).
    idb.get.mockResolvedValue({
      version: 1,
      items: [
        { timestamp: 9 * DAY, price: 1_900 },
        { timestamp: 10 * DAY, price: 2_000 },
      ],
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        coins: {
          'coingecko:ethereum': {
            prices: [
              { timestamp: 10 * DAY, price: 2_000 },
              { timestamp: 11 * DAY, price: 2_100 },
              { timestamp: 12 * DAY, price: 2_200 },
            ],
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const localNewestMidnight = 11 * DAY + 22 * 3_600
    const result = await loadHistoricalEthUsd(9 * DAY, localNewestMidnight)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result.map((item) => item.timestamp)).toEqual([
      9 * DAY,
      10 * DAY,
      11 * DAY,
      12 * DAY,
    ])
  })

  it('fetches the requested range once and stores normalized valid prices', async () => {
    idb.get.mockResolvedValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        coins: {
          'coingecko:ethereum': {
            prices: [
              { timestamp: 10 * DAY, price: 2_000 },
              { timestamp: 11 * DAY, price: -1 },
              { timestamp: 12 * DAY, price: 2_200 },
              { timestamp: 13 * DAY, price: 2_300 },
            ],
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadHistoricalEthUsd(10 * DAY + 300, 12 * DAY + 600)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toContain(`start=${10 * DAY}`)
    expect(fetchMock.mock.calls[0][0]).toContain('period=1d&span=4')
    expect(result).toEqual([
      { timestamp: 10 * DAY, price: 2_000 },
      { timestamp: 12 * DAY, price: 2_200 },
      { timestamp: 13 * DAY, price: 2_300 },
    ])
    expect(idb.set).toHaveBeenCalledOnce()
  })

  it('keeps cache access optional when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(readHistoricalPriceCache()).resolves.toEqual([])
  })

  it('joins the nearest daily price and uses the live spot price for today', () => {
    const now = Math.floor(Date.now() / 1000)
    const yesterday = now - DAY
    const entries: DailyEarningsLedgerEntry[] = [
      {
        date: localDateKey(now),
        timestamp: now,
        earnedEth: 0.01,
        annualizedYield: 0.04,
        balanceEth: 12,
      },
      {
        date: localDateKey(yesterday),
        timestamp: yesterday,
        earnedEth: 0.02,
        annualizedYield: 0.04,
        balanceEth: 11.9,
      },
    ]

    const rows = joinHistoricalPrices(
      entries,
      [{ timestamp: yesterday + 600, price: 2_500 }],
      3_000,
      1,
      now,
    )

    expect(rows[0].ethPrice).toBe(3_000)
    expect(rows[0].fiatValue).toBeCloseTo(30)
    expect(rows[1].ethPrice).toBe(2_500)
    expect(rows[1].fiatValue).toBeCloseTo(50)
  })

  it('falls back to live spot for a recent completed day with no historical match', () => {
    const now = Math.floor(Date.now() / 1000)
    const yesterday = Math.floor(new Date(now * 1000).setHours(0, 0, 0, 0) / 1000) - DAY
    const entries: DailyEarningsLedgerEntry[] = [
      {
        date: localDateKey(yesterday),
        timestamp: yesterday,
        earnedEth: 0.02,
        annualizedYield: 0.04,
        balanceEth: 11.9,
      },
    ]

    const rows = joinHistoricalPrices(entries, [], 2_700, 0.9, now)

    expect(rows[0].ethPrice).toBe(2_700)
    expect(rows[0].fiatValue).toBeCloseTo(54)
  })

  it('converts historical USD prices with the live FX factor', () => {
    const now = Math.floor(Date.now() / 1000)
    const yesterday = now - DAY
    const entries: DailyEarningsLedgerEntry[] = [
      {
        date: localDateKey(yesterday),
        timestamp: yesterday,
        earnedEth: 0.02,
        annualizedYield: 0.04,
        balanceEth: 11.9,
      },
    ]

    const rows = joinHistoricalPrices(
      entries,
      [{ timestamp: yesterday, price: 2_500 }],
      2_700,
      0.9,
      now,
    )

    expect(rows[0].ethPrice).toBeCloseTo(2_250)
    expect(rows[0].fiatValue).toBeCloseTo(45)
  })
})
