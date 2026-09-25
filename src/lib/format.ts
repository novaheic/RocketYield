import { formatUnits } from 'viem'
import type { FiatCurrency } from './types'

export function formatEth(value: bigint, maximumFractionDigits = 5) {
  const number = Number(formatUnits(value, 18))
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  }).format(number)
}

export function formatFiatValue(
  value: number,
  currency: FiatCurrency,
  options: { signed?: boolean; fractionDigits?: number } = {},
) {
  if (!Number.isFinite(value)) return `${currency} unavailable`

  const fractionDigits = options.fractionDigits ?? (() => {
    const currencyDigits = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
    return Math.abs(value) >= 1_000 ? 0 : currencyDigits
  })()

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)

  if (options.signed && value > 0 && !formatted.startsWith('+')) {
    return `+${formatted}`
  }
  return formatted
}

/**
 * ETH fraction digits so the live ticker advances about once per `targetTickMs`.
 * Small balances need more places; large ones stay near the previous 9-digit floor.
 * Hard-capped at 12 so the hero balance does not overflow typical viewports.
 */
export function liveEthFractionDigits(ethPerSecond: number, targetTickMs = 40) {
  if (!Number.isFinite(ethPerSecond) || ethPerSecond <= 0) return 9
  const ulp = ethPerSecond * (targetTickMs / 1000)
  if (!(ulp > 0)) return 9
  const digits = Math.ceil(-Math.log10(ulp))
  return Math.min(12, Math.max(9, digits))
}

/** Fiat fraction digits so one ETH display ULP remains visible at the given rate. */
export function liveFiatFractionDigits(ethRate: number, ethFractionDigits = 9) {
  if (!Number.isFinite(ethRate) || ethRate <= 0) return ethFractionDigits
  const digits = Math.ceil(ethFractionDigits - Math.log10(ethRate))
  return Math.min(10, Math.max(2, digits))
}

export function formatFiat(eth: bigint, rate: number | null, currency: FiatCurrency) {
  if (rate === null) return `${currency} unavailable`
  return formatFiatValue(Number(formatUnits(eth, 18)) * rate, currency)
}

export function formatPercent(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp * 1000)
}

export function formatCountdown(seconds: number) {
  if (seconds <= 0) return 'awaiting update'
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  return `${hours}h ${minutes}m`
}

export function shortAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`
}
