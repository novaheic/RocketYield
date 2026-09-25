import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { estimateTodayEarnings } from '../lib/analytics/dailyEarnings'
import { useFitText } from '../hooks/useFitText'
import {
  formatEth,
  formatFiat,
  formatFiatValue,
  formatPercent,
} from '../lib/format'
import type { DashboardData, FiatCurrency } from '../lib/types'

function MetricValue({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef<HTMLElement>(null)
  useFitText(wrapRef, valueRef, { minScale: 0.55 })

  return (
    <div className="metric-value-fit" ref={wrapRef}>
      <strong ref={valueRef} className="fit-number">{children}</strong>
    </div>
  )
}

interface MetricBandProps {
  data: DashboardData
  fiatCurrency: FiatCurrency
}

function displayEth(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  }).format(value)
}

export function MetricBand({ data, fiatCurrency }: MetricBandProps) {
  const { earnings, yields, smoothedEthPerSecond } = data.analytics
  const todayEthRef = useRef<HTMLElement>(null)
  const todayFiatRef = useRef<HTMLElement>(null)
  const fiatCurrencyRef = useRef(fiatCurrency)
  const ethRateRef = useRef(data.market.ethFiat[fiatCurrency])

  fiatCurrencyRef.current = fiatCurrency
  ethRateRef.current = data.market.ethFiat[fiatCurrency]

  const todayEstimate = useMemo(
    () => estimateTodayEarnings(
      data.transfers,
      data.rates,
      smoothedEthPerSecond,
      Math.floor(Date.now() / 1000),
    ),
    [data.rates, data.transfers, smoothedEthPerSecond],
  )

  useEffect(() => {
    const ethPerSecond = Math.max(0, smoothedEthPerSecond)
    let frame = 0
    let lastEthText = ''
    let lastFiatText = ''

    const paint = () => {
      const wallNow = Date.now() / 1000
      const liveEth = todayEstimate.realizedEth
        + ethPerSecond * Math.max(0, wallNow - todayEstimate.tickFrom)
      const ethText = displayEth(liveEth)

      if (todayEthRef.current && ethText !== lastEthText) {
        todayEthRef.current.textContent = ethText
        lastEthText = ethText
      }

      if (todayFiatRef.current) {
        const currency = fiatCurrencyRef.current
        const ethRate = ethRateRef.current
        const fiatText = ethRate === null
          ? `${currency} unavailable`
          : formatFiatValue(liveEth * ethRate, currency, { fractionDigits: 2 })
        if (fiatText !== lastFiatText) {
          todayFiatRef.current.textContent = fiatText
          lastFiatText = fiatText
        }
      }

      frame = window.requestAnimationFrame(paint)
    }

    frame = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(frame)
  }, [data.address, todayEstimate, smoothedEthPerSecond])

  const items = [
    ['7 days', earnings.sevenDays],
    ['30 days', earnings.thirtyDays],
    ['90 days', earnings.ninetyDays],
    ['Lifetime', earnings.lifetime],
  ] as const

  const initialFiat = data.market.ethFiat[fiatCurrency]

  return (
    <section className="metric-band" aria-label="Earnings windows">
      <div className="metric-cell">
        <span>Today</span>
        <MetricValue>
          +<span ref={todayEthRef}>{displayEth(todayEstimate.ethAt)}</span>{' '}
          <small>ETH</small>
        </MetricValue>
        <small ref={todayFiatRef}>
          {initialFiat === null
            ? `${fiatCurrency} unavailable`
            : formatFiatValue(todayEstimate.ethAt * initialFiat, fiatCurrency, {
              fractionDigits: 2,
            })}
        </small>
      </div>
      {items.map(([label, value]) => (
        <div className="metric-cell" key={label}>
          <span>{label}</span>
          <MetricValue>
            +{formatEth(value)} <small>ETH</small>
          </MetricValue>
          <small>{formatFiat(value, data.market.ethFiat[fiatCurrency], fiatCurrency)}</small>
        </div>
      ))}
      <div className="metric-cell yield-cell">
        <span>Current yield</span>
        <MetricValue>
          {formatPercent(yields.apr30d)} <small>APR</small>
        </MetricValue>
        <small>{formatPercent(yields.apy30d)} APY · trailing 30d</small>
      </div>
    </section>
  )
}
