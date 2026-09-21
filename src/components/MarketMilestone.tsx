import { ArrowUpRight, Flag, Gauge } from 'lucide-react'
import { formatDate, formatEta, formatPercent, formatSignedPercent } from '../lib/format'
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

      <article className="panel milestone-panel">
        <header className="compact-header">
          <Flag size={17} />
          <h2>Next milestone</h2>
        </header>
        {analytics.milestone ? (
          <>
            <strong className="milestone-value">{analytics.milestone.targetEth} ETH earned</strong>
            <p>{formatEta(analytics.milestone.etaDays)} at the current 7-day rate.</p>
            <div className="milestone-track">
              <span
                style={{
                  width: `${Math.max(
                    4,
                    Math.min(
                      100,
                      ((analytics.milestone.targetEth - analytics.milestone.remainingEth) /
                        analytics.milestone.targetEth) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
            <small>{analytics.milestone.remainingEth.toFixed(5)} ETH remaining</small>
          </>
        ) : (
          <p>Your next milestone appears after another rate update.</p>
        )}
      </article>

      <article className="panel rate-panel">
        <header className="compact-header">
          <span className="section-index">03</span>
          <h2>Rate windows</h2>
        </header>
        <div className="rate-row">
          <span>7 day</span>
          <strong>{formatPercent(analytics.yields.apr7d)} APR</strong>
          <small>{formatPercent(analytics.yields.apy7d)} APY</small>
        </div>
        <div className="rate-row">
          <span>30 day</span>
          <strong>{formatPercent(analytics.yields.apr30d)} APR</strong>
          <small>{formatPercent(analytics.yields.apy30d)} APY</small>
        </div>
      </article>
    </section>
  )
}
