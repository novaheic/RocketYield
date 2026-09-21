import type { Address, Hash } from 'viem'

export const FIAT_CURRENCIES = ['USD', 'EUR', 'AUD', 'CAD', 'CNY', 'GBP', 'JPY', 'KRW'] as const

export type FiatCurrency = (typeof FIAT_CURRENCIES)[number]

export type LoadPhase =
  | 'idle'
  | 'resolving'
  | 'current'
  | 'transfers'
  | 'rates'
  | 'calculating'
  | 'ready'
  | 'error'

export interface LoadProgress {
  phase: LoadPhase
  label: string
  completed?: number
  total?: number
}

export interface TransferPoint {
  blockNumber: bigint
  transactionHash: Hash
  logIndex: number
  timestamp: number
  from: Address
  to: Address
  value: bigint
  delta: bigint
}

export interface RatePoint {
  blockNumber: bigint
  timestamp: number
  rate: bigint
}

export interface ValuePoint {
  timestamp: number
  valueEth: number
  balanceReth: number
}

export interface DailyEarning {
  timestamp: number
  earnedEth: number
}

export interface EarningsWindows {
  today: bigint
  sevenDays: bigint
  thirtyDays: bigint
  ninetyDays: bigint
  lifetime: bigint
}

export interface YieldRates {
  apr7d: number
  apy7d: number
  apr30d: number
  apy30d: number
}

export interface Projections {
  current: { day: bigint; month: bigint; year: bigint }
  thirtyDayAverage: { day: bigint; month: bigint; year: bigint }
}

export interface Milestone {
  targetEth: number
  remainingEth: number
  etaDays: number | null
}

export interface Analytics {
  earnings: EarningsWindows
  yields: YieldRates
  projections: Projections
  rateSeries: RatePoint[]
  valueSeries: ValuePoint[]
  dailyEarnings: DailyEarning[]
  milestone: Milestone | null
  smoothedEthPerSecond: number
}

export interface MarketData {
  ethFiat: Record<FiatCurrency, number | null>
  marketRate: number | null
  premiumPercent: number | null
  fetchedAt: number | null
  fiatError?: string
  marketError?: string
}

export interface DashboardData {
  input: string
  address: Address
  ensName?: string
  currentReth: bigint
  currentRate: bigint
  currentEth: bigint
  transfers: TransferPoint[]
  rates: RatePoint[]
  analytics: Analytics
  market: MarketData
  chainBlock: bigint
  rateUpdatedAt: number
  expectedNextUpdateAt: number
}

export type DashboardErrorCode =
  | 'rpc_missing'
  | 'invalid_address'
  | 'ens_not_found'
  | 'rpc_rate_limited'
  | 'archive_required'
  | 'network'
  | 'unknown'

export class DashboardError extends Error {
  constructor(
    public readonly code: DashboardErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'DashboardError'
  }
}
