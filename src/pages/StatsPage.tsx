import { ArrowLeft, BarChart3, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchPublicStats, type PublicStats } from '../lib/stats'
import '../styles/stats.css'

function integer(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function percent(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function updatedAt(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function StatsPage() {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchPublicStats(controller.signal)
      .then(setStats)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Public statistics are unavailable.')
      })
    return () => controller.abort()
  }, [])

  const chartMax = useMemo(() => {
    if (!stats) return 1
    return Math.max(
      1,
      ...stats.daily.flatMap((day) => [day.uniqueVisitors, day.dashboardLoads]),
    )
  }, [stats])

  return (
    <main className="stats-page">
      <nav className="stats-nav">
        <a href="/" className="stats-brand">
          <span aria-hidden="true">R</span>
          RocketYield
        </a>
        <a href="/">
          <ArrowLeft size={15} />
          Back to dashboard
        </a>
      </nav>

      <header className="stats-hero">
        <div>
          <span className="eyebrow">PUBLIC AGGREGATE STATISTICS</span>
          <h1>How RocketYield is being used.</h1>
        </div>
        <p>
          A small, transparent view of reach and successful portfolio reads. These counters are
          approximate and can include bots.
        </p>
      </header>

      {error && (
        <section className="stats-state" role="alert">
          <BarChart3 size={22} />
          <h2>Stats are not available yet.</h2>
          <p>{error}</p>
        </section>
      )}

      {!stats && !error && (
        <section className="stats-state" aria-live="polite">
          <span className="stats-loader" />
          <h2>Reading aggregate counters</h2>
        </section>
      )}

      {stats && (
        <>
          <section className="stats-metrics" aria-label="All-time totals">
            <div>
              <span>Unique visitors</span>
              <strong>{integer(stats.totals.uniqueVisitors)}</strong>
              <small>anonymous browsers</small>
            </div>
            <div>
              <span>Page views</span>
              <strong>{integer(stats.totals.pageViews)}</strong>
              <small>dashboard visits</small>
            </div>
            <div>
              <span>Successful reads</span>
              <strong>{integer(stats.totals.dashboardLoads)}</strong>
              <small>completed live loads</small>
            </div>
            <div>
              <span>Successful visitors</span>
              <strong>{integer(stats.totals.successfulVisitors)}</strong>
              <small>at least one completed read</small>
            </div>
            <div className="stats-rate">
              <span>Visitor success rate</span>
              <strong>{percent(stats.totals.successRate)}</strong>
              <small>visitors with a completed read</small>
            </div>
          </section>

          <section className="stats-trend" aria-labelledby="trend-heading">
            <header>
              <div>
                <span className="section-index">30D</span>
                <h2 id="trend-heading">Daily activity</h2>
              </div>
              <div className="stats-legend">
                <span><i className="visitors-key" /> Visitors</span>
                <span><i className="loads-key" /> Successful reads</span>
              </div>
            </header>
            <div className="stats-chart">
              {stats.daily.map((day) => (
                <div
                  className="stats-day"
                  key={day.day}
                  title={`${day.day}: ${day.uniqueVisitors} visitors, ${day.dashboardLoads} successful reads`}
                  aria-label={`${day.day}: ${day.uniqueVisitors} unique visitors and ${day.dashboardLoads} successful reads`}
                >
                  <span
                    className="visitor-bar"
                    style={{ height: `${Math.max(day.uniqueVisitors ? 3 : 0, (day.uniqueVisitors / chartMax) * 100)}%` }}
                  />
                  <span
                    className="load-bar"
                    style={{ height: `${Math.max(day.dashboardLoads ? 3 : 0, (day.dashboardLoads / chartMax) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <footer>
              <span>{stats.daily.at(0)?.day}</span>
              <span>Updated {updatedAt(stats.updatedAt)}</span>
              <span>{stats.daily.at(-1)?.day}</span>
            </footer>
          </section>
        </>
      )}

      <section className="stats-privacy">
        <ShieldCheck size={19} />
        <div>
          <h2>Counts, not portfolios.</h2>
          <p>
            RocketYield does not send wallet addresses, ENS names, balances, earnings, RPC details,
            or error contents to analytics. Anonymous browser IDs are salted and hashed before
            storage.
          </p>
        </div>
      </section>

      <footer className="stats-footer">
        <span>Public aggregate statistics</span>
        <span>No cookies · no wallet data · no account profiles</span>
      </footer>
    </main>
  )
}
