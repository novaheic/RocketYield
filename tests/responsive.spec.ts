import { expect, test } from '@playwright/test'

test('landing page contains the real product entry flow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('what it has actually earned')
  await expect(page.getByLabel('Ethereum address or ENS name')).toBeVisible()
  await expect(page.getByText('No wallet connection, signature, or account.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Stats' }).first()).toBeVisible()
})

test('a maximum-length ENS-style string does not overflow the viewport', async ({ page }) => {
  await page.goto('/')
  const longName = `${'averylongwalletlabel'.repeat(3)}.eth`
  await page.getByLabel('Ethereum address or ENS name').fill(longName)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('full addresses remain contained at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.getByLabel('Ethereum address or ENS name').fill(
    '0x1234567890abcdef1234567890abcdef12345678',
  )
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('the wide earnings table scrolls inside its section on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.setContent(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>* { box-sizing: border-box; } html, body { margin: 0; }</style>
    <main style="width: 100%; padding: 16px">
      <section class="earnings-history">
        <div class="earnings-history-toolbar">
          <span>1,825 earning days</span>
          <div class="earnings-export-actions"><button>CSV</button><button>JSON</button></div>
        </div>
        <div class="earnings-table-scroll">
          <table class="earnings-table">
            <thead><tr>
              <th>Date</th><th>Change (ETH)</th><th>Value (USD)</th>
              <th>ETH Price (USD)</th><th>Annualized Yield</th><th>Balance (ETH)</th>
            </tr></thead>
            <tbody><tr>
              <th>Sep 22, 2026</th><td>+0.00123456</td><td>$3.70</td>
              <td>$3,000.00</td><td>4.12%</td><td>12.345678</td>
            </tr></tbody>
          </table>
        </div>
        <nav class="earnings-pagination">
          <button>First</button><button>Previous</button><select><option>Page 1 of 61</option></select>
          <button>Next</button><button>Last</button>
        </nav>
      </section>
    </main>
  `)
  await page.addStyleTag({ path: 'src/styles/tokens.css' })
  await page.addStyleTag({ path: 'src/styles/app.css' })

  const layout = await page.evaluate(() => {
    const scroll = document.querySelector('.earnings-table-scroll') as HTMLElement
    return {
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      tableScrolls: scroll.scrollWidth > scroll.clientWidth,
    }
  })
  expect(layout.pageOverflows).toBe(false)
  expect(layout.tableScrolls).toBe(true)
})

test('public stats remain readable with large totals and thirty days of data', async ({ page }) => {
  await page.route('**/api/analytics/stats', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        totals: {
          visits: 12345678,
          pageViews: 98765432,
          viewsPerVisit: 8,
          visitsThirtyDays: 5432100,
          pageViewsThirtyDays: 4321000,
          periodDays: 180,
        },
        daily: Array.from({ length: 30 }, (_, index) => ({
          day: `2026-09-${String(index + 1).padStart(2, '0')}`,
          pageViews: index * 1000,
          visits: index * 500,
        })),
        updatedAt: '2026-09-21T12:00:00.000Z',
        estimated: false,
      }),
    }),
  )
  await page.goto('/stats')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('RocketYield is being used')
  await expect(page.getByText('12,345,678')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('methodology and legal pages expose required information without overflow', async ({ page }) => {
  await page.goto('/methodology')
  await expect(page.getByText(/Earnings = Σ/)).toBeVisible()

  await page.goto('/impressum')
  await expect(page.getByText('Eckertstr. 2B').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'novaheidt@gmail.com' }).first()).toBeVisible()

  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Cloudflare Web Analytics' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
