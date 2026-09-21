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
- Historical archive calls sample `getExchangeRate()` at every transfer block, daily for the recent chart, and monthly for older chart history. Requests are throttled for free-tier limits. The current balances contract is resolved through RocketStorage for the exact latest protocol-update time.
- Earnings are calculated as the sum of each held balance multiplied by the next realized rate change. Buying more rETH does not inflate earlier earnings, and selling does not remove earnings already realized.
- CoinGecko supplies the optional ETH/USD display. GeckoTerminal supplies the optional Curve rETH/WETH spot quote. Either may fail without blocking on-chain ETH figures.
- IndexedDB caches completed block ranges locally. Refreshes request only newer blocks.

The ticking balance is explicitly an estimate. Rocket Pool’s rate changes in discrete oracle updates, usually around every 24 hours. RocketYield smooths the recent realized rate between updates and snaps back to the next on-chain value.

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

Build with `npm run build` and publish `dist/` to any static host. Configure `VITE_ETHEREUM_RPC_URL` at build time. The core rETH dashboard remains static; the optional public statistics described below require Cloudflare Pages Functions and D1.

## Free public statistics on Cloudflare

The `/stats` page uses Cloudflare Pages Functions and a free D1 database. It displays aggregate counts only. Wallet addresses, ENS names, balances, earnings, RPC details, and error contents are never sent to analytics.

### Test locally

1. Copy `.dev.vars.example` to `.dev.vars` and replace the example value with a long random string.
2. Create the local database and start Pages:

```bash
npm run db:migrate:local
npm run cf:dev
```

Open `http://localhost:8788/stats`. Regular `npm run dev` still runs the frontend, but its analytics endpoints are intentionally absent.

### Deploy on the free tier

1. Create a free Cloudflare account, then sign in from the project:

```bash
npx wrangler login
```

2. Create the D1 database:

```bash
npx wrangler d1 create rocketyield-analytics
```

3. Copy the returned `database_id` into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Apply the production migration:

```bash
npm run db:migrate:remote
```

5. Create the Pages project, add the server-only analytics salt, then deploy:

```bash
npx wrangler pages project create rocketyield
npx wrangler pages secret put ANALYTICS_SALT --project-name rocketyield
npm run build
npx wrangler pages deploy dist --project-name rocketyield
```

6. Replace `APP_ORIGIN` in `wrangler.jsonc` with the exact Pages URL Cloudflare returns, then build and deploy once more.

The anonymous browser ID is salted and hashed inside the Function before D1 storage. The public API returns only totals and daily aggregates. These numbers are intentionally approximate: bots, cleared browser storage, and determined request spam can affect public counters.

## Limits

First load for an old, active wallet can require several historical contract reads. RocketYield throttles and caches them, but an endpoint may still rate-limit or reject archive access. The UI reports those failures without substituting sample values.

Unofficial community tool. Not affiliated with Rocket Pool.
