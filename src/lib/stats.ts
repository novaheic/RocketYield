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

export async function fetchPublicStats(signal?: AbortSignal): Promise<PublicStats> {
  const response = await fetch('/api/analytics/stats', {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('The local analytics backend is not running. Use npm run cf:dev.')
    }
    throw new Error('Public statistics are temporarily unavailable.')
  }
  return response.json() as Promise<PublicStats>
}
