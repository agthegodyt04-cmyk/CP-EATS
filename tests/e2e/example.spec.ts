import { test, expect } from './fixtures';

test.describe('Playwright Setup Verification', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CP EATS/i);
    await expect(page.locator('[data-testid="app-landing"]')).toBeVisible();
  });
});
