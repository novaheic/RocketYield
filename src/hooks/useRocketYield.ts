import { useCallback, useEffect, useRef, useState } from 'react'
import { buildAnalytics } from '../lib/analytics/timeline'
import { loadRateHistory, loadTransferHistory } from '../lib/chain/history'
import { readCurrentPosition, resolveWallet } from '../lib/chain/client'
import { loadMarketData } from '../lib/market'
import {
  DashboardError,
  type DashboardData,
  type LoadProgress,
} from '../lib/types'

const DAY = 86_400

function normalizeError(error: unknown) {
  if (error instanceof DashboardError) return error
  return new DashboardError(
    'unknown',
    error instanceof Error ? error.message : 'An unexpected error interrupted the live data request.',
    error,
  )
}

export function useRocketYield(input: string) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<DashboardError | null>(null)
  const [progress, setProgress] = useState<LoadProgress>({
    phase: 'idle',
    label: 'Waiting for an address',
  })
  const [revision, setRevision] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    abortRef.current?.abort()
    if (!input.trim()) {
      setData(null)
      setError(null)
      setProgress({ phase: 'idle', label: 'Waiting for an address' })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    async function run() {
      try {
        setError(null)
        setData(null)
        setProgress({ phase: 'resolving', label: 'Resolving address' })
        const resolved = await resolveWallet(input)

        setProgress({ phase: 'current', label: 'Reading current rETH position' })
        const current = await readCurrentPosition(resolved.address)
        const marketPromise = loadMarketData(Number(current.currentRate) / 1e18, controller.signal)

        const transfers = await loadTransferHistory(
          resolved.address,
          current.chainBlock,
          setProgress,
          controller.signal,
        )
        let rates = await loadRateHistory(
          current.chainBlock,
          transfers.map((transfer) => transfer.blockNumber),
          setProgress,
          controller.signal,
        )

        const now = Math.floor(Date.now() / 1000)
        if (!rates.length) {
          throw new DashboardError(
            'archive_required',
            'The RPC returned no Rocket Pool rate history. Use an archive-capable Ethereum endpoint.',
          )
        }
        const update = {
          latest: current.protocolRateUpdatedAt,
          next: current.protocolRateUpdatedAt + DAY,
        }
        if (rates.at(-1)!.rate !== current.currentRate) {
          rates = [
            ...rates,
            {
              blockNumber: current.chainBlock,
              timestamp: now,
              rate: current.currentRate,
            },
          ]
        }

        setProgress({ phase: 'calculating', label: 'Calculating balance-weighted earnings' })
        const analytics = buildAnalytics(transfers, rates, current.currentReth, now)
        const market = await marketPromise

        if (controller.signal.aborted) return
        setData({
          input,
          ...resolved,
          ...current,
          transfers,
          rates,
          analytics,
          market,
          rateUpdatedAt: update.latest,
          expectedNextUpdateAt: update.next,
        })
        setProgress({ phase: 'ready', label: 'Live data ready' })
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(normalizeError(caught))
        setProgress({ phase: 'error', label: 'Live data request failed' })
      }
    }

    void run()
    return () => controller.abort()
  }, [input, revision])

  return { data, error, progress, refresh }
}
