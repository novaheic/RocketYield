import { formatEth, formatFiat, formatPercent } from '../lib/format'
import type { DashboardData } from '../lib/types'

interface MetricBandProps {
  data: DashboardData
  showFiat: boolean
}

export function MetricBand({ data, showFiat }: MetricBandProps) {
  const { earnings, yields } = data.analytics
  const items = [
    ['Today', earnings.today],
    ['7 days', earnings.sevenDays],
    ['30 days', earnings.thirtyDays],
    ['90 days', earnings.ninetyDays],
    ['Lifetime', earnings.lifetime],
  ] as const

  return (
    <section className="metric-band" aria-label="Earnings windows">
      {items.map(([label, value]) => (
        <div className="metric-cell" key={label}>
          <span>{label}</span>
          <strong>+{formatEth(value)} <small>ETH</small></strong>
          {showFiat && <small>{formatFiat(value, data.market.ethUsd)}</small>}
        </div>
      ))}
      <div className="metric-cell yield-cell">
        <span>Current yield</span>
        <strong>{formatPercent(yields.apr30d)} <small>APR</small></strong>
        <small>{formatPercent(yields.apy30d)} APY · trailing 30d</small>
      </div>
    </section>
  )
}
