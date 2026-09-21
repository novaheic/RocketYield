# RocketYield

*Watch your rETH climb.* · rocketyield.net

A small, good-looking dashboard for Rocket Pool stakers. Paste a wallet address or ENS name and see what your rETH is worth and what it has earned, live. Built for friends, meant to stay open on a second monitor. Unofficial community tool, not affiliated with Rocket Pool.

## Why

Today the routine is: open stake.rocketpool.net, type in a balance, do the math. Portfolio trackers like Zapper and DeBank show rETH as one line in a long list. Nothing answers the question stakers actually have: **how much ETH is my rETH worth, and how fast is it growing?**

## What it does

Enter an address, get a single calm screen:

- **Hero: your position in ETH, ticking up.** The current ETH value of your rETH, with a small `+0.00112 since opening` underneath. Fiat value alongside.
- **Earned** today / 7d / 30d / 90d / lifetime, in ETH and fiat.
- **APR / APY**, trailing 7d and 30d.
- **Projections.** Expected earnings per day, month and year at the current rate, plus "at your 30d average" for comparison.
- **Charts.** rETH/ETH rate over time, daily earnings bars, position value with buys and sells marked.
- **Market vs. redemption rate.** Premium or discount on DEXs, for anyone thinking of selling.
- **Milestones.** "0.01 ETH earned in about 3 days."

No wallet connect. Read-only, address in the URL (`?address=vitalik.eth`), so it can be bookmarked and shared.

## Layout

1. **Top:** the ETH balance, large, ticking. Small "since opening" delta beneath it.
2. **Middle strip:** earned today / 7d / 30d / lifetime, and current APR.
3. **Projections card:** day, month, year.
4. **Below the fold:** charts, market rate, milestones.

## Design

- Dark by default, quiet, one big number in the middle. Should look fine from across the room.
- The balance is the hero. "Since opening" is a small supporting detail, not the focus.
- Glanceable at the top for short-term checks, deeper stats and charts below for long-term.
- No account, no settings screen, no clutter.

## How it works

rETH doesn't rebase. Your balance stays fixed and each token is worth more ETH over time, so:

> **Earnings (ETH) = rETH balance × (rate now − rate then)**

Because people buy, sell and move rETH, the balance isn't constant. So the app rebuilds the balance over time from `Transfer` events and adds up earnings piece by piece:

> **Earnings = Σ (balance during period × rate change during that period)**

Any window (7d, 30d, lifetime) is just a slice of that timeline. Buying more rETH doesn't inflate past earnings, and selling doesn't erase them.

Data comes straight from Ethereum:

| Need | Source |
|---|---|
| Current rate | `getExchangeRate()` on the rETH contract |
| Balance | `balanceOf(address)` |
| Rate history | Historical `getExchangeRate` calls (one per day) or oracle update events |
| Balance history | rETH `Transfer` events for the address |
| Fiat price | Any public ETH price API |

**The ticking is an estimate.** As far as I know the on-chain rate updates about once a day, so the real number moves in steps. The page smooths the recent trend into a per-second accrual and snaps to the real rate at each update. The UI should say so, and show a "next update in ~X h" countdown. (Confirm the update cadence in the Rocket Pool docs before shipping.)

## Scope

**v1**
- Single static page, no backend, public RPC
- Earnings from **actual balance history**, so buys, sells and transfers are handled correctly
- Ticking ETH balance, today / 7d / 30d / 90d / lifetime, APR/APY, projections
- Charts: rate over time, daily earnings, position value with buys and sells marked
- Market vs. redemption rate, milestones, fiat toggle

## Stack

Vanilla JS or a light framework, viem for chain reads, a small charting lib, hosted as a static site. An archive-capable RPC (Alchemy or Infura free tier) is the only external dependency that matters.
