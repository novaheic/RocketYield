import { get, set } from 'idb-keyval'
import type { DailyEarningsLedgerEntry, DailyEarningsLedgerRow } from './types'

const DAY_SECONDS = 86_400
const PRICE_CACHE_VERSION = 1
const PRICE_CACHE_KEY = `ry:${PRICE_CACHE_VERSION}:eth-usd-daily`
const PRICE_API = 'https://coins.llama.fi/chart/coingecko:ethereum'

export interface HistoricalPricePoint {
  timestamp: number
  price: number
}

interface CachedHistoricalPrices {
  version: number
  items: HistoricalPricePoint[]
}

interface DefiLlamaChartResponse {
  coins?: {
    'coingecko:ethereum'?: {
      prices?: Array<{ timestamp?: number; price?: number }>
    }
  }
}

function utcDay(timestamp: number) {
  return Math.floor(timestamp / DAY_SECONDS) * DAY_SECONDS
}

function localDateKey(timestamp: number) {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizePrices(items: HistoricalPricePoint[]) {
  const deduped = new Map<number, HistoricalPricePoint>()
  for (const item of items) {
    if (
      Number.isFinite(item.timestamp) &&
      Number.isFinite(item.price) &&
      item.timestamp > 0 &&
      item.price > 0
    ) {
      deduped.set(item.timestamp, item)
    }
  }
  return [...deduped.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export async function readHistoricalPriceCache(): Promise<HistoricalPricePoint[]> {
  if (typeof indexedDB === 'undefined') return []
  try {
    const cached = await get<CachedHistoricalPrices>(PRICE_CACHE_KEY)
    return cached?.version === PRICE_CACHE_VERSION ? normalizePrices(cached.items) : []
  } catch {
    return []
  }
}

async function writeHistoricalPriceCache(items: HistoricalPricePoint[]) {
  if (typeof indexedDB === 'undefined') return
  try {
    await set(PRICE_CACHE_KEY, {
      version: PRICE_CACHE_VERSION,
      items: normalizePrices(items),
    } satisfies CachedHistoricalPrices)
  } catch {
    // Price caching is an optimization and must not block the earnings table.
  }
}

function coversRange(items: HistoricalPricePoint[], start: number, end: number) {
  // Match against the raw requested timestamps (local midnights), not UTC-floored
  // bounds. A one-day slack on floored bounds previously let a cache that stopped at
  // UTC day N claim coverage for local day N+1 in positive-offset timezones, so the
  // newest completed row never refetched and fell outside nearestPrice's window.
  return nearestPrice(items, start) !== null && nearestPrice(items, end) !== null
}

export async function loadHistoricalEthUsd(
  startTimestamp: number,
  endTimestamp: number,
  signal?: AbortSignal,
): Promise<HistoricalPricePoint[]> {
  if (endTimestamp < startTimestamp) return []

  const cached = await readHistoricalPriceCache()
  if (coversRange(cached, startTimestamp, endTimestamp)) return cached

  // Floor the start for a stable API window, and extend one UTC day past the end so
  // evening timezones (local midnight = previous UTC evening) still receive a candle
  // for the newest completed local day.
  const start = utcDay(startTimestamp)
  const fetchEnd = utcDay(endTimestamp) + DAY_SECONDS
  const span = Math.max(1, Math.floor((fetchEnd - start) / DAY_SECONDS) + 1)
  const url = `${PRICE_API}?start=${start}&period=1d&span=${span}`
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Historical ETH prices unavailable (HTTP ${response.status})`)

  const payload = await response.json() as DefiLlamaChartResponse
  const fresh = (payload.coins?.['coingecko:ethereum']?.prices ?? []).flatMap((item) => {
    if (
      typeof item.timestamp !== 'number' ||
      typeof item.price !== 'number' ||
      !Number.isFinite(item.timestamp) ||
      !Number.isFinite(item.price) ||
      item.price <= 0
    ) {
      return []
    }
    return [{ timestamp: item.timestamp, price: item.price }]
  })
  if (fresh.length === 0) throw new Error('Historical ETH prices unavailable')

  const merged = normalizePrices([...cached, ...fresh])
  await writeHistoricalPriceCache(merged)
  return merged
}

function nearestPrice(items: HistoricalPricePoint[], timestamp: number) {
  if (items.length === 0) return null

  let low = 0
  let high = items.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (items[middle].timestamp < timestamp) low = middle + 1
    else high = middle
  }

  const after = items[low]
  const before = items[low - 1]
  const selected = !before || Math.abs(after.timestamp - timestamp) < Math.abs(before.timestamp - timestamp)
    ? after
    : before
  return Math.abs(selected.timestamp - timestamp) <= DAY_SECONDS * 1.5 ? selected.price : null
}

/**
 * Joins ledger entries to prices. Historical series is ETH/USD from DefiLlama;
 * pass `usdToFiat` (selectedFiat / USD) to convert completed days into the UI currency.
 * Today's row uses `currentFiatPrice` directly when available.
 */
export function joinHistoricalPrices(
  entries: DailyEarningsLedgerEntry[],
  prices: HistoricalPricePoint[],
  currentFiatPrice: number | null,
  usdToFiat: number | null = 1,
  now = Math.floor(Date.now() / 1000),
): DailyEarningsLedgerRow[] {
  const today = localDateKey(now)
  return entries.map((entry) => {
    let ethPrice: number | null = null
    if (entry.date === today && currentFiatPrice && currentFiatPrice > 0) {
      ethPrice = currentFiatPrice
    } else {
      const usdPrice = nearestPrice(prices, entry.timestamp)
      if (usdPrice !== null && usdToFiat !== null && Number.isFinite(usdToFiat) && usdToFiat > 0) {
        ethPrice = usdPrice * usdToFiat
      } else if (
        // DefiLlama can lag a few hours after a local day closes; use live spot
        // for recently completed days so the newest row is not blank.
        currentFiatPrice &&
        currentFiatPrice > 0 &&
        now - entry.timestamp < DAY_SECONDS * 2
      ) {
        ethPrice = currentFiatPrice
      }
    }
    return {
      ...entry,
      ethPrice,
      fiatValue: ethPrice === null ? null : entry.earnedEth * ethPrice,
    }
  })
}

/** Live FX implied by current ETH spot prices: selectedFiat / USD. */
export function usdToFiatFactor(
  usdPrice: number | null,
  fiatPrice: number | null,
  currencyIsUsd: boolean,
): number | null {
  if (currencyIsUsd) return 1
  if (
    usdPrice === null ||
    fiatPrice === null ||
    !Number.isFinite(usdPrice) ||
    !Number.isFinite(fiatPrice) ||
    usdPrice <= 0 ||
    fiatPrice <= 0
  ) {
    return null
  }
  return fiatPrice / usdPrice
}
