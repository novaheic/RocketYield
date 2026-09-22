import { useEffect, useRef, useState } from 'react'
import { formatFiat } from '../lib/format'
import { FIAT_CURRENCIES, type DashboardData, type FiatCurrency } from '../lib/types'

interface BalanceHeroProps {
  data: DashboardData
  fiatCurrency: FiatCurrency
  onFiatCurrencyChange: (currency: FiatCurrency) => void
}

function displayNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 8,
  }).format(value)
}

export function BalanceHero({
  data,
  fiatCurrency,
  onFiatCurrencyChange,
}: BalanceHeroProps) {
  const openedAt = useRef(Date.now())
  const baseEth = Number(data.currentEth) / 1e18
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    openedAt.current = Date.now()
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [data.address, data.currentEth])

  const elapsedSeconds = Math.max(0, (now - openedAt.current) / 1000)
  const accrued = data.analytics.smoothedEthPerSecond * elapsedSeconds
  const estimatedEth = baseEth + accrued

  return (
    <section className="balance-hero" aria-labelledby="position-heading">
      <div className="hero-kicker">
        <span className="live-rule" />
        <span id="position-heading">Current position</span>
        <label className="fiat-selector">
          <span>Display in</span>
          <select
            aria-label="Fiat currency"
            value={fiatCurrency}
            onChange={(event) => onFiatCurrencyChange(event.target.value as FiatCurrency)}
          >
            {FIAT_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="balance-line">
        <strong>{displayNumber(estimatedEth)}</strong>
        <span>ETH</span>
      </div>

      <div className="balance-support">
        <span className="opening-delta">
          +{displayNumber(accrued)} since opening
          <span className="estimate-tag">estimate</span>
        </span>
        <span>{formatFiat(data.currentEth, data.market.ethFiat[fiatCurrency], fiatCurrency)}</span>
      </div>
    </section>
  )
}
