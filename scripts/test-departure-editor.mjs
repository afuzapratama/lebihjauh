// API contract tests with a mocked database; never connects to project data.
// node --experimental-test-module-mocks --import=tsx/esm scripts/test-departure-editor.mjs
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { getTableName } from 'drizzle-orm';

let reads = [];
let writes = [];
let failPickup = false;
function query(result) {
  return new Proxy(
    {},
    {
      get: (_target, key) =>
        key === 'then'
          ? (resolve, reject) =>
              Promise.resolve().then(result).then(resolve, reject)
          : () => query(result),
    },
  );
}
const db = {
  select: () =>
    query(() => {
      assert.ok(reads.length, 'Unexpected database read');
      return reads.shift();
    }),
  insert: (table) => ({
    values: (values) =>
      query(() => {
        const name = getTableName(table);
        if (failPickup && name === 'departure_pickup_options')
          throw new Error('Injected write failure');
        writes.push({ kind: 'insert', table: name, values });
        return [{ id: 'departure-created', ...values }];
      }),
  }),
  update: (table) => ({
    set: (values) =>
      query(() => {
        writes.push({ kind: 'update', table: getTableName(table), values });
        return [{ id: 'departure-existing', ...values }];
      }),
  }),
  delete: (table) =>
    query(() => {
      writes.push({ kind: 'delete', table: getTableName(table) });
      return [];
    }),
  transaction: async (callback) => {
    const checkpoint = writes.length;
    try {
      return await callback(db);
    } catch (error) {
      writes.splice(checkpoint);
      throw error;
    }
  },
};
mock.module('../src/db/client.ts', { namedExports: { getDb: () => db } });
const { POST, PATCH, DELETE } =
  await import('../src/pages/api/admin/departures.ts');
