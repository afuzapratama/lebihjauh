import assert from 'node:assert/strict';
import postgres from 'postgres';
import {
  resolveBookingSnapshot,
  resolveItinerary,
  type ItineraryStage,
} from '../src/lib/trip-itinerary';

const core: ItineraryStage[] = [
  {
    day: 'Hari 1',
    title: 'Perjalanan inti',
    activities: [{ time: '08.00', activity: 'Mulai', location: 'Basecamp' }],
    details: '',
  },
];
const override: ItineraryStage[] = [
  {
    day: 'Hari 1',
    title: 'Rute khusus',
    activities: [{ time: '09.00', activity: 'Mulai', location: 'Jalur B' }],
    details: '',
  },
];

assert.deepEqual(resolveItinerary(core, null), {
  source: 'trip_version',
  stages: core,
});
assert.deepEqual(resolveItinerary(core, override), {
  source: 'departure_override',
  stages: override,
});
assert.deepEqual(resolveItinerary(core, []), {
  source: 'departure_override',
  stages: [],
});

const snapshot = resolveBookingSnapshot(
  {
    snapshotVersion: 2,
    itineraryStages: override,
    legacyItinerary: 'Snapshot lama',
    included: 'Snapshot termasuk',
    excluded: 'Snapshot tidak termasuk',
    preparation: 'Snapshot persiapan',
    terms: 'Snapshot ketentuan',
    pickup: { pickupRundownStages: null },
  },
  {
    itineraryStages: core,
    itinerary: 'Live berubah',
    included: 'Live berubah',
    excluded: 'Live berubah',
    preparation: 'Live berubah',
    terms: 'Live berubah',
  },
);
assert.deepEqual(snapshot.itineraryStages, override);
assert.equal(snapshot.itinerary, 'Snapshot lama');
assert.equal(snapshot.included, 'Snapshot termasuk');
assert.deepEqual(snapshot.pickupRundownStages, []);

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum tersedia.');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const columns = await sql<Array<{ column_name: string }>>`
    select column_name
    from information_schema.columns
    where table_name = 'departure_pickup_options'
      and column_name in ('itinerary_stages', 'pickup_rundown_stages')
  `;
  assert.deepEqual(
    columns.map((row) => row.column_name),
    ['pickup_rundown_stages'],
  );

  const [snapshotAudit] = await sql<
    Array<{
      total: number;
      versioned: number;
      frozen: number;
      pickup_contract: number;
    }>
  >`
    select
      count(*)::int as total,
      count(*) filter (
        where package_snapshot->>'snapshotVersion' = '2'
      )::int as versioned,
      count(*) filter (
        where package_snapshot ? 'itineraryStages'
      )::int as frozen,
      count(*) filter (
        where package_snapshot->'pickup' ? 'pickupRundownStages'
      )::int as pickup_contract
    from bookings
  `;
  assert.equal(snapshotAudit.versioned, snapshotAudit.total);
  assert.equal(snapshotAudit.frozen, snapshotAudit.total);
  assert.equal(snapshotAudit.pickup_contract, snapshotAudit.total);

  const [duplicateAudit] = await sql<Array<{ total: number }>>`
    select count(*)::int as total
    from departure_pickup_options dpo
    join departures d on d.id = dpo.departure_id
    join trip_versions tv on tv.id = d.trip_version_id
    where dpo.pickup_rundown_stages is not null
      and dpo.pickup_rundown_stages = coalesce(
        d.itinerary_override,
        tv.itinerary_stages
      )
  `;
  assert.equal(
    duplicateAudit.total,
    0,
    'Rundown pickup tidak boleh menjadi salinan itinerary utama.',
  );

  console.log(
    `Phase 4J.2 lulus: resolver 3 skenario; ${snapshotAudit.total} snapshot booking v2; tanpa duplikasi itinerary pickup.`,
  );
} finally {
  await sql.end();
}
