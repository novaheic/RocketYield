import {
  fetchHistoricalEthUsd,
  parseHistoricalPriceQuery,
} from '../_lib/historicalPrices'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
}

export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store', Allow: 'GET' },
    })
  }

  const query = parseHistoricalPriceQuery(new URL(request.url))
  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Query must include integer start and span (1–4000 days).' }),
      {
        status: 400,
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
      },
    )
  }

  try {
    const prices = await fetchHistoricalEthUsd(query.start, query.span, request.signal)
    return new Response(JSON.stringify({ prices }), {
      headers: {
        ...JSON_HEADERS,
        // Daily candles are stable; edge-cache aggressively and let browsers refresh hourly.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    })
  } catch (error) {
    console.error('historical-prices failed', error)
    return new Response(JSON.stringify({ error: 'Historical ETH prices are temporarily unavailable.' }), {
      status: 503,
      headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
    })
  }
}
