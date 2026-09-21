export interface AnalyticsEnv {
  CLOUDFLARE_ACCOUNT_ID: string
  WEB_ANALYTICS_SITE_TAG: string
  CLOUDFLARE_ANALYTICS_TOKEN: string
}

export interface DailyStat {
  day: string
  pageViews: number
  visits: number
}

export interface PublicStats {
  totals: {
    visits: number
    pageViews: number
    viewsPerVisit: number
    visitsThirtyDays: number
    pageViewsThirtyDays: number
    periodDays: number
  }
  daily: DailyStat[]
  updatedAt: string
  estimated: boolean
}

interface CloudflareRow {
  count: number
  sum?: { visits?: number | null } | null
  avg?: { sampleInterval?: number | null } | null
  dimensions: { date: string }
}

export function fillThirtyDays(rows: CloudflareRow[], now = new Date()): DailyStat[] {
  const byDay = new Map(rows.map((row) => [row.dimensions.date, row]))
  const output: DailyStat[] = []
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  cursor.setUTCDate(cursor.getUTCDate() - 29)

  for (let index = 0; index < 30; index += 1) {
    const day = cursor.toISOString().slice(0, 10)
    const row = byDay.get(day)
    output.push({
      day,
      pageViews: Number(row?.count ?? 0),
      visits: Number(row?.sum?.visits ?? 0),
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return output
}

const ANALYTICS_QUERY = `
  query RocketYieldAnalytics(
    $accountTag: String!
    $siteTag: String!
    $start: Date!
    $end: Date!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        activity: rumPageloadEventsAdaptiveGroups(
          limit: 1000
          orderBy: [date_ASC]
          filter: {
            siteTag: $siteTag
            date_geq: $start
            date_leq: $end
          }
        ) {
          count
          sum { visits }
          avg { sampleInterval }
          dimensions { date }
        }
      }
    }
  }
`

export async function readPublicStats(
  env: AnalyticsEnv,
  now = new Date(),
  request: typeof fetch = fetch,
): Promise<PublicStats> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - 179)

  const response = await request('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: ANALYTICS_QUERY,
      variables: {
        accountTag: env.CLOUDFLARE_ACCOUNT_ID,
        siteTag: env.WEB_ANALYTICS_SITE_TAG,
        start: start.toISOString().slice(0, 10),
        end: now.toISOString().slice(0, 10),
      },
    }),
  })

  if (!response.ok) throw new Error(`Cloudflare Analytics returned ${response.status}.`)
  const body = await response.json() as {
    data?: { viewer?: { accounts?: Array<{ activity?: CloudflareRow[] }> } }
    errors?: unknown[]
  }
  if (body.errors?.length) throw new Error('Cloudflare Analytics query failed.')

  const rows = body.data?.viewer?.accounts?.[0]?.activity ?? []
  const daily = fillThirtyDays(rows, now)
  const visits = rows.reduce((total, row) => total + Number(row.sum?.visits ?? 0), 0)
  const pageViews = rows.reduce((total, row) => total + Number(row.count ?? 0), 0)
  const visitsThirtyDays = daily.reduce((total, row) => total + row.visits, 0)
  const pageViewsThirtyDays = daily.reduce((total, row) => total + row.pageViews, 0)

  return {
    totals: {
      visits,
      pageViews,
      viewsPerVisit: visits ? pageViews / visits : 0,
      visitsThirtyDays,
      pageViewsThirtyDays,
      periodDays: 180,
    },
    daily,
    updatedAt: now.toISOString(),
    estimated: rows.some((row) => Number(row.avg?.sampleInterval ?? 1) > 1),
  }
}
