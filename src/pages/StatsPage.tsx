import { ArrowLeft, BarChart3, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LegalLinks } from '../components/StaticPageLayout'
import { VisitorChart } from '../components/VisitorChart'
import { fetchVisitorStats, type VisitorStats } from '../lib/stats'
import '../styles/stats.css'

const LAST_THIRTY_DAYS = '30d'

function integer(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function shortDay(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function updatedAt(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function rangeLabel(range: string) {
  return range === LAST_THIRTY_DAYS ? 'last 30 days' : `in ${range}`
}

export function StatsPage() {
  const [range, setRange] = useState(LAST_THIRTY_DAYS)
  const [stats, setStats] = useState<VisitorStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetchVisitorStats(range, controller.signal)
      .then((result) => {
        setStats(result)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Visitor statistics are unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range])

  const ranges = [LAST_THIRTY_DAYS, ...(stats?.years ?? []).map(String)]

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
          <span className="eyebrow">PUBLIC VISITOR STATISTICS</span>
          <h1>How many people visit RocketYield.</h1>
        </div>
        <p>
          Counted by RocketYield itself, not a third-party tracker. A visitor is one browser on one
          day: coming back tomorrow counts again, reloading today does not.
        </p>
      </header>

      {error && !stats && (
        <section className="stats-state" role="alert">
          <BarChart3 size={22} />
          <h2>Stats are not available yet.</h2>
          <p>{error}</p>
        </section>
      )}

      {!stats && !error && (
        <section className="stats-state" aria-live="polite">
          <span className="stats-loader" />
          <h2>Reading visitor counts</h2>
        </section>
      )}

      {stats && (
        <>
          <section className="stats-metrics" aria-label="Visitor totals">
            <div>
              <span>Visitors today</span>
              <strong>{integer(stats.today.visitors)}</strong>
              <small>since 00:00 UTC</small>
            </div>
            <div className="stats-rate">
              <span>Visitors</span>
              <strong>{integer(stats.totals.visitors)}</strong>
              <small>{rangeLabel(stats.range)}</small>
            </div>
            <div>
              <span>Page views</span>
              <strong>{integer(stats.totals.pageViews)}</strong>
              <small>{rangeLabel(stats.range)}</small>
            </div>
            <div>
              <span>All-time visitors</span>
              <strong>{integer(stats.allTime.visitors)}</strong>
              <small>{stats.allTime.since ? `since ${shortDay(stats.allTime.since)}` : 'no visits yet'}</small>
            </div>
          </section>

          <section className="stats-trend" aria-labelledby="trend-heading" aria-busy={loading}>
            <header>
              <h2 id="trend-heading">Daily visitors</h2>
              <div className="stats-ranges" role="group" aria-label="Time range">
                {ranges.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === range}
                    onClick={() => setRange(option)}
                  >
                    {option === LAST_THIRTY_DAYS ? '30 days' : option}
                  </button>
                ))}
              </div>
            </header>
            {error && <p className="stats-inline-error" role="alert">{error}</p>}
            <div className={loading ? 'stats-chart-wrap is-loading' : 'stats-chart-wrap'}>
              <VisitorChart key={stats.range} daily={stats.daily} />
            </div>
            <footer>
              <span>Days are in UTC</span>
              <span>Updated {updatedAt(stats.updatedAt)}</span>
            </footer>
          </section>
        </>
      )}

      <section className="stats-privacy">
        <ShieldCheck size={19} />
        <div>
          <h2>Counts, not people.</h2>
          <p>
            Each page load sends an empty request to RocketYield's own server. To recognise a repeat
            visit on the same day, the server hashes the IP address and browser name with a random
            salt that is deleted at the end of the day. No cookies, no localStorage, no third-party
            scripts, and no wallet addresses, ENS names, balances, or earnings are ever stored.
          </p>
        </div>
      </section>

      <footer className="stats-footer">
        <LegalLinks />
        <span>No cookies · no trackers · no wallet data</span>
      </footer>
    </main>
  )
}
