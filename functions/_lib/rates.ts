/** Shared rETH exchange-rate timeline for all visitors. */

export interface RatesEnv {
  RATE_HISTORY: KVNamespace
  ETHEREUM_RPC_URL: string
}

export interface SerializedRatePoint {
  blockNumber: string
  timestamp: number
  rate: string
}

export interface SharedRateCache {
  version: number
  throughBlock: string
  updatedAt: string
  items: SerializedRatePoint[]
  stale?: boolean
}

export const RATE_CACHE_VERSION = 1
export const RATE_KV_KEY = `shared-rates-v${RATE_CACHE_VERSION}`
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000
export const STALE_AFTER_BLOCKS = 7_200n
export const RATE_SAMPLE_BATCH_SIZE = 8

const RETH_DEPLOYMENT_BLOCK = 13_325_322n
const RETH_ADDRESS = '0xae78736Cd615f374D3085123A210448E74Fc6393'
const GET_EXCHANGE_RATE_DATA = '0xe6aa216c'
const RECENT_SAMPLE_BLOCKS = 7_200n
const RECENT_SAMPLE_COUNT = 90n
const HISTORICAL_SAMPLE_BLOCKS = 216_000n

type FetchLike = typeof fetch

export function buildSharedSampleBlocks(latestBlock: bigint): bigint[] {
  const samples = new Set<string>()
  const recentStart =
    latestBlock - RECENT_SAMPLE_BLOCKS * RECENT_SAMPLE_COUNT > RETH_DEPLOYMENT_BLOCK
      ? latestBlock - RECENT_SAMPLE_BLOCKS * RECENT_SAMPLE_COUNT
      : RETH_DEPLOYMENT_BLOCK

  for (
    let block = RETH_DEPLOYMENT_BLOCK + 1_000n;
    block < recentStart;
    block += HISTORICAL_SAMPLE_BLOCKS
  ) {
    samples.add(block.toString())
  }
  for (let block = recentStart; block < latestBlock; block += RECENT_SAMPLE_BLOCKS) {
    samples.add(block.toString())
  }
  samples.add(latestBlock.toString())

  return [...samples].map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

export function isRateCacheStale(
  cache: SharedRateCache | null | undefined,
  latestBlock: bigint,
  now = Date.now(),
): boolean {
  if (!cache || cache.version !== RATE_CACHE_VERSION || cache.items.length === 0) return true
  const updatedAt = Date.parse(cache.updatedAt)
  if (!Number.isFinite(updatedAt) || now - updatedAt > STALE_AFTER_MS) return true
  try {
    const through = BigInt(cache.throughBlock)
    if (latestBlock > through && latestBlock - through > STALE_AFTER_BLOCKS) return true
  } catch {
    return true
  }
  return false
}

export function parseSharedRateCache(value: unknown): SharedRateCache | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<SharedRateCache>
  if (raw.version !== RATE_CACHE_VERSION) return null
  if (typeof raw.throughBlock !== 'string' || typeof raw.updatedAt !== 'string') return null
  if (!Array.isArray(raw.items)) return null
  const items: SerializedRatePoint[] = []
  for (const item of raw.items) {
    if (!item || typeof item !== 'object') return null
    const point = item as Partial<SerializedRatePoint>
    if (
      typeof point.blockNumber !== 'string'
      || typeof point.timestamp !== 'number'
      || typeof point.rate !== 'string'
    ) {
      return null
    }
    items.push({
      blockNumber: point.blockNumber,
      timestamp: point.timestamp,
      rate: point.rate,
    })
  }
  return {
    version: RATE_CACHE_VERSION,
    throughBlock: raw.throughBlock,
    updatedAt: raw.updatedAt,
    items,
    ...(raw.stale ? { stale: true } : {}),
  }
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  request: FetchLike,
): Promise<T> {
  const response = await request(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const payload = await response.json() as {
    result?: T
    error?: { message?: string }
  }
  if (!response.ok || payload.error || payload.result === undefined) {
    throw new Error(payload.error?.message ?? `RPC ${method} failed with HTTP ${response.status}.`)
  }
  return payload.result
}

async function readLatestBlock(rpcUrl: string, request: FetchLike): Promise<bigint> {
  const hex = await rpcCall<string>(rpcUrl, 'eth_blockNumber', [], request)
  return BigInt(hex)
}

async function readRateAtBlock(
  rpcUrl: string,
  blockNumber: bigint,
  request: FetchLike,
): Promise<SerializedRatePoint> {
  const blockTag = `0x${blockNumber.toString(16)}`
  const [rateHex, block] = await Promise.all([
    rpcCall<string>(
      rpcUrl,
      'eth_call',
      [{ to: RETH_ADDRESS, data: GET_EXCHANGE_RATE_DATA }, blockTag],
      request,
    ),
    rpcCall<{ timestamp: string }>(
      rpcUrl,
      'eth_getBlockByNumber',
      [blockTag, false],
      request,
    ),
  ])
  return {
    blockNumber: blockNumber.toString(),
    timestamp: Number(BigInt(block.timestamp)),
    rate: BigInt(rateHex).toString(),
  }
}

async function sampleMissingRates(
  rpcUrl: string,
  blocks: bigint[],
  request: FetchLike,
): Promise<SerializedRatePoint[]> {
  const fresh: SerializedRatePoint[] = []
  for (let index = 0; index < blocks.length; index += RATE_SAMPLE_BATCH_SIZE) {
    const batch = blocks.slice(index, index + RATE_SAMPLE_BATCH_SIZE)
    const points = await Promise.all(
      batch.map((blockNumber) => readRateAtBlock(rpcUrl, blockNumber, request)),
    )
    fresh.push(...points)
  }
  return fresh
}

function mergeRateItems(
  existing: SerializedRatePoint[],
  fresh: SerializedRatePoint[],
): SerializedRatePoint[] {
  const deduped = new Map<string, SerializedRatePoint>()
  for (const point of [...existing, ...fresh]) {
    deduped.set(point.blockNumber, point)
  }
  return [...deduped.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export async function readRateCacheFromKv(env: RatesEnv): Promise<SharedRateCache | null> {
  const raw = await env.RATE_HISTORY.get(RATE_KV_KEY, 'json')
  return parseSharedRateCache(raw)
}

export async function refreshSharedRates(
  env: RatesEnv,
  request: FetchLike = fetch,
  now = new Date(),
): Promise<SharedRateCache> {
  const rpcUrl = env.ETHEREUM_RPC_URL?.trim()
  if (!rpcUrl) {
    throw new Error('ETHEREUM_RPC_URL is not configured.')
  }

  const existing = (await readRateCacheFromKv(env)) ?? {
    version: RATE_CACHE_VERSION,
    throughBlock: '0',
    updatedAt: new Date(0).toISOString(),
    items: [],
  }

  const latestBlock = await readLatestBlock(rpcUrl, request)
  const existingBlocks = new Set(existing.items.map((point) => point.blockNumber))
  const missing = buildSharedSampleBlocks(latestBlock)
    .filter((block) => !existingBlocks.has(block.toString()))

  const fresh = missing.length > 0
    ? await sampleMissingRates(rpcUrl, missing, request)
    : []

  const merged: SharedRateCache = {
    version: RATE_CACHE_VERSION,
    throughBlock: latestBlock.toString(),
    updatedAt: now.toISOString(),
    items: mergeRateItems(existing.items, fresh),
  }

  await env.RATE_HISTORY.put(RATE_KV_KEY, JSON.stringify(merged))
  return merged
}

export async function readPublicRates(
  env: RatesEnv,
  request: FetchLike = fetch,
  now = new Date(),
): Promise<SharedRateCache> {
  const cached = await readRateCacheFromKv(env)
  let latestBlock: bigint | null = null

  try {
    const rpcUrl = env.ETHEREUM_RPC_URL?.trim()
    if (rpcUrl) {
      latestBlock = await readLatestBlock(rpcUrl, request)
    }
  } catch {
    latestBlock = null
  }

  const stale = isRateCacheStale(
    cached,
    latestBlock ?? (cached ? BigInt(cached.throughBlock) : 0n),
    now.getTime(),
  )

  if (!stale && cached) return cached

  try {
    return await refreshSharedRates(env, request, now)
  } catch (error) {
    if (cached && cached.items.length > 0) {
      return { ...cached, stale: true }
    }
    throw error
  }
}
