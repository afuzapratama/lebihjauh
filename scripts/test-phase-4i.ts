import assert from 'node:assert/strict';
import { parsePrivateTripOffer } from '../src/lib/private-trip-service.ts';
import { revenueFilters } from '../src/lib/revenue-report.ts';

const future = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1_000).toISOString();

const offer = parsePrivateTripOffer({
  title: 'Merbabu Private Trip',
  startAt: future(10),
  endAt: future(12),
  validUntil: future(5),
  pax: '4',
  unitPrice: '1500000',
  dpMode: 'percent',
  dpValue: '30',
  included: 'Transport',
  excluded: 'Kebutuhan pribadi',
  pickupZoneName: 'Jakarta',
  pickupLocationName: 'Halim',
  pickupAddress: 'Jakarta Timur',
  pickupMapsUrl: 'https://maps.google.com/',
  pickupInstructions: 'Tunggu di pintu utama.',
  itineraryStages: JSON.stringify([
    {
      day: 'Hari 1',
      title: 'Jakarta menuju basecamp',
      activities: [{ time: '20:00', activity: 'Berangkat', location: 'Halim' }],
      details: '',
    },
  ]),
  preparation: 'Jaket hangat',
  notes: 'Waktu final melalui WhatsApp.',
});

assert.equal(offer.minimumDp, '1800000');
assert.equal(offer.pickupDetails.locationName, 'Halim');
assert.equal(offer.itineraryStages[0]?.activities.length, 1);
assert.match(offer.meetingPoint, /Jakarta.*Halim/);

const filters = revenueFilters(
  new URLSearchParams({
    year: '2026',
    month: '9',
    source: 'private_trip',
    departure: '11111111-1111-4111-8111-111111111111',
    pickup: 'Jakarta · Halim',
  }),
);
assert.equal(filters.bookingSource, 'private_trip');
assert.equal(filters.departureId, '11111111-1111-4111-8111-111111111111');
assert.equal(filters.pickupName, 'Jakarta · Halim');

assert.throws(
  () =>
    parsePrivateTripOffer({
      ...offer,
      startAt: future(10),
      endAt: future(12),
      validUntil: future(5),
      pax: '4',
      unitPrice: '1500000',
      dpMode: 'percent',
      dpValue: '30',
      pickupZoneName: 'Jakarta',
      pickupLocationName: 'Halim',
      itineraryStages: '[]',
    }),
  /minimal satu hari/i,
);

console.log('Phase 4I: private offer and finance filter contracts passed.');
