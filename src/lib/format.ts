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

export function formatFiat(eth: bigint, rate: number | null, currency: FiatCurrency) {
  if (rate === null) return `${currency} unavailable`
  const value = Number(formatUnits(eth, 18)) * rate
  const currencyDigits = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 1_000 ? 0 : currencyDigits,
  }).format(value)
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

export function formatEta(days: number | null) {
  if (days === null || !Number.isFinite(days)) return 'rate unavailable'
  if (days < 1) return `about ${Math.max(1, Math.round(days * 24))} hours`
  if (days < 60) return `about ${Math.ceil(days)} days`
  return `about ${Math.ceil(days / 30.4375)} months`
}

export function shortAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`
}
