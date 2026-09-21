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
