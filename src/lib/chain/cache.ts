import { get, set } from 'idb-keyval'
import type { Address } from 'viem'
import type { RatePoint, TransferPoint } from '../types'

const CACHE_VERSION = 2

interface CachedTransfers {
  version: number
  throughBlock: bigint
  items: TransferPoint[]
}

interface CachedRates {
  version: number
  throughBlock: bigint
  items: RatePoint[]
}

async function safeGet<T>(key: string): Promise<T | undefined> {
  if (typeof indexedDB === 'undefined') return undefined
  try {
    return await get<T>(key)
  } catch {
    return undefined
  }
}

async function safeSet<T>(key: string, value: T): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    await set(key, value)
  } catch {
    // Caching is an optimization; private browsing must not break live reads.
  }
}

export async function readTransferCache(address: Address) {
  const cached = await safeGet<CachedTransfers>(`ry:${CACHE_VERSION}:transfers:${address.toLowerCase()}`)
  return cached?.version === CACHE_VERSION ? cached : undefined
}

export async function writeTransferCache(address: Address, throughBlock: bigint, items: TransferPoint[]) {
  await safeSet<CachedTransfers>(`ry:${CACHE_VERSION}:transfers:${address.toLowerCase()}`, {
    version: CACHE_VERSION,
    throughBlock,
    items,
  })
}

export async function readRateCache() {
  const cached = await safeGet<CachedRates>(`ry:${CACHE_VERSION}:rates`)
  return cached?.version === CACHE_VERSION ? cached : undefined
}

export async function writeRateCache(throughBlock: bigint, items: RatePoint[]) {
  await safeSet<CachedRates>(`ry:${CACHE_VERSION}:rates`, {
    version: CACHE_VERSION,
    throughBlock,
    items,
  })
}
