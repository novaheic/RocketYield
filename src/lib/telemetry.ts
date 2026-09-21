export type AnalyticsEvent = 'page_view' | 'dashboard_loaded'

const VISITOR_KEY = 'rocketyield:visitor-id'
const sentPageViews = new Set<string>()

function visitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(VISITOR_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

function analyticsEnabled() {
  return !(import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname))
}

export async function trackEvent(type: AnalyticsEvent) {
  if (!analyticsEnabled()) return
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, visitorId: visitorId() }),
      keepalive: true,
    })
  } catch {
    // Analytics must never interrupt the live rETH dashboard.
  }
}

export function trackPageView() {
  const page = `${window.location.pathname}${window.location.search}`
  if (sentPageViews.has(page)) return
  sentPageViews.add(page)
  void trackEvent('page_view')
}
