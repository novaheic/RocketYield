import type { MarketData } from './types'

const ETH_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
const CURVE_RETH_WETH_POOL =
  'https://api.geckoterminal.com/api/v2/networks/eth/pools/0x9efe1a1cbd6ca51ee8319afc4573d253c3b732af'

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export async function loadMarketData(redemptionRate: number, signal?: AbortSignal): Promise<MarketData> {
  const result: MarketData = {
    ethUsd: null,
    marketRate: null,
    premiumPercent: null,
    fetchedAt: null,
  }

  const [fiat, market] = await Promise.allSettled([
    fetchJson<{ ethereum?: { usd?: number } }>(ETH_PRICE_URL, signal),
    fetchJson<{
      data?: { attributes?: { base_token_price_quote_token?: string } }
    }>(CURVE_RETH_WETH_POOL, signal),
  ])

  if (fiat.status === 'fulfilled' && Number.isFinite(fiat.value.ethereum?.usd)) {
    result.ethUsd = fiat.value.ethereum!.usd!
  } else {
    result.fiatError = 'USD price unavailable'
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

  if (result.ethUsd !== null || result.marketRate !== null) result.fetchedAt = Date.now()
  return result
}
