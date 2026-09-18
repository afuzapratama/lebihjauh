import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('page loads without errors, missing anchors, or horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  const pageHeading = page.getByRole('heading', { level: 1 });
  await expect(pageHeading).toBeVisible();
  await expect(pageHeading).not.toHaveText('');
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const brokenAnchors = await page
    .locator('a[href^="#"]')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute('href')!)
        .filter((href) => !document.querySelector(href)),
    );
  expect(brokenAnchors).toEqual([]);
  expect(
    await page
      .locator('.hero-image')
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('navigation reaches trip and gallery sections', async ({
  page,
  isMobile,
}) => {
  if (isMobile) {
    const toggle = page.locator('.menu-toggle');
    const mobileNav = page.locator('#mobile-nav');
    const contentTop = await page
      .locator('main')
      .evaluate((element) => element.getBoundingClientRect().top);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(mobileNav).toBeVisible();
    expect(
      await page
        .locator('main')
        .evaluate((element) => element.getBoundingClientRect().top),
    ).toBe(contentTop);

    const tripToggle = mobileNav.getByRole('button', { name: 'Trip' });
    await expect(tripToggle).toHaveAttribute('aria-expanded', 'false');
    await tripToggle.click();
    await expect(tripToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(
      mobileNav.getByRole('link', { name: 'Open Trip', exact: true }),
    ).toBeVisible();

    await mobileNav.getByRole('link', { name: 'Galeri' }).click();
    await expect(page).toHaveURL(/#galeri$/);
    await expect(mobileNav).toBeHidden();
  } else {
    await page.locator('.trip-dropdown summary').click();
    await page
      .locator('.dropdown-menu')
      .getByRole('link', { name: 'Open Trip', exact: true })
      .click();
    await expect(page).toHaveURL(/\/trip$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('trip filters and accessible trip details work', async ({
  page,
  isMobile,
}) => {
  await page.goto('/trip');
  const allCards = page.locator('.trip-card');
  const firstTripName = (await allCards
    .first()
    .getByRole('heading')
    .textContent())!.trim();
  await page
    .getByRole('searchbox', { name: 'Cari perjalanan' })
    .fill(firstTripName);
  await page.getByRole('button', { name: 'Cari trip' }).click();
  await expect(page).toHaveURL(/\/trip\?q=/);
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.locator('.trip-card').getByRole('heading')).toHaveText(
    firstTripName,
  );
  await page.getByRole('link', { name: 'Reset filter' }).click();
  await expect(page).toHaveURL(/\/trip$/);
  await allCards
    .first()
    .getByRole('link', { name: /Lihat trip/i })
    .last()
    .click();
  await expect(page).toHaveURL(/\/trip\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Harga per meeting point/i }),
  ).toBeVisible();
  await expect(
    page.locator('.trip-pickup-table tbody tr').first(),
  ).toBeVisible();
  const preparation = page.locator('.detail-disclosure-preparation');
  await expect(preparation).toHaveAttribute('open', '');
  await expect(
    preparation.locator('.detail-preparation-list li').first(),
  ).toBeVisible();
  const terms = page.locator('.detail-disclosure-terms');
  await terms.locator('summary').click();
  await expect(terms).toHaveAttribute('open', '');
  await expect(terms.locator('.detail-terms-list li').first()).toBeVisible();

  const schedulePanel = page.locator('.public-schedule-panel');
  if (isMobile) {
    await schedulePanel.evaluate((panel) => {
      window.scrollTo({
        top: panel.getBoundingClientRect().bottom + window.scrollY + 100,
      });
    });
    const mobileBookingBar = page.locator('[data-mobile-booking-bar]');
    await expect(mobileBookingBar).toHaveAttribute('data-visible', 'true');
    await expect(
      mobileBookingBar.getByRole('link', {
        name: /Cek meeting point & booking/i,
      }),
    ).toBeVisible();
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await expect(mobileBookingBar).toHaveAttribute('data-visible', 'false');
  } else {
    await page.evaluate(() => window.scrollTo({ top: 1450 }));
    await expect
      .poll(async () =>
        schedulePanel.evaluate((panel) =>
          Math.round(panel.getBoundingClientRect().top),
        ),
      )
      .toBe(116);
  }
});

test('gallery and news open readable content', async ({ page, isMobile }) => {
  await expect(
    page.getByRole('link', { name: 'Lihat semua galeri' }),
  ).toHaveAttribute('href', '/galeri');
  await expect(
    page.getByRole('link', { name: 'Baca semua cerita' }),
  ).toHaveAttribute('href', '/news');

  const galleryTrigger = page.locator('.gallery-item').first();
  await expect(galleryTrigger).toBeVisible();
  const dialogId = await galleryTrigger.getAttribute('data-dialog');
  await galleryTrigger.click();
  const photo = page.locator(`#${dialogId}`);
  await expect(photo).toBeVisible();
  await expect(photo.getByRole('img')).toBeVisible();
  await photo.getByRole('button', { name: 'Tutup foto' }).click();
  await expect(photo).toBeHidden();

  const articleLink = page.locator('.journal-card h3 a').first();
  await expect(articleLink).toBeVisible();
  await articleLink.click();
  await expect(page).toHaveURL(/\/news\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const navigation = page.locator(isMobile ? '#mobile-nav' : '.desktop-nav');
  await expect(navigation.locator('a[href="/news"]')).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.goto('/galeri');
  await expect(navigation.locator('a[href="/galeri"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('gallery loads photos in responsive three-row batches', async ({
  page,
}) => {
  await page.goto('/galeri');

  const galleryItems = page.locator('[data-gallery-item]');
  const itemCount = await galleryItems.count();
  test.skip(itemCount === 0, 'No published gallery item.');

  const columnCount = await page
    .locator('[data-gallery-grid]')
    .evaluate(
      (gallery) =>
        getComputedStyle(gallery).gridTemplateColumns.split(' ').filter(Boolean)
          .length,
    );
  const batchSize = columnCount * 3;
  const firstBatchSize = Math.min(batchSize, itemCount);

  await expect(page.locator('[data-gallery-item]:visible')).toHaveCount(
    firstBatchSize,
  );

  const hiddenImages = page.locator('[data-gallery-item][hidden] img');
  await expect(hiddenImages).toHaveCount(itemCount - firstBatchSize);
  expect(
    await hiddenImages.evaluateAll((images) =>
      images.every((image) => !image.hasAttribute('src')),
    ),
  ).toBe(true);

  if (itemCount > firstBatchSize) {
    await page.locator('[data-gallery-load-more]').click();
    await expect(page.locator('[data-gallery-item]:visible')).toHaveCount(
      Math.min(firstBatchSize + batchSize, itemCount),
    );
  }
});

test('booking lookup verifies the PIC before opening an invoice', async ({
  page,
  isMobile,
}) => {
  if (!isMobile) {
    const actions = page.locator('.nav-actions');
    await expect(
      actions.getByRole('link', { name: 'Cek booking', exact: true }),
    ).toBeVisible();
    await expect(
      actions.getByRole('link', { name: /Gas, pilih trip!/ }),
    ).toBeVisible();
    await page.setViewportSize({ width: 800, height: 900 });
    await page.reload();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('.menu-toggle')).toBeVisible();
  }

  await page.route('**/api/booking-lookup', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      number: 'LJ-OT-000123',
      whatsapp: '081234567890',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        booking: {
          number: 'LJ-OT-000123',
          state: 'confirmed',
          tripName: 'Rinjani Overland',
          startAt: '2099-10-15T01:00:00.000Z',
          pickup: 'Plaza Semanggi',
          picName: 'Raka P.',
          pax: 3,
          paymentState: 'dp',
          total: '2400000',
          remaining: '1600000',
          invoicePath: '/invoice/LJ-OT-000123',
        },
      }),
    });
  });

  await page.goto('/cek-booking');
  await expect(page.locator('main')).not.toContainText(/privat/i);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const form = page.locator('#booking-lookup-form');
  await form.getByLabel('Nomor booking').fill('LJ-OT-000123');
  await form.getByLabel('WhatsApp PIC').fill('081234567890');
  await form.getByRole('button', { name: /Cek booking saya/ }).click();
  const result = page.locator('#booking-lookup-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('Rinjani Overland');
  await expect(result).toContainText('DP terverifikasi');
  await expect(
    result.getByRole('link', { name: 'Buka invoice', exact: false }),
  ).toHaveAttribute('href', '/invoice/LJ-OT-000123');
});

test('private request validates and sends a structured request', async ({
  page,
}) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route('**/api/private-trip-requests', async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ request: { number: 'LJ-PT-TEST001' } }),
    });
  });
  await page
    .getByRole('link', { name: /Rencanakan Private Trip/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/private-trip$/);
  const form = page.locator('#private-trip-form');
  await form.getByRole('button', { name: 'Kirim permintaan' }).click();
  expect(sentBody).toBeNull();
  await form.getByLabel('Destinasi atau rute yang diinginkan').fill('Merbabu');
  await form.getByLabel('Tanggal berangkat').fill('2099-10-15');
  await form.getByLabel('Tanggal pulang').fill('2099-10-17');
  await form.getByLabel('Perkiraan jumlah peserta').fill('8');
  await form.getByLabel('Nama lengkap PIC').fill('Raka Pratama');
  await form.getByLabel('WhatsApp PIC').fill('081234567890');
  await form.getByLabel('Ceritakan kebutuhanmu').fill('Trip komunitas.');
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Kirim permintaan' }).click();
  await expect(page.locator('.private-success')).toContainText('LJ-PT-TEST001');
  expect(sentBody).toMatchObject({
    destination: 'Merbabu',
    pax: '8',
    picName: 'Raka Pratama',
    privacyAccepted: true,
  });
});

test('private request accepts prefilled details from an oversized open trip group', async ({
  page,
}) => {
  await page.goto(
    '/private-trip?source=open-trip&destination=Gunung%20Ungaran&startDate=2099-10-15&endDate=2099-10-17&pax=11',
  );

  await expect(page.locator('.private-prefill-note')).toBeVisible();
  await expect(
    page.getByLabel('Destinasi atau rute yang diinginkan'),
  ).toHaveValue('Gunung Ungaran');
  await expect(page.getByLabel('Tanggal berangkat')).toHaveValue('2099-10-15');
  await expect(page.getByLabel('Tanggal pulang')).toHaveValue('2099-10-17');
  await expect(page.getByLabel('Perkiraan jumlah peserta')).toHaveValue('11');
});

test('FAQ expands and page passes core accessibility checks', async ({
  page,
}) => {
  await page.locator('.faq-item summary').first().click();
  await expect(page.locator('.faq-item').first()).toHaveAttribute('open', '');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
