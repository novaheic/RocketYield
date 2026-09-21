import type {
  Analytics,
  DailyEarning,
  EarningsWindows,
  Milestone,
  Projections,
  RatePoint,
  TransferPoint,
  ValuePoint,
  YieldRates,
} from '../types'

export const WAD = 10n ** 18n
const DAY = 86_400

interface EarningEvent {
  timestamp: number
  earned: bigint
}

export function toEthNumber(value: bigint) {
  return Number(value) / 1e18
}

function rateAtOrBefore(rates: RatePoint[], timestamp: number) {
  let selected = rates[0]
  for (const rate of rates) {
    if (rate.timestamp > timestamp) break
    selected = rate
  }
  return selected
}

function calculateYield(rates: RatePoint[], days: number, now: number) {
  const latest = rates.at(-1)
  const start = rateAtOrBefore(rates, now - days * DAY)
  if (!latest || !start || start.rate === 0n || latest.timestamp === start.timestamp) return { apr: 0, apy: 0 }
  const elapsedDays = Math.max((latest.timestamp - start.timestamp) / DAY, 1)
  const growth = Number(latest.rate - start.rate) / Number(start.rate)
  const apr = growth * (365 / elapsedDays)
  const apy = Math.pow(1 + growth, 365 / elapsedDays) - 1
  return { apr, apy }
}

function sumSince(events: EarningEvent[], timestamp: number) {
  return events.reduce((sum, event) => (event.timestamp >= timestamp ? sum + event.earned : sum), 0n)
}

function startOfToday(timestamp: number) {
  const date = new Date(timestamp * 1000)
  date.setHours(0, 0, 0, 0)
  return Math.floor(date.getTime() / 1000)
}

function toWei(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0n
  return BigInt(Math.round(value * 1e18))
}

function projectionFromDaily(dailyEth: number): Projections['current'] {
  return {
    day: toWei(dailyEth),
    month: toWei(dailyEth * 30.4375),
    year: toWei(dailyEth * 365),
  }
}

function nextMilestone(lifetime: bigint, dailyEth: number): Milestone | null {
  const earned = toEthNumber(lifetime)
  const targets = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100]
  const targetEth = targets.find((target) => target > earned + 1e-12)
  if (!targetEth) return null
  const remainingEth = targetEth - earned
  return {
    targetEth,
    remainingEth,
    etaDays: dailyEth > 0 ? remainingEth / dailyEth : null,
  }
}

export function buildAnalytics(
  transfers: TransferPoint[],
  rates: RatePoint[],
  currentBalance: bigint,
  now = Math.floor(Date.now() / 1000),
): Analytics {
  const sortedTransfers = [...transfers].sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
  )
  const sortedRates = [...rates].sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.timestamp - b.timestamp : a.blockNumber < b.blockNumber ? -1 : 1,
  )

  let transferIndex = 0
  let balance = 0n
  let previousRate: RatePoint | undefined
  const earningEvents: EarningEvent[] = []
  const valueSeries: ValuePoint[] = []

  for (const rate of sortedRates) {
    while (
      transferIndex < sortedTransfers.length &&
      sortedTransfers[transferIndex].blockNumber < rate.blockNumber
    ) {
      balance += sortedTransfers[transferIndex].delta
      transferIndex += 1
    }

    if (previousRate && rate.rate > previousRate.rate && balance > 0n) {
      earningEvents.push({
        timestamp: rate.timestamp,
        earned: (balance * (rate.rate - previousRate.rate)) / WAD,
      })
    }
    while (
      transferIndex < sortedTransfers.length &&
      sortedTransfers[transferIndex].blockNumber === rate.blockNumber
    ) {
      balance += sortedTransfers[transferIndex].delta
      transferIndex += 1
    }
    valueSeries.push({
      timestamp: rate.timestamp,
      valueEth: toEthNumber((balance * rate.rate) / WAD),
      balanceReth: toEthNumber(balance),
    })
    previousRate = rate
  }

  const lifetime = earningEvents.reduce((sum, item) => sum + item.earned, 0n)
  const earnings: EarningsWindows = {
    today: sumSince(earningEvents, startOfToday(now)),
    sevenDays: sumSince(earningEvents, now - 7 * DAY),
    thirtyDays: sumSince(earningEvents, now - 30 * DAY),
    ninetyDays: sumSince(earningEvents, now - 90 * DAY),
    lifetime,
  }

  const dailyMap = new Map<number, bigint>()
  for (const event of earningEvents) {
    const day = Math.floor(event.timestamp / DAY) * DAY
    dailyMap.set(day, (dailyMap.get(day) ?? 0n) + event.earned)
  }
  const dailyEarnings: DailyEarning[] = [...dailyMap.entries()]
    .map(([timestamp, earned]) => ({ timestamp, earnedEth: toEthNumber(earned) }))
    .sort((a, b) => a.timestamp - b.timestamp)

  const sevenDayYield = calculateYield(sortedRates, 7, now)
  const thirtyDayYield = calculateYield(sortedRates, 30, now)
  const yields: YieldRates = {
    apr7d: sevenDayYield.apr,
    apy7d: sevenDayYield.apy,
    apr30d: thirtyDayYield.apr,
    apy30d: thirtyDayYield.apy,
  }

  const currentEth = previousRate ? toEthNumber((currentBalance * previousRate.rate) / WAD) : 0
  const currentDaily = currentEth * (sevenDayYield.apr / 365)
  const averageDaily = toEthNumber(earnings.thirtyDays) / 30
  const projections: Projections = {
    current: projectionFromDaily(currentDaily),
    thirtyDayAverage: projectionFromDaily(averageDaily),
  }

  return {
    earnings,
    yields,
    projections,
    rateSeries: sortedRates,
    valueSeries,
    dailyEarnings,
    milestone: nextMilestone(lifetime, currentDaily),
    smoothedEthPerSecond: currentDaily / DAY,
  }
}
