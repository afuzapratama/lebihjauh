import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  adminAuditLog,
  booking,
  bookingAllocation,
  bookingParticipant,
  departure,
  departurePickupOption,
  invoice,
  invoiceAccessGrant,
  privateTripOffer,
  privateTripManifestDraft,
  privateTripRequest,
  trip,
  tripVersion,
} from '../db/schema';
import { createAccessToken } from './booking-security';
import type { TripPackageSnapshotV2 } from './trip-itinerary';

type Values = Record<string, unknown>;
const requestStates = [
  'new',
  'contacted',
  'offer_sent',
  'accepted',
  'declined',
  'expired',
  'converted',
] as const;
const offerStates = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'superseded',
  'expired',
] as const;
export type PrivateRequestState = (typeof requestStates)[number];
export type PrivateOfferState = (typeof offerStates)[number];

export class PrivateTripInputError extends Error {}
export class PrivateTripConflictError extends Error {}

const clean = (values: Values, name: string, max: number, required = false) => {
  const value =
    typeof values[name] === 'string'
      ? values[name].trim().replace(/\s+/g, ' ')
      : '';
  if (required && !value)
    throw new PrivateTripInputError(`${name} wajib diisi.`);
  if (value.length > max)
    throw new PrivateTripInputError(`${name} terlalu panjang.`);
  return value;
};
const whole = (values: Values, name: string, min: number, max: number) => {
  const value = clean(values, name, 16, true).replace(/\D/g, '');
  if (!/^\d+$/.test(value))
    throw new PrivateTripInputError(`${name} harus berupa Rupiah bulat.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max)
    throw new PrivateTripInputError(
      `${name} berada di luar batas yang diizinkan.`,
    );
  return value;
};
const integer = (values: Values, name: string, min: number, max: number) => {
  const raw = clean(values, name, 10, true);
  if (!/^\d+$/.test(raw))
    throw new PrivateTripInputError(`${name} harus berupa angka bulat.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new PrivateTripInputError(
      `${name} berada di luar batas yang diizinkan.`,
    );
  return value;
};
const dateOnly = (values: Values, name: string, required = true) => {
  const raw = clean(values, name, 16, required);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    throw new PrivateTripInputError(`${name} tidak valid.`);
  const value = new Date(`${raw}T00:00:00+07:00`);
  if (Number.isNaN(value.getTime()))
    throw new PrivateTripInputError(`${name} tidak valid.`);
  return value;
};
const dateTime = (values: Values, name: string) => {
  const raw = clean(values, name, 40, true);
  const value = new Date(raw);
  if (Number.isNaN(value.getTime()))
    throw new PrivateTripInputError(`${name} tidak valid.`);
  return value;
};
const truthy = (value: unknown) =>
  value === true || value === 'true' || value === 'on';
const picParticipation = (values: Values, fallback = true) =>
  values.picIsParticipant == null ? fallback : truthy(values.picIsParticipant);

type ItineraryStage = {
  day: string;
  title: string;
  activities: Array<{ time: string; activity: string; location: string }>;
  details: string;
};

const optionalDateTime = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new PrivateTripInputError(`${label} tidak valid.`);
  return parsed;
};

const url = (value: unknown, label: string) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') throw new Error();
    return parsed.toString();
  } catch {
    throw new PrivateTripInputError(`${label} harus berupa tautan HTTPS.`);
  }
};

