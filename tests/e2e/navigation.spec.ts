import { test, expect } from './fixtures';

test.describe('Navigation', () => {
  test('should navigate between customer tabs', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }

    await authenticatedPage.locator('[data-testid="nav-orders"]').click();
    await authenticatedPage.waitForTimeout(500);

    await authenticatedPage.locator('[data-testid="nav-profile"]').click();
    await authenticatedPage.waitForTimeout(500);

    await expect(authenticatedPage.locator('[data-testid="customer-dashboard"]')).toBeVisible();
  });

  test('should have working logout button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }

    const logoutBtn = authenticatedPage.locator('[data-testid="logout-button"]');
    await expect(logoutBtn).toBeVisible();
  });
});
