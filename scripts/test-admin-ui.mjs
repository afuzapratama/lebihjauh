// Isolated UI regression check: compiled pages + API fixtures, no database writes.
// Run after `npm run build`: node scripts/test-admin-ui.mjs
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { experimental_AstroContainer as Container } from 'astro/container';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import ts from 'typescript';

process.env.DATABASE_URL ??=
  'postgresql://ui-test:unused@localhost:5432/ui_test';
process.env.BETTER_AUTH_SECRET ??=
  'isolated-ui-check-secret-not-for-production-12345';
const root = new URL('../', import.meta.url);
const chunks = new URL('dist/server/chunks/', root);
const assets = new URL('dist/client/_astro/', root);
const chunkNames = await readdir(chunks);
const assetNames = await readdir(assets);
const assetContents = new Map(
  await Promise.all(
    assetNames.map(async (name) => [
      name,
      await readFile(new URL(name, assets)),
    ]),
  ),
);
// Astro may inline this script in its manifest; container needs a resolver.
const layoutScript = 'admin-layout-test.js';
const layout = await readFile(
  new URL('src/layouts/AdminLayout.astro', root),
  'utf8',
);
const layoutCode = layout.match(/<script>([\s\S]*?)<\/script>/)[1];
assetContents.set(
  layoutScript,
  Buffer.from(
    ts.transpileModule(layoutCode, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
  ),
);
const adminCss = assetNames.filter(
  (name) =>
    name.endsWith('.css') &&
    assetContents.get(name).toString().includes('.admin-app'),
);
assert.ok(adminCss.length, 'Shared admin stylesheet is built');
const container = await Container.create({
  resolve: (id) => {
    const compiled = id.includes('/TripEditor.astro?')
      ? assetNames.find(
          (name) =>
            name.startsWith('TripEditor.astro_') && name.endsWith('.js'),
        )
      : null;
    return `/_astro/${compiled || layoutScript}`;
  },
});
const htmlPages = new Map();
for (const [path, source, params] of [
  ['/admin', 'src/pages/admin/index.astro'],
  ['/admin/trips', 'src/pages/admin/trips.astro'],
  ['/admin/trips/new', 'src/pages/admin/trips/new.astro'],
  [
    '/admin/trips/trip-fixture',
    'src/pages/admin/trips/[id].astro',
    { id: 'trip-fixture' },
  ],
  ['/admin/login', 'src/pages/admin/login.astro'],
]) {
  const chunk = (
    await Promise.all(
      chunkNames.map(async (name) => ({
        name,
        code: await readFile(new URL(name, chunks), 'utf8'),
      })),
    )
  ).find((entry) => entry.code.includes(`//#region ${source}`));
  assert.ok(chunk, `Built page exists: ${source}`);
  const { page } = await import(new URL(chunk.name, chunks));
  const html = await container.renderToString(page().default, {
    locals: { user: { name: 'Admin Preview' } },
    request: new Request(`http://admin-ui.test${path}`),
    params,
  });
  htmlPages.set(
    path,
    '<!doctype html>' +
      html.replace(
        '</head>',
        adminCss
          .map((name) => `<link rel="stylesheet" href="/_astro/${name}">`)
          .join('') + '</head>',
      ),
  );
}

const fixture = {
  id: 'trip-fixture',
  name: 'Labuan Bajo',
  slug: 'labuan-bajo',
  category: 'Bahari & Sailing',
  description: 'Data contoh untuk pemeriksaan tampilan.',
  included: 'Kapal dan pemandu',
  excluded: '',
  itinerary: '',
  meetingPoint: '',
  locationLabel: 'Labuan Bajo · Nusa Tenggara Timur',
  difficultyLevel: 'beginner',
  elevationMeters: 2050,
  trailDistanceKm: '8.50',
  elevationGainMeters: 750,
  trekDurationMinMinutes: 240,
  trekDurationMaxMinutes: 300,
  routeName: 'Via Mawar',
  terrainSummary: 'Jalur tanah, akar, dan beberapa tanjakan berbatu.',
  trailMapEmbedUrl: 'https://umap.openstreetmap.fr/en/map/jalur-contoh_123456',
  preparation: '',
  terms: '',
  coverImageUrl: '',
  createdAt: '2026-09-01T01:00:00.000Z',
  updatedAt: '2026-09-10T01:00:00.000Z',
  departures: [
    {
      id: 'departure-fixture',
      startAt: '2026-10-18T01:00:00.000Z',
      endAt: '2026-10-25T10:00:00.000Z',
      timezone: 'Asia/Jakarta',
      capacity: 20,
      unitPrice: '2500000',
      minimumPickupPrice: '2300000',
      dpMode: 'percent',
      dpValue: '30',
      bookingCutoffAt: '2026-10-17T01:00:00.000Z',
      balanceDueAt: '2026-10-16T01:00:00.000Z',
      publicationState: 'draft',
    },
  ],
};
const browser = await chromium.launch();
try {
  const devices = [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
  ];
  for (const [device, viewport] of process.env.ADMIN_UI_TEST_DEVICE
    ? devices.filter(([name]) => name === process.env.ADMIN_UI_TEST_DEVICE)
    : devices) {
    // Deliberately different browser timezone: inputs must still use WIB.
    const context = await browser.newContext({
      viewport,
      timezoneId: 'America/New_York',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    const writes = [];
    let r2Uploads = 0;
    let failSave = false;
    let empty = false;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (htmlPages.has(path))
        return route.fulfill({
          contentType: 'text/html',
          body: htmlPages.get(path),
        });
      if (path.startsWith('/_astro/')) {
        const name = path.slice('/_astro/'.length);
        const body = assetContents.get(name);
        if (!body) return route.fulfill({ status: 404 });
        const contentType = name.endsWith('.css')
          ? 'text/css'
          : name.endsWith('.js')
            ? 'text/javascript'
            : 'font/woff2';
        return route.fulfill({ contentType, body });
      }
      if (path === '/api/admin/trips' && request.method() === 'GET')
        return route.fulfill({ json: { trips: empty ? [] : [fixture] } });
      if (path.endsWith('/pickup-points') && request.method() === 'GET')
        return route.fulfill({
          json: {
            pickupPoints: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                zoneName: 'Jakarta',
                locationName: 'Halim',
                address: 'Jakarta Timur',
                mapsUrl: '',
                instructions: '',
                isActive: true,
              },
            ],
          },
        });
      if (path === '/api/admin/media/presign')
        return route.fulfill({
          status: 201,
          json: {
            uploadUrl: 'https://r2-upload.test/trip-covers/fixture.webp',
            publicUrl: 'https://media.example.test/trip-covers/fixture.webp',
            contentType: 'image/webp',
          },
        });
      if (new URL(request.url()).host === 'r2-upload.test') {
        r2Uploads += 1;
        return route.fulfill({ status: 200 });
      }
      if (path.startsWith('/api/admin/')) {
        writes.push({
          path,
          method: request.method(),
          body: request.postDataJSON(),
        });
        return route.fulfill({
          status: failSave ? 500 : 200,
          json: failSave
            ? { message: 'Penyimpanan gagal, coba lagi.' }
            : path === '/api/admin/trips' && request.method() === 'PATCH'
              ? { version: { version: 2 } }
              : {},
        });
      }
      if (path === '/api/auth/sign-in/email')
        return route.fulfill({
          status: 401,
          json: { code: 'INVALID_EMAIL_OR_PASSWORD' },
        });
      if (path === '/api/auth/sign-out')
        return route.fulfill({ json: { success: true } });
      return route.fulfill({ status: 404 });
    });
    for (const path of [
      '/admin',
      '/admin/trips',
      '/admin/trips/new',
      '/admin/trips/trip-fixture',
      '/admin/login',
    ]) {
      await page.goto(`http://admin-ui.test${path}`);
      if (path === '/admin/trips') {
        await page
          .getByRole('heading', { name: 'Labuan Bajo', exact: true })
          .waitFor();
        const menuToggle = page.getByRole('button', { name: /Menu/ });
        if (device === 'mobile') {
          assert.equal(await menuToggle.isVisible(), true);
          assert.equal(
            await page.locator('#admin-navigation').isVisible(),
            false,
          );
          await menuToggle.click();
          assert.equal(await menuToggle.getAttribute('aria-expanded'), 'true');
          await page
            .getByRole('link', { name: /Open Trip Paket & keberangkatan/ })
            .waitFor();
          await page
            .getByRole('link', { name: /Private Trip Permintaan & penawaran/ })
            .waitFor();
          await page.keyboard.press('Escape');
          assert.equal(await menuToggle.getAttribute('aria-expanded'), 'false');
        } else {
          assert.equal(await menuToggle.isVisible(), false);
          assert.equal(
            await page.locator('#admin-navigation').isVisible(),
            true,
          );
        }
      }
      if (path.endsWith('trip-fixture'))
        await page
          .getByRole('heading', { name: 'Labuan Bajo', exact: true })
          .waitFor();
      if (path === '/admin') {
        await page.evaluate(() => {
          const trigger = document.createElement('button');
          trigger.type = 'button';
          trigger.textContent = 'Buka bukti fixture';
          trigger.dataset.adminImageSrc =
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Cpath fill="%23ef741f" d="M0 0h8v8H0z"/%3E%3C/svg%3E';
          trigger.dataset.adminImageEyebrow = 'BUKTI PEMBAYARAN';
          trigger.dataset.adminImageTitle = 'Pembayaran fixture';
          trigger.dataset.adminImageAlt = 'Bukti fixture';
          document.querySelector('#admin-content')?.append(trigger);
        });
        await page
          .getByRole('button', { name: 'Buka bukti fixture', exact: true })
          .click();
        assert.equal(
          await page
            .locator('#admin-image-dialog')
            .evaluate((dialog) =>
              dialog instanceof HTMLDialogElement ? dialog.open : false,
            ),
          true,
          `${device}: global image viewer opens`,
        );
        await page.locator('#admin-image').waitFor({ state: 'visible' });
        assert.equal(
          await page.locator('#admin-image-title').textContent(),
          'Pembayaran fixture',
        );
        assert.equal(
          await page.locator('#admin-image').getAttribute('alt'),
          'Bukti fixture',
        );
        await page.getByRole('button', { name: 'Tutup gambar' }).click();
        assert.equal(
          await page.locator('#admin-image-dialog').isVisible(),
          false,
        );
      }
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${device} ${path}: no horizontal overflow`,
      );
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        accessibility.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        `${device} ${path}: accessibility`,
      );
      await page.screenshot({
        path: new URL(
          `docs/phase-4c/previews/${path.split('/').at(-1) || 'dashboard'}-${device}.png`,
          root,
        ).pathname,
        fullPage: true,
      });
    }
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill('invalid-password');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.getByText('Email atau password salah.').waitFor();

    await page.goto('http://admin-ui.test/admin/trips/trip-fixture');
    await page.waitForFunction(
      () => document.querySelector('[name="name"]')?.value === 'Labuan Bajo',
    );
    assert.equal(await page.locator('#trip-form').isVisible(), false);
    assert.equal(await page.locator('#departure-form').isVisible(), false);
    assert.equal(
      await page
        .getByRole('button', { name: 'Hapus jadwal', exact: true })
        .isVisible(),
      false,
    );
    await page.getByRole('tab', { name: 'Data paket', exact: true }).click();
    await page.locator('[name="description"]').fill('Isian belum disimpan');
    await page.getByRole('tab', { name: 'Titik jemput', exact: true }).click();
    await page
      .getByRole('button', { name: '+ Tambah lokasi', exact: true })
      .click();
    await page.locator('[name="zoneName"]').fill('Medan');
    await page.getByRole('tab', { name: 'Data paket', exact: true }).click();
    assert.equal(
      await page.locator('[name="description"]').inputValue(),
      'Isian belum disimpan',
    );
    await page.getByRole('tab', { name: 'Titik jemput', exact: true }).click();
    assert.equal(await page.locator('[name="zoneName"]').inputValue(), 'Medan');
    await page.getByRole('tab', { name: 'Data paket', exact: true }).click();
    for (const [tab, name] of [
      ['Data paket', 'package-form'],
      ['Titik jemput', 'pickup-form'],
    ]) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${name}: no overflow`,
      );
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        scan.violations.map((v) => v.id),
        [],
        `${name}: accessible`,
      );
      await page.screenshot({
        path: new URL(`docs/phase-4c/previews/${name}-${device}.png`, root)
          .pathname,
        fullPage: true,
      });
    }
    await page.getByRole('tab', { name: 'Data paket', exact: true }).click();
    assert.equal(
      await page.locator('[name="name"]').inputValue(),
      'Labuan Bajo',
    );
    assert.equal(
      await page.locator('[name="locationLabel"]').inputValue(),
      fixture.locationLabel,
    );
    assert.equal(
      await page.locator('[name="difficultyLevel"]').inputValue(),
      fixture.difficultyLevel,
    );
    assert.equal(
      await page.locator('[name="trekDurationMinHours"]').inputValue(),
      '4',
    );
    await page
      .getByText('02 · Info trek & tingkat aktivitas', { exact: true })
      .click();
    assert.equal(
      await page.locator('[name="terrainSummary"]').inputValue(),
      fixture.terrainSummary,
    );
    assert.equal(
      await page.locator('[name="trailMapEmbedUrl"]').inputValue(),
      fixture.trailMapEmbedUrl,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      'activity profile: no overflow',
    );
    const activityAccessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      activityAccessibility.violations.map((v) => v.id),
      [],
      'activity profile: accessible',
    );
    await page.screenshot({
      path: new URL(
        `docs/phase-4c/previews/activity-profile-${device}.png`,
        root,
      ).pathname,
      fullPage: true,
    });
    await page.getByText('03 · Fasilitas paket', { exact: true }).click();
    assert.equal(
      await page.locator('[name="included"]').inputValue(),
      fixture.included,
    );
    await page
      .getByRole('button', { name: 'Simpan trip', exact: true })
      .click();
    await page
      .getByText(
        'Versi paket 2 dibuat. Jadwal dengan booking tetap memakai versi sebelumnya.',
        { exact: true },
      )
      .last()
      .waitFor();
    assert.equal(writes.at(-1).method, 'PATCH');
    assert.equal(writes.at(-1).body.id, fixture.id);
    assert.equal(writes.at(-1).body.locationLabel, fixture.locationLabel);
    assert.equal(writes.at(-1).body.difficultyLevel, fixture.difficultyLevel);
    assert.equal(writes.at(-1).body.trekDurationMinMinutes, '240');
    assert.equal(writes.at(-1).body.applyToUnbookedDepartures, 'on');
    await page.locator('[name="name"]').fill('Gunung Rinjani 2026');
    assert.equal(
      await page.locator('#slug-preview').textContent(),
      '/trip/gunung-rinjani-2026',
    );
    await page.locator('[name="category"]').selectOption('__custom');
    await page.locator('[name="customCategory"]').fill('Fotografi alam');
    await page
      .getByRole('button', { name: 'Simpan trip', exact: true })
      .click();
    await page
      .getByText(
        'Versi paket 2 dibuat. Jadwal dengan booking tetap memakai versi sebelumnya.',
        { exact: true },
      )
      .last()
      .waitFor();
    assert.equal(writes.at(-1).body.slug, 'gunung-rinjani-2026');
    assert.equal(writes.at(-1).body.category, 'Fotografi alam');
    await page.getByRole('tab', { name: 'Jadwal', exact: true }).click();
    await page.locator('.schedule-more > summary').click();
    await page
      .getByRole('button', { name: 'Edit jadwal', exact: true })
      .click();
    assert.equal(
      await page.locator('[name="startDate"]').inputValue(),
      '2026-10-18',
    );
    assert.equal(
      await page.locator('[name="startTime"]').inputValue(),
      '08:00',
    );
    assert.equal(await page.locator('[name="unitPrice"]').isVisible(), false);
    await page.locator('[name="endDate"]').fill('2026-10-24');
    assert.equal(
      await page.locator('[name="endDate"]').inputValue(),
      '2026-10-24',
    );
    await page.locator('#schedule-payment-settings > summary').click();
    await page.locator('[name="bookingCutoffDate"]').fill('2026-10-15');
    assert.equal(
      await page.locator('[name="bookingCutoffDate"]').inputValue(),
      '2026-10-15',
    );
    await page.locator('[name="balanceDueDate"]').fill('2026-10-11');
    await page.locator('[name="balanceDueTime"]').fill('20:00');
    assert.equal(
      await page.locator('[name="balanceDueDate"]').inputValue(),
      '2026-10-11',
    );
    await page.locator('[name="publicationState"]').selectOption('closed');
    await page
      .getByRole('button', { name: 'Simpan jadwal', exact: true })
      .click();
    await page
      .getByText('Jadwal diperbarui.', { exact: true })
      .last()
      .waitFor();
    assert.equal(writes.at(-1).body.startAt, fixture.departures[0].startAt);
    assert.equal(writes.at(-1).body.balanceDueAt, '2026-10-11T13:00:00.000Z');
    assert.equal(writes.at(-1).body.publicationState, 'closed');
    assert.equal(writes.at(-1).body.unitPrice, undefined);
    await page.locator('.schedule-more > summary').click();
    await page
      .getByRole('button', { name: 'Hapus jadwal', exact: true })
      .click();
    await page
      .locator('#admin-confirm-dialog')
      .getByRole('button', { name: 'Hapus jadwal', exact: true })
      .click();
    await page.waitForTimeout(20);
    assert.equal(writes.at(-1).method, 'DELETE');
    // Create one schedule with a stored pickup: no repeated address input.
    await page
      .getByRole('button', { name: '+ Tambah jadwal', exact: true })
      .click();
    await page.locator('[name="startDate"]').fill('2026-11-10');
    await page.locator('[name="startTime"]').fill('07:17');
    await page.locator('[name="capacity"]').fill('15');
    await page.locator('[name="unitPrice"]').fill('1500000');
    assert.equal(
      await page.locator('[name="unitPrice"]').inputValue(),
      'Rp1.500.000',
    );
    await page.getByRole('tab', { name: 'Titik jemput', exact: true }).click();
    await page.getByRole('tab', { name: 'Jadwal', exact: true }).click();
    assert.equal(
      await page.locator('[name="startTime"]').inputValue(),
      '07:17',
    );
    assert.equal(
      await page.locator('[name="initialPickupPointId"]').inputValue(),
      '11111111-1111-4111-8111-111111111111',
    );
    const formA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      formA11y.violations.map((v) => v.id),
      [],
      'Schedule form accessibility',
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator('.notification-close').evaluateAll((buttons) =>
      buttons.forEach((button) => {
        if (button instanceof HTMLElement) button.click();
      }),
    );
    await page.screenshot({
      path: new URL(
        `docs/phase-4c/previews/schedule-editor-${device}.png`,
        root,
      ).pathname,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Simpan jadwal', exact: true })
      .click();
    await page.getByText('Jadwal disimpan.', { exact: true }).last().waitFor();
    assert.equal(writes.at(-1).method, 'POST');
    assert.equal(
      writes.at(-1).body.initialPickupPointId,
      '11111111-1111-4111-8111-111111111111',
    );
    assert.equal(writes.at(-1).body.startAt, '2026-11-10T00:17:00.000Z');
    assert.equal(writes.at(-1).body.balanceDueAt, '');
    assert.equal(writes.at(-1).body.unitPrice, '1500000');
    await page.getByRole('tab', { name: 'Data paket', exact: true }).click();
    failSave = true;
    await page
      .getByRole('button', { name: 'Simpan trip', exact: true })
      .click();
    await page
      .getByText('Penyimpanan gagal, coba lagi.', { exact: true })
      .last()
      .waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: 'Simpan trip', exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(
      await page.locator('[name="name"]').inputValue(),
      'Labuan Bajo',
    );
    failSave = false;
    await page.setInputFiles('#cover-file', {
      name: 'cover.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from(
        'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=',
        'base64',
      ),
    });
    await page.getByText('cover.webp', { exact: true }).waitFor();
    const savedCover = page.waitForResponse((response) => {
      const request = response.request();
      if (
        new URL(request.url()).pathname !== '/api/admin/trips' ||
        request.method() !== 'PATCH'
      )
        return false;
      return (
        request.postDataJSON()?.coverImageUrl ===
        'https://media.example.test/trip-covers/fixture.webp'
      );
    });
    await page
      .getByRole('button', { name: 'Simpan trip', exact: true })
      .click();
    await savedCover;
    assert.equal(r2Uploads, 1);
    assert.equal(
      writes.at(-1).body.coverImageUrl,
      'https://media.example.test/trip-covers/fixture.webp',
    );
    await page.goto('http://admin-ui.test/admin/trips');
    await page
      .getByRole('heading', { name: 'Labuan Bajo', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Arsipkan', exact: true }).click();
    await page
      .locator('#admin-confirm-dialog')
      .getByRole('button', { name: 'Arsipkan trip', exact: true })
      .click();
    await page.getByText('Trip diarsipkan.').waitFor();
    assert.equal(writes.at(-1).path, '/api/admin/trips');
    assert.equal(writes.at(-1).method, 'DELETE');
    await page
      .getByText(
        'Belum ada Open Trip. Buat paket pertama untuk mulai mengatur keberangkatan.',
      )
      .waitFor();
    await page.getByRole('button', { name: 'Keluar' }).click();
    await page.waitForURL('**/admin/login');
    assert.deepEqual(errors, [], `${device}: no browser JavaScript errors`);
    console.log(
      `${device}: layout, accessibility, login error, R2 thumbnail/upload, easy WIB schedule, edit/save, empty/error states and logout passed (fixture API).`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
