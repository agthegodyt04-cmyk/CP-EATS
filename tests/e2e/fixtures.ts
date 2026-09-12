import { test as base, type Browser, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CUSTOMER_SESSION_PATH = path.resolve(PROJECT_ROOT, 'playwright', '.auth', 'customer.json');
const KITCHEN_SESSION_PATH = path.resolve(PROJECT_ROOT, 'playwright', '.auth', 'kitchen.json');

const MOCK_CUSTOMER_USER = {
  id: 'mock-customer-id-001',
  email: 'test-cpeats-001@example.com',
  user_metadata: { name: 'Test Customer' },
  app_metadata: { provider: 'email' },
  created_at: new Date().toISOString(),
};

const MOCK_KITCHEN_USER = {
  id: 'mock-kitchen-id-001',
  email: 'test-cpeats-kitchen@example.com',
  user_metadata: { name: 'Test Kitchen' },
  app_metadata: { provider: 'email' },
  created_at: new Date().toISOString(),
};

type Fixtures = {
  authenticatedPage: Page;
  kitchenPage: Page;
};

function buildMockSession(user: any) {
  return {
    access_token: 'mock-token-' + user.id,
    refresh_token: 'mock-refresh-' + user.id,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
}

async function setupMockAuth(page: Page, user: any, role: 'customer' | 'kitchen') {
  const session = buildMockSession(user);
  const projectRef = new URL(process.env.VITE_SUPABASE_URL || 'https://eqslifnlscywjppcwupn.supabase.co').hostname.split('.')[0];
  const authTokenKey = `sb-${projectRef}-auth-token`;

  await page.addInitScript((args: { key: string; session: any }) => {
    localStorage.setItem(args.key, JSON.stringify(args.session));
  }, { key: authTokenKey, session });

  await page.route(`**/auth/v1/token?grant_type=refresh_token`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ session, user: session.user }),
    });
  });

  await page.route(`**/auth/v1/user`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: session.user }),
    });
  });

  // Mock Supabase database reads so e2e runs fully offline. Without this the
  // boot-time profile query hits the real project with a fake token, 401s,
  // and the app stays on the loading screen forever.
  // NOTE: page.route handlers resolve last-registered-first, so the catch-all
  // must be registered BEFORE the more specific users handler.
  await page.route('**/rest/v1/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/users**', async route => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      return;
    }
    const profile = {
      id: user.id,
      email: user.email,
      name: user.user_metadata.name,
      role,
      status: 'approved',
      phone: '',
      society: '',
      flatAddress: '',
      themePreference: 'light',
      created_at: new Date().toISOString(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile),
    });
  });
}

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await setupMockAuth(page, MOCK_CUSTOMER_USER, 'customer');
    await page.goto('/');
    await page.waitForSelector('[data-testid="loading-screen"]', { state: 'hidden', timeout: 15000 }).catch(() => {});
    await use(page);
  },
  kitchenPage: async ({ page }, use) => {
    await setupMockAuth(page, MOCK_KITCHEN_USER, 'kitchen');
    await page.goto('/');
    await page.waitForSelector('[data-testid="loading-screen"]', { state: 'hidden', timeout: 15000 }).catch(() => {});
    await use(page);
  },
});

export { expect } from '@playwright/test';
