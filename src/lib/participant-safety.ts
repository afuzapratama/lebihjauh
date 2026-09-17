import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  adminAuditLog,
  booking,
  bookingParticipant,
  bookingParticipantDataDraft,
  bookingParticipantDataGrant,
  departure,
  invoice,
  participantDataGrant,
  participantSafetyData,
  payment,
  trip,
  tripVersion,
} from '../db/schema';
import {
  createParticipantDataToken,
  decryptIdentity,
  encryptIdentity,
  hashSecret,
  identityHash,
  maskIdentity,
} from './booking-security';
import {
  assertParticipantDocumentExists,
  isParticipantDocumentObjectKey,
  UploadInputError,
} from './r2';

export class ParticipantSafetyInputError extends Error {}
export class ParticipantSafetyConflictError extends Error {}

const documentTypes = [
  'ktp',
  'sim',
  'student_card',
  'passport',
  'kitas',
] as const;
type DocumentType = (typeof documentTypes)[number];

const compact = (value: unknown, label: string, min: number, max: number) => {
  const result =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (result.length < min)
    throw new ParticipantSafetyInputError(`${label} wajib diisi.`);
  if (result.length > max)
    throw new ParticipantSafetyInputError(`${label} terlalu panjang.`);
  return result;
};

const phone = (value: unknown, label: string, required = true) => {
  const result = typeof value === 'string' ? value.replace(/[\s()-]/g, '') : '';
  if (!result && !required) return null;
  if (!/^\+?\d{9,16}$/.test(result)) {
    throw new ParticipantSafetyInputError(`${label} tidak valid.`);
  }
  return result;
};

const tokenValue = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(value)) {
    throw new ParticipantSafetyInputError('Tautan data peserta tidak valid.');
  }
  return value;
};

const bookingIdValue = (value: unknown) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new ParticipantSafetyInputError('Booking tidak valid.');
  }
  return value;
};

const bookingReferenceValue = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim())
    throw new ParticipantSafetyInputError('Booking tidak valid.');
  return value.trim();
};

const verified = (rows: Array<{ amount: string }>) =>
  rows.reduce((total, row) => total + BigInt(row.amount), 0n);

