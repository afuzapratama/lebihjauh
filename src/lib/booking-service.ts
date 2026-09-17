import { createHash } from 'node:crypto';
import { and, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  booking,
  bookingAllocation,
  bookingParticipant,
  checkoutQuote,
  departure,
  departurePickupOption,
  idempotencyRecord,
  invoice,
  invoiceAccessGrant,
  trip,
  tripVersion,
} from '../db/schema';
import {
  resolveBookingSnapshot,
  resolveItinerary,
  type TripPackageSnapshotV2,
} from './trip-itinerary';
import { createAccessToken } from './booking-security';
import { getBookableDepartures } from './public-trips';

const maxPax = 10_000;
const quoteLifetimeMs = 15 * 60 * 1000;
const holdLifetimeMs = 24 * 60 * 60 * 1000;
const grantLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export class BookingInputError extends Error {}
export class BookingConflictError extends Error {}

export type ParticipantInput = {
  fullName: string;
};

export type BookingInput = {
  quoteId: string;
  picName: string;
  picWhatsApp: string;
  picEmail?: string;
  picIsParticipant: boolean;
  participants: ParticipantInput[];
  termsAccepted: boolean;
  participantConsent: boolean;
};

const trim = (value: unknown, field: string, max: number, required = true) => {
  const result =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && !result) throw new BookingInputError(`${field} wajib diisi.`);
  if (result.length > max)
    throw new BookingInputError(`${field} terlalu panjang.`);
  return result;
};

const whatsapp = (value: unknown) => {
  const result = typeof value === 'string' ? value.replace(/[\s()-]/g, '') : '';
  if (!/^\+?\d{9,16}$/.test(result)) {
    throw new BookingInputError('Nomor WhatsApp PIC tidak valid.');
  }
  return result;
};

function rupiah(value: string) {
  if (!/^\d+$/.test(value))
    throw new Error('Nilai Rupiah database tidak valid.');
  return BigInt(value);
}

function minimumDp(total: bigint, dpMode: string, dpValue: string) {
  const value = rupiah(dpValue);
  if (dpMode === 'percent') return (total * value + 99n) / 100n;
  return value > total ? total : value;
}

function futureDate(date: Date, message: string) {
  if (date <= new Date()) throw new BookingConflictError(message);
}

function requestHash(input: BookingInput) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        quoteId: input.quoteId,
        picName: input.picName,
        picWhatsApp: input.picWhatsApp,
        picEmail: input.picEmail ?? '',
        picIsParticipant: input.picIsParticipant,
        participants: input.participants.map((person) => person.fullName),
      }),
    )
    .digest('hex');
}

export function parseBookingInput(value: unknown): BookingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BookingInputError('Data booking tidak valid.');
  }
  const values = value as Record<string, unknown>;
  const rawParticipants = values.participants;
  if (!Array.isArray(rawParticipants) || !rawParticipants.length) {
    throw new BookingInputError('Isi data setiap peserta yang ikut trip.');
  }
  if (rawParticipants.length > maxPax) {
    throw new BookingInputError(
      'Jumlah peserta melebihi batas yang diizinkan.',
    );
  }
  const participants = rawParticipants.map((person, index) => {
    if (!person || typeof person !== 'object' || Array.isArray(person)) {
      throw new BookingInputError(`Data Peserta ${index + 1} tidak valid.`);
    }
    const participant = person as Record<string, unknown>;
    return {
      fullName: trim(participant.fullName, `Nama Peserta ${index + 1}`, 120),
    };
  });

  const picIsParticipant = values.picIsParticipant === true;
  const input: BookingInput = {
    quoteId: trim(values.quoteId, 'Quote booking', 64),
    picName: trim(values.picName, 'Nama PIC', 120),
    picWhatsApp: whatsapp(values.picWhatsApp),
    picEmail: trim(values.picEmail, 'Email PIC', 254, false) || undefined,
    picIsParticipant,
    participants,
    termsAccepted: values.termsAccepted === true,
    participantConsent: values.participantConsent === true,
  };
  if (input.picEmail && !/^\S+@\S+\.\S+$/.test(input.picEmail)) {
    throw new BookingInputError('Email PIC tidak valid.');
  }
  if (!input.termsAccepted) {
    throw new BookingInputError(
      'Setujui ketentuan perjalanan sebelum membuat booking.',
    );
  }
  if (!input.participantConsent) {
    throw new BookingInputError(
      'PIC harus menyatakan telah mendapat persetujuan dari seluruh peserta.',
    );
  }
  if (input.picIsParticipant) {
    const first = input.participants[0];
    if (first.fullName !== input.picName) {
      throw new BookingInputError(
        'Peserta 1 harus sama dengan data PIC saat PIC ikut trip.',
      );
    }
  }
  return input;
}