const point = {
  id: '11111111-1111-4111-8111-111111111111',
  zoneName: 'Jakarta',
  locationName: 'Halim',
  address: 'Jakarta Timur',
  mapsUrl: null,
  instructions: 'Pintu utama',
};
const version = {
  versionId: 'version-1',
  tripId: 'trip-1',
  itineraryStages: [
    {
      day: 'Hari 1',
      title: 'Berangkat',
      activities: [
        { time: '07:17', activity: 'Perjalanan', location: 'Halim' },
      ],
      details: '',
    },
  ],
};
const input = {
  tripId: 'trip-1',
  startAt: '2027-01-10T00:17:00.000Z',
  endAt: '2027-01-11T10:00:00.000Z',
  timezone: 'Asia/Jakarta',
  capacity: '15',
  unitPrice: '1500000',
  dpMode: 'percent',
  dpValue: '30',
  bookingCutoffAt: '2027-01-09T13:00:00.000Z',
  // Pelunasan setelah trip selesai tetap valid selama masih pada hari turun (WIB).
  balanceDueAt: '2027-01-11T13:00:00.000Z',
  publicationState: 'draft',
  initialPickupPointId: point.id,
};
const call = (handler, body, method = 'POST') =>
  handler({
    request: new Request('http://api.test/api/admin/departures', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    locals: { user: { id: 'admin-test' } },
  });

reads = [[version], [point]];
assert.equal((await call(POST, input)).status, 201);
assert.equal(reads.length, 0);
const pickup = writes.find(
  (w) => w.table === 'departure_pickup_options',
).values;
assert.equal(pickup.pricePerPax, input.unitPrice);
assert.equal(pickup.address, point.address);
assert.equal(pickup.masterPickupPointId, point.id);
assert.equal(pickup.pickupRundownStages, null);
assert.equal(pickup.isDefault, true);

const afterDescentDay = await call(POST, {
  ...input,
  balanceDueAt: '2027-01-11T17:00:00.000Z',
});
assert.equal(afterDescentDay.status, 400);
assert.equal(
  (await afterDescentDay.json()).message,
  'Tenggat pelunasan tidak boleh setelah hari terakhir trip (hari turun).',
);

writes = [];
assert.equal(
  (await call(POST, { ...input, initialPickupPointId: '' })).status,
  400,
);
reads = [[version], []];
assert.equal((await call(POST, input)).status, 400);
assert.deepEqual(
  writes,
  [],
  'Unavailable/foreign pickup cannot create a departure',
);

reads = [[version], [point]];
failPickup = true;
const errorLog = mock.method(console, 'error', () => {});
assert.equal((await call(POST, input)).status, 500);
assert.deepEqual(
  writes,
  [],
  'Departure and pickup writes are inside the same transaction',
);
errorLog.mock.restore();
failPickup = false;

const existing = {
  id: 'departure-existing',
  tripVersionId: 'version-1',
  unitPrice: '9990000',
  revision: 2,
  startAt: new Date(input.startAt),
};
reads = [
  [existing],
  [{ price: '1200000' }],
  [{ ...version, versionId: 'version-2' }],
  [{ tripId: 'trip-1' }],
  [{ value: 0 }],
  [],
];
assert.equal(
  (await call(PATCH, { ...input, id: existing.id, unitPrice: '1' }, 'PATCH'))
    .status,
  200,
);
assert.equal(
  writes.find((w) => w.kind === 'update').values.unitPrice,
  '1200000',
  'Client cannot overwrite meeting-point price through schedule edit',
);
assert.equal(
  writes.find((w) => w.kind === 'update').values.tripVersionId,
  'version-1',
  'Schedule edit must preserve its bound package version by default',
);
assert.equal(
  writes.some((w) => w.table === 'departure_pickup_options'),
  false,
);

writes = [];
reads = [
  [existing],
  [{ price: '1200000' }],
  [{ ...version, versionId: 'version-2' }],
  [{ tripId: 'trip-1' }],
  [{ value: 1 }],
];
assert.equal(
  (
    await call(
      PATCH,
      { ...input, id: existing.id, useLatestTripVersion: true },
      'PATCH',
    )
  ).status,
  400,
  'A booked schedule requires explicit confirmation before switching version',
);
assert.deepEqual(writes, []);

reads = [
  [existing],
  [{ price: '1200000' }],
  [{ ...version, versionId: 'version-2' }],
  [{ tripId: 'trip-1' }],
  [{ value: 1 }],
  [],
];
assert.equal(
  (
    await call(
      PATCH,
      {
        ...input,
        id: existing.id,
        useLatestTripVersion: true,
        confirmBookedItineraryChange: true,
      },
      'PATCH',
    )
  ).status,
  200,
);
assert.equal(
  writes.find((w) => w.kind === 'update').values.tripVersionId,
  'version-2',
);

writes = [];
reads = [[existing], [{ value: 1 }]];
assert.equal((await call(DELETE, { id: existing.id }, 'DELETE')).status, 400);
assert.deepEqual(writes, [], 'Booked departure cannot be deleted');
reads = [[existing], [{ value: 0 }], [{ value: 2 }], [{ value: 0 }]];
assert.equal((await call(DELETE, { id: existing.id }, 'DELETE')).status, 400);
assert.deepEqual(writes, [], 'Active checkout quote blocks deletion');
reads = [[existing], [{ value: 0 }], [{ value: 0 }], [{ value: 1 }]];
assert.equal((await call(DELETE, { id: existing.id }, 'DELETE')).status, 400);
assert.deepEqual(writes, [], 'Financial history blocks deletion');
reads = [[existing], [{ value: 0 }], [{ value: 0 }], [{ value: 0 }]];
assert.equal((await call(DELETE, { id: existing.id }, 'DELETE')).status, 200);
assert.deepEqual(
  writes.filter((w) => w.kind === 'delete').map((w) => w.table),
  ['checkout_quotes', 'departure_pickup_options', 'departures'],
);
assert.equal(reads.length, 0);
console.log(
  'Departure API contracts passed: stored pickup, atomic creation, unavailable location, server-derived price, protected deletion and expired quote cleanup (mock DB).',
);
