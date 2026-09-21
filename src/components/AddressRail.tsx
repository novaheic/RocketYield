import { ArrowUpRight, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { DashboardData, LoadProgress } from '../lib/types'
import { shortAddress } from '../lib/format'

interface AddressRailProps {
  query: string
  data: DashboardData | null
  progress: LoadProgress
  onSubmit: (value: string) => void
  onRefresh: () => void
}

export function AddressRail({ query, data, progress, onSubmit, onRefresh }: AddressRailProps) {
  const [value, setValue] = useState(query)
  useEffect(() => setValue(query), [query])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.trim()) onSubmit(value.trim())
  }

  return (
    <aside className="address-rail">
      <a className="brand" href="/" aria-label="RocketYield home">
        <span className="brand-mark" aria-hidden="true">R</span>
        <span>
          <strong>RocketYield</strong>
          <small>rETH instrument</small>
        </span>
      </a>

      <form className="address-form" onSubmit={submit}>
        <label htmlFor="wallet">Address or ENS</label>
        <div className="address-input-wrap">
          <input
            id="wallet"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="vitalik.eth"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" aria-label="Load address">
            <Search size={16} strokeWidth={1.8} />
          </button>
        </div>
      </form>

      <div className="rail-status" aria-live="polite">
        <span className={`status-dot status-${progress.phase}`} />
        <span>{progress.label}</span>
      </div>

      {data && (
        <div className="identity">
          <span>Tracking</span>
          <strong title={data.ensName ?? data.address}>
            {data.ensName ?? shortAddress(data.address)}
          </strong>
          {data.ensName && <small>{shortAddress(data.address)}</small>}
          <div className="identity-actions">
            <button onClick={onRefresh} type="button">
              <RefreshCw size={14} />
              Refresh
            </button>
            <a
              href={`https://etherscan.io/address/${data.address}`}
              target="_blank"
              rel="noreferrer"
            >
              Etherscan
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      )}

      <div className="rail-note">
        <span>READ ONLY</span>
        <p>No wallet connection. The address stays in this page’s URL.</p>
      </div>
    </aside>
  )
}
