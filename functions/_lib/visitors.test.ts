// @vitest-environment node
/// <reference types="@cloudflare/workers-types" />
/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { fillDays, isCountableVisit, readVisitorStats, recordVisit, resolveRange } from './visitors'

type Param = string | number | null

function createD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:')

  function statement(sql: string, params: Param[] = []) {
    const run = () => {
      const result = sqlite.prepare(sql).run(...params)
      return { success: true, results: [], meta: { changes: Number(result.changes) } }
    }
    const all = () => ({
      success: true,
      results: sqlite.prepare(sql).all(...params).map((row) => ({ ...row })),
      meta: { changes: 0 },
    })
    const isRead = /^\s*select/i.test(sql)
    return {
      bind: (...next: Param[]) => statement(sql, next),
      run: async () => run(),
      all: async () => all(),
      first: async () => all().results[0] ?? null,
      execute: () => (isRead ? all() : run()),
    }
  }

  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Array<ReturnType<typeof statement>>) =>
      statements.map((entry) => entry.execute()),
  } as unknown as D1Database
}

const alice = { ip: '203.0.113.1', userAgent: 'Mozilla/5.0 Firefox/140.0' }
const bob = { ip: '203.0.113.2', userAgent: 'Mozilla/5.0 Firefox/140.0' }

describe('visitor counting', () => {
  it('counts every page view but each visitor once per day', async () => {
    const db = createD1()
    const now = new Date('2026-10-02T12:00:00.000Z')

    await recordVisit(db, alice, now)
    await recordVisit(db, alice, now)
    await recordVisit(db, bob, now)

    const stats = await readVisitorStats(db, null, now)
    expect(stats.today).toEqual({ visitors: 2, pageViews: 3 })
    expect(stats.allTime).toMatchObject({ visitors: 2, pageViews: 3, since: '2026-10-02' })
  })

  it('counts a returning visitor again on a new day and forgets old hashes', async () => {
    const db = createD1()
    let salt = 0
    const createSalt = () => `salt-${(salt += 1)}`

    await recordVisit(db, alice, new Date('2026-10-01T23:59:00.000Z'), createSalt)
    await recordVisit(db, alice, new Date('2026-10-02T00:01:00.000Z'), createSalt)

    const stats = await readVisitorStats(db, null, new Date('2026-10-02T12:00:00.000Z'))
    expect(stats.allTime.visitors).toBe(2)
    const hashes = await db.prepare('SELECT day FROM visitor_hashes').all<{ day: string }>()
    expect(hashes.results.map((row) => row.day)).toEqual(['2026-10-02'])
    const salts = await db.prepare('SELECT day FROM daily_salts').all<{ day: string }>()
    expect(salts.results.map((row) => row.day)).toEqual(['2026-10-02'])
  })

  it('returns a full calendar year and lists every year with data', async () => {
    const db = createD1()
    await recordVisit(db, alice, new Date('2026-03-04T10:00:00.000Z'))
    await recordVisit(db, bob, new Date('2027-01-02T10:00:00.000Z'))

    const now = new Date('2027-06-01T12:00:00.000Z')
    const year = await readVisitorStats(db, '2026', now)
    expect(year.range).toBe('2026')
    expect(year.daily).toHaveLength(365)
    expect(year.daily.find((day) => day.day === '2026-03-04')).toEqual({
      day: '2026-03-04',
      visitors: 1,
      pageViews: 1,
    })
    expect(year.totals).toEqual({ visitors: 1, pageViews: 1 })
    expect(year.years).toEqual([2027, 2026])
    expect(year.allTime.visitors).toBe(2)
  })
})

describe('visitor ranges', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')

  it('defaults to the last 30 days', () => {
    expect(resolveRange(null, now)).toEqual({ range: '30d', start: '2026-09-03', end: '2026-10-02' })
    expect(resolveRange('nonsense', now).range).toBe('30d')
    expect(resolveRange('2031', now).range).toBe('30d')
  })

  it('stops the current year at today', () => {
    expect(resolveRange('2026', now)).toEqual({ range: '2026', start: '2026-01-01', end: '2026-10-02' })
  })

  it('fills days without visits with zeroes', () => {
    const days = fillDays([{ day: '2026-10-02', visitors: 4, pageViews: 9 }], '2026-09-30', '2026-10-02')
    expect(days.map((day) => day.visitors)).toEqual([0, 0, 4])
  })
})

describe('countable visits', () => {
  const visit = (headers: Record<string, string>) =>
    new Request('https://rocketyield.net/api/visitors', { method: 'POST', headers })
  const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36'

  it('accepts same-origin browser page loads', () => {
    expect(isCountableVisit(visit({ Origin: 'https://rocketyield.net', 'User-Agent': browser }))).toBe(true)
  })

  it('rejects cross-origin posts, bots, and prefetches', () => {
    expect(isCountableVisit(visit({ Origin: 'https://evil.example', 'User-Agent': browser }))).toBe(false)
    expect(isCountableVisit(visit({ 'User-Agent': browser }))).toBe(false)
    expect(isCountableVisit(visit({
      Origin: 'https://rocketyield.net',
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    }))).toBe(false)
    expect(isCountableVisit(visit({
      Origin: 'https://rocketyield.net',
      'User-Agent': browser,
      'Sec-Purpose': 'prefetch',
    }))).toBe(false)
  })
})
