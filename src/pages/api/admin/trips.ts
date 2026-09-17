import type { APIRoute } from 'astro';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
  notExists,
  sql,
} from 'drizzle-orm';
import { getDb } from '../../../db/client';
import {
  adminAuditLog,
  booking,
  checkoutQuote,
  departure,
  departurePickupOption,
  trip,
  tripExpense,
  tripVersion,
} from '../../../db/schema';
import { InputError, parseTripInput, toPayload } from '../../../lib/trip-admin';
import {
  departureDeletionPolicy,
  tripArchivePolicy,
} from '../../../lib/departure-policy';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ url }) => {
  const requestedSource = url.searchParams.get('source');
  const source =
    requestedSource === 'open_trip' || requestedSource === 'private_trip'
      ? requestedSource
      : 'all';
  const db = getDb();
  const rows = await db
    .select({
      id: trip.id,
      slug: trip.slug,
      name: trip.name,
      category: trip.category,
      archivedAt: trip.archivedAt,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      versionId: tripVersion.id,
      version: tripVersion.version,
      description: tripVersion.description,
      included: tripVersion.included,
      excluded: tripVersion.excluded,
      itinerary: tripVersion.itinerary,
      itineraryStages: tripVersion.itineraryStages,
      meetingPoint: tripVersion.meetingPoint,
      locationLabel: tripVersion.locationLabel,
      difficultyLevel: tripVersion.difficultyLevel,
      elevationMeters: tripVersion.elevationMeters,
      trailDistanceKm: tripVersion.trailDistanceKm,
      elevationGainMeters: tripVersion.elevationGainMeters,
      trekDurationMinMinutes: tripVersion.trekDurationMinMinutes,
      trekDurationMaxMinutes: tripVersion.trekDurationMaxMinutes,
      routeName: tripVersion.routeName,
      terrainSummary: tripVersion.terrainSummary,
      trailMapEmbedUrl: tripVersion.trailMapEmbedUrl,
      preparation: tripVersion.preparation,
      terms: tripVersion.terms,
      coverImageUrl: tripVersion.coverImageUrl,
    })
    .from(trip)
    .innerJoin(tripVersion, eq(tripVersion.tripId, trip.id))
    .where(isNull(trip.archivedAt))
    .orderBy(desc(trip.updatedAt), desc(tripVersion.version));

  // Pada 4C hanya versi aktif yang dapat diedit. Filter ini tetap aman jika data
  // hasil migrasi atau versi historis sudah ada.
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.id)) latest.set(row.id, row);
  const trips = await Promise.all(
    [...latest.values()].map(async (item) => {
      const departures = await db
        .select({
          ...getTableColumns(departure),
          tripVersionNumber: tripVersion.version,
          tripVersionItineraryStages: tripVersion.itineraryStages,
        })
        .from(departure)
        .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
        .where(eq(tripVersion.tripId, item.id))
        .orderBy(departure.startAt);
      const protectedDepartures = await Promise.all(
        departures.map(async (schedule) => {
          const [relatedBookings, activeQuotes, expenses, prices] =
            await Promise.all([
              db
                .select({ source: booking.bookingSource })
                .from(booking)
                .where(eq(booking.departureId, schedule.id)),
              db
                .select({ value: count() })
                .from(checkoutQuote)
                .where(
                  and(
                    eq(checkoutQuote.departureId, schedule.id),
                    gt(checkoutQuote.expiresAt, new Date()),
                  ),
                ),
              db
                .select({ value: count() })
                .from(tripExpense)
                .where(eq(tripExpense.departureId, schedule.id)),
              db
                .select({ minimum: departurePickupOption.pricePerPax })
                .from(departurePickupOption)
                .where(
                  and(
                    eq(departurePickupOption.departureId, schedule.id),
                    eq(departurePickupOption.isActive, true),
                  ),
                )
                .orderBy(departurePickupOption.pricePerPax)
                .limit(1),
            ]);
          const [price] = prices;
          return {
            ...schedule,
            minimumPickupPrice: price?.minimum ?? null,
            bookingSources: [
              ...new Set(relatedBookings.map((row) => row.source)),
            ],
            ...departureDeletionPolicy(relatedBookings.length, {
              activeQuoteCount: activeQuotes[0]?.value ?? 0,
              expenseCount: expenses[0]?.value ?? 0,
            }),
          };
        }),
      );
      const tripSource = protectedDepartures.some((schedule) =>
        schedule.bookingSources.includes('private_trip'),
      )
        ? 'private_trip'
        : 'open_trip';
      return {
        ...item,
        source: tripSource,
        departures: protectedDepartures,
        ...tripArchivePolicy(protectedDepartures),
      };
    }),
  );
  return json({
    trips:
      source === 'all' ? trips : trips.filter((item) => item.source === source),
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const input = parseTripInput(values);
    const { name, slug, category, ...versionValues } = input;
    const db = getDb();
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);

    const result = await db.transaction(async (tx) => {
      const [createdTrip] = await tx
        .insert(trip)
        .values({ name, slug, category })
        .returning();
      const [createdVersion] = await tx
        .insert(tripVersion)
        .values({ tripId: createdTrip.id, version: 1, ...versionValues })
        .returning();
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'trip',
        entityId: createdTrip.id,
        action: 'created',
        payload: { name: input.name, slug: input.slug },
      });
      return { trip: createdTrip, version: createdVersion };
    });
    return json(result, 201);
  } catch (error) {
    if (error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof Error && /unique/i.test(error.message)) {
      return json({ message: 'Slug sudah digunakan oleh trip lain.' }, 409);
    }
    console.error('Gagal membuat trip', error);
    return json({ message: 'Gagal menyimpan trip.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const id = typeof values.id === 'string' ? values.id : '';
    if (!id) throw new InputError('ID trip tidak valid.');
    const applyToUnbookedDepartures =
      values.applyToUnbookedDepartures === true ||
      values.applyToUnbookedDepartures === 'true' ||
      values.applyToUnbookedDepartures === 'on';
    const input = parseTripInput(values);
    const { name, slug, category, ...versionValues } = input;
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const db = getDb();

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(trip)
        .where(and(eq(trip.id, id), isNull(trip.archivedAt)));
      if (!existing) throw new InputError('Trip tidak ditemukan.');
      const [version] = await tx
        .select()
        .from(tripVersion)
        .where(eq(tripVersion.tripId, id))
        .orderBy(desc(tripVersion.version))
        .limit(1);
      if (!version) throw new InputError('Versi trip tidak ditemukan.');
      const [updatedTrip] = await tx
        .update(trip)
        .set({ name, slug, category, updatedAt: new Date() })
        .where(eq(trip.id, id))
        .returning();
      const [updatedVersion] = await tx
        .insert(tripVersion)
        .values({
          tripId: id,
          version: version.version + 1,
          ...versionValues,
        })
        .returning();
      let updatedScheduleCount = 0;
      if (applyToUnbookedDepartures) {
        const unbookedSchedules = await tx
          .select({ id: departure.id })
          .from(departure)
          .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
          .where(
            and(
              eq(tripVersion.tripId, id),
              notExists(
                tx
                  .select({ id: booking.id })
                  .from(booking)
                  .where(eq(booking.departureId, departure.id)),
              ),
            ),
          );
        const scheduleIds = unbookedSchedules.map((item) => item.id);
        if (scheduleIds.length) {
          const updatedSchedules = await tx
            .update(departure)
            .set({
              tripVersionId: updatedVersion.id,
              revision: sql`${departure.revision} + 1`,
              updatedAt: new Date(),
            })
            .where(
              and(
                inArray(departure.id, scheduleIds),
                notExists(
                  tx
                    .select({ id: booking.id })
                    .from(booking)
                    .where(eq(booking.departureId, departure.id)),
                ),
              ),
            )
            .returning({ id: departure.id });
          updatedScheduleCount = updatedSchedules.length;
        }
      }
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'trip',
        entityId: id,
        action: 'version_created',
        payload: {
          name: input.name,
          slug: input.slug,
          previousVersion: version.version,
          version: updatedVersion.version,
          updatedScheduleCount,
        },
      });
      return {
        trip: updatedTrip,
        version: updatedVersion,
        updatedScheduleCount,
      };
    });
    return json(updated);
  } catch (error) {
    if (error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof Error && /unique/i.test(error.message)) {
      return json({ message: 'Slug sudah digunakan oleh trip lain.' }, 409);
    }
    console.error('Gagal memperbarui trip', error);
    return json({ message: 'Gagal memperbarui trip.' }, 500);
  }
};