export async function createCheckoutQuote(
  guestScopeHash: string,
  departureId: string,
  pax: number,
  pickupOptionId: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(departureId)) {
    throw new BookingInputError('Jadwal keberangkatan tidak valid.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(pickupOptionId)) {
    throw new BookingInputError('Pilih meeting point terlebih dahulu.');
  }
  if (!Number.isInteger(pax) || pax < 1 || pax > maxPax) {
    throw new BookingInputError('Jumlah peserta tidak valid.');
  }
  const db = getDb();
  const [schedule] = await db
    .select({
      id: departure.id,
      revision: departure.revision,
      capacity: departure.capacity,
      unitPrice: departure.unitPrice,
      dpMode: departure.dpMode,
      dpValue: departure.dpValue,
      bookingCutoffAt: departure.bookingCutoffAt,
      publicationState: departure.publicationState,
    })
    .from(departure)
    .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
    .innerJoin(trip, eq(tripVersion.tripId, trip.id))
    .where(and(eq(departure.id, departureId), isNull(trip.archivedAt)))
    .limit(1);
  if (!schedule || schedule.publicationState !== 'open') {
    throw new BookingConflictError('Jadwal ini tidak tersedia untuk booking.');
  }
  const [pickup] = await db
    .select({
      id: departurePickupOption.id,
      pricePerPax: departurePickupOption.pricePerPax,
      capacity: departurePickupOption.capacity,
    })
    .from(departurePickupOption)
    .where(
      and(
        eq(departurePickupOption.id, pickupOptionId),
        eq(departurePickupOption.departureId, schedule.id),
        eq(departurePickupOption.isActive, true),
      ),
    )
    .limit(1);
  if (!pickup) {
    throw new BookingConflictError(
      'Meeting point tidak lagi tersedia. Pilih titik jemput lain.',
    );
  }
  futureDate(
    schedule.bookingCutoffAt,
    'Tenggat booking untuk jadwal ini sudah lewat.',
  );
  const activeAllocations = await db
    .select({ pax: bookingAllocation.pax })
    .from(bookingAllocation)
    .where(
      and(
        eq(bookingAllocation.departureId, schedule.id),
        or(
          eq(bookingAllocation.state, 'committed'),
          and(
            eq(bookingAllocation.state, 'held'),
            gt(bookingAllocation.expiresAt, new Date()),
          ),
        ),
      ),
    );
  const occupied = activeAllocations.reduce((sum, item) => sum + item.pax, 0);
  if (schedule.capacity - occupied < pax) {
    throw new BookingConflictError(
      'Kursi yang tersedia tidak mencukupi untuk jumlah peserta ini.',
    );
  }
  if (pickup.capacity) {
    const pickupAllocations = await db
      .select({ pax: bookingAllocation.pax })
      .from(bookingAllocation)
      .innerJoin(booking, eq(bookingAllocation.bookingId, booking.id))
      .where(
        and(
          eq(booking.pickupOptionId, pickup.id),
          or(
            eq(bookingAllocation.state, 'committed'),
            and(
              eq(bookingAllocation.state, 'held'),
              gt(bookingAllocation.expiresAt, new Date()),
            ),
          ),
        ),
      );
    const pickupOccupied = pickupAllocations.reduce(
      (total, item) => total + item.pax,
      0,
    );
    if (pickup.capacity - pickupOccupied < pax)
      throw new BookingConflictError(
        'Kuota pada meeting point ini tidak mencukupi. Pilih titik lain atau kurangi peserta.',
      );
  }
  const total = rupiah(pickup.pricePerPax) * BigInt(pax);
  const dp = minimumDp(total, schedule.dpMode, schedule.dpValue);
  if (dp <= 0n)
    throw new BookingConflictError('Aturan down payment jadwal belum valid.');
  const expiresAt = new Date(
    Math.min(Date.now() + quoteLifetimeMs, schedule.bookingCutoffAt.getTime()),
  );
  const [quote] = await db
    .insert(checkoutQuote)
    .values({
      guestScopeHash,
      departureId: schedule.id,
      pickupOptionId: pickup.id,
      departureRevision: schedule.revision,
      pax,
      unitPrice: total === 0n ? '0' : pickup.pricePerPax,
      total: total.toString(),
      minimumDp: dp.toString(),
      expiresAt,
    })
    .returning();
  return quote;
}

