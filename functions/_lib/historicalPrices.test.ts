// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchHistoricalEthUsd,
  MAX_SPAN_DAYS,
  parseDefiLlamaChart,
  parseHistoricalPriceQuery,
} from './historicalPrices'

describe('historical price proxy helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts integer start and span within bounds', () => {
    expect(
      parseHistoricalPriceQuery(
        new URL(`https://rocketyield.net/api/historical-prices?start=1700000000&span=30`),
      ),
    ).toEqual({ start: 1_700_000_000, span: 30 })
  })

  it('rejects malformed or out-of-range query params', () => {
    expect(
      parseHistoricalPriceQuery(new URL('https://rocketyield.net/api/historical-prices?start=abc&span=30')),
    ).toBeNull()
    expect(
      parseHistoricalPriceQuery(new URL('https://rocketyield.net/api/historical-prices?start=1700000000&span=0')),
    ).toBeNull()
    expect(
      parseHistoricalPriceQuery(
        new URL(`https://rocketyield.net/api/historical-prices?start=1700000000&span=${MAX_SPAN_DAYS + 1}`),
      ),
    ).toBeNull()
    expect(
      parseHistoricalPriceQuery(new URL('https://rocketyield.net/api/historical-prices?start=100&span=10')),
    ).toBeNull()
  })

  it('normalizes DefiLlama payloads and drops invalid candles', () => {
    expect(
      parseDefiLlamaChart({
        coins: {
          'coingecko:ethereum': {
            prices: [
              { timestamp: 10, price: 2_000 },
              { timestamp: 11, price: -1 },
              { timestamp: 12, price: 2_200 },
              { timestamp: 'x', price: 1 },
            ],
          },
        },
      }),
    ).toEqual([
      { timestamp: 10, price: 2_000 },
      { timestamp: 12, price: 2_200 },
    ])
    expect(parseDefiLlamaChart(null)).toEqual([])
  })

  it('fetches and returns normalized prices from DefiLlama', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        coins: {
          'coingecko:ethereum': {
            prices: [
              { timestamp: 10, price: 2_000 },
              { timestamp: 11, price: 2_100 },
            ],
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchHistoricalEthUsd(1_700_000_000, 2)).resolves.toEqual([
      { timestamp: 10, price: 2_000 },
      { timestamp: 11, price: 2_100 },
    ])
    expect(fetchMock.mock.calls[0][0]).toContain('start=1700000000')
    expect(fetchMock.mock.calls[0][0]).toContain('period=1d&span=2')
  })

  it('throws when DefiLlama returns an empty series', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ coins: { 'coingecko:ethereum': { prices: [] } } }),
      }),
    )

    await expect(fetchHistoricalEthUsd(1_700_000_000, 2)).rejects.toThrow(/unavailable/i)
  })
})