// Arsip mempertahankan riwayat audit dan menghindari penghapusan data trip secara
// permanen. Sebelum fase booking dimulai, jadwal terkait tidak dihapus dari basis data.
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const id = typeof values.id === 'string' ? values.id : '';
    if (!id) throw new InputError('ID trip tidak valid.');
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const db = getDb();
    const [existing] = await db
      .select({ id: trip.id, name: trip.name })
      .from(trip)
      .where(and(eq(trip.id, id), isNull(trip.archivedAt)));
    if (!existing) throw new InputError('Trip tidak ditemukan.');

    const schedules = await db
      .select({ id: departure.id })
      .from(departure)
      .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
      .where(eq(tripVersion.tripId, id));
    const schedulePolicies = await Promise.all(
      schedules.map(async (schedule) => {
        const [total] = await db
          .select({ value: count() })
          .from(booking)
          .where(eq(booking.departureId, schedule.id));
        return { orderCount: total?.value ?? 0 };
      }),
    );
    const archivePolicy = tripArchivePolicy(schedulePolicies);
    if (!archivePolicy.canArchive)
      throw new InputError(archivePolicy.archiveReason!);

    await db.transaction(async (tx) => {
      await tx
        .update(trip)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(trip.id, id));
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'trip',
        entityId: id,
        action: 'archived',
        payload: { name: existing.name },
      });
    });
    return json({ archived: true });
  } catch (error) {
    if (error instanceof InputError)
      return json({ message: error.message }, 400);
    console.error('Gagal mengarsipkan trip', error);
    return json({ message: 'Gagal mengarsipkan trip.' }, 500);
  }
};
