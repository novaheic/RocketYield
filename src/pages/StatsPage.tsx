import { ArrowLeft, BarChart3, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { LegalLinks } from '../components/StaticPageLayout'
import { fetchPublicStats, type PublicStats } from '../lib/stats'
import '../styles/stats.css'

function integer(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
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
    let active = true
    async function load() {
      try {
        const result = await fetchPublicStats()
        if (active) setStats(result)
      } catch (caught: unknown) {
        if (!active) return
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Public statistics are unavailable.')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const chartMax = useMemo(() => {
    if (!stats) return 1
    return Math.max(
      1,
      ...stats.daily.flatMap((day) => [day.visits, day.pageViews]),
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
          A small, transparent view of reach from privacy-preserving Cloudflare Web Analytics.
          Visits are a popularity estimate, not a count of identifiable people.
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
          <section className="stats-metrics" aria-label="Tracked totals">
            <div>
              <span>Visits</span>
              <strong>{integer(stats.totals.visits)}</strong>
              <small>last {stats.totals.periodDays} days</small>
            </div>
            <div>
              <span>Page views</span>
              <strong>{integer(stats.totals.pageViews)}</strong>
              <small>last {stats.totals.periodDays} days</small>
            </div>
            <div>
              <span>Views per visit</span>
              <strong>{stats.totals.viewsPerVisit.toFixed(2)}</strong>
              <small>aggregate ratio</small>
            </div>
            <div>
              <span>30-day visits</span>
              <strong>{integer(stats.totals.visitsThirtyDays)}</strong>
              <small>rolling window</small>
            </div>
            <div className="stats-rate">
              <span>30-day page views</span>
              <strong>{integer(stats.totals.pageViewsThirtyDays)}</strong>
              <small>{stats.estimated ? 'sampled estimate' : 'unsampled count'}</small>
            </div>
          </section>

          <section className="stats-trend" aria-labelledby="trend-heading">
            <header>
              <div>
                <span className="section-index">30D</span>
                <h2 id="trend-heading">Daily activity</h2>
              </div>
              <div className="stats-legend">
                <span><i className="visitors-key" /> Visits</span>
                <span><i className="loads-key" /> Page views</span>
              </div>
            </header>
            <div className="stats-chart">
              {stats.daily.map((day) => (
                <div
                  className="stats-day"
                  key={day.day}
                  title={`${day.day}: ${day.visits} visits, ${day.pageViews} page views`}
                  aria-label={`${day.day}: ${day.visits} visits and ${day.pageViews} page views`}
                >
                  <span
                    className="visitor-bar"
                    style={{ height: `${Math.max(day.visits ? 3 : 0, (day.visits / chartMax) * 100)}%` }}
                  />
                  <span
                    className="load-bar"
                    style={{ height: `${Math.max(day.pageViews ? 3 : 0, (day.pageViews / chartMax) * 100)}%` }}
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
            or error contents to analytics. Cloudflare Web Analytics uses no cookies, localStorage,
            individual profiles, or fingerprinting.
          </p>
        </div>
      </section>

      <footer className="stats-footer">
        <LegalLinks />
        <span>No cookies · no wallet data · no account profiles</span>
      </footer>
    </main>
  )
}
