import { readPublicRates, type RatesEnv } from '../_lib/rates'

export const onRequest: PagesFunction<RatesEnv> = async ({ request, env }) => {
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
    const rates = await readPublicRates(env)
    return new Response(JSON.stringify(rates), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': rates.stale
          ? 'public, max-age=60, s-maxage=60'
          : 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (error) {
    console.error('rates failed', error)
    return new Response(JSON.stringify({ error: 'Shared Rocket Pool rate history is temporarily unavailable.' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }
}
