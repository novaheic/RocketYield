// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildSpanChunks,
  DAY_SECONDS,
  DEFILLAMA_MAX_SPAN,
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

  it('splits long spans into DefiLlama-safe chunks', () => {
    expect(buildSpanChunks(1_700_000_000, 1_340)).toEqual([
      { start: 1_700_000_000, span: DEFILLAMA_MAX_SPAN },
      { start: 1_700_000_000 + DEFILLAMA_MAX_SPAN * DAY_SECONDS, span: DEFILLAMA_MAX_SPAN },
      {
        start: 1_700_000_000 + DEFILLAMA_MAX_SPAN * 2 * DAY_SECONDS,
        span: 1_340 - DEFILLAMA_MAX_SPAN * 2,
      },
    ])
    expect(buildSpanChunks(1_700_000_000, 40)).toEqual([{ start: 1_700_000_000, span: 40 }])
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

  it('chunks long ranges into multiple DefiLlama requests', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      const start = Number(parsed.searchParams.get('start'))
      const span = Number(parsed.searchParams.get('span'))
      expect(span).toBeLessThanOrEqual(DEFILLAMA_MAX_SPAN)
      return {
        ok: true,
        json: async () => ({
          coins: {
            'coingecko:ethereum': {
              prices: Array.from({ length: span }, (_, index) => ({
                timestamp: start + index * DAY_SECONDS,
                price: 2_000 + index,
              })),
            },
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchHistoricalEthUsd(1_700_000_000, 1_340)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(1_340)
    expect(result[0]).toEqual({ timestamp: 1_700_000_000, price: 2_000 })
    expect(result.at(-1)?.timestamp).toBe(
      1_700_000_000 + (1_340 - 1) * DAY_SECONDS,
    )
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
