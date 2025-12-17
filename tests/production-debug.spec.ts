import { test, expect } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * PRODUCTION BUILD DEBUG TESTS
 * Tests the actual production build to verify everything works
 */

test.describe('Production Build Debug', () => {

  test('production build loads and renders', async ({ browser }) => {
    const distPath = join(process.cwd(), 'dist');

    // Simple static server
    const server = createServer((req, res) => {
      let url = req.url || '/';
      url = url.replace(/^\/FrewuencyGolemz-jusdnce/, '');
      if (url === '' || url === '/') url = '/index.html';

      const filePath = join(distPath, url);

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = filePath.split('.').pop() || '';
      const types: Record<string, string> = {
        'html': 'text/html',
        'js': 'application/javascript',
        'css': 'text/css',
        'map': 'application/json',
      };

      res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
      res.end(readFileSync(filePath));
    });

    await new Promise<void>(r => server.listen(4455, r));

    const context = await browser.newContext();
    const page = await context.newPage();

    const errors: string[] = [];
    const logs: string[] = [];

    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => errors.push(err.message));

    try {
      await page.goto('http://localhost:4455/', { timeout: 30000 });
      await page.waitForTimeout(3000);

      console.log('\n========================================');
      console.log('PRODUCTION BUILD DEBUG REPORT');
      console.log('========================================\n');

      // 1. Check for API key status
      const apiKeyLog = logs.find(l => l.includes('[Gemini] API Key status:'));
      console.log('1. API KEY STATUS:');
      if (apiKeyLog) {
        if (apiKeyLog.includes('MISSING')) {
          console.log('   ❌ MISSING - Build does not contain API key');
        } else {
          console.log('   ✅ PRESENT -', apiKeyLog);
        }
      } else {
        console.log('   ⚠️  Status log not found');
      }

      // 2. Check for page errors
      console.log('\n2. PAGE ERRORS:');
      if (errors.length === 0) {
        console.log('   ✅ No critical errors');
      } else {
        errors.forEach(e => console.log('   ❌', e));
      }

      // 3. Check UI rendering
      console.log('\n3. UI RENDERING:');
      try {
        const rootContent = await page.$eval('#root', el => el.innerHTML);
        if (rootContent.length > 100) {
          console.log('   ✅ UI rendered (' + rootContent.length + ' chars)');
        } else {
          console.log('   ❌ UI empty or minimal');
        }
      } catch (e: any) {
        console.log('   ❌ Browser crashed (WebGL issue in headless)');
      }

      // 4. Check for generation-related logs
      console.log('\n4. GENERATION LOGS:');
      const genLogs = logs.filter(l => l.includes('[Gemini]'));
      if (genLogs.length > 0) {
        genLogs.forEach(l => console.log('   ' + l));
      } else {
        console.log('   No generation logs (expected until user uploads image)');
      }

      // 5. All console logs
      console.log('\n5. ALL CONSOLE LOGS:');
      logs.slice(0, 20).forEach(l => console.log('   ' + l));
      if (logs.length > 20) {
        console.log('   ... and', logs.length - 20, 'more');
      }

      console.log('\n========================================\n');

    } finally {
      await context.close();
      server.close();
    }
  });

  test('check if bundle contains expected code', async ({ browser }) => {
    const distPath = join(process.cwd(), 'dist');
    const assetsDir = join(distPath, 'assets');

    if (!existsSync(assetsDir)) {
      console.log('No dist/assets directory. Run npm run build first.');
      return;
    }

    // Read the JS bundle
    const files = readdirSync(assetsDir);
    const jsFile = files.find((f: string) => f.endsWith('.js') && !f.endsWith('.map'));

    if (!jsFile) {
      console.log('No JS bundle found');
      return;
    }

    const bundlePath = join(assetsDir, jsFile);
    const bundleContent = readFileSync(bundlePath, 'utf-8');

    console.log('\n========================================');
    console.log('BUNDLE CONTENT CHECK');
    console.log('========================================\n');

    // Check for key strings
    const checks = [
      { name: 'GoogleGenAI', pattern: /GoogleGenAI/ },
      { name: 'gemini-2.5-flash-image', pattern: /gemini-2\.5-flash-image/ },
      { name: 'Step4Preview', pattern: /Step4Preview/ },
      { name: 'KineticEngine', pattern: /KineticEngine/ },
      { name: 'QuantumVisualizer', pattern: /QuantumVisualizer/ },
      { name: 'API Key status log', pattern: /\[Gemini\] API Key status/ },
      { name: 'generateDanceFrames', pattern: /generateDanceFrames/ },
    ];

    checks.forEach(({ name, pattern }) => {
      const found = pattern.test(bundleContent);
      console.log(`${found ? '✅' : '❌'} ${name}`);
    });

    // Check for API key value (should see AIzaSy if embedded)
    const hasApiKey = /AIzaSy[a-zA-Z0-9_-]{30,}/.test(bundleContent);
    console.log(`${hasApiKey ? '✅' : '❌'} API Key embedded in bundle`);

    console.log('\n========================================\n');
  });

});
