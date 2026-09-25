import type { DailyEarningsLedgerEntry, RatePoint, TransferPoint } from '../types'
import { WAD, toEthNumber } from './units'

const DAY_SECONDS = 86_400
const YEAR_DAYS = 365

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp * 1000)
  date.setHours(0, 0, 0, 0)
  return Math.floor(date.getTime() / 1000)
}

function nextLocalDay(timestamp: number) {
  const date = new Date(timestamp * 1000)
  date.setDate(date.getDate() + 1)
  date.setHours(0, 0, 0, 0)
  return Math.floor(date.getTime() / 1000)
}

function localDateKey(timestamp: number) {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function rateAt(rates: RatePoint[], timestamp: number) {
  if (timestamp <= rates[0].timestamp) return rates[0].rate
  const latest = rates.at(-1)!
  if (timestamp >= latest.timestamp) return latest.rate

  let low = 0
  let high = rates.length - 1
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (rates[middle].timestamp <= timestamp) low = middle
    else high = middle
  }

  const before = rates[low]
  const after = rates[high]
  const elapsed = BigInt(timestamp - before.timestamp)
  const duration = BigInt(after.timestamp - before.timestamp)
  return before.rate + ((after.rate - before.rate) * elapsed) / duration
}

function positiveEarnings(balance: bigint, startRate: bigint, endRate: bigint) {
  if (balance <= 0n || endRate <= startRate) return 0n
  return (balance * (endRate - startRate)) / WAD
}

function annualizedRate(startRate: bigint, endRate: bigint, elapsedSeconds: number) {
  if (startRate <= 0n || endRate <= startRate || elapsedSeconds <= 0) return 0
  const growth = Number(endRate - startRate) / Number(startRate)
  return growth * ((YEAR_DAYS * DAY_SECONDS) / elapsedSeconds)
}

function sortTransfers(transfers: TransferPoint[]) {
  return [...transfers].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1
    return a.logIndex - b.logIndex
  })
}