function parseItineraryStages(value: unknown): ItineraryStage[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new PrivateTripInputError('Susunan itinerary tidak valid.');
    }
  }
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30)
    throw new PrivateTripInputError(
      'Itinerary wajib memiliki minimal satu hari perjalanan.',
    );
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new PrivateTripInputError(
        `Itinerary hari ${index + 1} tidak valid.`,
      );
    const row = item as Record<string, unknown>;
    const day = typeof row.day === 'string' ? row.day.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const details = typeof row.details === 'string' ? row.details.trim() : '';
    if (!day || day.length > 40 || !title || title.length > 180)
      throw new PrivateTripInputError(
        `Hari dan judul itinerary ${index + 1} wajib diisi.`,
      );
    if (details.length > 2_000)
      throw new PrivateTripInputError(
        `Catatan itinerary ${index + 1} terlalu panjang.`,
      );
    if (
      !Array.isArray(row.activities) ||
      row.activities.length < 1 ||
      row.activities.length > 30
    )
      throw new PrivateTripInputError(
        `Itinerary hari ${index + 1} wajib memiliki minimal satu kegiatan.`,
      );
    const activities = row.activities.map((activity, activityIndex) => {
      if (!activity || typeof activity !== 'object' || Array.isArray(activity))
        throw new PrivateTripInputError(
          `Kegiatan ${activityIndex + 1} pada hari ${index + 1} tidak valid.`,
        );
      const entry = activity as Record<string, unknown>;
      const time = typeof entry.time === 'string' ? entry.time.trim() : '';
      const activityName =
        typeof entry.activity === 'string' ? entry.activity.trim() : '';
      const location =
        typeof entry.location === 'string' ? entry.location.trim() : '';
      if (
        !activityName ||
        activityName.length > 240 ||
        time.length > 40 ||
        location.length > 180
      )
        throw new PrivateTripInputError(
          `Isi kegiatan ${activityIndex + 1} pada hari ${index + 1} belum benar.`,
        );
      return { time, activity: activityName, location };
    });
    return { day, title, activities, details };
  });
}

export function parsePrivateTripRequest(values: Values) {
  const startDate = dateOnly(values, 'startDate')!;
  const endDate = dateOnly(values, 'endDate', false);
  if (endDate && endDate < startDate)
    throw new PrivateTripInputError(
      'Tanggal pulang tidak boleh sebelum tanggal berangkat.',
    );
  const picWhatsApp = clean(values, 'picWhatsApp', 24, true).replace(
    /[^0-9+ -]/g,
    '',
  );
  if (picWhatsApp.replace(/\D/g, '').length < 8)
    throw new PrivateTripInputError('Nomor WhatsApp PIC belum valid.');
  const picEmail = clean(values, 'picEmail', 254);
  if (picEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(picEmail))
    throw new PrivateTripInputError('Email PIC belum valid.');
  if (!truthy(values.privacyAccepted))
    throw new PrivateTripInputError(
      'Persetujuan penggunaan data kontak wajib dicentang.',
    );
  return {
    destination: clean(values, 'destination', 160, true),
    startDate,
    endDate,
    pax: integer(values, 'pax', 1, 10_000),
    picName: clean(values, 'picName', 120, true),
    picWhatsApp,
    picEmail: picEmail || null,
    needs: clean(values, 'needs', 2_000),
  };
}

function minimumDp(total: bigint, dpMode: string, dpValue: string) {
  const value = BigInt(dpValue);
  const amount = dpMode === 'percent' ? (total * value + 99n) / 100n : value;
  if (amount <= 0n || amount > total)
    throw new PrivateTripInputError(
      'Nilai down payment harus lebih dari Rp0 dan tidak melebihi total penawaran.',
    );
  return amount;
}

