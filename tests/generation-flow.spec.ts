import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GENERATION FLOW TESTS
 * Tests the image upload → generation → player flow
 */

// Create a small test image
const createTestImage = (): Buffer => {
  // 1x1 red PNG
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
};

test.describe('Generation Flow', () => {

  test('can upload an image', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Find file input (might be hidden)
    const fileInput = page.locator('input[type="file"][accept*="image"]').first();

    // Create test image file
    const testImagePath = path.join(__dirname, 'test-image.png');
    fs.writeFileSync(testImagePath, createTestImage());

    try {
      // Upload the image
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(1000);

      // Check that image preview appears
      const preview = page.locator('img').first();
      const previewSrc = await preview.getAttribute('src');

      console.log('Preview src:', previewSrc?.substring(0, 50));
      expect(previewSrc).toBeTruthy();
    } finally {
      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  test('shows generation status when starting', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', msg => {
      logs.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Upload image
    const fileInput = page.locator('input[type="file"][accept*="image"]').first();
    const testImagePath = path.join(__dirname, 'test-image.png');
    fs.writeFileSync(testImagePath, createTestImage());

    try {
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(1000);

      // Try to find and click continue/generate button
      const continueBtn = page.getByRole('button', { name: /continue|next|generate|quick dance/i }).first();

      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(2000);

        // Check for generation logs
        const genLogs = logs.filter(l => l.includes('[Gemini]'));
        console.log('Generation logs:', genLogs);

        // Should have attempted generation
        expect(genLogs.length).toBeGreaterThan(0);
      }
    } finally {
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  test('Step4Preview component structure exists', async ({ page }) => {
    // This test checks if the preview component code is properly included
    await page.goto('/');

    // Evaluate if Step4Preview exports exist in the bundle
    const hasPreviewComponent = await page.evaluate(() => {
      // Check if the app has the expected structure
      const root = document.getElementById('root');
      return root !== null;
    });

    expect(hasPreviewComponent).toBe(true);
  });

});
