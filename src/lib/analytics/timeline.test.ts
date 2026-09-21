import { describe, expect, it } from 'vitest'
import type { Address, Hash } from 'viem'
import type { RatePoint, TransferPoint } from '../types'
import { buildAnalytics, WAD } from './timeline'

const wallet = '0x1111111111111111111111111111111111111111' as Address
const other = '0x2222222222222222222222222222222222222222' as Address

function transfer(blockNumber: bigint, deltaReth: number, timestamp: number, logIndex = 0): TransferPoint {
  const incoming = deltaReth > 0
  const value = BigInt(Math.abs(deltaReth)) * WAD
  return {
    blockNumber,
    transactionHash: `0x${blockNumber.toString().padStart(64, '0')}` as Hash,
    logIndex,
    timestamp,
    from: incoming ? other : wallet,
    to: incoming ? wallet : other,
    value,
    delta: incoming ? value : -value,
  }
}

function rate(blockNumber: bigint, value: number, timestamp: number): RatePoint {
  return { blockNumber, timestamp, rate: BigInt(Math.round(value * 1e6)) * 10n ** 12n }
}

describe('buildAnalytics', () => {
  it('weights each rate increase by the balance held at that update', () => {
    const transfers = [
      transfer(1n, 10, 100),
      transfer(3n, 10, 300),
      transfer(5n, -5, 500),
    ]
    const rates = [
      rate(0n, 1, 0),
      rate(2n, 1.1, 200),
      rate(4n, 1.2, 400),
      rate(6n, 1.3, 600),
    ]

    const result = buildAnalytics(transfers, rates, 15n * WAD, 700)

    expect(Number(result.earnings.lifetime) / 1e18).toBeCloseTo(4.5)
    expect(result.valueSeries.at(-1)?.balanceReth).toBe(15)
    expect(result.valueSeries.at(-1)?.valueEth).toBeCloseTo(19.5)
  })

  it('does not apply earnings from before a buy to the new balance', () => {
    const result = buildAnalytics(
      [transfer(3n, 10, 300)],
      [rate(1n, 1, 100), rate(2n, 1.1, 200), rate(4n, 1.2, 400)],
      10n * WAD,
      500,
    )

    expect(Number(result.earnings.lifetime) / 1e18).toBeCloseTo(1)
  })

  it('does not erase earnings after a complete exit', () => {
    const result = buildAnalytics(
      [transfer(1n, 4, 100), transfer(3n, -4, 300)],
      [rate(0n, 1, 0), rate(2n, 1.1, 200), rate(4n, 1.2, 400)],
      0n,
      500,
    )

    expect(Number(result.earnings.lifetime) / 1e18).toBeCloseTo(0.4)
    expect(result.projections.current.day).toBe(0n)
  })

  it('closes the prior holding interval before applying same-block transfers', () => {
    const result = buildAnalytics(
      [transfer(2n, 2, 200, 1)],
      [rate(1n, 1, 100), rate(2n, 1.05, 200)],
      2n * WAD,
      300,
    )

    expect(Number(result.earnings.lifetime) / 1e18).toBe(0)
  })

  it('keeps rolling windows and milestone projections finite', () => {
    const now = 40 * 86_400
    const result = buildAnalytics(
      [transfer(1n, 8, 0)],
      [
        rate(0n, 1, 0),
        rate(2n, 1.01, now - 10 * 86_400),
        rate(3n, 1.02, now - 2 * 86_400),
        rate(4n, 1.021, now),
      ],
      8n * WAD,
      now,
    )

    expect(result.earnings.sevenDays).toBeGreaterThan(0n)
    expect(result.earnings.thirtyDays).toBeGreaterThanOrEqual(result.earnings.sevenDays)
    expect(Number.isFinite(result.yields.apr7d)).toBe(true)
    expect(result.milestone?.etaDays).not.toBeNaN()
  })
})