export async function getCheckoutDeparture(departureId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      departureId,
    )
  )
    return null;
  const [schedule] = await getBookableDepartures({ departureId });
  return schedule ? { ...schedule, tripName: schedule.name } : null;
}

async function expireDueHolds(
  tx: Parameters<ReturnType<typeof getDb>['transaction']>[0] extends (
    tx: infer T,
  ) => unknown
    ? T
    : never,
  departureId: string,
  now: Date,
) {
  const due = await tx
    .select({ bookingId: bookingAllocation.bookingId })
    .from(bookingAllocation)
    .where(
      and(
        eq(bookingAllocation.departureId, departureId),
        eq(bookingAllocation.state, 'held'),
        lte(bookingAllocation.expiresAt, now),
      ),
    );
  if (!due.length) return;
  await tx
    .update(bookingAllocation)
    .set({ state: 'released', releasedAt: now, updatedAt: now })
    .where(
      and(
        eq(bookingAllocation.departureId, departureId),
        eq(bookingAllocation.state, 'held'),
        lte(bookingAllocation.expiresAt, now),
      ),
    );
  await tx
    .update(booking)
    .set({ state: 'expired', updatedAt: now })
    .where(
      and(
        inArray(
          booking.id,
          due.map((item) => item.bookingId),
        ),
        eq(booking.state, 'awaiting_payment'),
      ),
    );
}

function numberFromSequence(result: unknown) {
  const rows = result as Array<{ value?: string | number | bigint }>;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('Nomor booking tidak dapat dibuat.');
  return `LJ-OT-${String(value).padStart(6, '0')}`;
}

