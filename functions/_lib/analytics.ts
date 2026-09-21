export type AnalyticsEventType = 'page_view' | 'dashboard_loaded'

export interface AnalyticsEnv {
  ANALYTICS_DB: D1Database
  ANALYTICS_SALT: string
  APP_ORIGIN?: string
}

export interface EventPayload {
  type: AnalyticsEventType
  visitorId: string
}

export interface DailyStat {
  day: string
  pageViews: number
  dashboardLoads: number
  uniqueVisitors: number
  successfulVisitors: number
}

export interface PublicStats {
  totals: {
    uniqueVisitors: number
    pageViews: number
    dashboardLoads: number
    successfulVisitors: number
    successRate: number
  }
  daily: DailyStat[]
  updatedAt: string
}

const EVENT_TYPES = new Set<AnalyticsEventType>(['page_view', 'dashboard_loaded'])
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validEventPayload(value: unknown): value is EventPayload {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<EventPayload>
  return (
    typeof item.type === 'string' &&
    EVENT_TYPES.has(item.type as AnalyticsEventType) &&
    typeof item.visitorId === 'string' &&
    VISITOR_ID_PATTERN.test(item.visitorId)
  )
}

export async function hashVisitor(visitorId: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${visitorId}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function recordEvent(
  env: AnalyticsEnv,
  payload: EventPayload,
  now = new Date(),
) {
  const timestamp = now.toISOString()
  const day = timestamp.slice(0, 10)
  const visitorHash = await hashVisitor(payload.visitorId, env.ANALYTICS_SALT)
  const success = payload.type === 'dashboard_loaded' ? 1 : 0
  const pageView = payload.type === 'page_view' ? 1 : 0

  await env.ANALYTICS_DB.batch([
    env.ANALYTICS_DB.prepare(
      `INSERT INTO visitors (visitor_hash, first_seen, last_seen, has_success)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(visitor_hash) DO UPDATE SET
         last_seen = excluded.last_seen,
         has_success = MAX(visitors.has_success, excluded.has_success)`,
    ).bind(visitorHash, timestamp, timestamp, success),
    env.ANALYTICS_DB.prepare(
      `INSERT INTO daily_stats (day, page_views, dashboard_loads)
       VALUES (?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET
         page_views = daily_stats.page_views + excluded.page_views,
         dashboard_loads = daily_stats.dashboard_loads + excluded.dashboard_loads`,
    ).bind(day, pageView, success),
    env.ANALYTICS_DB.prepare(
      `INSERT INTO daily_visitors (day, visitor_hash, has_success)
       VALUES (?, ?, ?)
       ON CONFLICT(day, visitor_hash) DO UPDATE SET
         has_success = MAX(daily_visitors.has_success, excluded.has_success)`,
    ).bind(day, visitorHash, success),
  ])
}

interface TotalRow {
  unique_visitors: number
  page_views: number
  dashboard_loads: number
  successful_visitors: number
}

interface DailyRow {
  day: string
  page_views: number
  dashboard_loads: number
  unique_visitors: number
  successful_visitors: number
}

export function fillThirtyDays(rows: DailyRow[], now = new Date()): DailyStat[] {
  const byDay = new Map(rows.map((row) => [row.day, row]))
  const output: DailyStat[] = []
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  cursor.setUTCDate(cursor.getUTCDate() - 29)

  for (let index = 0; index < 30; index += 1) {
    const day = cursor.toISOString().slice(0, 10)
    const row = byDay.get(day)
    output.push({
      day,
      pageViews: row?.page_views ?? 0,
      dashboardLoads: row?.dashboard_loads ?? 0,
      uniqueVisitors: row?.unique_visitors ?? 0,
      successfulVisitors: row?.successful_visitors ?? 0,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return output
}

export async function readPublicStats(
  env: AnalyticsEnv,
  now = new Date(),
): Promise<PublicStats> {
  const [totals, dailyResult] = await Promise.all([
    env.ANALYTICS_DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM visitors) AS unique_visitors,
        (SELECT COALESCE(SUM(page_views), 0) FROM daily_stats) AS page_views,
        (SELECT COALESCE(SUM(dashboard_loads), 0) FROM daily_stats) AS dashboard_loads,
        (SELECT COUNT(*) FROM visitors WHERE has_success = 1) AS successful_visitors`,
    ).first<TotalRow>(),
    env.ANALYTICS_DB.prepare(
      `SELECT
        stats.day,
        stats.page_views,
        stats.dashboard_loads,
        COUNT(visitors.visitor_hash) AS unique_visitors,
        COALESCE(SUM(visitors.has_success), 0) AS successful_visitors
       FROM daily_stats AS stats
       LEFT JOIN daily_visitors AS visitors ON visitors.day = stats.day
       WHERE stats.day >= date(?, '-29 days')
       GROUP BY stats.day, stats.page_views, stats.dashboard_loads
       ORDER BY stats.day ASC`,
    ).bind(now.toISOString().slice(0, 10)).all<DailyRow>(),
  ])

  const uniqueVisitors = Number(totals?.unique_visitors ?? 0)
  const successfulVisitors = Number(totals?.successful_visitors ?? 0)
  return {
    totals: {
      uniqueVisitors,
      pageViews: Number(totals?.page_views ?? 0),
      dashboardLoads: Number(totals?.dashboard_loads ?? 0),
      successfulVisitors,
      successRate: uniqueVisitors ? successfulVisitors / uniqueVisitors : 0,
    },
    daily: fillThirtyDays(dailyResult.results ?? [], now),
    updatedAt: now.toISOString(),
  }
}