function sortRates(rates: RatePoint[]) {
  return [...rates]
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Balance-weighted earnings over [start, end] using the same linear rate allocation
 * and transfer splits as the daily ledger.
 */
function earningsBetween(
  transfers: TransferPoint[],
  rates: RatePoint[],
  start: number,
  end: number,
): bigint {
  if (rates.length < 1 || end <= start) return 0n

  const sortedTransfers = sortTransfers(transfers)
  let balance = 0n
  let transferIndex = 0
  while (
    transferIndex < sortedTransfers.length &&
    sortedTransfers[transferIndex].timestamp <= start
  ) {
    balance += sortedTransfers[transferIndex].delta
    transferIndex += 1
  }

  let segmentStart = start
  let earned = 0n

  while (
    transferIndex < sortedTransfers.length &&
    sortedTransfers[transferIndex].timestamp < end
  ) {
    const transferTimestamp = Math.max(sortedTransfers[transferIndex].timestamp, segmentStart)
    earned += positiveEarnings(
      balance,
      rateAt(rates, segmentStart),
      rateAt(rates, transferTimestamp),
    )

    const timestamp = sortedTransfers[transferIndex].timestamp
    while (
      transferIndex < sortedTransfers.length &&
      sortedTransfers[transferIndex].timestamp === timestamp
    ) {
      balance += sortedTransfers[transferIndex].delta
      transferIndex += 1
    }
    segmentStart = transferTimestamp
  }

  earned += positiveEarnings(balance, rateAt(rates, segmentStart), rateAt(rates, end))
  return earned
}

function balanceAfter(transfers: TransferPoint[], timestamp: number) {
  let balance = 0n
  for (const transfer of sortTransfers(transfers)) {
    if (transfer.timestamp > timestamp) break
    balance += transfer.delta
  }
  return balance
}

function tickStartForToday(
  transfers: TransferPoint[],
  dayStart: number,
  lastRateTimestamp: number,
  now: number,
) {
  if (lastRateTimestamp >= dayStart) return Math.min(Math.max(dayStart, lastRateTimestamp), now)

  if (balanceAfter(transfers, dayStart) > 0n) return dayStart

  for (const transfer of sortTransfers(transfers)) {
    if (transfer.timestamp < dayStart) continue
    if (transfer.timestamp > now) break
    if (balanceAfter(transfers, transfer.timestamp) > 0n) return transfer.timestamp
  }

  return now
}

export interface TodayEarningsEstimate {
  /** Ledger-style ETH earned from local midnight through the last known rate sample. */
  realizedEth: number
  /** Unix seconds after which `ethPerSecond` should be accrued. */
  tickFrom: number
  /** Realized + smoothed accrual evaluated at `now`. */
  ethAt: number
}

/**
 * Live-friendly "today so far" estimate: transfer-aware earnings since local midnight
 * through the latest rate sample, plus optional smoothed accrual afterward.
 */
export function estimateTodayEarnings(
  transfers: TransferPoint[],
  rates: RatePoint[],
  ethPerSecond: number,
  now = Math.floor(Date.now() / 1000),
): TodayEarningsEstimate {
  const dayStart = startOfLocalDay(now)
  const sortedRates = sortRates(rates)
  const lastRateTimestamp = sortedRates.at(-1)?.timestamp ?? dayStart
  const realizedEnd = Math.min(now, Math.max(dayStart, lastRateTimestamp))
  const realized = sortedRates.length >= 1
    ? earningsBetween(transfers, sortedRates, dayStart, realizedEnd)
    : 0n
  const realizedEth = toEthNumber(realized)
  const tickFrom = tickStartForToday(transfers, dayStart, lastRateTimestamp, now)
  const accrued = Math.max(0, ethPerSecond) * Math.max(0, now - tickFrom)
  return {
    realizedEth,
    tickFrom,
    ethAt: realizedEth + accrued,
  }
}

/**
 * Builds completed browser-local calendar-day earnings without adding historical RPC reads.
 * Rate growth between sampled points is allocated linearly, while transfers split
 * each day so only the balance actually held earns during each sub-interval.
 */
export function buildDailyEarningsLedger(
  transfers: TransferPoint[],
  rates: RatePoint[],
  now = Math.floor(Date.now() / 1000),
): DailyEarningsLedgerEntry[] {
  if (rates.length < 2) return []

  const sortedRates = sortRates(rates)
  if (sortedRates.length < 2) return []

  const sortedTransfers = sortTransfers(transfers)

  const firstTimestamp = sortedRates[0].timestamp
  const lastTimestamp = Math.min(now, sortedRates.at(-1)!.timestamp)
  if (lastTimestamp <= firstTimestamp) return []

  let balance = 0n
  let transferIndex = 0
  while (
    transferIndex < sortedTransfers.length &&
    sortedTransfers[transferIndex].timestamp <= firstTimestamp
  ) {
    balance += sortedTransfers[transferIndex].delta
    transferIndex += 1
  }

  const entries: DailyEarningsLedgerEntry[] = []
  let cursor = firstTimestamp

  while (cursor < lastTimestamp) {
    const dayTimestamp = startOfLocalDay(cursor)
    const localDayEnd = nextLocalDay(dayTimestamp)
    const dayEnd = Math.min(localDayEnd, lastTimestamp)
    let segmentStart = cursor
    let earned = 0n

    while (
      transferIndex < sortedTransfers.length &&
      sortedTransfers[transferIndex].timestamp < dayEnd
    ) {
      const transferTimestamp = Math.max(sortedTransfers[transferIndex].timestamp, segmentStart)
      earned += positiveEarnings(
        balance,
        rateAt(sortedRates, segmentStart),
        rateAt(sortedRates, transferTimestamp),
      )

      const timestamp = sortedTransfers[transferIndex].timestamp
      while (
        transferIndex < sortedTransfers.length &&
        sortedTransfers[transferIndex].timestamp === timestamp
      ) {
        balance += sortedTransfers[transferIndex].delta
        transferIndex += 1
      }
      segmentStart = transferTimestamp
    }

    const startRate = rateAt(sortedRates, cursor)
    const endRate = rateAt(sortedRates, dayEnd)
    earned += positiveEarnings(balance, rateAt(sortedRates, segmentStart), endRate)

    if (earned > 0n && dayEnd === localDayEnd) {
      entries.push({
        date: localDateKey(dayTimestamp),
        timestamp: dayTimestamp,
        earnedEth: toEthNumber(earned),
        annualizedYield: annualizedRate(startRate, endRate, dayEnd - cursor),
        balanceEth: toEthNumber((balance * endRate) / WAD),
      })
    }

    cursor = dayEnd
  }

  return entries.reverse()
}
