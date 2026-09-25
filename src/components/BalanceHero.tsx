import { useEffect, useRef } from 'react'
import {
  formatFiatValue,
  liveEthFractionDigits,
  liveFiatFractionDigits,
} from '../lib/format'
import { FIAT_CURRENCIES, type DashboardData, type FiatCurrency } from '../lib/types'

interface BalanceHeroProps {
  data: DashboardData
  fiatCurrency: FiatCurrency
  onFiatCurrencyChange: (currency: FiatCurrency) => void
}

/** Fraction of the remaining display-unit gap closed each frame — keeps ticks consecutive but very fast. */
const CATCH_UP = 0.55

function displayNumber(value: number, fractionDigits: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
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
  const visitStartedAt = useRef(performance.now())
  const fiatCurrencyRef = useRef(fiatCurrency)
  const ethRateRef = useRef(data.market.ethFiat[fiatCurrency])

  fiatCurrencyRef.current = fiatCurrency
  ethRateRef.current = data.market.ethFiat[fiatCurrency]

  useEffect(() => {
    visitStartedAt.current = performance.now()
  }, [data.address, data.currentEth])

  useEffect(() => {
    const baseEth = Number(data.currentEth) / 1e18
    const ethPerSecond = data.analytics.smoothedEthPerSecond
    const fractionDigits = liveEthFractionDigits(ethPerSecond)
    const ethUlp = 10 ** -fractionDigits
    let ethUnits = Math.round(baseEth / ethUlp)
    let accruedUnits = Math.round(
      (ethPerSecond * Math.max(0, (performance.now() - visitStartedAt.current) / 1000)) / ethUlp,
    )
    let frame = 0

    const paint = (now: number) => {
      const currency = fiatCurrencyRef.current
      const ethRate = ethRateRef.current
      const fiatDigits = ethRate === null
        ? fractionDigits
        : liveFiatFractionDigits(ethRate, fractionDigits)

      const accrued = ethPerSecond * Math.max(0, (now - visitStartedAt.current) / 1000)
      const targetEthUnits = Math.round((baseEth + accrued) / ethUlp)
      const targetAccruedUnits = Math.round(accrued / ethUlp)

      ethUnits = stepToward(ethUnits, targetEthUnits)
      accruedUnits = stepToward(accruedUnits, targetAccruedUnits)

      const ethValue = ethUnits * ethUlp
      const accruedValue = accruedUnits * ethUlp

      if (ethRef.current) ethRef.current.textContent = displayNumber(ethValue, fractionDigits)
      if (visitEthRef.current) visitEthRef.current.textContent = displayNumber(accruedValue, fractionDigits)

      if (visitFiatRef.current) {
        visitFiatRef.current.textContent = ethRate === null
          ? ''
          : formatFiatValue(accruedValue * ethRate, currency, {
              signed: true,
              fractionDigits: fiatDigits,
            })
      }

      frame = window.requestAnimationFrame(paint)
    }

    frame = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(frame)
  }, [data.address, data.currentEth, data.analytics.smoothedEthPerSecond])

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
          <strong ref={ethRef} />
        </div>

        <div className="opening-delta">
          <span className="opening-delta-eth">
            <span aria-hidden="true">+</span>
            <span className="eth-mark" aria-label="ETH">Ξ</span>
            <span ref={visitEthRef} />
          </span>
          <span className="opening-delta-fiat" ref={visitFiatRef} />
          <span className="opening-delta-label">this visit</span>
        </div>
      </div>
    </section>
  )
}
