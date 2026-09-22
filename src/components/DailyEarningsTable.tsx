import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { buildDailyEarningsLedger } from '../lib/analytics/dailyEarnings'
import { downloadEarnings } from '../lib/earningsExport'
import { formatFiatValue } from '../lib/format'
import {
  joinHistoricalPrices,
  loadHistoricalEthUsd,
  readHistoricalPriceCache,
  usdToFiatFactor,
  type HistoricalPricePoint,
} from '../lib/historicalPrices'
import type { DashboardData, FiatCurrency } from '../lib/types'

const PAGE_SIZE = 30

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(timestamp * 1000)
}

function ethLabel(value: number, signed = false) {
  if (!Number.isFinite(value)) return '—'
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 8,
  }).format(value)
  return signed && value > 0 ? `+${formatted}` : formatted
}

function fiatLabel(value: number | null, currency: FiatCurrency, price = false) {
  if (value === null || !Number.isFinite(value)) return '—'
  return formatFiatValue(value, currency, {
    fractionDigits: price || value >= 0.01 ? 2 : 4,
  })
}

function yieldLabel(value: number) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function todayKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DailyEarningsTable({
  data,
  fiatCurrency,
}: {
  data: DashboardData
  fiatCurrency: FiatCurrency
}) {
  const entries = useMemo(
    () => buildDailyEarningsLedger(data.transfers, data.rates),
    [data.rates, data.transfers],
  )
  const [prices, setPrices] = useState<HistoricalPricePoint[]>([])
  const [priceState, setPriceState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [entries])

  useEffect(() => {
    const historicalEntries = entries.filter((entry) => entry.date !== todayKey())
    if (historicalEntries.length === 0) {
      setPriceState('ready')
      return
    }

    let active = true
    const controller = new AbortController()
    setPriceState('loading')

    void readHistoricalPriceCache().then((cached) => {
      if (active && cached.length > 0) setPrices(cached)
    })

    const timestamps = historicalEntries.map((entry) => entry.timestamp)
    void loadHistoricalEthUsd(
      Math.min(...timestamps),
      Math.max(...timestamps),
      controller.signal,
    ).then((loaded) => {
      if (!active) return
      setPrices(loaded)
      setPriceState('ready')
    }).catch((error: unknown) => {
      if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
      setPriceState('error')
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [entries])

  const currentFiatPrice = data.market.ethFiat[fiatCurrency]
  const usdToFiat = usdToFiatFactor(
    data.market.ethFiat.USD,
    currentFiatPrice,
    fiatCurrency === 'USD',
  )

  const rows = useMemo(
    () => joinHistoricalPrices(entries, prices, currentFiatPrice, usdToFiat),
    [currentFiatPrice, entries, prices, usdToFiat],
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const missingPriceLabel = priceState === 'loading' ? 'Loading…' : '—'
  const priceHistoryLabel = fiatCurrency === 'USD' ? 'USD' : `${fiatCurrency} (from USD)`

  return (
    <section className="earnings-history" aria-labelledby="earnings-history-title">
      <header className="panel-header earnings-history-heading">
        <div>
          <span className="section-index">04</span>
          <h2 id="earnings-history-title">Daily earnings history</h2>
        </div>
        <p>Completed local calendar days · historical {priceHistoryLabel} value · newest first</p>
      </header>

      <div className="earnings-history-toolbar">
        <span aria-live="polite">
          {rows.length.toLocaleString()} earning {rows.length === 1 ? 'day' : 'days'}
          {priceState === 'loading' ? ' · loading price history' : ''}
          {priceState === 'error' ? ' · historical prices unavailable' : ''}
        </span>
        <div className="earnings-export-actions">
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => downloadEarnings(rows, 'csv', data.address, fiatCurrency)}
          >
            <Download size={14} aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => downloadEarnings(rows, 'json', data.address, fiatCurrency)}
          >
            <Download size={14} aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="earnings-history-empty">
          No positive daily rETH earnings were found for this address.
        </div>
      ) : (
        <>
          <div className="earnings-table-scroll">
            <table className="earnings-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Change (ETH)</th>
                  <th scope="col">Value ({fiatCurrency})</th>
                  <th scope="col">ETH Price ({fiatCurrency})</th>
                  <th scope="col">Annualized Yield</th>
                  <th scope="col">Balance (ETH)</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.date}>
                    <th scope="row">
                      <time dateTime={row.date}>{dateLabel(row.timestamp)}</time>
                    </th>
                    <td className="earnings-change">{ethLabel(row.earnedEth, true)}</td>
                    <td>{row.fiatValue === null ? missingPriceLabel : fiatLabel(row.fiatValue, fiatCurrency)}</td>
                    <td>{row.ethPrice === null ? missingPriceLabel : fiatLabel(row.ethPrice, fiatCurrency, true)}</td>
                    <td>{yieldLabel(row.annualizedYield)}</td>
                    <td>{ethLabel(row.balanceEth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="earnings-pagination" aria-label="Daily earnings pages">
            <button type="button" onClick={() => setPage(1)} disabled={safePage === 1}>
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
            >
              Previous
            </button>
            <label>
              <span className="sr-only">Page</span>
              <select
                aria-label="Page"
                value={safePage}
                onChange={(event) => setPage(Number(event.target.value))}
              >
                {Array.from({ length: pageCount }, (_, index) => (
                  <option value={index + 1} key={index + 1}>
                    Page {index + 1} of {pageCount}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage === pageCount}
            >
              Next
            </button>
            <button type="button" onClick={() => setPage(pageCount)} disabled={safePage === pageCount}>
              Last
            </button>
          </nav>
        </>
      )}

      <p className="panel-footnote earnings-history-note">
        Completed daily values are estimates allocated from sampled on-chain rETH rates. Older
        periods use wider samples; totals remain balance-weighted across buys, sells, and transfers.
        Fiat values use DefiLlama’s nearest daily ETH/USD price
        {fiatCurrency === 'USD'
          ? '.'
          : `, converted to ${fiatCurrency} with the live ETH spot FX from CoinGecko.`}
      </p>
    </section>
  )
}
