import { describe, expect, it } from 'vitest'
import {
  formatFiat,
  formatFiatValue,
  liveEthFractionDigits,
  liveFiatFractionDigits,
} from './format'

describe('formatFiat', () => {
  it('formats values with the selected currency', () => {
    expect(formatFiat(1_000_000_000_000_000_000n, 2, 'EUR')).toBe('€2.00')
    expect(formatFiat(1_000_000_000_000_000_000n, 150, 'JPY')).toBe('¥150')
  })

  it('names the selected currency when its rate is unavailable', () => {
    expect(formatFiat(1n, null, 'CAD')).toBe('CAD unavailable')
  })
})

describe('formatFiatValue', () => {
  it('formats numeric fiat amounts', () => {
    expect(formatFiatValue(2, 'EUR')).toBe('€2.00')
    expect(formatFiatValue(150, 'JPY')).toBe('¥150')
  })

  it('can prefix positive amounts with a plus sign', () => {
    expect(formatFiatValue(0.04, 'USD', { signed: true })).toBe('+$0.04')
  })

  it('keeps a fixed fraction width when requested', () => {
    expect(formatFiatValue(12.3, 'USD', { fractionDigits: 5 })).toBe('$12.30000')
    expect(formatFiatValue(0.04, 'USD', { signed: true, fractionDigits: 5 })).toBe('+$0.04000')
  })
})

describe('liveEthFractionDigits', () => {
  it('keeps the previous 9-digit floor for zero or unknown yield', () => {
    expect(liveEthFractionDigits(0)).toBe(9)
    expect(liveEthFractionDigits(Number.NaN)).toBe(9)
  })

  it('adds places so a small balance ticks about every 40ms', () => {
    // ~0.389 ETH at ~2.5% APY ≈ 3e-10 ETH/s → 9 digits only move every few seconds
    expect(liveEthFractionDigits(3e-10)).toBe(11)
  })

  it('caps at 12 digits so the hero stays readable', () => {
    expect(liveEthFractionDigits(1e-14)).toBe(12)
  })

  it('stays near 9 digits when accrual is already fast', () => {
    expect(liveEthFractionDigits(5e-8)).toBe(9)
  })
})

describe('liveFiatFractionDigits', () => {
  it('keeps fiat ticks aligned with ETH display precision', () => {
    expect(liveFiatFractionDigits(3_000, 9)).toBe(6)
    expect(liveFiatFractionDigits(150, 9)).toBe(7)
    expect(liveFiatFractionDigits(3_000, 11)).toBe(8)
  })

  it('caps fiat places for the visit delta line', () => {
    expect(liveFiatFractionDigits(150, 12)).toBe(10)
  })
})
