import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('unknown routes show the branded and accessible 404 page', async ({
  page,
}) => {
  const response = await page.goto('/jalur-yang-hilang');

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Jalur Tidak Ditemukan — LebihJauh');
  await expect(
    page.getByRole('heading', { name: /Sepertinya kamu salah jalur/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Kembali ke basecamp/i }),
  ).toHaveAttribute('href', '/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('500 page shares the branded recovery experience', async ({ page }) => {
  const response = await page.goto('/500');

  expect(response?.status()).toBe(500);
  await expect(page).toHaveTitle('Ada Kendala di Jalur — LebihJauh');
  await expect(
    page.getByRole('heading', { name: /Jalurnya sedang kami rapikan/i }),
  ).toBeVisible();
  await expect(page.getByText('REF. LJ/500/00')).toBeVisible();
});
