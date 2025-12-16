import { test, expect } from '@playwright/test';

test('diagnose black screen', async ({ page }) => {
  const errors: string[] = [];
  const logs: string[] = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  // Load the dev server
  await page.goto('http://localhost:3002/', { timeout: 30000 });

  // Wait a bit for React to render
  await page.waitForTimeout(3000);

  // Check if root has content
  const rootContent = await page.$eval('#root', el => el.innerHTML);
  const hasContent = rootContent.length > 10;

  console.log('=== CONSOLE LOGS ===');
  logs.forEach(l => console.log(l));

  console.log('=== PAGE ERRORS ===');
  errors.forEach(e => console.log(e));

  console.log('=== ROOT CONTENT ===');
  console.log(`Has content: ${hasContent}`);
  console.log(`Content length: ${rootContent.length}`);
  if (rootContent.length < 500) {
    console.log(`Content: ${rootContent}`);
  } else {
    console.log(`Content preview: ${rootContent.substring(0, 500)}...`);
  }

  // Try screenshot but don't fail if it doesn't work
  try {
    await page.screenshot({ path: 'test-results/diagnose-screenshot.png' });
  } catch (e) {
    console.log('Screenshot failed (expected in headless env)');
  }

  // Test should pass if we got this far
  expect(true).toBe(true);
});
