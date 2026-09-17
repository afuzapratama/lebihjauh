export type ItineraryActivity = {
  time: string;
  activity: string;
  location: string;
};

export type ItineraryStage = {
  day: string;
  title: string;
  activities: ItineraryActivity[];
  details: string;
};

export type ResolvedItinerary = {
  source: 'trip_version' | 'departure_override';
  stages: ItineraryStage[];
};

/**
 * Resolve exactly one main itinerary. A pickup rundown is deliberately not an
 * input here: it is an optional segment rendered before this main journey.
 */
export function resolveItinerary(
  tripVersionStages: ItineraryStage[] | null | undefined,
  departureOverride: ItineraryStage[] | null | undefined,
): ResolvedItinerary {
  if (departureOverride !== null && departureOverride !== undefined) {
    return { source: 'departure_override', stages: departureOverride };
  }
  return { source: 'trip_version', stages: tripVersionStages ?? [] };
}

export function isItineraryStage(value: unknown): value is ItineraryStage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const stage = value as Record<string, unknown>;
  return (
    typeof stage.day === 'string' &&
    typeof stage.title === 'string' &&
    typeof stage.details === 'string' &&
    Array.isArray(stage.activities) &&
    stage.activities.every((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        return false;
      const activity = item as Record<string, unknown>;
      return (
        typeof activity.time === 'string' &&
        typeof activity.activity === 'string' &&
        typeof activity.location === 'string'
      );
    })
  );
}

export function itineraryStagesFrom(value: unknown): ItineraryStage[] {
  return Array.isArray(value) ? value.filter(isItineraryStage) : [];
}

/** Parse the legacy multiline itinerary without mixing it with structured stages. */
export function legacyItineraryEntriesFrom(value: unknown) {
  const entries: { title: string; details: string[] }[] = [];
  const dayHeading = /^(?:hari|day)\s*(?:ke\s*)?\d+\b/i;
  for (const line of String(value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)) {
    if (dayHeading.test(line)) entries.push({ title: line, details: [] });
    else if (entries.length) entries.at(-1)!.details.push(line);
    else entries.push({ title: line, details: [] });
  }
  return entries;
}

export type TripPackageSnapshotV2 = {
  snapshotVersion: 2;
  tripName: string;
  category: string;
  startAt: string;
  endAt: string;
  timezone: string;
  included: string;
  excluded: string;
  meetingPoint: string;
  preparation: string;
  terms: string;
  itineraryStages: ItineraryStage[];
  itinerarySource: ResolvedItinerary['source'];
  legacyItinerary: string;
  pickup: {
    id: string;
    zoneName: string;
    locationName: string;
    address: string;
    pickupAt: string | null;
    mapsUrl: string | null;
    instructions: string;
    pickupRundownStages: ItineraryStage[] | null;
  };
  privateRequestNumber?: string;
  offerRevision?: number;
};

type BookingSnapshotInput = Omit<Partial<TripPackageSnapshotV2>, 'pickup'> & {
  pickup?: Partial<TripPackageSnapshotV2['pickup']> & {
    /** Nama lama yang hanya dibaca saat migrasi snapshot v1. */
    itineraryStages?: unknown;
  };
};

type LivePackageFallback = {
  itineraryStages: unknown;
  itinerary: string;
  included: string;
  excluded: string;
  preparation: string;
  terms: string;
};

/**
 * Membaca kontrak paket yang sudah dibekukan pada booking.
 * Snapshot v2 tidak boleh mengambil isi live lagi; fallback hanya untuk
 * booking lama yang belum memiliki kontrak snapshot v2.
 */
export function resolveBookingSnapshot(
  snapshot: BookingSnapshotInput | null | undefined,
  live: LivePackageFallback,
) {
  const isV2 = snapshot?.snapshotVersion === 2;
  const itineraryStages = isV2
    ? itineraryStagesFrom(snapshot.itineraryStages)
    : itineraryStagesFrom(live.itineraryStages);
  const legacyPickupStages = itineraryStagesFrom(
    snapshot?.pickup?.itineraryStages,
  );
  const pickupRundownStages = isV2
    ? itineraryStagesFrom(snapshot?.pickup?.pickupRundownStages)
    : itineraryStagesFrom(snapshot?.pickup?.pickupRundownStages).length
      ? itineraryStagesFrom(snapshot?.pickup?.pickupRundownStages)
      : legacyPickupStages.length &&
          JSON.stringify(legacyPickupStages) !== JSON.stringify(itineraryStages)
        ? legacyPickupStages
        : [];

  return {
    itineraryStages,
    itinerary: isV2 ? (snapshot.legacyItinerary ?? '') : live.itinerary,
    included: isV2 ? (snapshot.included ?? '') : live.included,
    excluded: isV2 ? (snapshot.excluded ?? '') : live.excluded,
    preparation: isV2 ? (snapshot.preparation ?? '') : live.preparation,
    terms: isV2 ? (snapshot.terms ?? '') : live.terms,
    pickupRundownStages,
  };
}
