import { expect, test } from '@playwright/test'

async function firstFixedNavTop(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    for (const nav of document.querySelectorAll('nav')) {
      if (getComputedStyle(nav).position === 'fixed') {
        return nav.getBoundingClientRect().top
      }
    }
    return Number.NaN
  })
}

test.describe('route transitions (plan verification)', () => {
  test('marketing: nav stays fixed after client navigation', async ({ page }) => {
    await page.goto('/')
    const topBefore = await firstFixedNavTop(page)
    expect(topBefore).toBeGreaterThanOrEqual(0)
    expect(topBefore).toBeLessThan(1)

    await page.getByRole('link', { name: /^pricing$/i }).first().click()
    await page.waitForURL('**/pricing')

    const topAfter = await firstFixedNavTop(page)
    expect(topAfter).toBeGreaterThanOrEqual(0)
    expect(topAfter).toBeLessThan(1)
  })

  test('marketing: shell opacity wrapper present when motion allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect(page.locator('[data-transition="shell"]')).toHaveCount(1)
  })

  test('auth: login ↔ signup changes shell key (wrapper still present)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/login')
    await expect(page.locator('[data-transition="shell"]')).toHaveCount(1)

    await page.getByRole('link', { name: /sign up/i }).click()
    await page.waitForURL('**/signup')
    await expect(page.locator('[data-transition="shell"]')).toHaveCount(1)
  })

  test('reduced motion: no animated shell or app-main wrappers', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/login')
    await expect(page.locator('[data-transition="shell"]')).toHaveCount(0)

    await page.goto('/')
    await expect(page.locator('[data-transition="shell"]')).toHaveCount(0)
  })
})

test.describe('app shell (optional E2E credentials)', () => {
  test('fixed nav + app-main wrapper when signed in', async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run app transition checks')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/login')
    await page.locator('#email').fill(email!)
    await page.locator('#password').fill(password!)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/app\//, { timeout: 30_000 })

    const topDash = await firstFixedNavTop(page)
    expect(topDash).toBeGreaterThanOrEqual(0)
    expect(topDash).toBeLessThan(1)
    await expect(page.locator('[data-transition="app-main"]')).toHaveCount(1)

    await page.goto('/app/sigma-guide')
    await page.waitForURL('**/app/sigma-guide')

    const topGuide = await firstFixedNavTop(page)
    expect(topGuide).toBeGreaterThanOrEqual(0)
    expect(topGuide).toBeLessThan(1)
    await expect(page.locator('[data-transition="app-main"]')).toHaveCount(1)
  })
})
