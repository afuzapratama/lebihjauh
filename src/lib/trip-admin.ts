const allowedStates = ['draft', 'open', 'closed'] as const;
const allowedDpModes = ['percent', 'amount'] as const;

export type DepartureState = (typeof allowedStates)[number];
export type DpMode = (typeof allowedDpModes)[number];

export type TripInput = {
  name: string;
  slug: string;
  category: string;
  description: string;
  included: string;
  excluded: string;
  itinerary: string;
  itineraryStages: Array<{
    day: string;
    title: string;
    activities: Array<{ time: string; activity: string; location: string }>;
    details: string;
  }>;
  meetingPoint: string;
  locationLabel: string | null;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  elevationMeters: number | null;
  trailDistanceKm: string | null;
  elevationGainMeters: number | null;
  trekDurationMinMinutes: number | null;
  trekDurationMaxMinutes: number | null;
  routeName: string | null;
  terrainSummary: string | null;
  trailMapEmbedUrl: string | null;
  preparation: string;
  terms: string;
  coverImageUrl: string | null;
};

export type DepartureInput = {
  tripId: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  capacity: number;
  unitPrice: string;
  dpMode: DpMode;
  dpValue: string;
  bookingCutoffAt: Date;
  balanceDueAt: Date | null;
  publicationState: DepartureState;
  itineraryOverride: TripInput['itineraryStages'] | null;
  useLatestTripVersion: boolean;
  confirmBookedItineraryChange: boolean;
};

type Values = Record<string, unknown>;

export class InputError extends Error {}

const text = (values: Values, name: string, max: number, required = false) => {
  const value = typeof values[name] === 'string' ? values[name].trim() : '';
  if (required && !value) throw new InputError(`${name} wajib diisi.`);
  if (value.length > max) throw new InputError(`${name} terlalu panjang.`);
  return value;
};

