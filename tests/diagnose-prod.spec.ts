import { test, expect } from '@playwright/test';

test('diagnose production build', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors: string[] = [];
  const logs: string[] = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  // Load the PRODUCTION preview server
  await page.goto('http://localhost:3003/FrewuencyGolemz-jusdnce/', { timeout: 30000 });

  // Wait a bit for React to render
  await page.waitForTimeout(3000);

  // Check if root has content
  const rootContent = await page.$eval('#root', el => el.innerHTML);
  const hasContent = rootContent.length > 10;

  console.log('=== PRODUCTION BUILD CONSOLE LOGS ===');
  logs.forEach(l => console.log(l));

  console.log('=== PRODUCTION BUILD PAGE ERRORS ===');
  errors.forEach(e => console.log(e));

  console.log('=== ROOT CONTENT ===');
  console.log(`Has content: ${hasContent}`);
  console.log(`Content length: ${rootContent.length}`);
  if (rootContent.length < 500) {
    console.log(`Content: ${rootContent}`);
  } else {
    console.log(`Content preview: ${rootContent.substring(0, 500)}...`);
  }

  await context.close();
  expect(true).toBe(true);
});
