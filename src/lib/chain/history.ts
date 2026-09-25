import type { Address, Hash, Log } from 'viem'
import type { LoadProgress, RatePoint, TransferPoint } from '../types'
import {
  RETH_ABI,
  RETH_ADDRESS,
  RETH_DEPLOYMENT_BLOCK,
} from './contracts'
import {
  getMainnetClient,
  mapChainError,
} from './client'
import {
  readRateCache,
  readTransferCache,
  writeRateCache,
  writeTransferCache,
} from './cache'

const LOG_BLOCK_CHUNK = 200_000n
const MIN_LOG_BLOCK_CHUNK = 2_000n
const BLOCK_BATCH_SIZE = 16
const RATE_SAMPLE_BATCH_SIZE = 8
const RECENT_SAMPLE_BLOCKS = 7_200n
const RECENT_SAMPLE_COUNT = 90n
const HISTORICAL_SAMPLE_BLOCKS = 216_000n
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const RATE_LIMIT_RETRY_MS = 500

export type SharedRatesFetcher = (signal?: AbortSignal) => Promise<RatePoint[] | null>

type ProgressCallback = (progress: LoadProgress) => void

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('The request was cancelled.', 'AbortError')
}

function ranges(fromBlock: bigint, toBlock: bigint) {
  const output: Array<{ fromBlock: bigint; toBlock: bigint }> = []
  for (let start = fromBlock; start <= toBlock; start += LOG_BLOCK_CHUNK) {
    output.push({
      fromBlock: start,
      toBlock: start + LOG_BLOCK_CHUNK - 1n > toBlock ? toBlock : start + LOG_BLOCK_CHUNK - 1n,
    })
  }
  return output
}

function isRangeLimitError(error: unknown) {
  let current: unknown = error
  const messages: string[] = []
  const codes: number[] = []

  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const item = current as {
      message?: unknown
      details?: unknown
      shortMessage?: unknown
      code?: unknown
      cause?: unknown
    }
    for (const value of [item.message, item.details, item.shortMessage]) {
      if (typeof value === 'string') messages.push(value.toLowerCase())
    }
    if (typeof item.code === 'number') codes.push(item.code)
    current = item.cause
  }

  const text = messages.join(' ')
  return (
    codes.includes(-32602) ||
    codes.includes(-32005) ||
    text.includes('block range') ||
    text.includes('response size') ||
    text.includes('query returned more') ||
    text.includes('too many results') ||
    text.includes('limit exceeded')
  )
}

async function readLogsAdaptive<T>(
  fromBlock: bigint,
  toBlock: bigint,
  request: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<readonly T[]>,
  signal?: AbortSignal,
): Promise<T[]> {
  throwIfAborted(signal)
  try {
    return [...await request({ fromBlock, toBlock })]
  } catch (error) {
    const blockCount = toBlock - fromBlock + 1n
    if (!isRangeLimitError(error) || blockCount <= MIN_LOG_BLOCK_CHUNK) throw error

    const midpoint = fromBlock + (toBlock - fromBlock) / 2n
    const left = await readLogsAdaptive(fromBlock, midpoint, request, signal)
    const right = await readLogsAdaptive(midpoint + 1n, toBlock, request, signal)
    return [...left, ...right]
  }
}

interface AlchemyTransfer {
  blockNum: string
  uniqueId: string
  hash: Hash
  from: Address
  to: Address | null
  rawContract: { value: string | null }
  metadata?: { blockTimestamp?: string }
}

interface AlchemyTransfersResult {
  transfers: AlchemyTransfer[]
  pageKey?: string
}

function isAlchemyEndpoint() {
  return import.meta.env.VITE_ETHEREUM_RPC_URL?.includes('alchemy.com')
}

async function alchemyRequest<T>(method: string, params: unknown[], signal?: AbortSignal): Promise<T> {
  const response = await fetch(import.meta.env.VITE_ETHEREUM_RPC_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal,
  })
  const payload = await response.json() as {
    result?: T
    error?: { message?: string }
  }
  if (!response.ok || payload.error || payload.result === undefined) {
    throw new Error(payload.error?.message ?? `Alchemy request failed with HTTP ${response.status}.`)
  }
  return payload.result
}

