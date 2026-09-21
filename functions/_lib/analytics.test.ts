// @vitest-environment node
/// <reference types="@cloudflare/workers-types" />

import { describe, expect, it, vi } from 'vitest'
import { onRequest as eventHandler } from '../api/analytics/event'
import { fillThirtyDays, validEventPayload, type AnalyticsEnv } from './analytics'

function analyticsEnv() {
  const statement = {
    bind: vi.fn(),
  }
  statement.bind.mockReturnValue(statement)
  const batch = vi.fn().mockResolvedValue([])
  const prepare = vi.fn().mockReturnValue(statement)
  return {
    env: {
      ANALYTICS_DB: { batch, prepare } as unknown as D1Database,
      ANALYTICS_SALT: 'a-long-private-test-salt',
      APP_ORIGIN: 'https://rocketyield.net',
    } satisfies AnalyticsEnv,
    batch,
  }
}

function context(request: Request, env: AnalyticsEnv) {
  return {
    request,
    env,
    params: {},
    data: {},
    functionPath: '/api/analytics/event',
    waitUntil: vi.fn(),
    next: vi.fn(),
  } as unknown as Parameters<typeof eventHandler>[0]
}

describe('analytics event handler', () => {
  it('rejects event names outside the small allowlist', async () => {
    const { env, batch } = analyticsEnv()
    const request = new Request('https://rocketyield.net/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://rocketyield.net' },
      body: JSON.stringify({
        type: 'wallet_address',
        visitorId: '67fd9d31-4813-4a85-a8e9-e7f6f88db938',
      }),
    })

    const response = await eventHandler(context(request, env))

    expect(response?.status).toBe(400)
    expect(batch).not.toHaveBeenCalled()
  })

  it('records a valid aggregate event without retaining the browser ID', async () => {
    const { env, batch } = analyticsEnv()
    const visitorId = '67fd9d31-4813-4a85-a8e9-e7f6f88db938'
    const request = new Request('https://rocketyield.net/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://rocketyield.net' },
      body: JSON.stringify({ type: 'dashboard_loaded', visitorId }),
    })

    const response = await eventHandler(context(request, env))

    expect(response?.status).toBe(204)
    expect(batch).toHaveBeenCalledOnce()
    expect(JSON.stringify(batch.mock.calls)).not.toContain(visitorId)
  })

  it('rejects cross-origin writes in production', async () => {
    const { env, batch } = analyticsEnv()
    const request = new Request('https://rocketyield.net/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
      body: JSON.stringify({
        type: 'page_view',
        visitorId: '67fd9d31-4813-4a85-a8e9-e7f6f88db938',
      }),
    })

    const response = await eventHandler(context(request, env))

    expect(response?.status).toBe(403)
    expect(batch).not.toHaveBeenCalled()
  })
})

describe('analytics aggregation helpers', () => {
  it('validates anonymous aggregate payloads only', () => {
    expect(validEventPayload({
      type: 'page_view',
      visitorId: '67fd9d31-4813-4a85-a8e9-e7f6f88db938',
    })).toBe(true)
    expect(validEventPayload({ type: 'page_view', visitorId: 'wallet.eth' })).toBe(false)
  })

  it('fills missing days with zeroes for a stable 30-day chart', () => {
    const days = fillThirtyDays(
      [{
        day: '2026-09-21',
        page_views: 12,
        dashboard_loads: 7,
        unique_visitors: 8,
        successful_visitors: 5,
      }],
      new Date('2026-09-21T12:00:00.000Z'),
    )

    expect(days).toHaveLength(30)
    expect(days.at(-1)).toMatchObject({
      day: '2026-09-21',
      pageViews: 12,
      uniqueVisitors: 8,
    })
    expect(days[0].pageViews).toBe(0)
  })
})
