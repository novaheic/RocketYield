import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { DailyVisitors } from '../lib/stats'

const GRID_STEPS = 4

function integer(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function plural(value: number, word: string) {
  return `${integer(value)} ${word}${value === 1 ? '' : 's'}`
}

function parseDay(day: string) {
  return new Date(`${day}T00:00:00.000Z`)
}

const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

/** Rounds the axis up so every gridline lands on a whole, readable number. */
function axisStep(max: number) {
  const raw = Math.max(1, max) / GRID_STEPS
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw)!
  return Math.max(1, Math.ceil(step))
}

function axisTicks(daily: DailyVisitors[]) {
  if (daily.length > 62) {
    return daily.flatMap((entry, index) =>
      entry.day.endsWith('-01') ? [{ index, label: monthName.format(parseDay(entry.day)) }] : [],
    )
  }
  return daily.flatMap((entry, index) =>
    (daily.length - 1 - index) % 7 === 0 ? [{ index, label: shortDate.format(parseDay(entry.day)) }] : [],
  )
}

export function VisitorChart({ daily }: { daily: DailyVisitors[] }) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const count = daily.length
  const step = axisStep(Math.max(0, ...daily.map((entry) => entry.visitors)))
  const top = step * GRID_STEPS
  const activeDay = active === null ? null : daily[active]

  function indexAt(clientX: number) {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    const ratio = (clientX - rect.left) / rect.width
    return Math.min(count - 1, Math.max(0, Math.floor(ratio * count)))
  }

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    setActive(indexAt(event.clientX))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = active ?? count - 1
    const next = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: count - 1,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActive(Math.min(count - 1, Math.max(0, next)))
  }

  const tooltipAlign =
    active === null ? 'center' : active < count * 0.12 ? 'start' : active > count * 0.88 ? 'end' : 'center'

  return (
    <div className="visitor-chart">
      <div className="visitor-axis" aria-hidden="true">
        {Array.from({ length: GRID_STEPS + 1 }, (_, index) => (
          <span key={index} style={{ bottom: `${(index / GRID_STEPS) * 100}%` }}>
            {integer(step * index)}
          </span>
        ))}
      </div>
      <div
        ref={plotRef}
        className="visitor-plot"
        style={{ gap: count > 62 ? '1px' : 'clamp(2px, 0.5vw, 6px)' }}
        tabIndex={0}
        role="group"
        aria-label="Daily visitors. Use the arrow keys to read individual days."
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setActive(null)
        }}
        onFocus={() => setActive((current) => current ?? count - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        {daily.map((entry, index) => (
          <span
            key={entry.day}
            className="visitor-column"
            data-active={index === active || undefined}
          >
            <span
              className="visitor-bar"
              style={{ height: `${entry.visitors ? Math.max(1.5, (entry.visitors / top) * 100) : 0}%` }}
            />
          </span>
        ))}
        {activeDay && active !== null && (
          <div
            className="visitor-tooltip"
            data-align={tooltipAlign}
            style={{ left: `${((active + 0.5) / count) * 100}%` }}
            role="status"
          >
            <span>{longDate.format(parseDay(activeDay.day))}</span>
            <strong>{plural(activeDay.visitors, 'visitor')}</strong>
            <small>{plural(activeDay.pageViews, 'page view')}</small>
          </div>
        )}
      </div>
      <div className="visitor-ticks" aria-hidden="true">
        {axisTicks(daily).map((tick) => (
          <span key={tick.index} style={{ left: `${((tick.index + 0.5) / count) * 100}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  )
}