export async function createBooking(
  guestScopeHash: string,
  idempotencyKey: string,
  input: BookingInput,
) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
    throw new BookingInputError(
      'Kunci booking tidak valid. Muat ulang halaman lalu coba lagi.',
    );
  }
  const db = getDb();
  const payloadHash = requestHash(input);
  return db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(idempotencyRecord)
      .where(
        and(
          eq(idempotencyRecord.scopeHash, guestScopeHash),
          eq(idempotencyRecord.operation, 'create-booking'),
          eq(idempotencyRecord.key, idempotencyKey),
        ),
      )
      .limit(1);
    if (previous) {
      if (previous.requestHash !== payloadHash) {
        throw new BookingConflictError(
          'Permintaan yang sama sudah dipakai dengan data berbeda.',
        );
      }
      const [existing] = await tx
        .select({ number: invoice.number })
        .from(invoice)
        .where(eq(invoice.bookingId, previous.resourceId))
        .limit(1);
      if (!existing)
        throw new Error('Invoice booking sebelumnya tidak ditemukan.');
      return { number: existing.number, reused: true, invoiceToken: null };
    }

    const now = new Date();
    const [quote] = await tx
      .select()
      .from(checkoutQuote)
      .where(
        and(
          eq(checkoutQuote.id, input.quoteId),
          eq(checkoutQuote.guestScopeHash, guestScopeHash),
          gt(checkoutQuote.expiresAt, now),
        ),
      )
      .limit(1);
    if (!quote) {
      throw new BookingConflictError(
        'Ringkasan booking sudah kedaluwarsa. Periksa harga dan jadwal lagi.',
      );
    }
    if (quote.pax !== input.participants.length) {
      throw new BookingInputError(
        'Jumlah data peserta harus sama dengan jumlah pax yang dipilih.',
      );
    }

    await tx.execute(
      sql`select id from departures where id = ${quote.departureId} for update`,
    );
    const [schedule] = await tx
      .select({
        id: departure.id,
        revision: departure.revision,
        capacity: departure.capacity,
        unitPrice: departure.unitPrice,
        dpMode: departure.dpMode,
        dpValue: departure.dpValue,
        bookingCutoffAt: departure.bookingCutoffAt,
        balanceDueAt: departure.balanceDueAt,
        publicationState: departure.publicationState,
        startAt: departure.startAt,
        endAt: departure.endAt,
        timezone: departure.timezone,
        tripVersionId: tripVersion.id,
        tripName: trip.name,
        category: trip.category,
        included: tripVersion.included,
        excluded: tripVersion.excluded,
        meetingPoint: tripVersion.meetingPoint,
        terms: tripVersion.terms,
        preparation: tripVersion.preparation,
        legacyItinerary: tripVersion.itinerary,
        itineraryStages: tripVersion.itineraryStages,
        itineraryOverride: departure.itineraryOverride,
      })
      .from(departure)
      .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
      .innerJoin(trip, eq(tripVersion.tripId, trip.id))
      .where(and(eq(departure.id, quote.departureId), isNull(trip.archivedAt)))
      .limit(1);
    if (!schedule || schedule.publicationState !== 'open') {
      throw new BookingConflictError(
        'Jadwal ini sudah tidak dibuka untuk booking.',
      );
    }
    futureDate(
      schedule.bookingCutoffAt,
      'Tenggat booking untuk jadwal ini sudah lewat.',
    );
    if (schedule.revision !== quote.departureRevision) {
      throw new BookingConflictError(
        'Harga atau jadwal telah berubah. Periksa ringkasan booking terbaru.',
      );
    }
    if (!quote.pickupOptionId) {
      throw new BookingConflictError(
        'Ringkasan booking lama tidak memiliki meeting point. Periksa ulang pilihanmu.',
      );
    }
    const [pickup] = await tx
      .select({
        id: departurePickupOption.id,
        zoneName: departurePickupOption.zoneName,
        locationName: departurePickupOption.locationName,
        address: departurePickupOption.address,
        pickupAt: departurePickupOption.pickupAt,
        pricePerPax: departurePickupOption.pricePerPax,
        mapsUrl: departurePickupOption.mapsUrl,
        instructions: departurePickupOption.instructions,
        pickupRundownStages: departurePickupOption.pickupRundownStages,
        capacity: departurePickupOption.capacity,
        isActive: departurePickupOption.isActive,
      })
      .from(departurePickupOption)
      .where(
        and(
          eq(departurePickupOption.id, quote.pickupOptionId),
          eq(departurePickupOption.departureId, schedule.id),
        ),
      )
      .limit(1);
    if (!pickup || !pickup.isActive) {
      throw new BookingConflictError(
        'Meeting point yang dipilih sudah tidak tersedia. Buat ringkasan booking baru.',
      );
    }
    const serverTotal = rupiah(pickup.pricePerPax) * BigInt(quote.pax);
    const serverDp = minimumDp(serverTotal, schedule.dpMode, schedule.dpValue);
    if (
      serverTotal.toString() !== quote.total ||
      serverDp.toString() !== quote.minimumDp
    ) {
      throw new BookingConflictError(
        'Harga atau down payment telah berubah. Periksa ringkasan booking terbaru.',
      );
    }

    await expireDueHolds(tx, schedule.id, now);
    const activeAllocations = await tx
      .select({ pax: bookingAllocation.pax })
      .from(bookingAllocation)
      .where(
        and(
          eq(bookingAllocation.departureId, schedule.id),
          inArray(bookingAllocation.state, ['held', 'committed']),
        ),
      );
    const occupied = activeAllocations.reduce((sum, item) => sum + item.pax, 0);
    if (schedule.capacity - occupied < quote.pax) {
      throw new BookingConflictError(
        'Kursi pada jadwal ini baru saja habis. Pilih keberangkatan lain.',
      );
    }
    if (pickup.capacity) {
      const pickupAllocations = await tx
        .select({ pax: bookingAllocation.pax })
        .from(bookingAllocation)
        .innerJoin(booking, eq(bookingAllocation.bookingId, booking.id))
        .where(
          and(
            eq(booking.pickupOptionId, pickup.id),
            inArray(bookingAllocation.state, ['held', 'committed']),
          ),
        );
      const pickupOccupied = pickupAllocations.reduce(
        (total, item) => total + item.pax,
        0,
      );
      if (pickup.capacity - pickupOccupied < quote.pax)
        throw new BookingConflictError(
          'Kuota meeting point ini baru saja penuh. Pilih titik lain atau kurangi peserta.',
        );
    }

    const holdExpiresAt = new Date(
      Math.min(
        now.getTime() + holdLifetimeMs,
        schedule.bookingCutoffAt.getTime(),
      ),
    );
    const sequence = await tx.execute(
      sql`select nextval('booking_public_number_seq')::text as value`,
    );
    const publicNumber = numberFromSequence(sequence);
    const resolvedItinerary = resolveItinerary(
      schedule.itineraryStages,
      schedule.itineraryOverride,
    );
    const packageSnapshot: TripPackageSnapshotV2 = {
      snapshotVersion: 2,
      tripName: schedule.tripName,
      category: schedule.category,
      startAt: schedule.startAt.toISOString(),
      endAt: schedule.endAt.toISOString(),
      timezone: schedule.timezone,
      included: schedule.included,
      excluded: schedule.excluded,
      meetingPoint: schedule.meetingPoint,
      preparation: schedule.preparation,
      itineraryStages: resolvedItinerary.stages,
      itinerarySource: resolvedItinerary.source,
      legacyItinerary: schedule.legacyItinerary,
      pickup: {
        id: pickup.id,
        zoneName: pickup.zoneName,
        locationName: pickup.locationName,
        address: pickup.address,
        pickupAt: pickup.pickupAt?.toISOString() ?? null,
        mapsUrl: pickup.mapsUrl,
        instructions: pickup.instructions,
        pickupRundownStages: pickup.pickupRundownStages,
      },
      terms: schedule.terms,
    };
    const policySnapshot = {
      unitPrice: pickup.pricePerPax,
      total: serverTotal.toString(),
      dpMode: schedule.dpMode,
      dpValue: schedule.dpValue,
      minimumDp: serverDp.toString(),
      bookingCutoffAt: schedule.bookingCutoffAt.toISOString(),
      balanceDueAt: schedule.balanceDueAt?.toISOString() ?? null,
    };
    const [created] = await tx
      .insert(booking)
      .values({
        publicNumber,
        guestScopeHash,
        departureId: schedule.id,
        pickupOptionId: pickup.id,
        tripVersionId: schedule.tripVersionId,
        pax: quote.pax,
        picName: input.picName,
        picWhatsApp: input.picWhatsApp,
        picEmail: input.picEmail ?? null,
        picIsParticipant: input.picIsParticipant,
        picIdentityCiphertext: null,
        picIdentityHash: null,
        picIdentityLast4: null,
        packageSnapshot,
        policySnapshot,
        bookingSource: 'open_trip',
        holdExpiresAt,
        termsAcceptedAt: now,
        participantConsentAt: now,
      })
      .returning();
    await tx.insert(bookingParticipant).values(
      input.participants.map((person, index) => ({
        bookingId: created.id,
        position: index + 1,
        fullName: person.fullName,
        identityType: 'nik',
        identityCiphertext: null,
        identityHash: null,
        identityLast4: null,
        isPic: input.picIsParticipant && index === 0,
      })),
    );
    await tx.insert(bookingAllocation).values({
      bookingId: created.id,
      departureId: schedule.id,
      pax: quote.pax,
      state: 'held',
      expiresAt: holdExpiresAt,
    });
    await tx.insert(invoice).values({
      bookingId: created.id,
      number: publicNumber,
      total: serverTotal.toString(),
      minimumDp: serverDp.toString(),
      balanceDueAt: schedule.balanceDueAt,
      issuedAt: now,
    });
    const token = createAccessToken();
    await tx.insert(invoiceAccessGrant).values({
      bookingId: created.id,
      tokenHash: token.hash,
      expiresAt: new Date(now.getTime() + grantLifetimeMs),
    });
    await tx.insert(idempotencyRecord).values({
      scopeHash: guestScopeHash,
      operation: 'create-booking',
      key: idempotencyKey,
      requestHash: payloadHash,
      resourceId: created.id,
    });
    return { number: publicNumber, reused: false, invoiceToken: token.value };
  });
}