async function readAlchemyTransfers(
  address: Address,
  direction: 'incoming' | 'outgoing',
  fromBlock: bigint,
  latestBlock: bigint,
  signal?: AbortSignal,
) {
  const transfers: AlchemyTransfer[] = []
  let pageKey: string | undefined

  for (let page = 0; page < 100; page += 1) {
    throwIfAborted(signal)
    const request: Record<string, unknown> = {
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${latestBlock.toString(16)}`,
      contractAddresses: [RETH_ADDRESS],
      category: ['erc20'],
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: '0x3e8',
      ...(direction === 'incoming' ? { toAddress: address } : { fromAddress: address }),
      ...(pageKey ? { pageKey } : {}),
    }
    const result = await alchemyRequest<AlchemyTransfersResult>(
      'alchemy_getAssetTransfers',
      [request],
      signal,
    )
    transfers.push(...result.transfers)
    pageKey = result.pageKey
    if (!pageKey) return transfers
  }

  throw new Error('Alchemy returned more than 100 pages of rETH transfers for this address.')
}

function alchemyLogIndex(uniqueId: string) {
  const value = uniqueId.split(':').at(-1)
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function blockTimestamps(blockNumbers: bigint[], signal?: AbortSignal) {
  const rpc = getMainnetClient()
  const unique = [...new Set(blockNumbers.map(String))].map(BigInt)
  const timestamps = new Map<bigint, number>()

  for (let index = 0; index < unique.length; index += BLOCK_BATCH_SIZE) {
    throwIfAborted(signal)
    const batch = unique.slice(index, index + BLOCK_BATCH_SIZE)
    const blocks = await Promise.all(batch.map((blockNumber) => rpc.getBlock({ blockNumber })))
    blocks.forEach((block) => timestamps.set(block.number, Number(block.timestamp)))
  }
  return timestamps
}

export async function loadTransferHistory(
  address: Address,
  latestBlock: bigint,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<TransferPoint[]> {
  const rpc = getMainnetClient()
  const cached = await readTransferCache(address)
  const existing = cached?.items ?? []
  const fromBlock = cached ? cached.throughBlock + 1n : RETH_DEPLOYMENT_BLOCK
  if (fromBlock > latestBlock) return existing

  if (isAlchemyEndpoint()) {
    try {
      onProgress({
        phase: 'transfers',
        label: 'Reading rETH transfers through Alchemy',
        completed: 0,
        total: 2,
      })
      const [incoming, outgoing] = await Promise.all([
        readAlchemyTransfers(address, 'incoming', fromBlock, latestBlock, signal),
        readAlchemyTransfers(address, 'outgoing', fromBlock, latestBlock, signal),
      ])
      const fresh = [...incoming, ...outgoing].map((transfer) => {
        const from = transfer.from
        const to = (transfer.to ?? ZERO_ADDRESS) as Address
        const value = BigInt(transfer.rawContract.value ?? '0x0')
        const isIncoming = to.toLowerCase() === address.toLowerCase()
        const isOutgoing = from.toLowerCase() === address.toLowerCase()
        return {
          blockNumber: BigInt(transfer.blockNum),
          transactionHash: transfer.hash,
          logIndex: alchemyLogIndex(transfer.uniqueId),
          timestamp: transfer.metadata?.blockTimestamp
            ? Math.floor(Date.parse(transfer.metadata.blockTimestamp) / 1000)
            : 0,
          from,
          to,
          value,
          delta: (isIncoming ? value : 0n) - (isOutgoing ? value : 0n),
        } satisfies TransferPoint
      })
      const deduped = new Map<string, TransferPoint>()
      for (const transfer of [...existing, ...fresh]) {
        deduped.set(`${transfer.transactionHash}:${transfer.logIndex}`, transfer)
      }
      const merged = [...deduped.values()].sort((a, b) =>
        a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
      )
      await writeTransferCache(address, latestBlock, merged)
      onProgress({
        phase: 'transfers',
        label: `${merged.length.toLocaleString()} transfers indexed`,
        completed: 2,
        total: 2,
      })
      return merged
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw mapChainError(error, 'Could not reconstruct this address’s rETH transfer history.')
    }
  }

  const chunks = ranges(fromBlock, latestBlock)
  const raw = new Map<string, Log<bigint, number, false, typeof RETH_ABI[2]>>()

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      throwIfAborted(signal)
      const range = chunks[index]
      onProgress({
        phase: 'transfers',
        label: 'Reading rETH transfers',
        completed: index,
        total: chunks.length,
      })
      const [incoming, outgoing] = await Promise.all([
        readLogsAdaptive(
          range.fromBlock,
          range.toBlock,
          (blockRange) =>
            rpc.getLogs({
              address: RETH_ADDRESS,
              event: RETH_ABI[2],
              args: { to: address },
              ...blockRange,
            }),
          signal,
        ),
        readLogsAdaptive(
          range.fromBlock,
          range.toBlock,
          (blockRange) =>
            rpc.getLogs({
              address: RETH_ADDRESS,
              event: RETH_ABI[2],
              args: { from: address },
              ...blockRange,
            }),
          signal,
        ),
      ])

      for (const log of [...incoming, ...outgoing]) {
        raw.set(`${log.transactionHash}:${log.logIndex}`, log)
      }
    }

    const timestamps = await blockTimestamps(
      [...raw.values()].map((log) => log.blockNumber),
      signal,
    )
    const fresh = [...raw.values()].map((log) => {
      const from = log.args.from!
      const to = log.args.to!
      const value = log.args.value!
      const isIncoming = to.toLowerCase() === address.toLowerCase()
      const isOutgoing = from.toLowerCase() === address.toLowerCase()
      return {
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash!,
        logIndex: log.logIndex,
        timestamp: timestamps.get(log.blockNumber) ?? 0,
        from,
        to,
        value,
        delta: (isIncoming ? value : 0n) - (isOutgoing ? value : 0n),
      } satisfies TransferPoint
    })

    const merged = [...existing, ...fresh]
      .filter((item) => item.from !== ZERO_ADDRESS || item.to !== ZERO_ADDRESS)
      .sort((a, b) =>
        a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
      )
    await writeTransferCache(address, latestBlock, merged)
    onProgress({
      phase: 'transfers',
      label: `${merged.length.toLocaleString()} transfers indexed`,
      completed: chunks.length,
      total: chunks.length,
    })
    return merged
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw mapChainError(error, 'Could not reconstruct this address’s rETH transfer history.')
  }
}

export function buildRateSampleBlocks(latestBlock: bigint, transferBlocks: bigint[]) {
  const samples = new Set<string>()
  const recentStart = latestBlock - RECENT_SAMPLE_BLOCKS * RECENT_SAMPLE_COUNT > RETH_DEPLOYMENT_BLOCK
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
  for (const block of transferBlocks) {
    if (block >= RETH_DEPLOYMENT_BLOCK && block <= latestBlock) samples.add(block.toString())
  }
  samples.add(latestBlock.toString())

  return [...samples].map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
}

function buildTransferFillBlocks(latestBlock: bigint, transferBlocks: bigint[]) {
  const samples = new Set<string>()
  for (const block of transferBlocks) {
    if (block >= RETH_DEPLOYMENT_BLOCK && block <= latestBlock) samples.add(block.toString())
  }
  samples.add(latestBlock.toString())
  return [...samples].map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
}

function mergeRatePoints(points: RatePoint[]) {
  const deduped = new Map<string, RatePoint>()
  for (const point of points) {
    deduped.set(point.blockNumber.toString(), point)
  }
  return [...deduped.values()].sort((a, b) => a.timestamp - b.timestamp)
}

function parseSharedRateResponse(payload: unknown): RatePoint[] | null {
  if (!payload || typeof payload !== 'object') return null
  const items = (payload as { items?: unknown }).items
  if (!Array.isArray(items) || items.length === 0) return null
  const points: RatePoint[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') return null
    const raw = item as { blockNumber?: unknown; timestamp?: unknown; rate?: unknown }
    if (
      typeof raw.blockNumber !== 'string'
      || typeof raw.timestamp !== 'number'
      || typeof raw.rate !== 'string'
    ) {
      return null
    }
    try {
      points.push({
        blockNumber: BigInt(raw.blockNumber),
        timestamp: raw.timestamp,
        rate: BigInt(raw.rate),
      })
    } catch {
      return null
    }
  }
  return points
}

export async function fetchSharedRates(signal?: AbortSignal): Promise<RatePoint[] | null> {
  try {
    const response = await fetch('/api/rates', { signal })
    if (!response.ok) return null
    return parseSharedRateResponse(await response.json())
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return null
  }
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  return lower.includes('429') || lower.includes('rate limit')
}

async function sampleRatesAtBlocks(
  blocks: bigint[],
  onProgress: ProgressCallback,
  label: string,
  signal?: AbortSignal,
): Promise<RatePoint[]> {
  const rpc = getMainnetClient()
  const fresh: RatePoint[] = []

  for (let index = 0; index < blocks.length; index += RATE_SAMPLE_BATCH_SIZE) {
    throwIfAborted(signal)
    onProgress({
      phase: 'rates',
      label,
      completed: index,
      total: blocks.length,
    })
    const batch = blocks.slice(index, index + RATE_SAMPLE_BATCH_SIZE)

    let attempt = 0
    while (true) {
      try {
        const points = await Promise.all(
          batch.map(async (blockNumber) => {
            const [rate, block] = await Promise.all([
              rpc.readContract({
                address: RETH_ADDRESS,
                abi: RETH_ABI,
                functionName: 'getExchangeRate',
                blockNumber,
              }),
              rpc.getBlock({ blockNumber }),
            ])
            return {
              blockNumber,
              timestamp: Number(block.timestamp),
              rate,
            } satisfies RatePoint
          }),
        )
        fresh.push(...points)
        break
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        if (!isRateLimitError(error) || attempt >= 1) throw error
        attempt += 1
        await new Promise((resolve) => window.setTimeout(resolve, RATE_LIMIT_RETRY_MS))
      }
    }
  }

  return fresh
}

export async function loadRateHistory(
  latestBlock: bigint,
  transferBlocks: bigint[],
  onProgress: ProgressCallback,
  signal?: AbortSignal,
  fetchShared: SharedRatesFetcher = fetchSharedRates,
): Promise<RatePoint[]> {
  const cached = await readRateCache()
  let existing = cached?.items ?? []

  try {
    onProgress({
      phase: 'rates',
      label: 'Loading shared Rocket Pool rates',
      completed: 0,
      total: 1,
    })
    const shared = await fetchShared(signal)
    const usedSharedFeed = Boolean(shared?.length)
    if (shared?.length) {
      existing = mergeRatePoints([...existing, ...shared])
      onProgress({
        phase: 'rates',
        label: 'Loading shared Rocket Pool rates',
        completed: 1,
        total: 1,
      })
    }

    const existingBlocks = new Set(existing.map((point) => point.blockNumber.toString()))
    const sampleBlocks = (
      usedSharedFeed
        ? buildTransferFillBlocks(latestBlock, transferBlocks)
        : buildRateSampleBlocks(latestBlock, transferBlocks)
    ).filter((block) => !existingBlocks.has(block.toString()))

    const fresh = sampleBlocks.length > 0
      ? await sampleRatesAtBlocks(
        sampleBlocks,
        onProgress,
        usedSharedFeed
          ? 'Filling rates at your transfers'
          : 'Sampling historical Rocket Pool rates',
        signal,
      )
      : []

    const merged = mergeRatePoints([...existing, ...fresh])
    await writeRateCache(latestBlock, merged)
    onProgress({
      phase: 'rates',
      label: `${merged.length.toLocaleString()} rate points indexed`,
      completed: sampleBlocks.length,
      total: sampleBlocks.length,
    })
    return merged
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw mapChainError(error, 'Could not reconstruct Rocket Pool’s exchange-rate history.')
  }
}

export function transferMarkerLabel(transfer: TransferPoint, address: Address) {
  const incoming = transfer.to.toLowerCase() === address.toLowerCase()
  return `${incoming ? 'Received' : 'Sent'} in ${transfer.transactionHash.slice(0, 8)}…`
}

export type TransferLogIdentity = { transactionHash: Hash; logIndex: number }
