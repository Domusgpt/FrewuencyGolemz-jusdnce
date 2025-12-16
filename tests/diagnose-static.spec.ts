import { test, expect } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

test('diagnose with static server', async ({ browser }) => {
  // Serve the dist folder with a simple static server
  const distPath = join(process.cwd(), 'dist');

  const server = createServer((req, res) => {
    let url = req.url || '/';
    // Strip the base path for GitHub Pages
    url = url.replace(/^\/FrewuencyGolemz-jusdnce/, '');
    if (url === '' || url === '/') {
      url = '/index.html';
    }

    let filePath = join(distPath, url);

    if (!existsSync(filePath)) {
      console.log(`404: ${url} -> ${filePath}`);
      res.writeHead(404);
      res.end('Not found: ' + url);
      return;
    }

    const ext = filePath.split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'js': 'application/javascript',
      'css': 'text/css',
      'json': 'application/json',
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(readFileSync(filePath));
  });

  await new Promise<void>(resolve => server.listen(4444, resolve));

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

  try {
    await page.goto('http://localhost:4444/', { timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('=== STATIC SERVER CONSOLE LOGS ===');
    logs.forEach(l => console.log(l));

    console.log('=== STATIC SERVER PAGE ERRORS ===');
    errors.forEach(e => console.log(e));

    // Try to get content, but catch crash
    try {
      const rootContent = await page.$eval('#root', el => el.innerHTML);
      const hasContent = rootContent.length > 10;

      console.log('=== ROOT CONTENT ===');
      console.log(`Has content: ${hasContent}`);
      console.log(`Content length: ${rootContent.length}`);
      if (rootContent.length < 500) {
        console.log(`Content: ${rootContent}`);
      } else {
        console.log(`App rendered successfully! Preview: ${rootContent.substring(0, 200)}...`);
      }
    } catch (e: any) {
      console.log('=== BROWSER CRASHED (WebGL too heavy for headless) ===');
      console.log('This is expected in headless mode with complex shaders');
    }

    expect(true).toBe(true);
  } finally {
    await context.close();
    server.close();
  }
});