export async function createParticipantDataGrants(
  rawBookingId: unknown,
  actorUserId: string,
  origin: string,
  rawParticipantId?: unknown,
) {
  const bookingReference = bookingReferenceValue(rawBookingId);
  const participantId =
    rawParticipantId == null || rawParticipantId === ''
      ? null
      : bookingIdValue(rawParticipantId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: booking.id,
        number: booking.publicNumber,
        state: booking.state,
        minimumDp: invoice.minimumDp,
        startAt: departure.startAt,
        tripName: trip.name,
      })
      .from(booking)
      .innerJoin(invoice, eq(invoice.bookingId, booking.id))
      .innerJoin(departure, eq(departure.id, booking.departureId))
      .innerJoin(tripVersion, eq(tripVersion.id, booking.tripVersionId))
      .innerJoin(trip, eq(trip.id, tripVersion.tripId))
      .where(
        /^[0-9a-f-]{36}$/i.test(bookingReference)
          ? eq(booking.id, bookingReference)
          : eq(booking.publicNumber, bookingReference),
      )
      .limit(1);
    if (!order)
      throw new ParticipantSafetyInputError('Booking tidak ditemukan.');
    const bookingId = order.id;
    const payments = await tx
      .select({ amount: payment.amount })
      .from(payment)
      .where(
        and(eq(payment.bookingId, order.id), eq(payment.state, 'verified')),
      );
    if (
      verified(payments) < BigInt(order.minimumDp) ||
      order.state !== 'confirmed'
    ) {
      throw new ParticipantSafetyConflictError(
        'Tautan data peserta baru dapat diterbitkan setelah down payment minimum diverifikasi.',
      );
    }
    const expiresAt = new Date(
      Math.min(
        order.startAt.getTime() - 60 * 60 * 1000,
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ),
    );
    if (expiresAt <= new Date()) {
      throw new ParticipantSafetyConflictError(
        'Keberangkatan sudah terlalu dekat untuk pengumpulan data peserta.',
      );
    }
    const people = await tx
      .select({
        id: bookingParticipant.id,
        fullName: bookingParticipant.fullName,
      })
      .from(bookingParticipant)
      .where(eq(bookingParticipant.bookingId, bookingId));
    if (!people.length) {
      throw new ParticipantSafetyInputError('Roster peserta belum tersedia.');
    }
    const selectedPeople = participantId
      ? people.filter((person) => person.id === participantId)
      : people;
    if (!selectedPeople.length)
      throw new ParticipantSafetyInputError(
        'Peserta tidak ditemukan pada booking ini.',
      );
    await tx
      .update(participantDataGrant)
      .set({ revokedAt: new Date() })
      .where(
        and(
          isNull(participantDataGrant.revokedAt),
          inArray(
            participantDataGrant.bookingParticipantId,
            selectedPeople.map((person) => person.id),
          ),
        ),
      );
    const links = [] as Array<{
      participantId: string;
      fullName: string;
      url: string;
    }>;
    for (const person of selectedPeople) {
      const token = createParticipantDataToken();
      await tx.insert(participantDataGrant).values({
        bookingParticipantId: person.id,
        tokenHash: token.hash,
        expiresAt,
        sentAt: new Date(),
        createdByUserId: actorUserId,
      });
      links.push({
        participantId: person.id,
        fullName: person.fullName,
        url: `${origin}/data-peserta/${token.value}`,
      });
    }
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking',
      entityId: bookingId,
      action: 'participant_data_links_issued',
      payload: {
        count: links.length,
        participantId,
        expiresAt: expiresAt.toISOString(),
      },
    });
    return { number: order.number, tripName: order.tripName, expiresAt, links };
  });
}