export async function getPublicInvoice(
  number: string,
  guestScopeHash: string,
  accessToken?: string | null,
) {
  const db = getDb();
  const accessHash = accessToken
    ? createHash('sha256').update(`invoice-access:${accessToken}`).digest('hex')
    : null;
  const [row] = await db
    .select({
      number: invoice.number,
      id: invoice.id,
      total: invoice.total,
      minimumDp: invoice.minimumDp,
      balanceDueAt: invoice.balanceDueAt,
      issuedAt: invoice.issuedAt,
      bookingState: booking.state,
      holdExpiresAt: booking.holdExpiresAt,
      pax: booking.pax,
      picName: booking.picName,
      picWhatsApp: booking.picWhatsApp,
      bookingSource: booking.bookingSource,
      packageSnapshot: booking.packageSnapshot,
      itineraryStages: tripVersion.itineraryStages,
      itinerary: tripVersion.itinerary,
      included: tripVersion.included,
      excluded: tripVersion.excluded,
      preparation: tripVersion.preparation,
      terms: tripVersion.terms,
      guestScopeHash: booking.guestScopeHash,
      accessGrantId: invoiceAccessGrant.id,
    })
    .from(invoice)
    .innerJoin(booking, eq(invoice.bookingId, booking.id))
    .innerJoin(tripVersion, eq(booking.tripVersionId, tripVersion.id))
    .leftJoin(
      invoiceAccessGrant,
      and(
        eq(invoiceAccessGrant.bookingId, booking.id),
        isNull(invoiceAccessGrant.revokedAt),
        gt(invoiceAccessGrant.expiresAt, new Date()),
        accessHash ? eq(invoiceAccessGrant.tokenHash, accessHash) : sql`false`,
      ),
    )
    .where(eq(invoice.number, number))
    .limit(1);
  if (!row) return null;
  const {
    guestScopeHash: ownerScopeHash,
    accessGrantId,
    ...publicInvoice
  } = row;
  const canManage =
    Boolean(accessGrantId) ||
    (row.bookingState === 'awaiting_payment' &&
      ownerScopeHash === guestScopeHash);
  const { getPaymentSummary } = await import('./payment-service');
  const bookingSnapshot = publicInvoice.packageSnapshot as
    | (Partial<TripPackageSnapshotV2> & {
        pickup?: Partial<TripPackageSnapshotV2['pickup']> & {
          itineraryStages?: unknown;
        };
      })
    | null;
  const resolvedSnapshot = resolveBookingSnapshot(bookingSnapshot, {
    itineraryStages: row.itineraryStages,
    itinerary: row.itinerary,
    included: row.included,
    excluded: row.excluded,
    preparation: row.preparation,
    terms: row.terms,
  });
  return {
    ...publicInvoice,
    canManage,
    itineraryStages: resolvedSnapshot.itineraryStages,
    itinerary: resolvedSnapshot.itinerary,
    included: resolvedSnapshot.included,
    excluded: resolvedSnapshot.excluded,
    preparation: resolvedSnapshot.preparation,
    terms: resolvedSnapshot.terms,
    pickupRundownStages: resolvedSnapshot.pickupRundownStages,
    paymentSummary: await getPaymentSummary(publicInvoice.id),
  };
}

export async function exchangeInvoiceAccessToken(token: string) {
  const tokenHash = createHash('sha256')
    .update(`invoice-access:${token}`)
    .digest('hex');
  const db = getDb();
  const [grant] = await db
    .select({ bookingId: invoiceAccessGrant.bookingId })
    .from(invoiceAccessGrant)
    .where(
      and(
        eq(invoiceAccessGrant.tokenHash, tokenHash),
        isNull(invoiceAccessGrant.revokedAt),
        gt(invoiceAccessGrant.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!grant) return null;
  const [found] = await db
    .select({ number: invoice.number, guestScopeHash: booking.guestScopeHash })
    .from(invoice)
    .innerJoin(booking, eq(invoice.bookingId, booking.id))
    .where(eq(invoice.bookingId, grant.bookingId))
    .limit(1);
  return found ?? null;
}
