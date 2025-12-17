import { test, expect } from '@playwright/test';

/**
 * APP HEALTH TESTS
 * These tests verify the basic health of the jusDNCE app
 */

test.describe('App Health Checks', () => {

  test('app loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    const logs: string[] = [];

    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Print logs for debugging
    console.log('=== Console Logs ===');
    logs.forEach(l => console.log(l));

    // Check for critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('WebGL') && // WebGL errors are expected in headless
      !e.includes('net::ERR') // Network errors in test env
    );

    console.log('=== Page Errors ===');
    errors.forEach(e => console.log(e));

    expect(criticalErrors.length).toBe(0);
  });

  test('main UI elements render', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check for root element with content
    const root = await page.$('#root');
    expect(root).not.toBeNull();

    const content = await root?.innerHTML();
    expect(content?.length).toBeGreaterThan(100);

    // Check for header with jusDNCE branding
    const header = await page.locator('header').first();
    await expect(header).toBeVisible();

    // Check for main content area
    const main = await page.locator('main').first();
    await expect(main).toBeVisible();
  });

  test('API key status is logged', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', msg => {
      logs.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Look for API key status log
    const apiKeyLog = logs.find(l => l.includes('[Gemini] API Key status:'));
    console.log('API Key Log:', apiKeyLog);

    expect(apiKeyLog).toBeDefined();
  });

  test('upload area is visible on first step', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Look for upload-related elements
    const uploadText = page.getByText(/upload|drag|drop|image/i).first();
    await expect(uploadText).toBeVisible();
  });

});
