import { expect, test } from "@playwright/test"

test.describe("auth flows (optional credentials)", () => {
  test("email login and sign out", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run auth E2E checks")

    await page.goto("/login")
    await page.locator("#email").fill(email!)
    await page.locator("#password").fill(password!)
    await page.getByRole("button", { name: /sign in/i }).click()

    await page.waitForURL(/\/app\//, { timeout: 30_000 })
    await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible()

    await page.getByRole("button", { name: /sign out/i }).first().click()
    await page.waitForURL("**/login")
  })

  test("signup form renders with google option", async ({ page }) => {
    await page.goto("/signup")
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
    await expect(page.locator("#full-name")).toBeVisible()
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
  })
})
