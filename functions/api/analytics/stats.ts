import { readPublicStats, type AnalyticsEnv } from '../../_lib/analytics'

export const onRequest: PagesFunction<AnalyticsEnv> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        Allow: 'GET',
      },
    })
  }
  try {
    const stats = await readPublicStats(env)
    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Public statistics are temporarily unavailable.' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }
}
