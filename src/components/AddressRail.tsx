import { Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { LoadProgress } from '../lib/types'

interface AddressRailProps {
  query: string
  progress: LoadProgress
  onSubmit: (value: string) => void
}

export function AddressRail({ query, progress, onSubmit }: AddressRailProps) {
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
          <small>rETH Holder Dashboard</small>
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
    </aside>
  )
}