export function parsePrivateTripOffer(values: Values) {
  const startAt = dateTime(values, 'startAt');
  const endAt = dateTime(values, 'endAt');
  const validUntil = dateTime(values, 'validUntil');
  if (endAt <= startAt)
    throw new PrivateTripInputError('Waktu selesai harus setelah waktu mulai.');
  if (validUntil <= new Date())
    throw new PrivateTripInputError(
      'Masa berlaku penawaran harus di masa depan.',
    );
  const pax = integer(values, 'pax', 1, 10_000);
  const unitPrice = whole(values, 'unitPrice', 1, 999_999_999_999);
  const dpMode = clean(values, 'dpMode', 20, true);
  if (dpMode !== 'percent' && dpMode !== 'amount')
    throw new PrivateTripInputError('Jenis down payment tidak valid.');
  const dpValue = whole(
    values,
    'dpValue',
    dpMode === 'percent' ? 1 : 1,
    dpMode === 'percent' ? 100 : 999_999_999_999,
  );
  const total = BigInt(unitPrice) * BigInt(pax);
  const minimum = minimumDp(total, dpMode, dpValue);
  const pickupAt = optionalDateTime(values.pickupAt, 'Waktu pickup');
  const pickupDetails = {
    zoneName: clean(values, 'pickupZoneName', 120, true),
    locationName: clean(values, 'pickupLocationName', 180, true),
    address: clean(values, 'pickupAddress', 1_000),
    pickupAt: pickupAt?.toISOString() ?? null,
    mapsUrl: url(values.pickupMapsUrl, 'Tautan peta'),
    instructions: clean(values, 'pickupInstructions', 2_000),
  };
  const itineraryStages = parseItineraryStages(values.itineraryStages);
  return {
    title: clean(values, 'title', 160, true),
    startAt,
    endAt,
    validUntil,
    pax,
    unitPrice,
    dpMode,
    dpValue,
    minimumDp: minimum.toString(),
    included: clean(values, 'included', 8_000),
    excluded: clean(values, 'excluded', 8_000),
    meetingPoint: [
      pickupDetails.zoneName,
      pickupDetails.locationName,
      pickupDetails.address,
    ]
      .filter(Boolean)
      .join(' · '),
    pickupDetails,
    itineraryStages,
    preparation: clean(values, 'preparation', 8_000),
    notes: clean(values, 'notes', 4_000),
  };
}

function requestNumber(result: unknown) {
  const row = (result as Array<{ value?: string | number | bigint }>)[0];
  if (row?.value === undefined)
    throw new Error('Nomor permintaan tidak dapat dibuat.');
  return `LJ-PT-${String(row.value).padStart(6, '0')}`;
}

export async function createPrivateTripRequest(
  guestScopeHash: string,
  values: Values,
) {
  const input = parsePrivateTripRequest(values);
  const db = getDb();
  return db.transaction(async (tx) => {
    const sequence = await tx.execute(
      sql`select nextval('booking_public_number_seq')::text as value`,
    );
    const publicNumber = requestNumber(sequence);
    const [created] = await tx
      .insert(privateTripRequest)
      .values({
        ...input,
        publicNumber,
        guestScopeHash,
        consentedAt: new Date(),
      })
      .returning();
    return created;
  });
}

export async function updatePrivateTripRequestState(
  id: string,
  state: PrivateRequestState,
  actorUserId: string,
) {
  if (!requestStates.includes(state))
    throw new PrivateTripInputError('Status permintaan tidak valid.');
  const db = getDb();
  const [updated] = await db
    .update(privateTripRequest)
    .set({ state, updatedAt: new Date() })
    .where(eq(privateTripRequest.id, id))
    .returning();
  if (!updated)
    throw new PrivateTripInputError('Permintaan private trip tidak ditemukan.');
  await db.insert(adminAuditLog).values({
    actorUserId,
    entityType: 'private_trip_request',
    entityId: id,
    action: `state_${state}`,
    payload: { number: updated.publicNumber },
  });
  return updated;
}

export async function createPrivateTripOffer(
  requestId: string,
  values: Values,
  actorUserId: string,
  send = false,
) {
  const input = parsePrivateTripOffer(values);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(privateTripRequest)
      .where(eq(privateTripRequest.id, requestId))
      .limit(1);
    if (!request)
      throw new PrivateTripInputError(
        'Permintaan private trip tidak ditemukan.',
      );
    if (
      ['accepted', 'declined', 'expired', 'converted'].includes(request.state)
    )
      throw new PrivateTripConflictError(
        'Permintaan ini tidak dapat diberi penawaran lagi. Kesepakatan sudah harus dikonversi atau statusnya sudah ditutup.',
      );
    const [latest] = await tx
      .select({ revision: privateTripOffer.revision })
      .from(privateTripOffer)
      .where(eq(privateTripOffer.requestId, requestId))
      .orderBy(desc(privateTripOffer.revision))
      .limit(1);
    const now = new Date();
    if (send)
      await tx
        .update(privateTripOffer)
        .set({ state: 'superseded', updatedAt: now })
        .where(
          and(
            eq(privateTripOffer.requestId, requestId),
            eq(privateTripOffer.state, 'sent'),
          ),
        );
    const [created] = await tx
      .insert(privateTripOffer)
      .values({
        ...input,
        requestId,
        revision: (latest?.revision ?? 0) + 1,
        state: send ? 'sent' : 'draft',
        sentAt: send ? now : null,
        createdByUserId: actorUserId,
      })
      .returning();
    if (send)
      await tx
        .update(privateTripRequest)
        .set({ state: 'offer_sent', updatedAt: now })
        .where(eq(privateTripRequest.id, requestId));
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'private_trip_request',
      entityId: requestId,
      action: send ? 'offer_sent' : 'offer_drafted',
      payload: {
        number: request.publicNumber,
        revision: created.revision,
        offerId: created.id,
      },
    });
    return created;
  });
}

