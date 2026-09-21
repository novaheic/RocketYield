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

export async function fetchPublicStats(signal?: AbortSignal): Promise<PublicStats> {
  const response = await fetch('/api/analytics/stats', {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('The analytics backend is not running. Use npm run cf:dev.')
    }
    throw new Error('Public statistics are temporarily unavailable.')
  }
  return response.json() as Promise<PublicStats>
}
