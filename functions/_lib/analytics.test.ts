// @vitest-environment node
/// <reference types="@cloudflare/workers-types" />

import { describe, expect, it, vi } from 'vitest'
import { fillThirtyDays, readPublicStats, type AnalyticsEnv } from './analytics'

const env: AnalyticsEnv = {
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  WEB_ANALYTICS_SITE_TAG: 'site-tag',
  CLOUDFLARE_ANALYTICS_TOKEN: 'read-only-token',
}

describe('analytics aggregation helpers', () => {
  it('fills missing days with zeroes for a stable 30-day chart', () => {
    const days = fillThirtyDays(
      [{
        count: 12,
        sum: { visits: 8 },
        dimensions: { date: '2026-09-21' },
      }],
      new Date('2026-09-21T12:00:00.000Z'),
    )

    expect(days).toHaveLength(30)
    expect(days.at(-1)).toMatchObject({
      day: '2026-09-21',
      pageViews: 12,
      visits: 8,
    })
    expect(days[0].pageViews).toBe(0)
  })

  it('reads aggregate visits and page views with no visitor identifier', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        viewer: {
          accounts: [{
            activity: [{
              count: 12,
              sum: { visits: 8 },
              avg: { sampleInterval: 1 },
              dimensions: { date: '2026-09-21' },
            }],
          }],
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const stats = await readPublicStats(
      env,
      new Date('2026-09-21T12:00:00.000Z'),
      request,
    )

    expect(stats.totals).toMatchObject({
      visits: 8,
      pageViews: 12,
      viewsPerVisit: 1.5,
    })
    expect(request).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/graphql',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer read-only-token',
        }),
      }),
    )
    expect(request.mock.calls[0][1].body).not.toContain('visitorId')
  })
})
