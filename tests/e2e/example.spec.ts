import { test, expect } from './fixtures';

test.describe('Playwright Setup Verification', () => {
  test('homepage loads', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await expect(authenticatedPage).toHaveTitle(/CP EATS/i);
    await expect(authenticatedPage.locator('[data-testid="app-landing"]')).toBeVisible();
  });
});
