import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent, trackPageView } from './telemetry'

describe('privacy-safe telemetry', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('DEV', false)
    window.history.replaceState({}, '', `/telemetry-${crypto.randomUUID()}`)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends only the event type and anonymous visitor ID', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', request)

    await trackEvent('dashboard_loaded')

    const [, options] = request.mock.calls[0]
    const payload = JSON.parse(String(options.body)) as Record<string, unknown>
    expect(payload.type).toBe('dashboard_loaded')
    expect(payload.visitorId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(Object.keys(payload).sort()).toEqual(['type', 'visitorId'])
  })

  it('counts a page only once per browser navigation', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', request)

    trackPageView()
    trackPageView()

    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  })

  it('never surfaces analytics network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(trackEvent('page_view')).resolves.toBeUndefined()
  })
})
