import type { APIRoute } from 'astro';
import { and, count, desc, eq, gt, isNull, lte } from 'drizzle-orm';
import { getDb } from '../../../db/client';
import {
  adminAuditLog,
  booking,
  bookingAllocation,
  checkoutQuote,
  departure,
  departurePickupOption,
  trip,
  tripExpense,
  tripPickupPoint,
  tripVersion,
} from '../../../db/schema';
import {
  InputError,
  parseDepartureInput,
  toPayload,
} from '../../../lib/trip-admin';
import { departureDeletionPolicy } from '../../../lib/departure-policy';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function currentVersion(tripId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      tripId: trip.id,
      versionId: tripVersion.id,
      meetingPoint: tripVersion.meetingPoint,
    })
    .from(trip)
    .innerJoin(tripVersion, eq(tripVersion.tripId, trip.id))
    .where(and(eq(trip.id, tripId), isNull(trip.archivedAt)))
    .orderBy(desc(tripVersion.version))
    .limit(1);
  return row;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const input = parseDepartureInput(values);
    const initialPickupPointId =
      typeof values.initialPickupPointId === 'string'
        ? values.initialPickupPointId
        : '';
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        initialPickupPointId,
      )
    )
      throw new InputError('Pilih meeting point dari lokasi tersimpan.');
    const {
      tripId,
      useLatestTripVersion: _useLatestTripVersion,
      confirmBookedItineraryChange: _confirmBookedItineraryChange,
      ...departureValues
    } = input;
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const version = await currentVersion(tripId);
    if (!version)
      throw new InputError('Trip tidak ditemukan atau sudah diarsipkan.');
    const db = getDb();
    const created = await db.transaction(async (tx) => {
      const [point] = await tx
        .select()
        .from(tripPickupPoint)
        .where(
          and(
            eq(tripPickupPoint.id, initialPickupPointId),
            eq(tripPickupPoint.tripId, tripId),
            eq(tripPickupPoint.isActive, true),
          ),
        )
        .for('share');
      if (!point)
        throw new InputError(
          'Titik jemput tidak tersedia untuk paket ini. Pilih lokasi aktif.',
        );
      const [newDeparture] = await tx
        .insert(departure)
        .values({ ...departureValues, tripVersionId: version.versionId })
        .returning();
      await tx.insert(departurePickupOption).values({
        departureId: newDeparture.id,
        masterPickupPointId: point.id,
        zoneName: point.zoneName,
        locationName: point.locationName,
        address: point.address,
        mapsUrl: point.mapsUrl,
        instructions: point.instructions,
        pricePerPax: input.unitPrice,
        // 4J: tidak menyalin itinerary paket ke pickup. Rundown pickup
        // NULL berarti tidak ada segmen penjemputan
        // tambahan sebelum perjalanan utama.
        pickupRundownStages: null,
        isDefault: true,
      });
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'departure',
        entityId: newDeparture.id,
        action: 'created',
        payload: {
          tripId,
          startAt: input.startAt.toISOString(),
          state: input.publicationState,
          pickupOptionCreated: true,
          masterPickupPointId: point.id,
        },
      });
      return newDeparture;
    });
    return json({ departure: created }, 201);
  } catch (error) {
    if (error instanceof InputError)
      return json({ message: error.message }, 400);
    console.error('Gagal membuat jadwal', error);
    return json({ message: 'Gagal menyimpan jadwal.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const id = typeof values.id === 'string' ? values.id : '';
    if (!id) throw new InputError('ID jadwal tidak valid.');
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(departure)
      .where(eq(departure.id, id));
    if (!existing) throw new InputError('Jadwal tidak ditemukan.');
    const prices = await db
      .select({ price: departurePickupOption.pricePerPax })
      .from(departurePickupOption)
      .where(
        and(
          eq(departurePickupOption.departureId, id),
          eq(departurePickupOption.isActive, true),
        ),
      )
      .orderBy(departurePickupOption.pricePerPax)
      .limit(1);
    // Harga dikelola pada meeting point; field lama hanya dipertahankan untuk kompatibilitas data.
    const input = parseDepartureInput({
      ...values,
      unitPrice: prices[0]?.price ?? existing.unitPrice,
      useItineraryOverride:
        values.useItineraryOverride ??
        (existing.itineraryOverride ?? null) !== null,
      itineraryOverride:
        values.itineraryOverride ?? existing.itineraryOverride ?? [],
    });
    const {
      tripId,
      useLatestTripVersion,
      confirmBookedItineraryChange,
      ...departureValues
    } = input;
    const latestVersion = await currentVersion(tripId);
    if (!latestVersion)
      throw new InputError('Trip tidak ditemukan atau sudah diarsipkan.');
    const [originalVersion] = await db
      .select({ tripId: tripVersion.tripId })
      .from(tripVersion)
      .where(eq(tripVersion.id, existing.tripVersionId));
    if (originalVersion?.tripId !== tripId)
      throw new InputError('Jadwal tidak dapat dipindahkan ke paket lain.');

    const nextTripVersionId = useLatestTripVersion
      ? latestVersion.versionId
      : existing.tripVersionId;
    const itineraryChanged =
      JSON.stringify(existing.itineraryOverride ?? null) !==
        JSON.stringify(departureValues.itineraryOverride ?? null) ||
      nextTripVersionId !== existing.tripVersionId;
    const [orderTotal] = await db
      .select({ value: count() })
      .from(booking)
      .where(eq(booking.departureId, id));
    if (
      itineraryChanged &&
      (orderTotal?.value ?? 0) > 0 &&
      !confirmBookedItineraryChange
    ) {
      throw new InputError(
        `Jadwal memiliki ${orderTotal.value} booking. Konfirmasi perubahan itinerary/versi diperlukan; booking lama tetap memakai snapshot sebelumnya.`,
      );
    }

    const activeAllocations = await db
      .select({ pax: bookingAllocation.pax })
      .from(bookingAllocation)
      .where(
        and(
          eq(bookingAllocation.departureId, id),
          eq(bookingAllocation.state, 'held'),
        ),
      );
    const occupied = activeAllocations.reduce(
      (total, item) => total + item.pax,
      0,
    );
    if (departureValues.capacity < occupied) {
      throw new InputError(
        `Kapasitas tidak boleh di bawah ${occupied} kursi yang sedang ditahan.`,
      );
    }
    const [updated] = await db
      .update(departure)
      .set({
        ...departureValues,
        tripVersionId: nextTripVersionId,
        revision: existing.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(departure.id, id))
      .returning();
    await db.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'departure',
      entityId: id,
      action: 'updated',
      payload: {
        tripId,
        startAt: input.startAt.toISOString(),
        state: input.publicationState,
        itineraryChanged,
        switchedToLatestVersion: nextTripVersionId !== existing.tripVersionId,
        affectedBookingCount: orderTotal?.value ?? 0,
      },
    });
    return json({ departure: updated });
  } catch (error) {
    if (error instanceof InputError)
      return json({ message: error.message }, 400);
    console.error('Gagal memperbarui jadwal', error);
    return json({ message: 'Gagal memperbarui jadwal.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const id = typeof values.id === 'string' ? values.id : '';
    if (!id) throw new InputError('ID jadwal tidak valid.');
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const db = getDb();
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(departure)
        .where(eq(departure.id, id))
        .for('update');
      if (!existing) throw new InputError('Jadwal tidak ditemukan.');

      const [orderTotal] = await tx
        .select({ value: count() })
        .from(booking)
        .where(eq(booking.departureId, id));
      const orderPolicy = departureDeletionPolicy(orderTotal?.value ?? 0);
      if (!orderPolicy.canDelete)
        throw new InputError(orderPolicy.deleteReason!);

      const now = new Date();
      const [activeQuoteTotal] = await tx
        .select({ value: count() })
        .from(checkoutQuote)
        .where(
          and(
            eq(checkoutQuote.departureId, id),
            gt(checkoutQuote.expiresAt, now),
          ),
        );
      const [expenseTotal] = await tx
        .select({ value: count() })
        .from(tripExpense)
        .where(eq(tripExpense.departureId, id));
      const deletionPolicy = departureDeletionPolicy(0, {
        activeQuoteCount: activeQuoteTotal?.value ?? 0,
        expenseCount: expenseTotal?.value ?? 0,
      });
      if (!deletionPolicy.canDelete)
        throw new InputError(deletionPolicy.deleteReason!);

      // Quote checkout bersifat sementara. Yang kedaluwarsa tidak lagi dapat
      // dipakai membuat booking dan aman dibersihkan bersama jadwal.
      await tx
        .delete(checkoutQuote)
        .where(
          and(
            eq(checkoutQuote.departureId, id),
            lte(checkoutQuote.expiresAt, now),
          ),
        );
      await tx
        .delete(departurePickupOption)
        .where(eq(departurePickupOption.departureId, id));
      await tx.delete(departure).where(eq(departure.id, id));
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'departure',
        entityId: id,
        action: 'deleted',
        payload: {
          tripVersionId: existing.tripVersionId,
          startAt: existing.startAt.toISOString(),
          expiredCheckoutQuotesRemoved: true,
        },
      });
    });
    return json({ deleted: true });
  } catch (error) {
    if (error instanceof InputError)
      return json({ message: error.message }, 400);
    console.error('Gagal menghapus jadwal', error);
    return json({ message: 'Gagal menghapus jadwal.' }, 500);
  }
};
