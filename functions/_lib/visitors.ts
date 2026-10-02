/** First-party, cookieless visitor counting backed by Cloudflare D1. */

export interface VisitorsEnv {
  STATS_DB: D1Database
}

export interface DailyVisitors {
  day: string
  visitors: number
  pageViews: number
}

export interface VisitorCounts {
  visitors: number
  pageViews: number
}

export interface VisitorStats {
  range: string
  years: number[]
  daily: DailyVisitors[]
  totals: VisitorCounts
  today: VisitorCounts
  allTime: VisitorCounts & { since: string | null }
  updatedAt: string
}

export const DEFAULT_RANGE = '30d'
const FIRST_YEAR = 2026

const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|prerender|preview|monitor|uptime|facebookexternalhit|embedly|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\//i

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS daily_visits (
    day TEXT PRIMARY KEY,
    visitors INTEGER NOT NULL DEFAULT 0,
    page_views INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS daily_salts (
    day TEXT PRIMARY KEY,
    salt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS visitor_hashes (
    day TEXT NOT NULL,
    hash TEXT NOT NULL,
    PRIMARY KEY (day, hash)
  ) WITHOUT ROWID`,
]

const schemaReady = new WeakMap<D1Database, Promise<unknown>>()
const saltCache = new WeakMap<D1Database, { day: string; salt: string }>()

function ensureSchema(db: D1Database) {
  let ready = schemaReady.get(db)
  if (!ready) {
    ready = db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((error: unknown) => {
      schemaReady.delete(db)
      throw error
    })
    schemaReady.set(db, ready)
  }
  return ready
}

export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return isoDay(date)
}

/** Only real page loads from this site's own pages are counted. */
export function isCountableVisit(request: Request) {
  const origin = request.headers.get('Origin')
  if (!origin || origin !== new URL(request.url).origin) return false
  const purpose = request.headers.get('Sec-Purpose') ?? request.headers.get('Purpose') ?? ''
  if (/prefetch|prerender/i.test(purpose)) return false
  const userAgent = request.headers.get('User-Agent') ?? ''
  return userAgent.length > 0 && !BOT_PATTERN.test(userAgent)
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function dailySalt(db: D1Database, day: string, createSalt: () => string) {
  const cached = saltCache.get(db)
  if (cached?.day === day) return cached.salt

  const created = await db
    .prepare('INSERT OR IGNORE INTO daily_salts (day, salt) VALUES (?, ?)')
    .bind(day, createSalt())
    .run()
  if (created.meta.changes > 0) {
    // Deleting old salts makes earlier visitor hashes impossible to link or recompute.
    await db.batch([
      db.prepare('DELETE FROM visitor_hashes WHERE day < ?').bind(day),
      db.prepare('DELETE FROM daily_salts WHERE day < ?').bind(day),
    ])
  }
  const row = await db
    .prepare('SELECT salt FROM daily_salts WHERE day = ?')
    .bind(day)
    .first<{ salt: string }>()
  if (!row) throw new Error('Daily salt is missing.')
  saltCache.set(db, { day, salt: row.salt })
  return row.salt
}

export async function recordVisit(
  db: D1Database,
  visit: { ip: string; userAgent: string },
  now = new Date(),
  createSalt: () => string = () => crypto.randomUUID(),
) {
  await ensureSchema(db)
  const day = isoDay(now)
  const salt = await dailySalt(db, day, createSalt)
  const hash = (await sha256Hex(`${salt}|${visit.ip}|${visit.userAgent}`)).slice(0, 32)

  const seen = await db
    .prepare('INSERT OR IGNORE INTO visitor_hashes (day, hash) VALUES (?, ?)')
    .bind(day, hash)
    .run()
  const newVisitor = seen.meta.changes > 0 ? 1 : 0

  await db
    .prepare(
      `INSERT INTO daily_visits (day, visitors, page_views) VALUES (?, ?, 1)
       ON CONFLICT(day) DO UPDATE SET
         visitors = visitors + excluded.visitors,
         page_views = page_views + 1`,
    )
    .bind(day, newVisitor)
    .run()

  return { newVisitor: newVisitor === 1 }
}

export function resolveRange(value: string | null, now = new Date()) {
  const today = isoDay(now)
  const year = Number(value)
  if (value && /^\d{4}$/.test(value) && year >= FIRST_YEAR && year <= now.getUTCFullYear()) {
    const end = `${value}-12-31`
    return { range: value, start: `${value}-01-01`, end: end < today ? end : today }
  }
  return { range: DEFAULT_RANGE, start: addDays(today, -29), end: today }
}

export function fillDays(rows: DailyVisitors[], start: string, end: string): DailyVisitors[] {
  const byDay = new Map(rows.map((row) => [row.day, row]))
  const output: DailyVisitors[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const row = byDay.get(day)
    output.push({ day, visitors: row?.visitors ?? 0, pageViews: row?.pageViews ?? 0 })
  }
  return output
}

function sum(rows: DailyVisitors[]): VisitorCounts {
  return rows.reduce(
    (total, row) => ({
      visitors: total.visitors + row.visitors,
      pageViews: total.pageViews + row.pageViews,
    }),
    { visitors: 0, pageViews: 0 },
  )
}

export async function readVisitorStats(
  db: D1Database,
  rangeParam: string | null,
  now = new Date(),
): Promise<VisitorStats> {
  await ensureSchema(db)
  const { range, start, end } = resolveRange(rangeParam, now)
  const today = isoDay(now)

  const [rangeRows, allTimeRows, yearRows, todayRows] = await db.batch([
    db
      .prepare(
        `SELECT day, visitors, page_views AS pageViews FROM daily_visits
         WHERE day BETWEEN ? AND ? ORDER BY day`,
      )
      .bind(start, end),
    db.prepare(
      `SELECT COALESCE(SUM(visitors), 0) AS visitors, COALESCE(SUM(page_views), 0) AS pageViews,
         MIN(day) AS since FROM daily_visits`,
    ),
    db.prepare('SELECT DISTINCT CAST(substr(day, 1, 4) AS INTEGER) AS year FROM daily_visits'),
    db
      .prepare('SELECT visitors, page_views AS pageViews FROM daily_visits WHERE day = ?')
      .bind(today),
  ])

  const daily = fillDays(
    (rangeRows.results as DailyVisitors[]).map((row) => ({
      day: row.day,
      visitors: Number(row.visitors),
      pageViews: Number(row.pageViews),
    })),
    start,
    end,
  )
  const allTime = (allTimeRows.results[0] ?? {}) as Partial<VisitorCounts & { since: string | null }>
  const todayRow = (todayRows.results[0] ?? {}) as Partial<VisitorCounts>
  const years = new Set((yearRows.results as Array<{ year: number }>).map((row) => Number(row.year)))
  years.add(now.getUTCFullYear())

  return {
    range,
    years: [...years].sort((a, b) => b - a),
    daily,
    totals: sum(daily),
    today: {
      visitors: Number(todayRow.visitors ?? 0),
      pageViews: Number(todayRow.pageViews ?? 0),
    },
    allTime: {
      visitors: Number(allTime.visitors ?? 0),
      pageViews: Number(allTime.pageViews ?? 0),
      since: allTime.since ?? null,
    },
    updatedAt: now.toISOString(),
  }
}
