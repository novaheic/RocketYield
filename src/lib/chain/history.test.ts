import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
      [{ blockNumber: transferBlock, timestamp: 1_650_000_000 }],
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
    // The transfer's own timestamp is reused; only the latest block needs a header read.
    expect(rpc.getBlock.mock.calls.map((call) => call[0].blockNumber)).toEqual([latestBlock])
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
      [{ blockNumber: transferBlock, timestamp: 0 }],
      () => undefined,
      undefined,
      async () => null,
    )

    expect(rpc.readContract).toHaveBeenCalledTimes(expectedBlocks.length)
    expect(rpc.getBlock).toHaveBeenCalledTimes(expectedBlocks.length)
  })
})

describe('loadRateHistory resilience', () => {
  const latestBlock = RETH_DEPLOYMENT_BLOCK + 500_000n
  const shared: RatePoint[] = [
    { blockNumber: RETH_DEPLOYMENT_BLOCK + 1_000n, timestamp: 1_600_000_000, rate: 10n ** 18n },
  ]
  const transfers = Array.from({ length: 12 }, (_, index) => ({
    blockNumber: RETH_DEPLOYMENT_BLOCK + 10_000n * BigInt(index + 1),
    timestamp: 1_610_000_000 + index,
  }))

  beforeEach(() => {
    vi.stubGlobal('indexedDB', {})
    idb.get.mockReset()
    idb.set.mockReset()
    rpc.readContract.mockReset()
    rpc.getBlock.mockReset()
    idb.get.mockResolvedValue(undefined)
    idb.set.mockResolvedValue(undefined)
    rpc.getBlock.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => ({
      number: blockNumber,
      timestamp: 1_700_000_000n,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries a transiently failing sample on its own and completes', async () => {
    vi.useFakeTimers()
    const flaky = transfers[3].blockNumber
    let flakyFailures = 0
    rpc.readContract.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => {
      if (blockNumber === flaky && flakyFailures < 2) {
        flakyFailures += 1
        throw new Error('The request took too long to respond.')
      }
      return 10n ** 18n + blockNumber
    })

    const pending = loadRateHistory(latestBlock, transfers, () => undefined, undefined, async () => shared)
    await vi.runAllTimersAsync()
    const result = await pending

    const calls = rpc.readContract.mock.calls.map((call) => call[0].blockNumber)
    expect(calls.filter((block) => block === flaky)).toHaveLength(3)
    expect(calls.filter((block) => block !== flaky)).toHaveLength(transfers.length)
    expect(result.map((point) => point.blockNumber)).toEqual(expect.arrayContaining([flaky, latestBlock]))
  })

  it('does not retry errors that are not transient', async () => {
    const broken = transfers[0].blockNumber
    rpc.readContract.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => {
      if (blockNumber === broken) throw new Error('execution reverted')
      return 10n ** 18n
    })

    await expect(
      loadRateHistory(latestBlock, transfers, () => undefined, undefined, async () => shared),
    ).rejects.toThrow('execution reverted')
    expect(rpc.readContract.mock.calls.filter((call) => call[0].blockNumber === broken)).toHaveLength(1)
  })

  it('saves partial progress so a retry only samples what is missing', async () => {
    const broken = transfers[10].blockNumber
    rpc.readContract.mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => {
      if (blockNumber === broken) throw new Error('execution reverted')
      return 10n ** 18n
    })

    await expect(
      loadRateHistory(latestBlock, transfers, () => undefined, undefined, async () => shared),
    ).rejects.toThrow()

    const saved = idb.set.mock.calls.at(-1)?.[1] as { items: RatePoint[] }
    const savedBlocks = saved.items.map((point) => point.blockNumber)
    expect(savedBlocks).toEqual(expect.arrayContaining(transfers.slice(0, 10).map((t) => t.blockNumber)))
    expect(savedBlocks).not.toContain(broken)

    idb.get.mockResolvedValue(saved)
    rpc.readContract.mockReset()
    rpc.readContract.mockResolvedValue(10n ** 18n)

    await loadRateHistory(latestBlock, transfers, () => undefined, undefined, async () => shared)

    const retried = rpc.readContract.mock.calls.map((call) => call[0].blockNumber)
    expect(retried).toContain(broken)
    expect(retried).not.toContain(transfers[0].blockNumber)
    expect(retried.length).toBeLessThan(transfers.length)
  })
})
