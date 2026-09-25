# RocketYield

A quiet, read-only dashboard for Rocket Pool stakers. Enter an Ethereum address or ENS name to see the ETH value of its rETH, balance-weighted earnings, trailing yield, projections, and transfer-aware history.

RocketYield never connects a wallet and never asks for a signature. The tracked address lives in the URL so a view can be bookmarked or shared.

## Local setup

Requirements: Node.js 20.19+ (or 22.12+) and an Ethereum mainnet RPC endpoint that supports archive reads and broad `eth_getLogs` queries.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set `VITE_ETHEREUM_RPC_URL` in `.env.local`. The example uses an Alchemy URL placeholder; Infura or another archive-capable provider also works. Generic free public endpoints often reject the lifetime log ranges this app needs. A Vite environment variable is visible to the browser, so apply provider domain restrictions and never treat the URL as a server-side secret.

## Data model

- Current balance and redemption rate come from the mainnet rETH contract.
- On Alchemy, the app pages through `alchemy_getAssetTransfers`; other providers use filtered rETH `Transfer` logs. Both paths reconstruct the balance held at each point in time without Alchemy Free Tier’s 10-block log-range limit.
- The shared rETH/ETH rate timeline (monthly older points, daily for the latest ~90 days) is served from Cloudflare KV via `GET /api/rates`, refreshed lazily from an archive RPC. The browser only fills rates at that wallet’s transfer blocks (and falls back to full client sampling when the API is unavailable, e.g. plain `npm run dev`).
- Earnings are calculated as the sum of each held balance multiplied by the next realized rate change. Buying more rETH does not inflate earlier earnings, and selling does not remove earnings already realized.
- CoinGecko supplies ETH prices in USD, EUR, AUD, CAD, CNY, GBP, JPY, and KRW. The selected fiat currency is remembered in localStorage. GeckoTerminal supplies the optional Curve rETH/WETH spot quote. Either provider may fail without blocking on-chain ETH figures.
- IndexedDB caches completed block ranges locally. Refreshes request only newer blocks.

The ticking balance is explicitly an estimate. Rocket Pool’s rate changes in discrete oracle updates, usually around every 24 hours. RocketYield smooths the recent realized rate between updates and snaps back to the next on-chain value.

## Methodology, privacy, and legal pages

- `/methodology` documents contracts, formulas, sampling, estimates, sources, and limitations in English and German.
- `/impressum` contains the German provider information and an English legal-notice translation.
- `/privacy` and `/datenschutz` explain hosting, RPC, price providers, local storage, cookieless analytics, and data-subject rights in German and English.
- Every main surface links to these pages through the footer.

Cloudflare Web Analytics provides aggregate visits and page views without cookies, localStorage, browser IDs, individual profiles, or fingerprinting. Successful dashboard loads are not tracked.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
npm run preview
```

## Static deployment

Build with `npm run build` and publish `dist/` to any static host. Configure `VITE_ETHEREUM_RPC_URL` at build time. The core UI can run as a static site with client-side history reads; shared rate caching and public statistics require Cloudflare Pages Functions.

## Shared Rocket Pool rate history

`GET /api/rates` returns the shared exchange-rate timeline from Cloudflare KV. When the cache is empty or older than about six hours (or more than ~one day of blocks behind tip), the Function refreshes it from Ethereum using a server-only `ETHEREUM_RPC_URL` secret. The first cold refresh after deploy can take a moment; later visitors reuse the cache.

### Wire up KV and the RPC secret

1. Create KV namespaces and put their IDs into `wrangler.jsonc`:

```bash
npx wrangler kv namespace create RATE_HISTORY
npx wrangler kv namespace create RATE_HISTORY --preview
```

2. Add the archive RPC URL as a Pages secret (and in `.dev.vars` for local Pages):

```bash
npx wrangler pages secret put ETHEREUM_RPC_URL --project-name rocketyield
```

3. Copy `.dev.vars.example` to `.dev.vars`, set `ETHEREUM_RPC_URL`, then run:

```bash
npm run cf:dev
```

Open `http://localhost:8788` and load a wallet. Regular `npm run dev` still works: when `/api/rates` is absent the browser falls back to sampling the shared grid itself.

## Free public statistics on Cloudflare

The `/stats` page uses a Cloudflare Pages Function to read aggregate Web Analytics data with a server-only token. It displays visits and page views, not successful reads or identifiable users. Wallet addresses, ENS names, balances, earnings, RPC details, and error contents are never sent to analytics.

### Test locally

1. Complete the Cloudflare setup below (and the rate-history KV setup above if you want `/api/rates`).
2. Copy `.dev.vars.example` to `.dev.vars` and add the read-only API token plus `ETHEREUM_RPC_URL`.
3. Put the Cloudflare account ID and Web Analytics site tag in `wrangler.jsonc`.
4. Start Pages:

```bash
npm run cf:dev
```

Open `http://localhost:8788/stats`. Regular `npm run dev` still runs the frontend, but its server-side stats and rates endpoints are absent.

### Deploy on the free tier

1. Create a free Cloudflare account, then sign in from the project:

```bash
npx wrangler login
```

2. Create the Pages project and deploy once:

```bash
npx wrangler pages project create rocketyield
npm run build
npx wrangler pages deploy dist --project-name rocketyield
```

3. In Cloudflare, open the Pages project and enable Web Analytics. Copy its site tag.
4. Create a dedicated API token with only `Account Analytics: Read`.
5. Copy the account ID and site tag into `wrangler.jsonc`, then add secrets:

```bash
npx wrangler pages secret put CLOUDFLARE_ANALYTICS_TOKEN --project-name rocketyield
npx wrangler pages secret put ETHEREUM_RPC_URL --project-name rocketyield
npm run build
npx wrangler pages deploy dist --project-name rocketyield
```

Also set the `RATE_HISTORY` KV namespace IDs in `wrangler.jsonc` (see Shared Rocket Pool rate history above).

The analytics token never reaches the browser. The public API returns only totals and daily aggregates. Web Analytics does not use cookies, localStorage, browser IDs, or fingerprinting. Visits are still approximate and can include bots; Cloudflare may sample higher-volume data.

## Limits

First load for an old, active wallet still needs that address’s transfer history. Shared rate points come from `/api/rates` when Cloudflare Functions are configured; otherwise the browser samples the grid itself. An endpoint may still rate-limit or reject archive access. The UI reports those failures without substituting sample values.

Unofficial community tool. Not affiliated with Rocket Pool.
