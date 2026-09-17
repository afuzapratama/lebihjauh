import { and, asc, eq, gt, ilike, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  booking,
  bookingAllocation,
  departure,
  departurePickupOption,
  trip,
  tripVersion,
} from '../db/schema';
import { availableTripOptions } from './trip-availability';
import { resolveItinerary } from './trip-itinerary';

const publicFields = {
  id: departure.id,
  tripId: trip.id,
  slug: trip.slug,
  name: trip.name,
  category: trip.category,
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
  departureItineraryOverride: departure.itineraryOverride,
  startAt: departure.startAt,
  endAt: departure.endAt,
  timezone: departure.timezone,
  capacity: departure.capacity,
  dpMode: departure.dpMode,
  dpValue: departure.dpValue,
  bookingCutoffAt: departure.bookingCutoffAt,
  balanceDueAt: departure.balanceDueAt,
};

/** Shared read model for Home, catalog, detail and checkout. No booking writes. */
export async function getBookableDepartures(
  filters: {
    category?: string;
    query?: string;
    slug?: string;
    departureId?: string;
  } = {},
) {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select(publicFields)
    .from(trip)
    .innerJoin(tripVersion, eq(tripVersion.tripId, trip.id))
    .innerJoin(departure, eq(departure.tripVersionId, tripVersion.id))
    .where(
      and(
        isNull(trip.archivedAt),
        eq(departure.publicationState, 'open'),
        gt(departure.startAt, now),
        gt(departure.bookingCutoffAt, now),
        gt(departure.dpValue, '0'),
        ...(filters.category ? [eq(trip.category, filters.category)] : []),
        ...(filters.query
          ? [
              or(
                ilike(trip.name, `%${filters.query}%`),
                ilike(trip.category, `%${filters.query}%`),
                ilike(tripVersion.description, `%${filters.query}%`),
                ilike(tripVersion.locationLabel, `%${filters.query}%`),
                ilike(tripVersion.difficultyLevel, `%${filters.query}%`),
                ilike(tripVersion.routeName, `%${filters.query}%`),
                ilike(tripVersion.terrainSummary, `%${filters.query}%`),
              ),
            ]
          : []),
        ...(filters.slug ? [eq(trip.slug, filters.slug)] : []),
        ...(filters.departureId ? [eq(departure.id, filters.departureId)] : []),
      ),
    )
    .orderBy(asc(departure.startAt), asc(departure.id));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [pickups, allocations] = await Promise.all([
    db
      .select({
        id: departurePickupOption.id,
        departureId: departurePickupOption.departureId,
        zoneName: departurePickupOption.zoneName,
        locationName: departurePickupOption.locationName,
        address: departurePickupOption.address,
        pickupAt: departurePickupOption.pickupAt,
        pricePerPax: departurePickupOption.pricePerPax,
        mapsUrl: departurePickupOption.mapsUrl,
        instructions: departurePickupOption.instructions,
        pickupRundownStages: departurePickupOption.pickupRundownStages,
        capacity: departurePickupOption.capacity,
        isDefault: departurePickupOption.isDefault,
        sortOrder: departurePickupOption.sortOrder,
      })
      .from(departurePickupOption)
      .where(
        and(
          inArray(departurePickupOption.departureId, ids),
          eq(departurePickupOption.isActive, true),
        ),
      )
      .orderBy(
        asc(departurePickupOption.sortOrder),
        asc(departurePickupOption.createdAt),
        asc(departurePickupOption.id),
      ),
    db
      .select({
        departureId: bookingAllocation.departureId,
        pickupOptionId: booking.pickupOptionId,
        pax: bookingAllocation.pax,
        state: bookingAllocation.state,
        expiresAt: bookingAllocation.expiresAt,
      })
      .from(bookingAllocation)
      .innerJoin(booking, eq(bookingAllocation.bookingId, booking.id))
      .where(
        and(
          inArray(bookingAllocation.departureId, ids),
          inArray(bookingAllocation.state, ['committed', 'held']),
        ),
      ),
  ]);
  const pickupsByDeparture = new Map<string, typeof pickups>();
  const allocationsByDeparture = new Map<string, typeof allocations>();
  for (const pickup of pickups) {
    const list = pickupsByDeparture.get(pickup.departureId) ?? [];
    list.push(pickup);
    pickupsByDeparture.set(pickup.departureId, list);
  }
  for (const allocation of allocations) {
    const list = allocationsByDeparture.get(allocation.departureId) ?? [];
    list.push(allocation);
    allocationsByDeparture.set(allocation.departureId, list);
  }
  return rows.flatMap((row) => {
    const availability = availableTripOptions(
      row.capacity,
      pickupsByDeparture.get(row.id) ?? [],
      allocationsByDeparture.get(row.id) ?? [],
      now,
    );
    return availability
      ? [
          {
            ...row,
            ...availability,
            resolvedItineraryStages: resolveItinerary(
              row.itineraryStages,
              row.departureItineraryOverride,
            ).stages,
          },
        ]
      : [];
  });
}

export type PublicDeparture = Awaited<
  ReturnType<typeof getBookableDepartures>
>[number];
export type PublicTrip = Omit<PublicDeparture, 'id'> & {
  id: string;
  departures: PublicDeparture[];
};

export async function getPublicTrips(category?: string, query?: string) {
  const departures = await getBookableDepartures({ category, query });
  const grouped = new Map<string, PublicTrip>();
  for (const schedule of departures) {
    const item = grouped.get(schedule.tripId) ?? {
      ...schedule,
      id: schedule.tripId,
      departures: [],
    };
    item.departures.push(schedule);
    grouped.set(schedule.tripId, item);
  }
  return [...grouped.values()];
}

export async function getPublicTrip(slug: string, departureId?: string) {
  const departures = await getBookableDepartures({ slug });
  if (!departures.length) return null;
  const requested = departureId
    ? departures.find((schedule) => schedule.id === departureId)
    : undefined;
  const selectedDeparture = requested ?? departures[0];
  return {
    ...selectedDeparture,
    id: selectedDeparture.tripId,
    departures,
    selectedDeparture,
    requestedDepartureUnavailable: !!departureId && !requested,
  };
}
