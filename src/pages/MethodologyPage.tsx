import { StaticPageLayout } from '../components/StaticPageLayout'

export function MethodologyPage() {
  return (
    <StaticPageLayout
      eyebrow="METHODOLOGY"
      title="How RocketYield calculates your numbers."
      intro="A transparent description of the contracts, sampling, formulas, estimates, and limitations behind the dashboard."
    >
      <section className="static-section" lang="en">
        <span className="static-index">EN / 01</span>
        <h2>Position and transfer history</h2>
        <p>
          rETH is not a rebasing token. The token balance changes when rETH is minted, bought,
          received, sold, burned, or sent; its ETH redemption value changes through Rocket Pool’s
          exchange rate. RocketYield reads the current balance and rate from Ethereum mainnet and
          reconstructs prior balances from rETH ERC-20 Transfer activity.
        </p>
        <div className="formula">Position value = rETH balance × current ETH/rETH rate</div>
      </section>

      <section className="static-section" lang="en">
        <span className="static-index">EN / 02</span>
        <h2>Balance-weighted earnings</h2>
        <p>
          Each transfer closes one holding interval at the historical exchange rate for that block.
          Earnings are then added interval by interval, so a later purchase cannot create earlier
          earnings and a sale cannot erase earnings already accumulated.
        </p>
        <div className="formula">Earnings = Σ(balance held during interval × rate change)</div>
        <p>
          Today, 7-day, 30-day, and 90-day figures use the same timeline clipped to each time
          window. Historical rate calls are made at every transfer block, daily for the latest
          90 days, and monthly for older chart history.
        </p>
        <p>
          The daily earnings table splits that sampled timeline at the calendar-day boundaries in
          your browser’s local time and shows completed days only. Growth between two sampled rates
          is allocated linearly across the intervening days and split again at each transfer, so
          daily values are estimates but their balance-weighted interval total is preserved.
        </p>
      </section>

      <section className="static-section" lang="en">
        <span className="static-index">EN / 03</span>
        <h2>Yield, projections, and the ticking estimate</h2>
        <p>
          Trailing APR annualizes the observed exchange-rate growth over its measured window. APY
          compounds that observed growth over one year. Projections apply the trailing rate to the
          current balance and assume the balance does not change; they are scenarios, not forecasts.
        </p>
        <p>
          Each table row’s annualized yield is the rETH exchange-rate growth observed or allocated
          during that local day, scaled to a 365-day simple annual rate. Its balance is the
          transfer-aware ETH value at the end of that completed day.
        </p>
        <p>
          Rocket Pool’s on-chain rate moves in discrete oracle updates, usually around once per day.
          The large counter smooths the recent realized rate into a per-second display estimate and
          snaps back to the next real on-chain value. It is always labelled as an estimate.
        </p>
      </section>

      <section className="static-section" lang="en">
        <span className="static-index">EN / 04</span>
        <h2>Data sources</h2>
        <ul>
          <li>Ethereum mainnet rETH contract for current balance and exchange rate.</li>
          <li>Alchemy RPC and transfer-history API for live and historical Ethereum reads.</li>
          <li>CoinGecko for ETH prices in the dashboard’s supported fiat currencies.</li>
          <li>
            DefiLlama for the daily historical ETH/USD prices used in the earnings table. Non-USD
            fiat columns convert that series with the live ETH spot FX from CoinGecko.
          </li>
          <li>GeckoTerminal for the Curve rETH/WETH spot-market comparison.</li>
          <li>Cloudflare Pages, Functions, and cookieless Web Analytics for hosting and aggregate statistics.</li>
        </ul>
        <p>
          Market quotes exclude gas and user-specific slippage. Fiat and market APIs can be stale,
          unavailable, or rate-limited without affecting the core ETH calculation.
        </p>
      </section>

      <aside className="static-callout">
        <strong>Version 1.0 · 21 September 2026</strong>
        <p>Method changes will be documented on this page.</p>
      </aside>
    </StaticPageLayout>
  )
}
