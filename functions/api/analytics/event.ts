import {
  recordEvent,
  validEventPayload,
  type AnalyticsEnv,
} from '../../_lib/analytics'

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

function allowedOrigin(request: Request, configured?: string) {
  const origin = request.headers.get('Origin')
  if (!origin || !configured) return true
  try {
    const hostname = new URL(origin).hostname
    return origin === configured || hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export const onRequest: PagesFunction<AnalyticsEnv> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...jsonHeaders, Allow: 'POST' },
    })
  }
  if (!allowedOrigin(request, env.APP_ORIGIN)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
      status: 403,
      headers: jsonHeaders,
    })
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (contentLength > 512) {
    return new Response(JSON.stringify({ error: 'Request body is too large.' }), {
      status: 413,
      headers: jsonHeaders,
    })
  }
  if (!env.ANALYTICS_SALT || env.ANALYTICS_SALT.length < 16) {
    return new Response(JSON.stringify({ error: 'Analytics is not configured.' }), {
      status: 503,
      headers: jsonHeaders,
    })
  }

  try {
    const payload: unknown = await request.json()
    if (!validEventPayload(payload)) {
      return new Response(JSON.stringify({ error: 'Invalid analytics event.' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }
    await recordEvent(env, payload)
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return new Response(JSON.stringify({ error: 'Could not record analytics event.' }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
}
