import { formatEth, formatFiat } from '../lib/format'
import type { DashboardData } from '../lib/types'

interface ProjectionPanelProps {
  data: DashboardData
  showFiat: boolean
}

export function ProjectionPanel({ data, showFiat }: ProjectionPanelProps) {
  const { current, thirtyDayAverage } = data.analytics.projections
  const rows = [
    ['Per day', current.day, thirtyDayAverage.day],
    ['Per month', current.month, thirtyDayAverage.month],
    ['Per year', current.year, thirtyDayAverage.year],
  ] as const

  return (
    <section className="panel projection-panel">
      <header className="panel-header">
        <div>
          <span className="section-index">01</span>
          <h2>Forward estimate</h2>
        </div>
        <p>Current 7-day rate vs. your realized 30-day pace</p>
      </header>
      <div className="projection-head projection-row">
        <span>Window</span>
        <span>Current rate</span>
        <span>30d average</span>
      </div>
      {rows.map(([label, atCurrent, atAverage]) => (
        <div className="projection-row" key={label}>
          <span>{label}</span>
          <strong>
            +{formatEth(atCurrent)} ETH
            {showFiat && <small>{formatFiat(atCurrent, data.market.ethUsd)}</small>}
          </strong>
          <strong className="secondary-value">
            +{formatEth(atAverage)} ETH
            {showFiat && <small>{formatFiat(atAverage, data.market.ethUsd)}</small>}
          </strong>
        </div>
      ))}
      <p className="panel-footnote">
        Projection only. It assumes your rETH balance stays unchanged and does not predict future
        validator rewards.
      </p>
    </section>
  )
}
