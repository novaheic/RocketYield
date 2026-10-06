/** Proxied daily ETH/USD history for the earnings table. */

export const PRICE_API = 'https://coins.llama.fi/chart/coingecko:ethereum'
export const MAX_SPAN_DAYS = 4_000
export const MIN_START_TIMESTAMP = 1_400_000_000

export interface HistoricalPricePoint {
  timestamp: number
  price: number
}

interface DefiLlamaChartResponse {
  coins?: {
    'coingecko:ethereum'?: {
      prices?: Array<{ timestamp?: number; price?: number }>
    }
  }
}

export function parseHistoricalPriceQuery(url: URL): { start: number; span: number } | null {
  const start = Number(url.searchParams.get('start'))
  const span = Number(url.searchParams.get('span'))
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(span) ||
    !Number.isInteger(start) ||
    !Number.isInteger(span) ||
    start < MIN_START_TIMESTAMP ||
    span < 1 ||
    span > MAX_SPAN_DAYS
  ) {
    return null
  }
  return { start, span }
}

export function normalizeHistoricalPrices(
  items: Array<{ timestamp?: number; price?: number }>,
): HistoricalPricePoint[] {
  const deduped = new Map<number, HistoricalPricePoint>()
  for (const item of items) {
    if (
      typeof item.timestamp === 'number' &&
      typeof item.price === 'number' &&
      Number.isFinite(item.timestamp) &&
      Number.isFinite(item.price) &&
      item.timestamp > 0 &&
      item.price > 0
    ) {
      deduped.set(item.timestamp, { timestamp: item.timestamp, price: item.price })
    }
  }
  return [...deduped.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export function parseDefiLlamaChart(payload: unknown): HistoricalPricePoint[] {
  if (!payload || typeof payload !== 'object') return []
  const coins = (payload as DefiLlamaChartResponse).coins?.['coingecko:ethereum']?.prices
  return normalizeHistoricalPrices(coins ?? [])
}

export async function fetchHistoricalEthUsd(
  start: number,
  span: number,
  signal?: AbortSignal,
): Promise<HistoricalPricePoint[]> {
  const url = `${PRICE_API}?start=${start}&period=1d&span=${span}`
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Historical ETH prices unavailable (HTTP ${response.status})`)
  }
  const payload: unknown = await response.json()
  const prices = parseDefiLlamaChart(payload)
  if (prices.length === 0) throw new Error('Historical ETH prices unavailable')
  return prices
}
