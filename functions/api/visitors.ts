import { isCountableVisit, readVisitorStats, recordVisit, type VisitorsEnv } from '../_lib/visitors'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

export const onRequest: PagesFunction<VisitorsEnv> = async ({ request, env }) => {
  if (request.method === 'POST') {
    if (!isCountableVisit(request)) return new Response(null, { status: 204 })
    try {
      await recordVisit(env.STATS_DB, {
        ip: request.headers.get('CF-Connecting-IP') ?? '',
        userAgent: request.headers.get('User-Agent') ?? '',
      })
      return new Response(null, { status: 204 })
    } catch (error) {
      console.error('visit record failed', error)
      return new Response(null, { status: 500 })
    }
  }

  if (request.method === 'GET') {
    try {
      const range = new URL(request.url).searchParams.get('range')
      const stats = await readVisitorStats(env.STATS_DB, range)
      return new Response(JSON.stringify(stats), { headers: JSON_HEADERS })
    } catch (error) {
      console.error('visitor stats failed', error)
      return new Response(JSON.stringify({ error: 'Visitor statistics are temporarily unavailable.' }), {
        status: 500,
        headers: JSON_HEADERS,
      })
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: { ...JSON_HEADERS, Allow: 'GET, POST' },
  })
}
