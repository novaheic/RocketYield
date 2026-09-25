import {
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts'
import { History } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { DashboardData } from '../lib/types'

const chartOptions = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#92969a',
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 11,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: '#1a1c1e' },
    horzLines: { color: '#1a1c1e' },
  },
  rightPriceScale: { borderColor: '#282b2e' },
  timeScale: { borderColor: '#282b2e', timeVisible: false },
  crosshair: {
    vertLine: { color: '#52575b', labelBackgroundColor: '#393d40' },
    horzLine: { color: '#52575b', labelBackgroundColor: '#393d40' },
  },
} as const

interface ChartProps {
  data: DashboardData
}

export function AnalyticsCharts({ data }: ChartProps) {
  const rateRef = useRef<HTMLDivElement>(null)
  const earningsRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const containers = [rateRef.current, earningsRef.current, valueRef.current].filter(
      (item): item is HTMLDivElement => Boolean(item),
    )
    if (containers.length !== 3) return

    const rateChart = createChart(containers[0], { ...chartOptions, height: 250 })
    const rateSeries = rateChart.addSeries(LineSeries, {
      color: '#f26b38',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    })
    rateSeries.setData(
      data.analytics.rateSeries.map((point) => ({
        time: point.timestamp as UTCTimestamp,
        value: Number(point.rate) / 1e18,
      })),
    )

    const earningsChart = createChart(containers[1], { ...chartOptions, height: 250 })
    const earningsSeries = earningsChart.addSeries(HistogramSeries, {
      color: '#f26b38',
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    })
    earningsSeries.setData(
      data.analytics.dailyEarnings.map((point) => ({
        time: point.timestamp as UTCTimestamp,
        value: point.earnedEth,
        color: point.earnedEth > 0 ? '#f26b38' : '#52575b',
      })),
    )

    const valueChart = createChart(containers[2], { ...chartOptions, height: 290 })
    const valueSeries = valueChart.addSeries(LineSeries, {
      color: '#d9dbdc',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    })
    valueSeries.setData(
      data.analytics.valueSeries.map((point) => ({
        time: point.timestamp as UTCTimestamp,
        value: point.valueEth,
      })),
    )

    const seriesTimes = data.analytics.valueSeries.map((point) => point.timestamp)
    const markers = data.transfers.slice(-30).flatMap((transfer) => {
      const nearest = seriesTimes.find((time) => time >= transfer.timestamp)
      if (!nearest) return []
      const incoming = transfer.delta > 0n
      return [{
        time: nearest as UTCTimestamp,
        position: incoming ? 'belowBar' : 'aboveBar',
        color: incoming ? '#68b88b' : '#dc705f',
        shape: incoming ? 'arrowUp' : 'arrowDown',
        text: incoming ? 'IN' : 'OUT',
      } satisfies SeriesMarker<UTCTimestamp>]
    })
    createSeriesMarkers(valueSeries, markers)

    for (const chart of [rateChart, earningsChart, valueChart]) chart.timeScale().fitContent()

    const resize = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const index = containers.indexOf(entry.target as HTMLDivElement)
        const chart = [rateChart, earningsChart, valueChart][index]
        chart?.applyOptions({ width: entry.contentRect.width })
      }
    })
    containers.forEach((container) => resize.observe(container))

    return () => {
      resize.disconnect()
      rateChart.remove()
      earningsChart.remove()
      valueChart.remove()
    }
  }, [data])

  return (
    <section className="charts-section">
      <header className="panel-header charts-heading">
        <div>
          <History className="section-icon" size={18} aria-hidden="true" />
          <h2>Position history</h2>
        </div>
        <p>
          Charts by{' '}
          <a
            className="chart-attribution"
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
          >
            TradingView
          </a>
        </p>
      </header>
      <div className="chart-grid">
        <article className="chart-panel chart-rate">
          <div className="chart-label">
            <h3>rETH / ETH</h3>
            <span>Redemption rate</span>
          </div>
          <div className="chart-canvas" ref={rateRef} />
        </article>
        <article className="chart-panel chart-earnings">
          <div className="chart-label">
            <h3>Daily earnings</h3>
            <span>ETH realized at rate updates</span>
          </div>
          <div className="chart-canvas" ref={earningsRef} />
        </article>
        <article className="chart-panel chart-value">
          <div className="chart-label">
            <h3>Position value</h3>
            <span>ETH · inbound and outbound transfers marked</span>
          </div>
          <div className="chart-canvas chart-canvas-large" ref={valueRef} />
        </article>
      </div>
    </section>
  )
}
