import { FIAT_CURRENCIES, type FiatCurrency, type MarketData } from './types'

/** Coinbase public FX: units of each currency per 1 ETH. */
const ETH_PRICE_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=ETH'
const CURVE_RETH_WETH_POOL =
  'https://api.geckoterminal.com/api/v2/networks/eth/pools/0x9efe1a1cbd6ca51ee8319afc4573d253c3b732af'

function emptyFiatRates(): Record<FiatCurrency, number | null> {
  return Object.fromEntries(FIAT_CURRENCIES.map((currency) => [currency, null])) as Record<
    FiatCurrency,
    number | null
  >
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

function parseFiatRate(value: unknown): number | null {
  const rate = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

export async function loadMarketData(redemptionRate: number, signal?: AbortSignal): Promise<MarketData> {
  const result: MarketData = {
    ethFiat: emptyFiatRates(),
    marketRate: null,
    premiumPercent: null,
    fetchedAt: null,
  }

  const [fiat, market] = await Promise.allSettled([
    fetchJson<{ data?: { rates?: Record<string, string | number> } }>(ETH_PRICE_URL, signal),
    fetchJson<{
      data?: { attributes?: { base_token_price_quote_token?: string } }
    }>(CURVE_RETH_WETH_POOL, signal),
  ])

  if (fiat.status === 'fulfilled') {
    const rates = fiat.value.data?.rates
    for (const currency of FIAT_CURRENCIES) {
      result.ethFiat[currency] = parseFiatRate(rates?.[currency])
    }
  }

  const availableFiatCount = Object.values(result.ethFiat).filter((rate) => rate !== null).length
  if (availableFiatCount === 0) result.fiatError = 'Fiat prices unavailable'
  else if (availableFiatCount < FIAT_CURRENCIES.length) {
    result.fiatError = 'Some fiat prices unavailable'
  }

  if (market.status === 'fulfilled') {
    const rate = Number(market.value.data?.attributes?.base_token_price_quote_token)
    if (Number.isFinite(rate) && rate > 0) {
      result.marketRate = rate
      result.premiumPercent = ((rate / redemptionRate) - 1) * 100
    } else {
      result.marketError = 'DEX quote unavailable'
    }
  } else {
    result.marketError = 'DEX quote unavailable'
  }

  if (availableFiatCount > 0 || result.marketRate !== null) result.fetchedAt = Date.now()
  return result
}