export async function getParticipantDataAccess(rawToken: unknown) {
  const token = tokenValue(rawToken);
  const db = getDb();
  const [result] = await db
    .select({
      grantId: participantDataGrant.id,
      participantId: bookingParticipant.id,
      fullName: bookingParticipant.fullName,
      position: bookingParticipant.position,
      bookingNumber: booking.publicNumber,
      tripName: trip.name,
      startAt: departure.startAt,
      safetyStatus: participantSafetyData.status,
      addressCiphertext: participantSafetyData.addressCiphertext,
      whatsappCiphertext: participantSafetyData.whatsappCiphertext,
      emergencyNameCiphertext: participantSafetyData.emergencyNameCiphertext,
      emergencyRelationshipCiphertext:
        participantSafetyData.emergencyRelationshipCiphertext,
      emergencyWhatsAppCiphertext:
        participantSafetyData.emergencyWhatsAppCiphertext,
      identityType: participantSafetyData.identityType,
      identityCiphertext: participantSafetyData.identityCiphertext,
      hasDocument: participantSafetyData.documentObjectKey,
      reviewNote: participantSafetyData.reviewNote,
      draftCiphertext: participantDataGrant.draftCiphertext,
      draftSavedAt: participantDataGrant.draftSavedAt,
      completedAt: participantDataGrant.completedAt,
    })
    .from(participantDataGrant)
    .innerJoin(
      bookingParticipant,
      eq(bookingParticipant.id, participantDataGrant.bookingParticipantId),
    )
    .innerJoin(booking, eq(booking.id, bookingParticipant.bookingId))
    .innerJoin(departure, eq(departure.id, booking.departureId))
    .innerJoin(tripVersion, eq(tripVersion.id, booking.tripVersionId))
    .innerJoin(trip, eq(trip.id, tripVersion.tripId))
    .leftJoin(
      participantSafetyData,
      eq(participantSafetyData.bookingParticipantId, bookingParticipant.id),
    )
    .where(
      and(
        eq(
          participantDataGrant.tokenHash,
          hashSecret(token, 'participant-data'),
        ),
        isNull(participantDataGrant.revokedAt),
        gt(participantDataGrant.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!result) return null;
  const saved = result.addressCiphertext
    ? {
        fullName: result.fullName,
        address: decryptIdentity(result.addressCiphertext),
        participantWhatsApp: result.whatsappCiphertext
          ? decryptIdentity(result.whatsappCiphertext)
          : '',
        emergencyName: result.emergencyNameCiphertext
          ? decryptIdentity(result.emergencyNameCiphertext)
          : '',
        emergencyRelationship: result.emergencyRelationshipCiphertext
          ? decryptIdentity(result.emergencyRelationshipCiphertext)
          : '',
        emergencyWhatsApp: result.emergencyWhatsAppCiphertext
          ? decryptIdentity(result.emergencyWhatsAppCiphertext)
          : '',
        identityType: result.identityType ?? '',
        identityNumber: result.identityCiphertext
          ? decryptIdentity(result.identityCiphertext)
          : '',
      }
    : null;
  let draft: Record<string, string> | null = null;
  if (result.draftCiphertext) {
    try {
      const parsed = JSON.parse(decryptIdentity(result.draftCiphertext));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        draft = parsed as Record<string, string>;
    } catch {
      draft = null;
    }
  }
  return {
    ...result,
    formValues: draft ?? saved,
    hasDocument: Boolean(result.hasDocument),
  };
}

export async function createBookingParticipantDataGrant(
  rawBookingId: unknown,
  actorUserId: string,
  origin: string,
) {
  const bookingReference = bookingReferenceValue(rawBookingId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: booking.id,
        number: booking.publicNumber,
        state: booking.state,
        minimumDp: invoice.minimumDp,
        startAt: departure.startAt,
        tripName: trip.name,
      })
      .from(booking)
      .innerJoin(invoice, eq(invoice.bookingId, booking.id))
      .innerJoin(departure, eq(departure.id, booking.departureId))
      .innerJoin(tripVersion, eq(tripVersion.id, booking.tripVersionId))
      .innerJoin(trip, eq(trip.id, tripVersion.tripId))
      .where(
        /^[0-9a-f-]{36}$/i.test(bookingReference)
          ? eq(booking.id, bookingReference)
          : eq(booking.publicNumber, bookingReference),
      )
      .limit(1);
    if (!order)
      throw new ParticipantSafetyInputError('Booking tidak ditemukan.');
    const bookingId = order.id;
    const payments = await tx
      .select({ amount: payment.amount })
      .from(payment)
      .where(
        and(eq(payment.bookingId, order.id), eq(payment.state, 'verified')),
      );
    if (
      order.state !== 'confirmed' ||
      verified(payments) < BigInt(order.minimumDp)
    )
      throw new ParticipantSafetyConflictError(
        'Tautan PIC hanya dapat diterbitkan setelah down payment terverifikasi.',
      );
    const expiresAt = new Date(
      Math.min(
        order.startAt.getTime() - 60 * 60 * 1000,
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ),
    );
    if (expiresAt <= new Date())
      throw new ParticipantSafetyConflictError(
        'Keberangkatan sudah terlalu dekat untuk pengumpulan data peserta.',
      );
    const token = createParticipantDataToken();
    const issuedAt = new Date();
    // booking_id memang unik: tautan PIC diterbitkan ulang dengan merotasi
    // token pada grant yang sama. Selain menghindari benturan unique key,
    // ID grant tetap stabil sehingga draf peserta yang merujuk kepadanya
    // tidak ikut terhapus.
    await tx
      .insert(bookingParticipantDataGrant)
      .values({
        bookingId,
        tokenHash: token.hash,
        expiresAt,
        sentAt: issuedAt,
        createdByUserId: actorUserId,
      })
      .onConflictDoUpdate({
        target: bookingParticipantDataGrant.bookingId,
        set: {
          tokenHash: token.hash,
          expiresAt,
          sentAt: issuedAt,
          revokedAt: null,
          createdByUserId: actorUserId,
        },
      });
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking',
      entityId: bookingId,
      action: 'booking_participant_data_link_issued',
      payload: { expiresAt: expiresAt.toISOString() },
    });
    return {
      number: order.number,
      tripName: order.tripName,
      expiresAt,
      url: `${origin}/data-peserta/booking/${token.value}`,
    };
  });
}

