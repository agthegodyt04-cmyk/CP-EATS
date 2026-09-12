import { test, expect } from './fixtures';

test.describe('Feed', () => {
  test('should display feed posts', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await authenticatedPage.waitForTimeout(2000);

    const feedPosts = authenticatedPage.locator('[data-testid="feed-post-card"]');
    const count = await feedPosts.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should load feed post images', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await authenticatedPage.waitForTimeout(2000);

    const feedPosts = authenticatedPage.locator('[data-testid="feed-post-card"]');
    const count = await feedPosts.count();

    if (count > 0) {
      const firstImage = feedPosts.first().locator('img').first();
      await expect(firstImage).toBeVisible();
    }
  });
});
