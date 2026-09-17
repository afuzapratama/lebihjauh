import assert from 'node:assert/strict';
import { and, eq, lte } from 'drizzle-orm';
import { getDb } from '../src/db/client.ts';
import { departure } from '../src/db/schema.ts';
import { availableTripOptions } from '../src/lib/trip-availability.ts';
import { getCheckoutDeparture } from '../src/lib/booking-service.ts';
import { getPublicTrip, getPublicTrips } from '../src/lib/public-trips.ts';

const now = new Date('2030-01-01T00:00:00Z');
const pickups = [
  { id: 'cheap', capacity: 2, pricePerPax: '900000' },
  { id: 'other', capacity: null, pricePerPax: '2000000' },
];
const committed = {
  pickupOptionId: 'cheap',
  pax: 2,
  state: 'committed',
  expiresAt: null,
};
const available = availableTripOptions(10, pickups, [committed], now)!;
assert.equal(available.available, 8);
assert.equal(
  available.unitPrice,
  '2000000',
  'Sold-out pickup must not set the advertised minimum',
);
assert.deepEqual(
  available.pickupOptions.map((p) => p.id),
  ['other'],
);
assert.equal(
  availableTripOptions(2, pickups, [committed], now),
  null,
  'Full departure must not be bookable',
);
assert.equal(
  availableTripOptions(10, [pickups[0]], [committed], now),
  null,
  'All pickup quotas full',
);
assert.equal(availableTripOptions(10, [], [], now), null, 'No active pickup');
assert.equal(
  availableTripOptions(
    10,
    pickups,
    [{ ...committed, state: 'held', expiresAt: now }],
    now,
  )!.unitPrice,
  '900000',
  'Expired hold must release the advertised pickup',
);
assert.equal(
  availableTripOptions(
    10,
    pickups,
    [{ ...committed, state: 'held', expiresAt: new Date(now.getTime() + 1) }],
    now,
  )!.unitPrice,
  '2000000',
  'Live hold consumes pickup seats',
);
assert.equal(
  availableTripOptions(10, pickups, [{ ...committed, state: 'released' }], now)!
    .available,
  10,
);
assert.equal(
  availableTripOptions(
    3,
    pickups,
    [{ ...committed, pickupOptionId: null }],
    now,
  )!.pickupOptions[0].available,
  1,
  'Legacy allocation without pickup still consumes shared seats',
);
assert.equal(
  availableTripOptions(10, [pickups[0]], [{ ...committed, pax: 1 }], now)!
    .pickupOptions[0].available,
  1,
);
console.log(
  'Availability fixtures: passed (full/limited pickup, full departure, expired/live holds, legacy allocation).',
);

// Read-only integration smoke test against configured local data. No orders/quotes created.
try {
  assert.equal(await getCheckoutDeparture('invalid-id'), null);
  const trips = await getPublicTrips();
  let schedulesChecked = 0;
  for (const trip of trips) {
    const initial = await getPublicTrip(trip.slug);
    assert.equal(initial?.selectedDeparture.id, trip.departures[0].id);
    const stale = await getPublicTrip(
      trip.slug,
      '00000000-0000-4000-8000-000000000000',
    );
    assert.equal(stale?.requestedDepartureUnavailable, true);
    for (const schedule of trip.departures) {
      const detail = await getPublicTrip(trip.slug, schedule.id);
      const checkout = await getCheckoutDeparture(schedule.id);
      assert.ok(checkout);
      assert.ok(detail);
      assert.equal(detail.requestedDepartureUnavailable, false);
      assert.equal(detail.selectedDeparture.id, checkout.id);
      assert.equal(detail.unitPrice, checkout.unitPrice);
      assert.equal(detail.description, checkout.description);
      assert.equal(detail.terms, checkout.terms);
      assert.deepEqual(detail.pickupOptions, checkout.pickupOptions);
      assert.ok(checkout.available > 0);
      assert.ok(checkout.bookingCutoffAt > new Date());
      for (const pickup of checkout.pickupOptions) {
        assert.equal(pickup.departureId, schedule.id);
        assert.ok(
          pickup.available > 0 && pickup.available <= checkout.available,
        );
      }
      schedulesChecked++;
    }
  }
  const expired = await getDb()
    .select({ id: departure.id })
    .from(departure)
    .where(
      and(
        eq(departure.publicationState, 'open'),
        lte(departure.bookingCutoffAt, new Date()),
      ),
    )
    .limit(5);
  for (const schedule of expired) {
    assert.equal(await getCheckoutDeparture(schedule.id), null);
    assert.ok(
      !trips.some((trip) => trip.departures.some((d) => d.id === schedule.id)),
    );
  }
  console.log(
    `Read-only integration: ${schedulesChecked} available schedules, ${expired.length} expired schedules checked.`,
  );
} finally {
  await getDb().$client.end();
}
