import { useEffect, useRef } from 'react'
import { formatFiatValue, liveFiatFractionDigits } from '../lib/format'
import { FIAT_CURRENCIES, type DashboardData, type FiatCurrency } from '../lib/types'

interface BalanceHeroProps {
  data: DashboardData
  fiatCurrency: FiatCurrency
  onFiatCurrencyChange: (currency: FiatCurrency) => void
}

const ETH_FRACTION_DIGITS = 9
const ETH_ULP = 10 ** -ETH_FRACTION_DIGITS
/** Fraction of the remaining display-unit gap closed each frame — keeps ticks consecutive but very fast. */
const CATCH_UP = 0.55

function displayNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: ETH_FRACTION_DIGITS,
    maximumFractionDigits: ETH_FRACTION_DIGITS,
  }).format(value)
}

function stepToward(currentUnits: number, targetUnits: number) {
  const gap = targetUnits - currentUnits
  if (gap <= 0) return targetUnits
  return currentUnits + Math.max(1, Math.ceil(gap * CATCH_UP))
}

export function BalanceHero({
  data,
  fiatCurrency,
  onFiatCurrencyChange,
}: BalanceHeroProps) {
  const ethRef = useRef<HTMLElement>(null)
  const visitEthRef = useRef<HTMLElement>(null)
  const visitFiatRef = useRef<HTMLElement>(null)
  const ethRate = data.market.ethFiat[fiatCurrency]
  const fiatDigits = ethRate === null
    ? ETH_FRACTION_DIGITS
    : liveFiatFractionDigits(ethRate, ETH_FRACTION_DIGITS)

  useEffect(() => {
    const startedAt = performance.now()
    const baseEth = Number(data.currentEth) / 1e18
    const ethPerSecond = data.analytics.smoothedEthPerSecond
    let ethUnits = Math.round(baseEth / ETH_ULP)
    let accruedUnits = 0
    let frame = 0

    const paint = (now: number) => {
      const accrued = ethPerSecond * Math.max(0, (now - startedAt) / 1000)
      const targetEthUnits = Math.round((baseEth + accrued) / ETH_ULP)
      const targetAccruedUnits = Math.round(accrued / ETH_ULP)

      ethUnits = stepToward(ethUnits, targetEthUnits)
      accruedUnits = stepToward(accruedUnits, targetAccruedUnits)

      const ethValue = ethUnits * ETH_ULP
      const accruedValue = accruedUnits * ETH_ULP

      if (ethRef.current) ethRef.current.textContent = displayNumber(ethValue)
      if (visitEthRef.current) visitEthRef.current.textContent = `+${displayNumber(accruedValue)}`

      if (visitFiatRef.current) {
        visitFiatRef.current.textContent = ethRate === null
          ? ''
          : ` · ${formatFiatValue(accruedValue * ethRate, fiatCurrency, {
              signed: true,
              fractionDigits: fiatDigits,
            })}`
      }

      frame = window.requestAnimationFrame(paint)
    }

    frame = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(frame)
  }, [
    data.address,
    data.currentEth,
    data.analytics.smoothedEthPerSecond,
    ethRate,
    fiatCurrency,
    fiatDigits,
  ])

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

      <div className="balance-stage">
        <div className="balance-line">
          <span>ETH</span>
          <strong ref={ethRef}>{displayNumber(Number(data.currentEth) / 1e18)}</strong>
        </div>

        <div className="opening-delta">
          <span>
            <span ref={visitEthRef}>+{displayNumber(0)}</span>
            <span className="eth-mark" aria-label="ETH">Ξ</span>
            <span ref={visitFiatRef} />
          </span>
          <span className="opening-delta-label">this visit</span>
        </div>
      </div>
    </section>
  )
}