export async function updatePrivateTripOfferState(
  offerId: string,
  state: PrivateOfferState,
  note: string,
  actorUserId: string,
) {
  if (!offerStates.includes(state) || !['accepted', 'declined'].includes(state))
    throw new PrivateTripInputError('Tindakan penawaran tidak valid.');
  const normalizedNote = note.trim().replace(/\s+/g, ' ');
  const db = getDb();
  return db.transaction(async (tx) => {
    const [offer] = await tx
      .select()
      .from(privateTripOffer)
      .where(eq(privateTripOffer.id, offerId))
      .limit(1);
    if (!offer) throw new PrivateTripInputError('Penawaran tidak ditemukan.');
    if (offer.state !== 'sent')
      throw new PrivateTripConflictError(
        'Hanya penawaran terkirim yang dapat dikonfirmasi atau ditolak.',
      );
    if (state === 'accepted') {
      const [accepted] = await tx
        .select({ id: privateTripOffer.id })
        .from(privateTripOffer)
        .where(
          and(
            eq(privateTripOffer.requestId, offer.requestId),
            eq(privateTripOffer.state, 'accepted'),
          ),
        )
        .limit(1);
      if (accepted)
        throw new PrivateTripConflictError(
          'Sudah ada penawaran lain yang dicatat sebagai kesepakatan untuk permintaan ini.',
        );
    }
    const now = new Date();
    if (offer.validUntil < now)
      throw new PrivateTripConflictError(
        'Masa berlaku penawaran sudah berakhir. Buat revisi baru.',
      );
    await tx
      .update(privateTripOffer)
      .set({
        state,
        acceptedAt: state === 'accepted' ? now : null,
        acceptedNote: normalizedNote || null,
        updatedAt: now,
      })
      .where(eq(privateTripOffer.id, offerId));
    await tx
      .update(privateTripRequest)
      .set({ state, updatedAt: now })
      .where(eq(privateTripRequest.id, offer.requestId));
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'private_trip_request',
      entityId: offer.requestId,
      action: `offer_${state}`,
      payload: {
        offerId,
        revision: offer.revision,
        note: normalizedNote || null,
      },
    });
    return { requestId: offer.requestId, state };
  });
}

/** Public PIC view. The offer UUID acts as the unguessable link token. */
export async function getPublicPrivateOffer(offerId: string) {
  const db = getDb();
  const [found] = await db
    .select({ offer: privateTripOffer, request: privateTripRequest })
    .from(privateTripOffer)
    .innerJoin(
      privateTripRequest,
      eq(privateTripOffer.requestId, privateTripRequest.id),
    )
    .where(eq(privateTripOffer.id, offerId))
    .limit(1);
  if (!found || found.offer.state !== 'sent') return null;
  if (found.offer.validUntil <= new Date()) return null;
  return found;
}

