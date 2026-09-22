import { AlertTriangle, ArrowRight, Database, Radio } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { AddressRail } from './components/AddressRail'
import { AnalyticsCharts } from './components/AnalyticsCharts'
import { BalanceHero } from './components/BalanceHero'
import { DailyEarningsTable } from './components/DailyEarningsTable'
import { MarketMilestone } from './components/MarketMilestone'
import { MetricBand } from './components/MetricBand'
import { ProjectionPanel } from './components/ProjectionPanel'
import { LegalLinks } from './components/StaticPageLayout'
import { useRocketYield } from './hooks/useRocketYield'
import { ImpressumPage } from './pages/ImpressumPage'
import { MethodologyPage } from './pages/MethodologyPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { StatsPage } from './pages/StatsPage'
import { FIAT_CURRENCIES, type FiatCurrency } from './lib/types'
import './styles/app.css'

const FIAT_STORAGE_KEY = 'rocketyield-fiat-currency'

function currentQuery() {
  return new URLSearchParams(window.location.search).get('address') ?? ''
}

function initialFiatCurrency(): FiatCurrency {
  try {
    const stored = window.localStorage.getItem(FIAT_STORAGE_KEY)
    const currency = FIAT_CURRENCIES.find((candidate) => candidate === stored)
    return currency ?? 'USD'
  } catch {
    return 'USD'
  }
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

function ToolFooter({ blockNumber }: { blockNumber?: bigint }) {
  return (
    <footer className="tool-footer">
      <span>
        {blockNumber
          ? `RocketYield · on-chain data as of block ${blockNumber.toLocaleString()}`
          : 'RocketYield · unofficial community tool'}
      </span>
      <LegalLinks />
    </footer>
  )
}

export default function App() {
  const pathname = window.location.pathname
  const isStatsPage = pathname === '/stats'
  const isMethodologyPage = pathname === '/methodology'
  const isImpressumPage = pathname === '/impressum'
  const isPrivacyPage = pathname === '/privacy' || pathname === '/datenschutz'
  const isDashboardPage = !isStatsPage && !isMethodologyPage && !isImpressumPage && !isPrivacyPage
  const [query, setQuery] = useState(currentQuery)
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>(initialFiatCurrency)
  const { data, error, progress, refresh } = useRocketYield(isDashboardPage ? query : '')

  useEffect(() => {
    const onPopState = () => setQuery(currentQuery())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(FIAT_STORAGE_KEY, fiatCurrency)
    } catch {
      // The selection still works for this page when browser storage is unavailable.
    }
  }, [fiatCurrency])

  function navigate(value: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('address', value)
    window.history.pushState({}, '', url)
    setQuery(value)
  }

  if (isStatsPage) return <StatsPage />
  if (isMethodologyPage) return <MethodologyPage />
  if (isImpressumPage) return <ImpressumPage />
  if (isPrivacyPage) return <PrivacyPage />

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
                fiatCurrency={fiatCurrency}
                onFiatCurrencyChange={setFiatCurrency}
              />
              <MetricBand data={data} fiatCurrency={fiatCurrency} />
              <div className="analysis-grid">
                <ProjectionPanel data={data} fiatCurrency={fiatCurrency} />
                <MarketMilestone data={data} />
              </div>
              <AnalyticsCharts data={data} />
              <DailyEarningsTable data={data} fiatCurrency={fiatCurrency} />
              <ToolFooter blockNumber={data.chainBlock} />
            </div>
          )}
          {!data && <ToolFooter />}
      </main>
    </div>
  )
}
