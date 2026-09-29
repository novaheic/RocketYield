import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadMarketData } from './market'

function jsonResponse(value: unknown) {
  return {
    ok: true,
    json: async () => value,
  } as Response
}

describe('loadMarketData', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads every supported fiat rate from Coinbase', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            currency: 'ETH',
            rates: {
              USD: '4000',
              EUR: '3400',
              AUD: '6000',
              CAD: '5500',
              CNY: '28000',
              GBP: '3000',
              JPY: '600000',
              KRW: '5600000',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { attributes: { base_token_price_quote_token: '1.2' } },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadMarketData(1.1)

    expect(fetchMock.mock.calls[0][0]).toContain('api.coinbase.com/v2/exchange-rates')
    expect(result.ethFiat).toEqual({
      USD: 4_000,
      EUR: 3_400,
      AUD: 6_000,
      CAD: 5_500,
      CNY: 28_000,
      GBP: 3_000,
      JPY: 600_000,
      KRW: 5_600_000,
    })
    expect(result.fiatError).toBeUndefined()
  })

  it('keeps valid rates and reports a partial fiat response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { rates: { USD: '4000' } } }))
      .mockResolvedValueOnce(jsonResponse({ data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadMarketData(1.1)

    expect(result.ethFiat.USD).toBe(4_000)
    expect(result.ethFiat.EUR).toBeNull()
    expect(result.fiatError).toBe('Some fiat prices unavailable')
  })
})