/** Records the PIC decision without exposing admin-only state endpoints. */
export async function respondToPrivateOffer(
  offerId: string,
  state: 'accepted' | 'declined',
  note: string,
) {
  const normalizedNote = note.trim().replace(/\s+/g, ' ');
  const db = getDb();
  return db.transaction(async (tx) => {
    const [offer] = await tx
      .select()
      .from(privateTripOffer)
      .where(eq(privateTripOffer.id, offerId))
      .limit(1);
    if (!offer || offer.state !== 'sent')
      throw new PrivateTripConflictError('Penawaran ini sudah tidak aktif.');
    const now = new Date();
    if (offer.validUntil <= now)
      throw new PrivateTripConflictError(
        'Masa berlaku penawaran sudah berakhir.',
      );
    await tx
      .update(privateTripOffer)
      .set({
        state,
        acceptedAt: now,
        acceptedNote: normalizedNote || null,
        updatedAt: now,
      })
      .where(eq(privateTripOffer.id, offerId));
    await tx
      .update(privateTripRequest)
      .set({ state, updatedAt: now })
      .where(eq(privateTripRequest.id, offer.requestId));
    return { requestId: offer.requestId, state };
  });
}

type PrivateParticipant = { fullName: string };
type StoredDraftParticipant = {
  position: number;
  fullName: string;
  identityCiphertext: string | null;
  identityLast4: string | null;
};

function storedDraftParticipants(value: unknown, pax: number) {
  if (!Array.isArray(value) || value.length !== pax) return [];
  const participants: StoredDraftParticipant[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (
      !Number.isInteger(row.position) ||
      typeof row.fullName !== 'string' ||
      (row.identityCiphertext !== null &&
        typeof row.identityCiphertext !== 'string') ||
      (row.identityLast4 !== null && typeof row.identityLast4 !== 'string')
    )
      return [];
    participants.push({
      position: row.position as number,
      fullName: row.fullName,
      identityCiphertext: row.identityCiphertext,
      identityLast4: row.identityLast4,
    });
  }
  return participants.sort((a, b) => a.position - b.position);
}

function parseParticipants(values: Values, pax: number) {
  const raw = Array.isArray(values.participants) ? values.participants : [];
  if (raw.length !== pax)
    throw new PrivateTripInputError(
      `Data peserta harus berjumlah tepat ${pax} orang.`,
    );
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object')
      throw new PrivateTripInputError(`Data peserta ${index + 1} tidak valid.`);
    const person = entry as Record<string, unknown>;
    const fullName =
      typeof person.fullName === 'string'
        ? person.fullName.trim().replace(/\s+/g, ' ')
        : '';
    if (!fullName || fullName.length > 120)
      throw new PrivateTripInputError(`Nama peserta ${index + 1} wajib diisi.`);
    // Nomor identitas dikumpulkan kemudian melalui tautan data peserta.
    return { fullName } satisfies PrivateParticipant;
  });
}

async function findConversionOffer(offerId: string, requestId?: string) {
  const db = getDb();
  const rows = await db
    .select({ offer: privateTripOffer, request: privateTripRequest })
    .from(privateTripOffer)
    .innerJoin(
      privateTripRequest,
      eq(privateTripOffer.requestId, privateTripRequest.id),
    )
    .where(eq(privateTripOffer.id, offerId))
    .limit(1);
  const row = rows[0];
  if (!row || (requestId && row.request.id !== requestId)) return null;
  return row;
}

