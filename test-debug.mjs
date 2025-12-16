import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

console.log('Navigating...');
page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:3002', { timeout: 15000 }).catch(e => console.log('Nav error:', e.message));
await page.waitForTimeout(3000);

await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
console.log('Screenshot saved to debug-screenshot.png');

const root = await page.locator('#root').innerHTML().catch(() => 'ERROR');
console.log('Root length:', root.length);
console.log('Root preview:', root.substring(0, 800));

await browser.close();