export async function getBookingParticipantDataAccess(rawToken: unknown) {
  const token = tokenValue(rawToken);
  const db = getDb();
  const [grant] = await db
    .select({
      grantId: bookingParticipantDataGrant.id,
      bookingId: booking.id,
      bookingNumber: booking.publicNumber,
      tripName: trip.name,
      startAt: departure.startAt,
      expiresAt: bookingParticipantDataGrant.expiresAt,
    })
    .from(bookingParticipantDataGrant)
    .innerJoin(booking, eq(booking.id, bookingParticipantDataGrant.bookingId))
    .innerJoin(departure, eq(departure.id, booking.departureId))
    .innerJoin(tripVersion, eq(tripVersion.id, booking.tripVersionId))
    .innerJoin(trip, eq(trip.id, tripVersion.tripId))
    .where(
      and(
        eq(
          bookingParticipantDataGrant.tokenHash,
          hashSecret(token, 'participant-data'),
        ),
        isNull(bookingParticipantDataGrant.revokedAt),
        gt(bookingParticipantDataGrant.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!grant)
    throw new ParticipantSafetyConflictError('Tautan PIC sudah tidak berlaku.');
  const people = await db
    .select({
      participantId: bookingParticipant.id,
      position: bookingParticipant.position,
      fullName: bookingParticipant.fullName,
      isPic: bookingParticipant.isPic,
      safetyId: participantSafetyData.id,
      status: participantSafetyData.status,
      reviewedAt: participantSafetyData.reviewedAt,
    })
    .from(bookingParticipant)
    .leftJoin(
      participantSafetyData,
      eq(participantSafetyData.bookingParticipantId, bookingParticipant.id),
    )
    .where(eq(bookingParticipant.bookingId, grant.bookingId))
    .orderBy(asc(bookingParticipant.position));
  return {
    ...grant,
    people,
    completed: people.filter((person) => person.safetyId).length,
  };
}

export async function getBookingParticipantDataForm(
  rawToken: unknown,
  rawParticipantId: unknown,
) {
  const token = tokenValue(rawToken);
  const participantId = bookingIdValue(rawParticipantId);
  const db = getDb();
  const [result] = await db
    .select({
      grantId: bookingParticipantDataGrant.id,
      participantId: bookingParticipant.id,
      fullName: bookingParticipant.fullName,
      position: bookingParticipant.position,
      isPic: bookingParticipant.isPic,
      safetyStatus: participantSafetyData.status,
      addressCiphertext: participantSafetyData.addressCiphertext,
      whatsappCiphertext: participantSafetyData.whatsappCiphertext,
      emergencyNameCiphertext: participantSafetyData.emergencyNameCiphertext,
      emergencyRelationshipCiphertext:
        participantSafetyData.emergencyRelationshipCiphertext,
      emergencyWhatsAppCiphertext:
        participantSafetyData.emergencyWhatsAppCiphertext,
      identityType: participantSafetyData.identityType,
      identityCiphertext: participantSafetyData.identityCiphertext,
      hasDocument: participantSafetyData.documentObjectKey,
      reviewNote: participantSafetyData.reviewNote,
      draftCiphertext: bookingParticipantDataDraft.draftCiphertext,
      draftSavedAt: bookingParticipantDataDraft.savedAt,
    })
    .from(bookingParticipantDataGrant)
    .innerJoin(
      bookingParticipant,
      eq(bookingParticipant.bookingId, bookingParticipantDataGrant.bookingId),
    )
    .leftJoin(
      participantSafetyData,
      eq(participantSafetyData.bookingParticipantId, bookingParticipant.id),
    )
    .leftJoin(
      bookingParticipantDataDraft,
      and(
        eq(
          bookingParticipantDataDraft.bookingParticipantId,
          bookingParticipant.id,
        ),
        eq(
          bookingParticipantDataDraft.bookingGrantId,
          bookingParticipantDataGrant.id,
        ),
      ),
    )
    .where(
      and(
        eq(
          bookingParticipantDataGrant.tokenHash,
          hashSecret(token, 'participant-data'),
        ),
        eq(bookingParticipant.id, participantId),
        isNull(bookingParticipantDataGrant.revokedAt),
        gt(bookingParticipantDataGrant.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!result)
    throw new ParticipantSafetyConflictError(
      'Peserta tidak termasuk dalam booking ini.',
    );

  const saved = result.addressCiphertext
    ? {
        fullName: result.fullName,
        address: decryptIdentity(result.addressCiphertext),
        participantWhatsApp: result.whatsappCiphertext
          ? decryptIdentity(result.whatsappCiphertext)
          : '',
        emergencyName: result.emergencyNameCiphertext
          ? decryptIdentity(result.emergencyNameCiphertext)
          : '',
        emergencyRelationship: result.emergencyRelationshipCiphertext
          ? decryptIdentity(result.emergencyRelationshipCiphertext)
          : '',
        emergencyWhatsApp: result.emergencyWhatsAppCiphertext
          ? decryptIdentity(result.emergencyWhatsAppCiphertext)
          : '',
        identityType: result.identityType ?? '',
        identityNumber: result.identityCiphertext
          ? decryptIdentity(result.identityCiphertext)
          : '',
      }
    : null;
  let draft: Record<string, string> | null = null;
  if (result.draftCiphertext) {
    try {
      const parsed = JSON.parse(decryptIdentity(result.draftCiphertext));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        draft = parsed as Record<string, string>;
    } catch {
      draft = null;
    }
  }
  return {
    ...result,
    formValues: draft ?? saved,
    hasDocument: Boolean(result.hasDocument),
  };
}

export async function saveBookingParticipantSafetyDraft(
  rawToken: unknown,
  rawParticipantId: unknown,
  input: unknown,
) {
  const token = tokenValue(rawToken);
  const participantId = bookingIdValue(rawParticipantId);
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ParticipantSafetyInputError('Draf peserta tidak valid.');
  const values = input as Record<string, unknown>;
  const limits: Record<string, number> = {
    fullName: 120,
    address: 1_000,
    participantWhatsApp: 20,
    emergencyName: 120,
    emergencyRelationship: 80,
    emergencyWhatsApp: 20,
    identityType: 30,
    identityNumber: 40,
  };
  const draft: Record<string, string> = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = typeof values[field] === 'string' ? values[field].trim() : '';
    if (value.length > limit)
      throw new ParticipantSafetyInputError(
        'Salah satu isian draf terlalu panjang.',
      );
    draft[field] = value;
  }

  const db = getDb();
  const [grant] = await db
    .select({ id: bookingParticipantDataGrant.id })
    .from(bookingParticipantDataGrant)
    .innerJoin(
      bookingParticipant,
      eq(bookingParticipant.bookingId, bookingParticipantDataGrant.bookingId),
    )
    .where(
      and(
        eq(
          bookingParticipantDataGrant.tokenHash,
          hashSecret(token, 'participant-data'),
        ),
        eq(bookingParticipant.id, participantId),
        isNull(bookingParticipantDataGrant.revokedAt),
        gt(bookingParticipantDataGrant.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!grant)
    throw new ParticipantSafetyConflictError('Tautan PIC sudah tidak berlaku.');

  const savedAt = new Date();
  await db
    .insert(bookingParticipantDataDraft)
    .values({
      bookingGrantId: grant.id,
      bookingParticipantId: participantId,
      draftCiphertext: encryptIdentity(JSON.stringify(draft)),
      savedAt,
    })
    .onConflictDoUpdate({
      target: bookingParticipantDataDraft.bookingParticipantId,
      set: {
        bookingGrantId: grant.id,
        draftCiphertext: encryptIdentity(JSON.stringify(draft)),
        savedAt,
      },
    });
  return { saved: true, savedAt };
}

export async function saveBookingParticipantSafetyData(
  rawToken: unknown,
  rawParticipantId: unknown,
  input: unknown,
) {
  const token = tokenValue(rawToken);
  const participantId = bookingIdValue(rawParticipantId);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ParticipantSafetyInputError('Data peserta tidak valid.');
  }
  const values = input as Record<string, unknown>;
  const fullName = compact(values.fullName, 'Nama lengkap', 3, 120);
  const address = compact(values.address, 'Alamat', 8, 1_000);
  const participantWhatsApp = phone(
    values.participantWhatsApp,
    'Nomor WhatsApp peserta',
    false,
  );
  const emergencyName = compact(
    values.emergencyName,
    'Nama kontak darurat',
    3,
    120,
  );
  const emergencyRelationship = compact(
    values.emergencyRelationship,
    'Hubungan kontak darurat',
    3,
    80,
  );
  const emergencyWhatsApp = phone(
    values.emergencyWhatsApp,
    'Nomor WhatsApp darurat',
    true,
  );
  const identityType = String(values.identityType ?? 'ktp');
  if (!documentTypes.includes(identityType as DocumentType)) {
    throw new ParticipantSafetyInputError('Jenis dokumen tidak valid.');
  }
  const identityNumber = compact(
    values.identityNumber,
    'Nomor dokumen',
    4,
    40,
  ).replace(/\s+/g, '');
  const incomingDocumentObjectKey = values.documentObjectKey;
  if (
    incomingDocumentObjectKey != null &&
    incomingDocumentObjectKey !== '' &&
    !isParticipantDocumentObjectKey(incomingDocumentObjectKey)
  )
    throw new ParticipantSafetyInputError('Berkas foto identitas tidak valid.');
  if (values.consent !== true) {
    throw new ParticipantSafetyInputError(
      'Persetujuan penggunaan data untuk keselamatan wajib dicentang.',
    );
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    const [grant] = await tx
      .select({
        id: bookingParticipantDataGrant.id,
        existingDocumentObjectKey: participantSafetyData.documentObjectKey,
      })
      .from(bookingParticipantDataGrant)
      .innerJoin(
        bookingParticipant,
        eq(bookingParticipant.bookingId, bookingParticipantDataGrant.bookingId),
      )
      .leftJoin(
        participantSafetyData,
        eq(participantSafetyData.bookingParticipantId, bookingParticipant.id),
      )
      .where(
        and(
          eq(
            bookingParticipantDataGrant.tokenHash,
            hashSecret(token, 'participant-data'),
          ),
          eq(bookingParticipant.id, participantId),
          isNull(bookingParticipantDataGrant.revokedAt),
          gt(bookingParticipantDataGrant.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!grant)
      throw new ParticipantSafetyConflictError(
        'Tautan PIC sudah tidak berlaku.',
      );

    const documentObjectKey = isParticipantDocumentObjectKey(
      incomingDocumentObjectKey,
    )
      ? incomingDocumentObjectKey
      : grant.existingDocumentObjectKey;
    if (!isParticipantDocumentObjectKey(documentObjectKey))
      throw new ParticipantSafetyInputError(
        'Unggah foto identitas terlebih dahulu.',
      );

    try {
      await assertParticipantDocumentExists(documentObjectKey);
    } catch (error) {
      if (error instanceof UploadInputError)
        throw new ParticipantSafetyInputError(error.message);
      throw error;
    }

    const now = new Date();
    const data = {
      addressCiphertext: encryptIdentity(address),
      whatsappCiphertext: participantWhatsApp
        ? encryptIdentity(participantWhatsApp)
        : null,
      emergencyNameCiphertext: encryptIdentity(emergencyName),
      emergencyRelationshipCiphertext: encryptIdentity(emergencyRelationship),
      emergencyWhatsAppCiphertext: encryptIdentity(emergencyWhatsApp!),
      identityType,
      identityCiphertext: encryptIdentity(identityNumber),
      identityHash: identityHash(identityNumber),
      identityLast4: maskIdentity(identityNumber),
      documentObjectKey,
      documentContentType: documentObjectKey.endsWith('.png')
        ? 'image/png'
        : documentObjectKey.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg',
      status: 'complete' as const,
      consentAt: now,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
      updatedAt: now,
    };
    await tx
      .insert(participantSafetyData)
      .values({ bookingParticipantId: participantId, ...data })
      .onConflictDoUpdate({
        target: participantSafetyData.bookingParticipantId,
        set: data,
      });
    await tx
      .update(bookingParticipant)
      .set({
        fullName,
        identityType,
        identityCiphertext: data.identityCiphertext,
        identityHash: data.identityHash,
        identityLast4: data.identityLast4,
      })
      .where(eq(bookingParticipant.id, participantId));
    await tx
      .delete(bookingParticipantDataDraft)
      .where(
        eq(bookingParticipantDataDraft.bookingParticipantId, participantId),
      );
    return { saved: true };
  });
}

export async function saveParticipantSafetyDraft(
  rawToken: unknown,
  input: unknown,
) {
  const token = tokenValue(rawToken);
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ParticipantSafetyInputError('Draf peserta tidak valid.');
  const values = input as Record<string, unknown>;
  const limits: Record<string, number> = {
    fullName: 120,
    address: 1_000,
    participantWhatsApp: 20,
    emergencyName: 120,
    emergencyRelationship: 80,
    emergencyWhatsApp: 20,
    identityType: 30,
    identityNumber: 40,
  };
  const draft: Record<string, string> = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = typeof values[field] === 'string' ? values[field].trim() : '';
    if (value.length > limit)
      throw new ParticipantSafetyInputError(
        'Salah satu isian draf terlalu panjang.',
      );
    draft[field] = value;
  }
  const db = getDb();
  const [saved] = await db
    .update(participantDataGrant)
    .set({
      draftCiphertext: encryptIdentity(JSON.stringify(draft)),
      draftSavedAt: new Date(),
    })
    .where(
      and(
        eq(
          participantDataGrant.tokenHash,
          hashSecret(token, 'participant-data'),
        ),
        isNull(participantDataGrant.revokedAt),
        gt(participantDataGrant.expiresAt, new Date()),
      ),
    )
    .returning({ savedAt: participantDataGrant.draftSavedAt });
  if (!saved)
    throw new ParticipantSafetyConflictError(
      'Tautan data peserta sudah tidak berlaku.',
    );
  return { saved: true, savedAt: saved.savedAt };
}

export async function saveParticipantSafetyData(
  rawToken: unknown,
  input: unknown,
) {
  const token = tokenValue(rawToken);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ParticipantSafetyInputError('Data peserta tidak valid.');
  }
  const values = input as Record<string, unknown>;
  const fullName = compact(values.fullName, 'Nama lengkap', 3, 120);
  const address = compact(values.address, 'Alamat', 8, 1_000);
  const participantWhatsApp = phone(
    values.participantWhatsApp,
    'Nomor WhatsApp peserta',
    false,
  );
  const emergencyName = compact(
    values.emergencyName,
    'Nama kontak darurat',
    3,
    120,
  );
  const emergencyRelationship = compact(
    values.emergencyRelationship,
    'Hubungan kontak darurat',
    2,
    80,
  );
  const emergencyWhatsApp = phone(
    values.emergencyWhatsApp,
    'Nomor kontak darurat',
  );
  const identityType = compact(
    values.identityType,
    'Jenis dokumen',
    2,
    30,
  ) as DocumentType;
  if (!documentTypes.includes(identityType)) {
    throw new ParticipantSafetyInputError('Jenis dokumen tidak valid.');
  }
  const identityNumber = compact(
    values.identityNumber,
    'Nomor dokumen',
    4,
    40,
  ).replace(/\s+/g, '');
  const incomingDocumentObjectKey = values.documentObjectKey;
  if (
    incomingDocumentObjectKey != null &&
    incomingDocumentObjectKey !== '' &&
    !isParticipantDocumentObjectKey(incomingDocumentObjectKey)
  )
    throw new ParticipantSafetyInputError('Berkas foto identitas tidak valid.');
  if (values.consent !== true) {
    throw new ParticipantSafetyInputError(
      'Persetujuan penggunaan data untuk keselamatan wajib dicentang.',
    );
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    const [grant] = await tx
      .select({
        id: participantDataGrant.id,
        participantId: bookingParticipant.id,
        existingDocumentObjectKey: participantSafetyData.documentObjectKey,
      })
      .from(participantDataGrant)
      .innerJoin(
        bookingParticipant,
        eq(bookingParticipant.id, participantDataGrant.bookingParticipantId),
      )
      .leftJoin(
        participantSafetyData,
        eq(participantSafetyData.bookingParticipantId, bookingParticipant.id),
      )
      .where(
        and(
          eq(
            participantDataGrant.tokenHash,
            hashSecret(token, 'participant-data'),
          ),
          isNull(participantDataGrant.revokedAt),
          gt(participantDataGrant.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!grant) {
      throw new ParticipantSafetyConflictError(
        'Tautan data peserta sudah tidak berlaku.',
      );
    }
    const documentObjectKey = isParticipantDocumentObjectKey(
      incomingDocumentObjectKey,
    )
      ? incomingDocumentObjectKey
      : grant.existingDocumentObjectKey;
    if (!isParticipantDocumentObjectKey(documentObjectKey))
      throw new ParticipantSafetyInputError(
        'Unggah foto identitas terlebih dahulu.',
      );
    try {
      await assertParticipantDocumentExists(documentObjectKey);
    } catch (error) {
      if (error instanceof UploadInputError)
        throw new ParticipantSafetyInputError(error.message);
      throw error;
    }
    const now = new Date();
    const data = {
      addressCiphertext: encryptIdentity(address),
      whatsappCiphertext: participantWhatsApp
        ? encryptIdentity(participantWhatsApp)
        : null,
      emergencyNameCiphertext: encryptIdentity(emergencyName),
      emergencyRelationshipCiphertext: encryptIdentity(emergencyRelationship),
      emergencyWhatsAppCiphertext: encryptIdentity(emergencyWhatsApp!),
      identityType,
      identityCiphertext: encryptIdentity(identityNumber),
      identityHash: identityHash(identityNumber),
      identityLast4: maskIdentity(identityNumber),
      documentObjectKey,
      documentContentType: documentObjectKey.endsWith('.png')
        ? 'image/png'
        : documentObjectKey.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg',
      status: 'complete' as const,
      consentAt: now,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
      updatedAt: now,
    };
    await tx
      .insert(participantSafetyData)
      .values({ bookingParticipantId: grant.participantId, ...data })
      .onConflictDoUpdate({
        target: participantSafetyData.bookingParticipantId,
        set: data,
      });
    await tx
      .update(bookingParticipant)
      .set({
        fullName,
        identityType,
        identityCiphertext: data.identityCiphertext,
        identityHash: data.identityHash,
        identityLast4: data.identityLast4,
      })
      .where(eq(bookingParticipant.id, grant.participantId));
    await tx
      .update(participantDataGrant)
      .set({
        completedAt: now,
        draftCiphertext: null,
        draftSavedAt: null,
      })
      .where(eq(participantDataGrant.id, grant.id));
    return { saved: true };
  });
}