/** Context halaman konversi tidak pernah mengirim NIK plaintext kembali ke browser. */
export async function getPrivateConversionContext(
  requestId: string,
  offerId: string,
) {
  const found = await findConversionOffer(offerId, requestId);
  if (
    !found ||
    found.offer.state !== 'accepted' ||
    found.offer.convertedBookingId
  )
    return null;
  const db = getDb();
  const [draft] = await db
    .select()
    .from(privateTripManifestDraft)
    .where(
      and(
        eq(privateTripManifestDraft.offerId, found.offer.id),
        gt(privateTripManifestDraft.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const participants = draft
    ? storedDraftParticipants(draft.participants, found.offer.pax).map(
        (item) => ({
          position: item.position,
          fullName: item.fullName,
          identityLast4: item.identityLast4,
        }),
      )
    : [];
  return {
    ...found,
    draft: draft
      ? {
          participants,
          picIsParticipant: draft.picIsParticipant,
          updatedAt: draft.updatedAt,
        }
      : null,
  };
}

export async function savePrivateOfferManifestDraft(
  offerId: string,
  values: Values,
  actorUserId: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from private_trip_offers where id = ${offerId} for update`,
    );
    const [found] = await tx
      .select({ offer: privateTripOffer, request: privateTripRequest })
      .from(privateTripOffer)
      .innerJoin(
        privateTripRequest,
        eq(privateTripOffer.requestId, privateTripRequest.id),
      )
      .where(eq(privateTripOffer.id, offerId))
      .limit(1);
    if (!found)
      throw new PrivateTripInputError(
        'Penawaran private trip tidak ditemukan.',
      );
    if (found.offer.state !== 'accepted' || found.offer.convertedBookingId) {
      throw new PrivateTripConflictError(
        'Draf manifest hanya dapat disimpan untuk penawaran yang sudah disepakati dan belum dikonversi.',
      );
    }
    const now = new Date();
    if (found.offer.startAt <= now) {
      throw new PrivateTripConflictError(
        'Waktu perjalanan sudah lewat. Draf manifest tidak dapat disimpan.',
      );
    }
    const [existing] = await tx
      .select()
      .from(privateTripManifestDraft)
      .where(eq(privateTripManifestDraft.offerId, offerId))
      .limit(1);
    const participants = parseParticipants(values, found.offer.pax);
    const picIsParticipant = picParticipation(
      values,
      existing?.picIsParticipant ?? true,
    );
    if (
      picIsParticipant &&
      participants[0].fullName.localeCompare(found.request.picName, 'id', {
        sensitivity: 'base',
      }) !== 0
    ) {
      throw new PrivateTripInputError(
        'Peserta 1 harus PIC sesuai permintaan private trip.',
      );
    }
    const stored = participants.map((person, index) => ({
      position: index + 1,
      fullName: person.fullName,
      identityCiphertext: null,
      identityLast4: null,
    }));
    const expiresAt = new Date(
      Math.min(
        found.offer.startAt.getTime(),
        now.getTime() + 7 * 24 * 60 * 60 * 1000,
      ),
    );
    await tx
      .insert(privateTripManifestDraft)
      .values({
        offerId,
        participants: stored,
        picIsParticipant,
        savedByUserId: actorUserId,
        expiresAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: privateTripManifestDraft.offerId,
        set: {
          participants: stored,
          picIsParticipant,
          savedByUserId: actorUserId,
          expiresAt,
          updatedAt: now,
        },
      });
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'private_trip_request',
      entityId: found.request.id,
      action: 'manifest_draft_saved',
      payload: {
        offerId,
        offerRevision: found.offer.revision,
        pax: found.offer.pax,
        picIsParticipant,
      },
    });
    return { savedAt: now, expiresAt };
  });
}

export async function discardPrivateOfferManifestDraft(
  offerId: string,
  actorUserId: string,
) {
  const found = await findConversionOffer(offerId);
  if (!found)
    throw new PrivateTripInputError('Penawaran private trip tidak ditemukan.');
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(privateTripManifestDraft)
      .where(eq(privateTripManifestDraft.offerId, offerId));
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'private_trip_request',
      entityId: found.request.id,
      action: 'manifest_draft_discarded',
      payload: { offerId, offerRevision: found.offer.revision },
    });
  });
}

/** Converts an accepted private offer only once. Its internal departure is closed,
 * so it exists for invoice/allocation history and never becomes a public Open Trip. */
export async function convertPrivateOfferToBooking(
  offerId: string,
  values: Values,
  actorUserId: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from private_trip_offers where id = ${offerId} for update`,
    );
    const [offer] = await tx
      .select()
      .from(privateTripOffer)
      .where(eq(privateTripOffer.id, offerId))
      .limit(1);
    if (!offer) throw new PrivateTripInputError('Penawaran tidak ditemukan.');
    if (offer.convertedBookingId)
      throw new PrivateTripConflictError(
        'Penawaran ini sudah pernah dikonversi menjadi booking.',
      );
    if (offer.state !== 'accepted')
      throw new PrivateTripConflictError(
        'Hanya penawaran yang telah disepakati dapat dibuatkan booking.',
      );
    const now = new Date();
    if (offer.startAt <= now)
      throw new PrivateTripConflictError(
        'Waktu perjalanan sudah lewat. Buat penawaran baru dengan jadwal yang valid.',
      );
    const [request] = await tx
      .select()
      .from(privateTripRequest)
      .where(eq(privateTripRequest.id, offer.requestId))
      .limit(1);
    if (!request)
      throw new PrivateTripInputError('Permintaan asal tidak ditemukan.');
    const [savedDraft] = await tx
      .select()
      .from(privateTripManifestDraft)
      .where(
        and(
          eq(privateTripManifestDraft.offerId, offer.id),
          gt(privateTripManifestDraft.expiresAt, now),
        ),
      )
      .limit(1);
    const participants = parseParticipants(values, offer.pax);
    const picIsParticipant = picParticipation(
      values,
      savedDraft?.picIsParticipant ?? true,
    );
    if (
      picIsParticipant &&
      participants[0].fullName.localeCompare(request.picName, 'id', {
        sensitivity: 'base',
      }) !== 0
    ) {
      throw new PrivateTripInputError(
        'Peserta 1 harus PIC sesuai permintaan private trip.',
      );
    }
    const sequence = await tx.execute(
      sql`select nextval('booking_public_number_seq')::text as value`,
    );
    const publicNumber = `LJ-OT-${String((sequence as unknown as Array<{ value: string }>)[0]?.value ?? '').padStart(6, '0')}`;
    if (!/^LJ-OT-\d{6,}$/.test(publicNumber))
      throw new Error('Nomor booking private tidak dapat dibuat.');
    const slug = `private-${request.publicNumber.toLowerCase()}`;
    const [createdTrip] = await tx
      .insert(trip)
      .values({ slug, name: offer.title, category: 'Private Trip' })
      .returning();
    const [version] = await tx
      .insert(tripVersion)
      .values({
        tripId: createdTrip.id,
        version: 1,
        description: offer.notes || `Private Trip ${request.destination}.`,
        included: offer.included,
        excluded: offer.excluded,
        itinerary: offer.itineraryStages
          .map((stage) => `${stage.day} — ${stage.title}`)
          .join('\n'),
        itineraryStages: offer.itineraryStages,
        preparation: offer.preparation,
        meetingPoint: offer.meetingPoint,
        terms:
          'Detail perjalanan mengikuti penawaran private trip yang telah disepakati.',
        coverImageUrl: null,
      })
      .returning();
    const [privateDeparture] = await tx
      .insert(departure)
      .values({
        tripVersionId: version.id,
        startAt: offer.startAt,
        endAt: offer.endAt,
        timezone: 'Asia/Jakarta',
        capacity: offer.pax,
        unitPrice: offer.unitPrice,
        dpMode: offer.dpMode,
        dpValue: offer.dpValue,
        bookingCutoffAt: offer.startAt,
        balanceDueAt: null,
        publicationState: 'closed',
      })
      .returning();
    const pickup = offer.pickupDetails;
    const [privatePickup] = await tx
      .insert(departurePickupOption)
      .values({
        departureId: privateDeparture.id,
        zoneName: pickup.zoneName || 'Private Trip',
        locationName:
          pickup.locationName || offer.meetingPoint || 'Sesuai kesepakatan',
        address: pickup.address || '',
        pickupAt: pickup.pickupAt ? new Date(pickup.pickupAt) : null,
        pricePerPax: offer.unitPrice,
        mapsUrl: pickup.mapsUrl || null,
        instructions: pickup.instructions || '',
        pickupRundownStages: null,
        capacity: offer.pax,
        isDefault: true,
        isActive: true,
      })
      .returning();
    const holdExpiresAt = new Date(
      Math.min(now.getTime() + 24 * 60 * 60 * 1000, offer.startAt.getTime()),
    );
    const total = (BigInt(offer.unitPrice) * BigInt(offer.pax)).toString();
    const packageSnapshot: TripPackageSnapshotV2 = {
      snapshotVersion: 2,
      tripName: offer.title,
      category: 'Private Trip',
      startAt: offer.startAt.toISOString(),
      endAt: offer.endAt.toISOString(),
      timezone: 'Asia/Jakarta',
      included: offer.included,
      excluded: offer.excluded,
      meetingPoint: offer.meetingPoint,
      preparation: offer.preparation,
      itineraryStages: offer.itineraryStages,
      itinerarySource: 'trip_version',
      legacyItinerary: offer.itineraryStages
        .map((stage) => `${stage.day} — ${stage.title}`)
        .join('\n'),
      pickup: {
        id: privatePickup.id,
        zoneName: privatePickup.zoneName,
        locationName: privatePickup.locationName,
        address: privatePickup.address,
        pickupAt: privatePickup.pickupAt?.toISOString() ?? null,
        mapsUrl: privatePickup.mapsUrl,
        instructions: privatePickup.instructions,
        pickupRundownStages: null,
      },
      terms:
        'Detail perjalanan mengikuti penawaran private trip yang telah disepakati.',
      privateRequestNumber: request.publicNumber,
      offerRevision: offer.revision,
    };
    const policySnapshot = {
      unitPrice: offer.unitPrice,
      total,
      dpMode: offer.dpMode,
      dpValue: offer.dpValue,
      minimumDp: offer.minimumDp,
      bookingCutoffAt: offer.startAt.toISOString(),
      balanceDueAt: null,
      source: 'private_trip_offer',
    };
    const [createdBooking] = await tx
      .insert(booking)
      .values({
        publicNumber,
        guestScopeHash: request.guestScopeHash,
        departureId: privateDeparture.id,
        pickupOptionId: privatePickup.id,
        tripVersionId: version.id,
        pax: offer.pax,
        picName: request.picName,
        picWhatsApp: request.picWhatsApp,
        picEmail: request.picEmail,
        picIsParticipant,
        picIdentityCiphertext: null,
        picIdentityHash: null,
        picIdentityLast4: null,
        packageSnapshot,
        policySnapshot,
        bookingSource: 'private_trip',
        state: 'awaiting_payment',
        holdExpiresAt,
        termsAcceptedAt: now,
        participantConsentAt: now,
      })
      .returning();
    await tx.insert(bookingParticipant).values(
      participants.map((person, index) => ({
        bookingId: createdBooking.id,
        position: index + 1,
        fullName: person.fullName,
        // Private-trip roster hanya membutuhkan nama. Identitas dikumpulkan
        // kemudian melalui tautan peserta dan dapat berupa dokumen apa pun.
        identityType: 'pending',
        identityCiphertext: null,
        identityHash: null,
        identityLast4: null,
        isPic: picIsParticipant && index === 0,
      })),
    );
    await tx.insert(bookingAllocation).values({
      bookingId: createdBooking.id,
      departureId: privateDeparture.id,
      pax: offer.pax,
      state: 'held',
      expiresAt: holdExpiresAt,
    });
    await tx.insert(invoice).values({
      bookingId: createdBooking.id,
      number: publicNumber,
      total,
      minimumDp: offer.minimumDp,
      balanceDueAt: null,
      issuedAt: now,
    });
    const token = createAccessToken();
    await tx.insert(invoiceAccessGrant).values({
      bookingId: createdBooking.id,
      tokenHash: token.hash,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    });
    await tx
      .update(privateTripOffer)
      .set({ convertedBookingId: createdBooking.id, updatedAt: now })
      .where(eq(privateTripOffer.id, offer.id));
    await tx
      .update(privateTripRequest)
      .set({ state: 'converted', updatedAt: now })
      .where(eq(privateTripRequest.id, request.id));
    await tx
      .delete(privateTripManifestDraft)
      .where(eq(privateTripManifestDraft.offerId, offer.id));
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'private_trip_request',
      entityId: request.id,
      action: 'converted_to_booking',
      payload: {
        offerId: offer.id,
        offerRevision: offer.revision,
        bookingId: createdBooking.id,
        invoiceNumber: publicNumber,
        picIsParticipant,
      },
    });
    return {
      bookingId: createdBooking.id,
      number: publicNumber,
      invoiceToken: token.value,
    };
  });
}
