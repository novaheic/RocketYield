import { describe, expect, it } from 'vitest'
import { formatFiat } from './format'

describe('formatFiat', () => {
  it('formats values with the selected currency', () => {
    expect(formatFiat(1_000_000_000_000_000_000n, 2, 'EUR')).toBe('€2.00')
    expect(formatFiat(1_000_000_000_000_000_000n, 150, 'JPY')).toBe('¥150')
  })

  it('names the selected currency when its rate is unavailable', () => {
    expect(formatFiat(1n, null, 'CAD')).toBe('CAD unavailable')
  })
})
