import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.TEST_BASE_URL || 'http://localhost:4321';
const browser = await chromium.launch();
let checked = 0;
let pickupSwitches = 0;
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    // Prevent any real quotes, orders or other writes while inspecting live pages.
    await context.route('**/*', (route) =>
      ['GET', 'HEAD'].includes(route.request().method())
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(`${origin}/trip`);
    const tripLinks = await page
      .locator('.trip-image-link')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    assert.ok(
      tripLinks.length,
      'Local browser smoke test needs at least one available trip',
    );
    for (const tripLink of tripLinks) {
      await page.goto(`${origin}${tripLink}`);
      const schedules = await page
        .locator('.departure-option')
        .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
      for (const schedule of schedules) {
        await page.goto(`${origin}${tripLink}${schedule}`);
        const detail = await page.evaluate(() => {
          const selected = document.querySelector('.departure-option-active');
          const facts = document.querySelectorAll('.trip-quickfacts strong');
          return {
            date: facts[0].textContent.trim(),
            selectedDate: selected.querySelector('strong').textContent.trim(),
            price: facts[1].textContent.trim().replace(/\D/g, ''),
            prices: [
              ...document.querySelectorAll(
                '.trip-pickup-table td:last-child strong',
              ),
            ].map((e) => e.textContent.replace(/\D/g, '')),
            count: Number(facts[2].textContent.trim()),
            checkout: document
              .querySelector('.selected-departure-cta a')
              .getAttribute('href'),
          };
        });
        assert.equal(detail.date, detail.selectedDate);
        assert.equal(
          BigInt(detail.price),
          detail.prices.map(BigInt).reduce((a, b) => (a < b ? a : b)),
        );
        const selectedId = new URLSearchParams(schedule).get('jadwal');
        assert.equal(detail.checkout, `/booking/${selectedId}`);

        // Fixture responses test UI synchronization without persisting real quotes.
        let requests = 0;
        await page.route('**/api/checkout/quote', async (route) => {
          const body = route.request().postDataJSON();
          const pickup = await page
            .locator(`input[value="${body.pickupOptionId}"]`)
            .getAttribute('data-price');
          const total = (BigInt(pickup) * BigInt(body.pax)).toString();
          const requestIndex = ++requests;
          if (requestIndex === 1)
            await new Promise((resolve) => setTimeout(resolve, 400));
          await route.fulfill({
            json: {
              quote: {
                id: `fixture-${requestIndex}`,
                total,
                minimumDp: '100000',
              },
            },
          });
        });
        const response = await page.goto(`${origin}${detail.checkout}`, {
          waitUntil: 'domcontentloaded',
        });
        assert.equal(response.status(), 200);
        assert.equal(
          await page.locator('#pickup-options input').count(),
          detail.count,
        );
        const other = page
          .locator('#pickup-options input:not(:checked)')
          .first();
        if (await other.count()) {
          await other.check();
          pickupSwitches++;
        }
        await page.waitForFunction(
          () => !document.querySelector('#booking-submit').disabled,
        );
        await page.waitForTimeout(500);
        const summary = await page.evaluate(() => {
          const selected = document.querySelector(
            '#pickup-options input:checked',
          );
          return {
            price: document
              .querySelector('#pickup-unit-price')
              .textContent.replace(/\D/g, ''),
            expectedPrice: selected.dataset.price,
            label: document
              .querySelector('#pickup-summary dd')
              .textContent.trim(),
            expectedLabel: selected.dataset.label,
            max: document.querySelector('#booking-pax').max,
            available: selected.dataset.available,
            total: document
              .querySelector('#quote-summary strong')
              .textContent.replace(/\D/g, ''),
          };
        });
        assert.equal(summary.price, summary.expectedPrice);
        assert.equal(
          summary.total,
          summary.expectedPrice,
          'Late quote must not replace current pickup price',
        );
        assert.equal(summary.label, summary.expectedLabel);
        assert.equal(summary.max, summary.available);
        const excessivePax = Number(summary.max) + 1;
        await page.locator('#booking-pax').fill(String(excessivePax));
        const privateTripSuggestion = await page.evaluate(() => ({
          visible: !document.querySelector('#booking-pax-warning').hidden,
          text: document
            .querySelector('#booking-pax-warning')
            .textContent.trim(),
          href: document
            .querySelector('#private-trip-option')
            .getAttribute('href'),
          invalid: document
            .querySelector('#booking-pax')
            .getAttribute('aria-invalid'),
        }));
        assert.equal(privateTripSuggestion.visible, true);
        assert.match(privateTripSuggestion.text, /Private Trip/);
        assert.equal(privateTripSuggestion.invalid, 'true');
        const privateTripUrl = new URL(
          privateTripSuggestion.href,
          'http://localhost',
        );
        assert.equal(privateTripUrl.pathname, '/private-trip');
        assert.equal(
          privateTripUrl.searchParams.get('pax'),
          String(excessivePax),
        );
        assert.ok(privateTripUrl.searchParams.get('destination'));
        assert.ok(privateTripUrl.searchParams.get('startDate'));
        assert.ok(privateTripUrl.searchParams.get('endDate'));
        await page.unroute('**/api/checkout/quote');
        checked++;
      }
      await page.goto(`${origin}${tripLink}?jadwal=unavailable`);
      assert.match(
        await page.locator('main [role="status"]').innerText(),
        /tidak tersedia/,
      );
    }
    await context.close();
  }
  console.log(
    `Browser stage 1: ${checked} schedule flows and ${pickupSwitches} pickup switches passed (390/1440px, quotes mocked, no business writes).`,
  );
} finally {
  await browser.close();
}
