import { test, expect } from './fixtures';

test.describe('Customer Dashboard', () => {
  test('should load customer dashboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await expect(authenticatedPage.locator('[data-testid="customer-dashboard"]')).toBeVisible();
  });

  test('should display bottom navigation', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await expect(authenticatedPage.locator('[data-testid="nav-customer"]')).toBeVisible();
  });

  test('should show feed tab by default', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await expect(authenticatedPage.locator('[data-testid="nav-feed"]')).toBeVisible();
  });
});
