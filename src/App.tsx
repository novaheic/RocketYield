import { AlertTriangle, ArrowRight, Database, Radio } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { AddressRail } from './components/AddressRail'
import { AnalyticsCharts } from './components/AnalyticsCharts'
import { BalanceHero } from './components/BalanceHero'
import { MarketMilestone } from './components/MarketMilestone'
import { MetricBand } from './components/MetricBand'
import { ProjectionPanel } from './components/ProjectionPanel'
import { useRocketYield } from './hooks/useRocketYield'
import { trackPageView } from './lib/telemetry'
import { StatsPage } from './pages/StatsPage'
import './styles/app.css'

function currentQuery() {
  return new URLSearchParams(window.location.search).get('address') ?? ''
}

function Welcome({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.trim()) onSubmit(value.trim())
  }

  return (
    <section className="welcome">
      <div className="welcome-copy">
        <span className="eyebrow">READ-ONLY RETH MONITOR</span>
        <h1>See what your rETH is worth—and what it has actually earned.</h1>
        <p>
          RocketYield rebuilds your balance from Ethereum transfers, applies each Rocket Pool rate
          update, and keeps the answer open on one quiet screen.
        </p>
      </div>
      <form className="welcome-form" onSubmit={submit}>
        <label htmlFor="welcome-address">Ethereum address or ENS name</label>
        <div>
          <input
            id="welcome-address"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="yourname.eth or 0x…"
            spellCheck={false}
            autoFocus
          />
          <button type="submit">
            Read position <ArrowRight size={17} />
          </button>
        </div>
        <small>No wallet connection, signature, or account.</small>
      </form>
      <div className="welcome-method">
        <div>
          <Database size={18} />
          <span>
            <strong>Balance-aware</strong>
            Buys, sells, and transfers are reconstructed from rETH events.
          </span>
        </div>
        <div>
          <Radio size={18} />
          <span>
            <strong>Direct from Ethereum</strong>
            Current holdings and Rocket Pool rates come from mainnet.
          </span>
        </div>
      </div>
    </section>
  )
}

function Loading({
  label,
  completed,
  total,
}: {
  label: string
  completed?: number
  total?: number
}) {
  const percent = total ? Math.round(((completed ?? 0) / total) * 100) : null
  return (
    <section className="state-view" aria-live="polite">
      <span className="state-index">LIVE / INDEXING</span>
      <h1>{label}</h1>
      <p>
        First load can take a moment while RocketYield scans the address history. Later visits use a
        local cache and only request new blocks.
      </p>
      <div className="load-track">
        <span style={{ width: percent === null ? '18%' : `${Math.max(4, percent)}%` }} />
      </div>
      <small>{percent === null ? 'Contacting Ethereum' : `${percent}% of block ranges`}</small>
    </section>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="state-view error-state" role="alert">
      <AlertTriangle size={24} />
      <span className="state-index">DATA REQUEST STOPPED</span>
      <h1>RocketYield could not finish this read.</h1>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>Try the live request again</button>
    </section>
  )
}

export default function App() {
  const isStatsPage = window.location.pathname === '/stats'
  const [query, setQuery] = useState(currentQuery)
  const [showFiat, setShowFiat] = useState(true)
  const { data, error, progress, refresh } = useRocketYield(isStatsPage ? '' : query)

  useEffect(() => {
    if (!isStatsPage) trackPageView()
  }, [isStatsPage])

  useEffect(() => {
    const onPopState = () => setQuery(currentQuery())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(value: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('address', value)
    window.history.pushState({}, '', url)
    setQuery(value)
  }

  if (isStatsPage) return <StatsPage />

  return (
    <div className="app-shell">
      <AddressRail
        query={query}
        data={data}
        progress={progress}
        onSubmit={navigate}
        onRefresh={refresh}
      />
      <main className="main-stage">
        {!query && <Welcome onSubmit={navigate} />}
        {query && !data && !error && (
          <Loading
            label={progress.label}
            completed={progress.completed}
            total={progress.total}
          />
        )}
        {error && <ErrorState message={error.message} onRetry={refresh} />}
        {data && (
          <div className="dashboard">
            {data.currentReth === 0n && (
              <div className="holding-notice">
                This address currently holds no rETH. Historical earnings remain visible below.
              </div>
            )}
            {(data.market.fiatError || data.market.marketError) && (
              <div className="partial-notice">
                On-chain figures are complete. {data.market.fiatError ?? data.market.marketError}.
              </div>
            )}
            <BalanceHero
              data={data}
              showFiat={showFiat}
              onToggleFiat={() => setShowFiat((value) => !value)}
            />
            <MetricBand data={data} showFiat={showFiat} />
            <div className="analysis-grid">
              <ProjectionPanel data={data} showFiat={showFiat} />
              <MarketMilestone data={data} />
            </div>
            <AnalyticsCharts data={data} />
            <footer>
              <span>RocketYield · on-chain data as of block {data.chainBlock.toLocaleString()}</span>
              <span>
                <a href="/stats">Public stats</a> · Unofficial community tool. Not affiliated with Rocket Pool.
              </span>
            </footer>
          </div>
        )}
      </main>
    </div>
  )
}
