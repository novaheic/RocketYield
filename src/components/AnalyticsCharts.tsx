import {
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type BusinessDay,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { History } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDailyEarningsLedger, estimateTodayEarnings } from '../lib/analytics/dailyEarnings'
import type { DashboardData } from '../lib/types'

const DAY = 86_400

type ChartRange = '7d' | '30d' | '365d' | 'all'
type ChartMode = 'earnings' | 'value'

const RANGE_OPTIONS: Array<{ id: ChartRange; label: string }> = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '365d', label: '365d' },
  { id: 'all', label: 'All' },
]

const RANGE_DAYS: Record<Exclude<ChartRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '365d': 365,
}

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

function toBusinessDay(date: string): BusinessDay {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

function todayDateKey(now = new Date()) {
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function liveTodayEth(
  realizedEth: number,
  tickFrom: number,
  ethPerSecond: number,
  now = Date.now() / 1000,
) {
  return realizedEth + Math.max(0, ethPerSecond) * Math.max(0, now - tickFrom)
}

function shiftBusinessDay(day: BusinessDay, deltaDays: number): BusinessDay {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day))
  date.setUTCDate(date.getUTCDate() + deltaDays)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function businessDayValue(day: BusinessDay) {
  return Date.UTC(day.year, day.month - 1, day.day)
}

function applyChartRange(chart: IChartApi, range: ChartRange, times: Time[]) {
  if (times.length === 0) return
  if (range === 'all') {
    chart.timeScale().fitContent()
    return
  }

  const to = times[times.length - 1]
  const first = times[0]
  const days = RANGE_DAYS[range]

  if (typeof to === 'number' && typeof first === 'number') {
    const from = Math.max(first, to - days * DAY)
    if (from >= to) {
      chart.timeScale().fitContent()
      return
    }
    chart.timeScale().setVisibleRange({
      from: from as UTCTimestamp,
      to: to as UTCTimestamp,
    })
    return
  }

  if (typeof to === 'object' && typeof first === 'object') {
    const fromCandidate = shiftBusinessDay(to, -days)
    const from = businessDayValue(fromCandidate) > businessDayValue(first)
      ? fromCandidate
      : first
    if (businessDayValue(from) >= businessDayValue(to)) {
      chart.timeScale().fitContent()
      return
    }
    chart.timeScale().setVisibleRange({ from, to })
  }
}

function buildValueMarkers(data: DashboardData): SeriesMarker<UTCTimestamp>[] {
  const seriesTimes = data.analytics.valueSeries.map((point) => point.timestamp)
  return data.transfers.slice(-30).flatMap((transfer) => {
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
}

interface ChartProps {
  data: DashboardData
}

export function AnalyticsCharts({ data }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const timesRef = useRef<Time[]>([])
  const [range, setRange] = useState<ChartRange>('30d')
  const [mode, setMode] = useState<ChartMode>('value')
  const rangeRef = useRef(range)
  rangeRef.current = range

  const earningsLedger = useMemo(
    () => buildDailyEarningsLedger(data.transfers, data.rates)
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp),
    [data.rates, data.transfers],
  )

  const todayEstimate = useMemo(
    () => estimateTodayEarnings(
      data.transfers,
      data.rates,
      data.analytics.smoothedEthPerSecond,
      Math.floor(Date.now() / 1000),
    ),
    [data.analytics.smoothedEthPerSecond, data.rates, data.transfers],
  )

  // Recreate on mode change so UTC timestamps and BusinessDay series never share a chart.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, { ...chartOptions, height: 290 })
    chartRef.current = chart

    const resize = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      chart.applyOptions({ width: entry.contentRect.width })
    })
    resize.observe(container)

    return () => {
      resize.disconnect()
      markersRef.current?.detach()
      markersRef.current = null
      seriesRef.current = null
      chart.remove()
      chartRef.current = null
      timesRef.current = []
    }
  }, [data, mode])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    markersRef.current?.detach()
    markersRef.current = null
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current)
      seriesRef.current = null
    }

    if (mode === 'value') {
      const series = chart.addSeries(LineSeries, {
        color: '#d9dbdc',
        lineWidth: 2,
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      })
      const points = data.analytics.valueSeries.map((point) => ({
        time: point.timestamp as UTCTimestamp,
        value: point.valueEth,
      }))
      series.setData(points)
      markersRef.current = createSeriesMarkers(series, buildValueMarkers(data))
      seriesRef.current = series
      timesRef.current = data.analytics.valueSeries.map(
        (point) => point.timestamp as UTCTimestamp,
      )
    } else {
      const series = chart.addSeries(HistogramSeries, {
        color: '#f26b38',
        priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
      })
      const todayKey = todayDateKey()
      const todayValue = liveTodayEth(
        todayEstimate.realizedEth,
        todayEstimate.tickFrom,
        data.analytics.smoothedEthPerSecond,
      )
      const points = [
        ...earningsLedger.map((point) => ({
          time: toBusinessDay(point.date),
          value: point.earnedEth,
          color: point.earnedEth > 0 ? '#f26b38' : '#52575b',
        })),
        {
          time: toBusinessDay(todayKey),
          value: Math.max(0, todayValue),
          color: todayValue > 0 ? '#f26b38' : '#52575b',
        },
      ]
      series.setData(points)
      seriesRef.current = series
      timesRef.current = points.map((point) => point.time)
    }

    applyChartRange(chart, rangeRef.current, timesRef.current)
  }, [data, earningsLedger, mode, todayEstimate])

  useEffect(() => {
    if (mode !== 'earnings') return

    const todayTime = toBusinessDay(todayDateKey())
    let frame = 0
    let lastValue = Number.NaN

    const paint = () => {
      const series = seriesRef.current
      if (series) {
        const value = Math.max(0, liveTodayEth(
          todayEstimate.realizedEth,
          todayEstimate.tickFrom,
          data.analytics.smoothedEthPerSecond,
        ))
        if (Math.abs(value - lastValue) >= 0.00001) {
          series.update({
            time: todayTime,
            value,
            color: value > 0 ? '#f26b38' : '#52575b',
          })
          lastValue = value
        }
      }
      frame = window.requestAnimationFrame(paint)
    }

    frame = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(frame)
  }, [data.analytics.smoothedEthPerSecond, mode, todayEstimate])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !seriesRef.current) return
    applyChartRange(chart, range, timesRef.current)
  }, [range])

  const title = mode === 'value' ? 'Position value' : 'Daily earnings'
  const subtitle = mode === 'value'
    ? 'ETH · inbound and outbound transfers marked'
    : 'ETH earned per local calendar day · today is live'

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
        <article className="chart-panel chart-main">
          <div className="chart-panel-header">
            <div className="chart-label">
              <h3>{title}</h3>
              <span>{subtitle}</span>
            </div>
            <div className="chart-panel-controls">
              <div className="chart-range" role="group" aria-label="Chart time range">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={range === option.id ? 'is-active' : undefined}
                    aria-pressed={range === option.id}
                    onClick={() => setRange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="chart-mode" role="group" aria-label="Chart series">
                <button
                  type="button"
                  className={mode === 'earnings' ? 'is-active' : undefined}
                  aria-pressed={mode === 'earnings'}
                  onClick={() => setMode('earnings')}
                >
                  Earnings
                </button>
                <button
                  type="button"
                  className={mode === 'value' ? 'is-active' : undefined}
                  aria-pressed={mode === 'value'}
                  onClick={() => setMode('value')}
                >
                  Value
                </button>
              </div>
            </div>
          </div>
          <div className="chart-canvas chart-canvas-large" ref={containerRef} />
        </article>
      </div>
    </section>
  )
}
