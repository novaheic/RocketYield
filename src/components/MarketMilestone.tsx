import { Activity, ArrowUpRight, Gauge } from 'lucide-react'
import { formatDate, formatPercent, formatSignedPercent } from '../lib/format'
import type { DashboardData } from '../lib/types'

export function MarketMilestone({ data }: { data: DashboardData }) {
  const redemption = Number(data.currentRate) / 1e18
  const { market, analytics } = data

  return (
    <section className="side-stack">
      <article className="panel market-panel">
        <header className="compact-header">
          <Gauge size={17} />
          <h2>Exit rate check</h2>
        </header>
        <div className="market-comparison">
          <div>
            <span>Rocket Pool redemption</span>
            <strong>{redemption.toFixed(5)} ETH</strong>
          </div>
          <div>
            <span>Curve market</span>
            <strong>{market.marketRate?.toFixed(5) ?? 'Unavailable'}</strong>
          </div>
        </div>
        <div className="premium-line">
          <span>Market premium / discount</span>
          <strong className={(market.premiumPercent ?? 0) >= 0 ? 'positive' : 'negative'}>
            {formatSignedPercent(market.premiumPercent)}
          </strong>
        </div>
        <p className="panel-footnote">
          Spot quote, before slippage and gas.
          {market.fetchedAt && ` Checked ${formatDate(Math.floor(market.fetchedAt / 1000))}.`}
        </p>
        <a
          className="source-link"
          href="https://www.geckoterminal.com/eth/pools/0x9efe1a1cbd6ca51ee8319afc4573d253c3b732af"
          target="_blank"
          rel="noreferrer"
        >
          View Curve pool <ArrowUpRight size={14} />
        </a>
      </article>

      <article className="panel rate-panel">
        <header className="compact-header">
          <Activity className="section-icon" size={18} aria-hidden="true" />
          <h2>Rate windows</h2>
        </header>
        <div className="rate-grid">
          <div className="rate-cell">
            <span>7D</span>
            <strong>{formatPercent(analytics.yields.apr7d)}</strong>
            <small>APR · {formatPercent(analytics.yields.apy7d)} APY</small>
          </div>
          <div className="rate-cell">
            <span>30D</span>
            <strong>{formatPercent(analytics.yields.apr30d)}</strong>
            <small>APR · {formatPercent(analytics.yields.apy30d)} APY</small>
          </div>
          <div className="rate-cell">
            <span>365D</span>
            <strong>{formatPercent(analytics.yields.apr365d)}</strong>
            <small>APR · {formatPercent(analytics.yields.apy365d)} APY</small>
          </div>
        </div>
      </article>
    </section>
  )
}
