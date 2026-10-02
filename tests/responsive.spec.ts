import { expect, test } from '@playwright/test'

test('landing page contains the real product entry flow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('what it has actually earned')
  await expect(page.getByLabel('Ethereum address or ENS name')).toBeVisible()
  await expect(page.getByText('No wallet connection, signature, or account.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Methodology' }).first()).toBeVisible()
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

test('public stats remain readable with large totals and a full year of data', async ({ page, isMobile }) => {
  const start = Date.UTC(2026, 0, 1)
  await page.route('**/api/visitors?*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        range: '2026',
        years: [2026],
        daily: Array.from({ length: 365 }, (_, index) => ({
          day: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
          visitors: index * 500,
          pageViews: index * 1000,
        })),
        totals: { visitors: 5432100, pageViews: 9876543 },
        today: { visitors: 1234, pageViews: 2345 },
        allTime: { visitors: 12345678, pageViews: 23456789, since: '2026-01-01' },
        updatedAt: '2026-12-31T12:00:00.000Z',
      }),
    }),
  )
  await page.goto('/stats')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('visit RocketYield')
  await expect(page.getByText('12,345,678')).toBeVisible()
  const plot = page.getByRole('group', { name: /daily visitors/i })
  const box = (await plot.boundingBox())!
  const lastDay = { x: box.width - 0.5, y: box.height / 2 }
  if (isMobile) await plot.tap({ position: lastDay })
  else await plot.hover({ position: lastDay })
  await expect(page.getByRole('status')).toContainText(isMobile ? /Dec \d+, 2026/ : 'Dec 31, 2026')
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
  await expect(page.getByRole('heading', { name: 'Eigene Besucherzählung' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
