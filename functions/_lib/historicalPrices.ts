/** Proxied daily ETH/USD history for the earnings table. */

export const PRICE_API = 'https://coins.llama.fi/chart/coingecko:ethereum'
export const DAY_SECONDS = 86_400
export const MAX_SPAN_DAYS = 4_000
export const MIN_START_TIMESTAMP = 1_400_000_000
/** DefiLlama's chart endpoint rejects spans around 600+; keep a margin under that. */
export const DEFILLAMA_MAX_SPAN = 500

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

/** Split a long chart window into DefiLlama-safe chunks. */
export function buildSpanChunks(
  start: number,
  span: number,
  chunkSize = DEFILLAMA_MAX_SPAN,
): Array<{ start: number; span: number }> {
  if (span < 1) return []
  const size = Math.max(1, chunkSize)
  const chunks: Array<{ start: number; span: number }> = []
  let remaining = span
  let cursor = start
  while (remaining > 0) {
    const chunkSpan = Math.min(size, remaining)
    chunks.push({ start: cursor, span: chunkSpan })
    cursor += chunkSpan * DAY_SECONDS
    remaining -= chunkSpan
  }
  return chunks
}

async function fetchDefiLlamaChunk(
  start: number,
  span: number,
  signal?: AbortSignal,
): Promise<HistoricalPricePoint[]> {
  const url = `${PRICE_API}?start=${start}&period=1d&span=${span}`
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Historical ETH prices unavailable (HTTP ${response.status})`)
  }
  return parseDefiLlamaChart(await response.json())
}

export async function fetchHistoricalEthUsd(
  start: number,
  span: number,
  signal?: AbortSignal,
): Promise<HistoricalPricePoint[]> {
  const chunks = buildSpanChunks(start, span)
  const collected: HistoricalPricePoint[] = []

  for (const chunk of chunks) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const prices = await fetchDefiLlamaChunk(chunk.start, chunk.span, signal)
    collected.push(...prices)
  }

  const merged = normalizeHistoricalPrices(collected)
  if (merged.length === 0) throw new Error('Historical ETH prices unavailable')
  return merged
}
