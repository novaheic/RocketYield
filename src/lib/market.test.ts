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

  it('loads every supported fiat rate from CoinGecko', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ethereum: {
            usd: 4_000,
            eur: 3_400,
            aud: 6_000,
            cad: 5_500,
            cny: 28_000,
            gbp: 3_000,
            jpy: 600_000,
            krw: 5_600_000,
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

    expect(fetchMock.mock.calls[0][0]).toContain(
      'vs_currencies=usd,eur,aud,cad,cny,gbp,jpy,krw',
    )
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
      .mockResolvedValueOnce(jsonResponse({ ethereum: { usd: 4_000 } }))
      .mockResolvedValueOnce(jsonResponse({ data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadMarketData(1.1)

    expect(result.ethFiat.USD).toBe(4_000)
    expect(result.ethFiat.EUR).toBeNull()
    expect(result.fiatError).toBe('Some fiat prices unavailable')
  })
})
