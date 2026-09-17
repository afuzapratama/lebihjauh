import type { APIRoute } from 'astro';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../../../../../db/client';
import { adminAuditLog, trip, tripPickupPoint } from '../../../../../db/schema';

export const prerender = false;

class PickupPointInputError extends Error {}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const uuid = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value))
    throw new PickupPointInputError(`${label} tidak valid.`);
  return value;
};
const text = (value: unknown, label: string, max: number, required = true) => {
  const result =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && !result)
    throw new PickupPointInputError(`${label} wajib diisi.`);
  if (result.length > max)
    throw new PickupPointInputError(`${label} terlalu panjang.`);
  return result;
};
const parse = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PickupPointInputError('Data titik jemput tidak valid.');
  const input = value as Record<string, unknown>;
  const mapsUrl = text(input.mapsUrl, 'Tautan peta', 2_000, false);
  if (mapsUrl) {
    try {
      const url = new URL(mapsUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new PickupPointInputError(
        'Tautan peta harus berupa URL http atau https.',
      );
    }
  }
  return {
    zoneName: text(input.zoneName, 'Nama zona', 120),
    locationName: text(input.locationName, 'Nama lokasi', 160),
    address: text(input.address, 'Alamat', 1_000),
    mapsUrl: mapsUrl || null,
    instructions: text(input.instructions, 'Petunjuk dasar', 2_000, false),
  };
};

async function assertTrip(tripId: string) {
  const [found] = await getDb()
    .select({ id: trip.id })
    .from(trip)
    .where(eq(trip.id, tripId))
    .limit(1);
  if (!found) throw new PickupPointInputError('Open Trip tidak ditemukan.');
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const tripId = uuid(params.id, 'Open Trip');
    await assertTrip(tripId);
    const pickupPoints = await getDb()
      .select()
      .from(tripPickupPoint)
      .where(eq(tripPickupPoint.tripId, tripId))
      .orderBy(asc(tripPickupPoint.sortOrder), asc(tripPickupPoint.createdAt));
    return json({ pickupPoints });
  } catch (error) {
    return error instanceof PickupPointInputError
      ? json({ message: error.message }, 422)
      : json({ message: 'Titik jemput belum dapat dimuat.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const tripId = uuid(params.id, 'Open Trip');
    await assertTrip(tripId);
    const values = parse(await request.json());
    const db = getDb();
    const [created] = await db
      .insert(tripPickupPoint)
      .values({ tripId, ...values })
      .returning();
    await db.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'trip',
      entityId: tripId,
      action: 'pickup_point_created',
      payload: { pickupPointId: created.id, zoneName: created.zoneName },
    });
    return json({ pickupPoint: created }, 201);
  } catch (error) {
    return error instanceof PickupPointInputError
      ? json({ message: error.message }, 422)
      : json({ message: 'Titik jemput belum dapat disimpan.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  try {
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const tripId = uuid(params.id, 'Open Trip');
    const body = (await request.json()) as Record<string, unknown>;
    const id = uuid(body.id, 'Titik jemput');
    const action = body.action === 'deactivate' ? 'deactivate' : 'update';
    const db = getDb();
    const [existing] = await db
      .select({ id: tripPickupPoint.id })
      .from(tripPickupPoint)
      .where(
        and(eq(tripPickupPoint.id, id), eq(tripPickupPoint.tripId, tripId)),
      )
      .limit(1);
    if (!existing)
      throw new PickupPointInputError('Titik jemput tidak ditemukan.');
    const [updated] = await db
      .update(tripPickupPoint)
      .set(
        action === 'deactivate'
          ? { isActive: false, updatedAt: new Date() }
          : { ...parse(body), updatedAt: new Date() },
      )
      .where(eq(tripPickupPoint.id, id))
      .returning();
    await db.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'trip',
      entityId: tripId,
      action:
        action === 'deactivate'
          ? 'pickup_point_deactivated'
          : 'pickup_point_updated',
      payload: { pickupPointId: id },
    });
    return json({ pickupPoint: updated });
  } catch (error) {
    return error instanceof PickupPointInputError
      ? json({ message: error.message }, 422)
      : json({ message: 'Titik jemput belum dapat diperbarui.' }, 500);
  }
};