const optionalInteger = (
  values: Values,
  name: string,
  min: number,
  max: number,
) => {
  const raw = text(values, name, 12);
  if (!raw) return null;
  if (!/^\d+$/.test(raw))
    throw new InputError(`${name} harus berupa angka bulat.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new InputError(`${name} berada di luar batas yang diizinkan.`);
  return value;
};

const optionalDecimal = (
  values: Values,
  name: string,
  min: number,
  max: number,
) => {
  const raw = text(values, name, 16).replace(',', '.');
  if (!raw) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw))
    throw new InputError(`${name} maksimal dua angka desimal.`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max)
    throw new InputError(`${name} berada di luar batas yang diizinkan.`);
  return raw;
};

const trailMapEmbedUrl = (values: Values) => {
  const raw = text(values, 'trailMapEmbedUrl', 4_000);
  if (!raw) return null;

  const iframeSource = raw.match(
    /<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i,
  )?.[2];
  if (raw.includes('<') && !iframeSource) {
    throw new InputError(
      'Embed peta tidak valid. Tempel URL atau kode iframe dari uMap/Google My Maps.',
    );
  }

  try {
    const source = (iframeSource ?? raw).replaceAll('&amp;', '&');
    const isLocalTrailMap = /^\/peta-jalur\/[a-z0-9-]+\/?$/.test(source);
    if (isLocalTrailMap) return source;

    const parsed = new URL(source);
    const isUmap =
      parsed.hostname === 'umap.openstreetmap.fr' &&
      /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?map\//.test(parsed.pathname);
    const isGoogleMyMaps =
      parsed.hostname === 'www.google.com' &&
      /^\/maps\/d\/(?:u\/\d+\/)?embed$/.test(parsed.pathname);
    if (parsed.protocol !== 'https:' || (!isUmap && !isGoogleMyMaps)) {
      throw new Error();
    }
    return parsed.toString();
  } catch {
    throw new InputError(
      'Peta jalur harus memakai URL embed HTTPS dari uMap atau Google My Maps.',
    );
  }
};

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function wholeRupiah(values: Values, name: string, min: number, max: number) {
  const raw = text(values, name, 16, true);
  if (!/^\d+$/.test(raw))
    throw new InputError(
      `${name} harus berupa Rupiah bulat tanpa titik atau koma.`,
    );
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new InputError(`${name} berada di luar batas yang diizinkan.`);
  }
  return raw;
}

function dateTime(values: Values, name: string, required = true) {
  const raw = text(values, name, 40, required);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()))
    throw new InputError(`${name} tidak valid.`);
  return date;
}

const wibDate = (date: Date) =>
  new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

function structuredItinerary(
  rawValue: unknown,
  label: string,
): TripInput['itineraryStages'] {
  let rawStages = rawValue;
  if (typeof rawStages === 'string') {
    try {
      rawStages = rawStages ? JSON.parse(rawStages) : [];
    } catch {
      throw new InputError(`${label} tidak valid.`);
    }
  }
  if (!Array.isArray(rawStages) || rawStages.length > 30) {
    throw new InputError(`${label} maksimal 30 tahap.`);
  }
  return rawStages.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new InputError(`${label} tahap ${index + 1} tidak valid.`);
    }
    const stageValues = value as Values;
    const day =
      text(stageValues, 'day', 80) || text(stageValues, 'stage', 80, true);
    const title =
      text(stageValues, 'title', 180) ||
      text(stageValues, 'activity', 180, true);
    const rawActivities = Array.isArray(stageValues.activities)
      ? stageValues.activities
      : [
          {
            time: stageValues.time,
            activity: stageValues.activity,
            location: stageValues.location,
          },
        ];
    if (!rawActivities.length || rawActivities.length > 30)
      throw new InputError(
        `${label} tahap ${index + 1} harus berisi 1–30 kegiatan.`,
      );
    const activities = rawActivities.map((activity, activityIndex) => {
      if (!activity || typeof activity !== 'object' || Array.isArray(activity))
        throw new InputError(
          `${label} kegiatan ${activityIndex + 1} pada tahap ${index + 1} tidak valid.`,
        );
      const values = activity as Values;
      return {
        time: text(values, 'time', 80),
        activity: text(values, 'activity', 240, true),
        location: text(values, 'location', 180),
      };
    });
    return {
      day,
      title,
      activities,
      details: text(stageValues, 'details', 2_000),
    };
  });
}

export function parseTripInput(values: Values): TripInput {
  const name = text(values, 'name', 120, true);
  // URL selalu mengikuti nama yang disimpan. Field slug dari client sengaja tidak
  // dipercaya agar admin tidak perlu mengisi atau merapikan URL secara manual.
  const slug = slugify(name);
  if (!slug || slug.length > 140) throw new InputError('Slug tidak valid.');
  const category = text(values, 'category', 60, true);
  if (category === '__custom')
    throw new InputError('Jenis trip kustom belum diisi.');

  const rawDifficulty = text(values, 'difficultyLevel', 20);
  const difficultyLevel = rawDifficulty || null;
  if (
    difficultyLevel &&
    !['beginner', 'intermediate', 'advanced', 'expert'].includes(
      difficultyLevel,
    )
  )
    throw new InputError('Tingkat aktivitas tidak valid.');
  const trekDurationMinMinutes = optionalInteger(
    values,
    'trekDurationMinMinutes',
    1,
    10_080,
  );
  const trekDurationMaxMinutes = optionalInteger(
    values,
    'trekDurationMaxMinutes',
    1,
    10_080,
  );
  if (
    trekDurationMinMinutes !== null &&
    trekDurationMaxMinutes !== null &&
    trekDurationMaxMinutes < trekDurationMinMinutes
  )
    throw new InputError(
      'Durasi maksimal trek tidak boleh lebih singkat dari durasi minimal.',
    );

  const coverImageUrl = text(values, 'coverImageUrl', 2_000);
  if (coverImageUrl) {
    try {
      const parsed = new URL(coverImageUrl);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new InputError(
        'URL foto harus berupa alamat http atau https yang valid.',
      );
    }
  }

  const legacyItinerary = text(values, 'itinerary', 16_000);
  const itineraryStages = structuredItinerary(
    values.itineraryStages,
    'Itinerary inti',
  );
  const itinerary = itineraryStages.length
    ? itineraryStages
        .map((item) =>
          [
            `${item.day} — ${item.title}`,
            ...item.activities.map((activity) =>
              [activity.time, activity.activity, activity.location]
                .filter(Boolean)
                .join(' · '),
            ),
            item.details,
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n\n')
    : legacyItinerary;

  return {
    name,
    slug,
    category,
    description: text(values, 'description', 12_000, true),
    included: text(values, 'included', 12_000),
    excluded: text(values, 'excluded', 12_000),
    itinerary,
    itineraryStages,
    meetingPoint: text(values, 'meetingPoint', 4_000),
    locationLabel: text(values, 'locationLabel', 80) || null,
    difficultyLevel: difficultyLevel as TripInput['difficultyLevel'],
    elevationMeters: optionalInteger(values, 'elevationMeters', 1, 10_000),
    trailDistanceKm: optionalDecimal(values, 'trailDistanceKm', 0.01, 1_000),
    elevationGainMeters: optionalInteger(
      values,
      'elevationGainMeters',
      0,
      20_000,
    ),
    trekDurationMinMinutes,
    trekDurationMaxMinutes,
    routeName: text(values, 'routeName', 120) || null,
    terrainSummary: text(values, 'terrainSummary', 500) || null,
    trailMapEmbedUrl: trailMapEmbedUrl(values),
    preparation: text(values, 'preparation', 12_000),
    terms: text(values, 'terms', 16_000),
    coverImageUrl: coverImageUrl || null,
  };
}

export function parseDepartureInput(values: Values): DepartureInput {
  const tripId = text(values, 'tripId', 64, true);
  const startAt = dateTime(values, 'startAt')!;
  const endAt = dateTime(values, 'endAt')!;
  const bookingCutoffAt = dateTime(values, 'bookingCutoffAt')!;
  const balanceDueAt = dateTime(values, 'balanceDueAt', false);
  const timezone = text(values, 'timezone', 64, true);
  const publicationState = text(values, 'publicationState', 20, true);
  const dpMode = text(values, 'dpMode', 20, true);
  const useItineraryOverride =
    values.useItineraryOverride === true ||
    values.useItineraryOverride === 'true' ||
    values.useItineraryOverride === 'on';
  const itineraryOverride = useItineraryOverride
    ? structuredItinerary(values.itineraryOverride, 'Itinerary khusus jadwal')
    : null;
  if (useItineraryOverride && itineraryOverride?.length === 0) {
    throw new InputError(
      'Itinerary khusus jadwal harus berisi minimal satu tahap.',
    );
  }

  if (!allowedStates.includes(publicationState as DepartureState)) {
    throw new InputError('Status jadwal tidak valid.');
  }
  if (!allowedDpModes.includes(dpMode as DpMode))
    throw new InputError('Jenis down payment tidak valid.');
  if (endAt <= startAt)
    throw new InputError('Tanggal selesai harus setelah tanggal mulai.');
  if (bookingCutoffAt > startAt) {
    throw new InputError('Tenggat booking tidak boleh setelah keberangkatan.');
  }
  if (balanceDueAt && wibDate(balanceDueAt) > wibDate(endAt)) {
    throw new InputError(
      'Tenggat pelunasan tidak boleh setelah hari terakhir trip (hari turun).',
    );
  }

  const capacityText = wholeRupiah(values, 'capacity', 1, 10_000);
  const unitPrice = wholeRupiah(values, 'unitPrice', 1, 99_999_999_999_999);
  const dpValue = wholeRupiah(values, 'dpValue', 0, 99_999_999_999_999);
  const dpNumber = Number(dpValue);
  if (dpMode === 'percent' && dpNumber > 100)
    throw new InputError('Down payment persen maksimal 100%.');
  if (dpMode === 'amount' && dpNumber > Number(unitPrice)) {
    throw new InputError(
      'Down payment nominal tidak boleh melebihi harga satu pax.',
    );
  }

  return {
    tripId,
    startAt,
    endAt,
    timezone,
    capacity: Number(capacityText),
    unitPrice,
    dpMode: dpMode as DpMode,
    dpValue,
    bookingCutoffAt,
    balanceDueAt,
    publicationState: publicationState as DepartureState,
    itineraryOverride,
    useLatestTripVersion:
      values.useLatestTripVersion === true ||
      values.useLatestTripVersion === 'true' ||
      values.useLatestTripVersion === 'on',
    confirmBookedItineraryChange:
      values.confirmBookedItineraryChange === true ||
      values.confirmBookedItineraryChange === 'true',
  };
}

export async function toPayload(request: Request): Promise<Values> {
  const value = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('Payload tidak valid.');
  }
  return value as Values;
}
