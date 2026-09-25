import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RatePoint } from '../types'

const idb = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

const rpc = vi.hoisted(() => ({
  readContract: vi.fn(),
  getBlock: vi.fn(),
}))

vi.mock('idb-keyval', () => idb)
vi.mock('./client', () => ({
  getMainnetClient: () => rpc,
  mapChainError: (error: unknown, fallback: string) => {
    throw error instanceof Error ? error : new Error(fallback)
  },
}))

import { buildRateSampleBlocks, loadRateHistory } from './history'
import { RETH_DEPLOYMENT_BLOCK } from './contracts'

describe('loadRateHistory shared feed', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', {})
    idb.get.mockReset()
    idb.set.mockReset()
    rpc.readContract.mockReset()
    rpc.getBlock.mockReset()
    idb.get.mockResolvedValue(undefined)
    idb.set.mockResolvedValue(undefined)
  })

  it('only samples transfer blocks when the shared feed is available', async () => {
    const latestBlock = RETH_DEPLOYMENT_BLOCK + 500_000n
    const transferBlock = RETH_DEPLOYMENT_BLOCK + 100_000n
    const fullGridSize = buildRateSampleBlocks(latestBlock, [transferBlock]).length

    const shared: RatePoint[] = [
      {
        blockNumber: RETH_DEPLOYMENT_BLOCK + 1_000n,
        timestamp: 1_600_000_000,
        rate: 10n ** 18n,
      },
      {
        blockNumber: latestBlock - 7_200n,
        timestamp: 1_700_000_000,
        rate: 1_100_000_000_000_000_000n,
      },
    ]

    rpc.readContract.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => {
      return blockNumber === transferBlock ? 1_200_000_000_000_000_000n : 1_300_000_000_000_000_000n
    })
    rpc.getBlock.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => ({
      number: blockNumber,
      timestamp: blockNumber === transferBlock ? 1_650_000_000n : 1_710_000_000n,
    }))

    const labels: string[] = []
    const result = await loadRateHistory(
      latestBlock,
      [transferBlock],
      (progress) => {
        labels.push(progress.label)
      },
      undefined,
      async () => shared,
    )

    expect(fullGridSize).toBeGreaterThan(10)
    expect(rpc.readContract).toHaveBeenCalledTimes(2)
    expect(rpc.readContract.mock.calls.map((call) => call[0].blockNumber).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )).toEqual([transferBlock, latestBlock])
    expect(labels.some((label) => label.includes('shared'))).toBe(true)
    expect(labels.some((label) => label.includes('transfers'))).toBe(true)
    expect(result.map((point) => point.blockNumber.toString())).toEqual(
      expect.arrayContaining([
        shared[0].blockNumber.toString(),
        transferBlock.toString(),
        latestBlock.toString(),
      ]),
    )
  })

  it('falls back to the full sample grid when the shared feed is missing', async () => {
    const latestBlock = RETH_DEPLOYMENT_BLOCK + 500_000n
    const transferBlock = RETH_DEPLOYMENT_BLOCK + 100_000n
    const expectedBlocks = buildRateSampleBlocks(latestBlock, [transferBlock])

    rpc.readContract.mockResolvedValue(10n ** 18n)
    rpc.getBlock.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => ({
      number: blockNumber,
      timestamp: 1_600_000_000n + blockNumber,
    }))

    await loadRateHistory(
      latestBlock,
      [transferBlock],
      () => undefined,
      undefined,
      async () => null,
    )

    expect(rpc.readContract).toHaveBeenCalledTimes(expectedBlocks.length)
  })
})
