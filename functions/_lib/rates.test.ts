// @vitest-environment node
/// <reference types="@cloudflare/workers-types" />

import { describe, expect, it, vi } from 'vitest'
import {
  buildSharedSampleBlocks,
  isRateCacheStale,
  parseSharedRateCache,
  readPublicRates,
  RATE_CACHE_VERSION,
  STALE_AFTER_BLOCKS,
  STALE_AFTER_MS,
  type RatesEnv,
  type SharedRateCache,
} from './rates'

function cache(partial: Partial<SharedRateCache> = {}): SharedRateCache {
  return {
    version: RATE_CACHE_VERSION,
    throughBlock: '20000000',
    updatedAt: new Date().toISOString(),
    items: [
      { blockNumber: '13326322', timestamp: 1_600_000_000, rate: '1000000000000000000' },
      { blockNumber: '20000000', timestamp: 1_700_000_000, rate: '1100000000000000000' },
    ],
    ...partial,
  }
}

describe('shared rate cache helpers', () => {
  it('builds a shared grid without transfer-specific blocks', () => {
    const latest = 20_000_000n
    const blocks = buildSharedSampleBlocks(latest)
    expect(blocks.at(-1)).toBe(latest)
    expect(blocks.length).toBeGreaterThan(90)
    expect(new Set(blocks.map(String)).size).toBe(blocks.length)
  })

  it('parses and rejects malformed shared rate payloads', () => {
    expect(parseSharedRateCache(cache())).toMatchObject({
      version: RATE_CACHE_VERSION,
      throughBlock: '20000000',
    })
    expect(parseSharedRateCache({ version: 999, throughBlock: '1', updatedAt: 'x', items: [] })).toBeNull()
    expect(parseSharedRateCache({
      version: RATE_CACHE_VERSION,
      throughBlock: '1',
      updatedAt: 'x',
      items: [{ blockNumber: 1, timestamp: 1, rate: '1' }],
    })).toBeNull()
  })

  it('marks caches stale by age or block lag', () => {
    const fresh = cache()
    expect(isRateCacheStale(fresh, 20_000_000n)).toBe(false)

    const old = cache({
      updatedAt: new Date(Date.now() - STALE_AFTER_MS - 1).toISOString(),
    })
    expect(isRateCacheStale(old, 20_000_000n)).toBe(true)

    const behind = cache({ throughBlock: '20000000' })
    expect(isRateCacheStale(behind, 20_000_000n + STALE_AFTER_BLOCKS + 1n)).toBe(true)

    expect(isRateCacheStale(cache({ stale: true }), 20_000_000n)).toBe(true)
  })

  it('serves a fresh KV cache without refreshing', async () => {
    const stored = cache()
    const env: RatesEnv = {
      ETHEREUM_RPC_URL: 'https://example.invalid/rpc',
      RATE_HISTORY: {
        get: vi.fn().mockResolvedValue(stored),
        put: vi.fn(),
      } as unknown as KVNamespace,
    }
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: `0x${BigInt(stored.throughBlock).toString(16)}`,
    })))

    const result = await readPublicRates(env, request as unknown as typeof fetch)

    expect(result.items).toHaveLength(2)
    expect(env.RATE_HISTORY.put).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('returns stale cache when refresh fails', async () => {
    const stored = cache({
      updatedAt: new Date(Date.now() - STALE_AFTER_MS - 1).toISOString(),
    })
    const env: RatesEnv = {
      ETHEREUM_RPC_URL: 'https://example.invalid/rpc',
      RATE_HISTORY: {
        get: vi.fn().mockResolvedValue(stored),
        put: vi.fn(),
      } as unknown as KVNamespace,
    }
    const request = vi.fn().mockRejectedValue(new Error('RPC down'))

    const result = await readPublicRates(env, request as unknown as typeof fetch)

    expect(result.stale).toBe(true)
    expect(result.items).toHaveLength(2)
    expect(env.RATE_HISTORY.put).not.toHaveBeenCalled()
  })
})
