import { expect, test } from '@playwright/test';

test('news archive exposes indexable metadata and stays within the viewport', async ({
  page,
}) => {
  await page.goto('/news');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/news$/,
  );
  const featured = page.locator('.news-featured-card');
  if ((await featured.count()) > 0) await expect(featured).toBeVisible();
  else await expect(page.locator('.news-empty')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('article includes structured data, reading context, and a trip CTA', async ({
  page,
}) => {
  await page.goto('/news');
  const articleLink = page.locator('.journal-card h3 a').first();
  test.skip((await articleLink.count()) === 0, 'No published article.');
  await articleLink.click();

  await expect(page.locator('.article-meta-line')).toContainText('menit baca');
  await expect(page.locator('.article-trip-cta')).toBeVisible();
  await expect(
    page.locator('.article-trip-cta a[href^="/trip"]').first(),
  ).toBeVisible();

  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  const entries = JSON.parse(structuredData ?? '[]') as Array<{
    '@type'?: string;
  }>;
  expect(entries.some((entry) => entry['@type'] === 'Article')).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('SEO discovery files expose public articles without private routes', async ({
  request,
}) => {
  const sitemapResponse = await request.get('/sitemap.xml');
  expect(sitemapResponse.ok()).toBe(true);
  expect(sitemapResponse.headers()['content-type']).toContain(
    'application/xml',
  );
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain('/news/');
  expect(sitemap).not.toContain('/invoice/');

  const robotsResponse = await request.get('/robots.txt');
  expect(robotsResponse.ok()).toBe(true);
  const robots = await robotsResponse.text();
  expect(robots).toContain('Sitemap:');
  expect(robots).toContain('Disallow: /data-peserta/');
});

test('home page declares the preferred Google site name', async ({ page }) => {
  await page.goto('/');
  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  const entries = JSON.parse(structuredData ?? '[]') as Array<{
    '@type'?: string;
    name?: string;
  }>;
  expect(entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ '@type': 'WebSite', name: 'LebihJauh' }),
      expect.objectContaining({ '@type': 'Organization', name: 'LebihJauh' }),
    ]),
  );
});
