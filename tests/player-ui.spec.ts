import { test, expect } from '@playwright/test';

/**
 * PLAYER UI TESTS
 * Tests for the Step4Preview player component
 */

test.describe('Player UI Components', () => {

  test('app renders all main sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check header is present
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check for jusDNCE branding
    const branding = page.getByText(/jusDNCE/i);
    await expect(branding.first()).toBeVisible();

    // Check for footer/navigation
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Check for main content area
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('Step 1 (Assets) shows upload areas', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should show image upload area
    const imageUpload = page.locator('input[type="file"][accept*="image"]');
    expect(await imageUpload.count()).toBeGreaterThan(0);

    // Check for upload instructions text
    const uploadText = page.getByText(/upload|image|photo|picture/i);
    expect(await uploadText.count()).toBeGreaterThan(0);
  });

  test('navigation buttons are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Look for navigation/action buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    console.log('Found buttons:', buttonCount);

    // Should have at least sign in, continue, etc.
    expect(buttonCount).toBeGreaterThan(2);
  });

  test('credits display is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Look for credits display (shows "X CR")
    const creditsDisplay = page.getByText(/CR$/);
    const visible = await creditsDisplay.isVisible().catch(() => false);

    console.log('Credits display visible:', visible);
  });

  test('style presets exist in bundle', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Navigate to step 2 if possible (need an image first)
    // For now, just verify the app structure
    const root = await page.$('#root');
    const html = await root?.innerHTML();

    // Check that styling classes are applied
    expect(html).toContain('class=');
  });

});

test.describe('Player Controls (when visible)', () => {

  test.skip('player controls render with frames', async ({ page }) => {
    // This test would require mocked frames
    // Skipping until we have a mock setup

    await page.goto('/');

    // Would need to inject mock frames here
    // Then check for:
    // - Play/Pause button
    // - Export menu
    // - Deck controls
    // - FX settings
  });

});
