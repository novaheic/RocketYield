export interface DailyVisitors {
  day: string
  visitors: number
  pageViews: number
}

export interface VisitorCounts {
  visitors: number
  pageViews: number
}

export interface VisitorStats {
  range: string
  years: number[]
  daily: DailyVisitors[]
  totals: VisitorCounts
  today: VisitorCounts
  allTime: VisitorCounts & { since: string | null }
  updatedAt: string
}

const VISITORS_ENDPOINT = '/api/visitors'

export async function fetchVisitorStats(range: string, signal?: AbortSignal): Promise<VisitorStats> {
  const response = await fetch(`${VISITORS_ENDPOINT}?range=${encodeURIComponent(range)}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('The stats backend is not running. Use npm run cf:dev.')
    }
    throw new Error('Visitor statistics are temporarily unavailable.')
  }
  return response.json() as Promise<VisitorStats>
}

/** Records one page load. The server derives everything it needs from the request itself. */
export function recordPageView() {
  if (navigator.webdriver) return
  const send = () => {
    void fetch(VISITORS_ENDPOINT, { method: 'POST', keepalive: true }).catch(() => undefined)
  }
  const doc = document as Document & { prerendering?: boolean }
  if (doc.prerendering) {
    doc.addEventListener('prerenderingchange', send, { once: true })
  } else {
    send()
  }
}
