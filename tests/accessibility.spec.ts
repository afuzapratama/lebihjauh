import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicPages = [
  { path: '/', title: /LebihJauh/i },
  { path: '/about', title: /LebihJauh/i },
  { path: '/trip', title: 'Open Trip — LebihJauh' },
  { path: '/galeri', title: 'Galeri Perjalanan — LebihJauh' },
  { path: '/news', title: 'News & Cerita — LebihJauh' },
  { path: '/private-trip', title: 'Private Trip — LebihJauh' },
  { path: '/cek-booking', title: 'Cek Booking — LebihJauh' },
  { path: '/pembayaran', title: 'Metode Pembayaran — LebihJauh' },
];

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
}

for (const { path, title } of publicPages) {
  test(`${path} passes core accessibility checks`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveTitle(title);
    await expectNoAccessibilityViolations(page);
  });
}

test('published trip and article detail pages pass core checks', async ({
  page,
}) => {
  await page.goto('/trip');
  const tripLink = page.locator('.trip-card a[href^="/trip/"]').first();
  if ((await tripLink.count()) > 0) {
    await tripLink.click();
    await expect(page).toHaveTitle(/— Open Trip LebihJauh$/);
    await expectNoAccessibilityViolations(page);
  }

  await page.goto('/news');
  const articleLink = page.locator('.journal-card h3 a').first();
  if ((await articleLink.count()) > 0) {
    await articleLink.click();
    await expect(page).toHaveTitle(/— LebihJauh$/);
    await expectNoAccessibilityViolations(page);
  }
});

test('desktop trip menu restores focus when dismissed', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The full navigation is only shown on desktop.');

  await page.goto('/trip');
  const summary = page.locator('.trip-dropdown summary');
  await summary.focus();
  await summary.press('Enter');
  await expect(page.locator('.trip-dropdown')).toHaveAttribute('open', '');
  await expectNoAccessibilityViolations(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('.trip-dropdown')).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
});

test('mobile navigation remains accessible while expanded', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The compact navigation is only shown on mobile.');

  await page.goto('/about');
  const toggle = page.locator('.menu-toggle');
  await expect(toggle).toHaveAccessibleName('Buka menu navigasi');
  await toggle.click();

  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveAccessibleName('Tutup menu navigasi');
  await expect(page.locator('#mobile-nav')).toBeVisible();
  const tripToggle = page
    .locator('#mobile-nav')
    .getByRole('button', { name: 'Trip' });
  await expect(tripToggle).toHaveAttribute('aria-expanded', 'false');
  await tripToggle.click();
  await expect(tripToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page
      .locator('#mobile-nav')
      .getByRole('link', { name: 'Private Trip', exact: true }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-nav')).toBeHidden();
  await expect(toggle).toBeFocused();
});

test('gallery dialog has a visible, named close control', async ({ page }) => {
  await page.goto('/galeri');

  const trigger = page.locator('[data-dialog]').first();
  test.skip((await trigger.count()) === 0, 'No published gallery item.');
  await trigger.click();

  const dialog = page.getByRole('dialog');
  const closeButton = dialog.getByRole('button', { name: 'Tutup foto' });
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeVisible();
  await expect(closeButton).toHaveCSS('color', 'rgb(25, 27, 24)');
  await expectNoAccessibilityViolations(page);

  await closeButton.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('skip link moves keyboard focus to the main content', async ({ page }) => {
  await page.goto('/about');
  await page.keyboard.press('Tab');

  const skipLink = page.getByRole('link', { name: 'Langsung ke konten' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('reduced-motion preference disables smooth scrolling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/about');

  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
});
