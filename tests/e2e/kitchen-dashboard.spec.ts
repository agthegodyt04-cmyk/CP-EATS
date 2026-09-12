import { test, expect } from './fixtures';

test.describe('Kitchen Dashboard', () => {
  test('should render kitchen dashboard', async ({ kitchenPage }) => {
    await kitchenPage.goto('/');
    await kitchenPage.waitForSelector('[data-testid="kitchen-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = kitchenPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('Kitchen user is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await expect(kitchenPage.locator('[data-testid="kitchen-dashboard"]')).toBeVisible();
  });

  test('should have no console errors', async ({ kitchenPage }) => {
    const consoleErrors: string[] = [];
    kitchenPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await kitchenPage.waitForLoadState('networkidle');

    expect(consoleErrors.filter(e => !e.includes('favicon') && !e.includes('chrome-extension')).length).toBe(0);
  });

  test('should display navigation tabs', async ({ kitchenPage }) => {
    await kitchenPage.goto('/');
    await kitchenPage.waitForSelector('[data-testid="kitchen-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = kitchenPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('Kitchen user is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await expect(kitchenPage.locator('[data-testid="nav-kitchen"]')).toBeVisible();
    await expect(kitchenPage.locator('[data-testid="nav-kitchen-orders"]')).toBeVisible();
    await expect(kitchenPage.locator('[data-testid="nav-kitchen-menu"]')).toBeVisible();
  });
});
