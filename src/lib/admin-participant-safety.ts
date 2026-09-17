import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  adminAuditLog,
  bookingParticipant,
  participantSafetyData,
} from '../db/schema';
import { decryptIdentity } from './booking-security';

export class SafetyReviewInputError extends Error {}

const uuid = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new SafetyReviewInputError(`${label} tidak valid.`);
  }
  return value;
};

const decrypt = (value: string | null) =>
  value ? decryptIdentity(value) : null;

export async function getBookingParticipantSafety(bookingId: string) {
  const db = getDb();
  const rows = await db
    .select({
      participantId: bookingParticipant.id,
      position: bookingParticipant.position,
      fullName: bookingParticipant.fullName,
      isPic: bookingParticipant.isPic,
      checkedInAt: bookingParticipant.checkedInAt,
      safetyId: participantSafetyData.id,
      address: participantSafetyData.addressCiphertext,
      whatsapp: participantSafetyData.whatsappCiphertext,
      emergencyName: participantSafetyData.emergencyNameCiphertext,
      emergencyRelationship:
        participantSafetyData.emergencyRelationshipCiphertext,
      emergencyWhatsApp: participantSafetyData.emergencyWhatsAppCiphertext,
      identityType: participantSafetyData.identityType,
      identityNumber: participantSafetyData.identityCiphertext,
      identityLast4: participantSafetyData.identityLast4,
      documentObjectKey: participantSafetyData.documentObjectKey,
      status: participantSafetyData.status,
      reviewedAt: participantSafetyData.reviewedAt,
      reviewNote: participantSafetyData.reviewNote,
      updatedAt: participantSafetyData.updatedAt,
    })
    .from(bookingParticipant)
    .leftJoin(
      participantSafetyData,
      eq(participantSafetyData.bookingParticipantId, bookingParticipant.id),
    )
    .where(eq(bookingParticipant.bookingId, bookingId))
    .orderBy(asc(bookingParticipant.position));

  return rows.map((row) => ({
    ...row,
    address: decrypt(row.address),
    whatsapp: decrypt(row.whatsapp),
    emergencyName: decrypt(row.emergencyName),
    emergencyRelationship: decrypt(row.emergencyRelationship),
    emergencyWhatsApp: decrypt(row.emergencyWhatsApp),
    identityNumber: decrypt(row.identityNumber),
  }));
}

export async function reviewParticipantSafety(
  input: unknown,
  actorUserId: string,
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SafetyReviewInputError('Data pemeriksaan tidak valid.');
  }
  const values = input as Record<string, unknown>;
  const participantId = uuid(values.participantId, 'Peserta');
  const decision =
    values.decision === 'needs_revision'
      ? 'needs_revision'
      : values.decision === 'approve'
        ? 'approve'
        : null;
  if (!decision) throw new SafetyReviewInputError('Keputusan tidak valid.');
  const note =
    typeof values.note === 'string'
      ? values.note.trim().replace(/\s+/g, ' ')
      : '';
  if (note.length > 500)
    throw new SafetyReviewInputError('Catatan terlalu panjang.');
  if (decision === 'needs_revision' && note.length < 5) {
    throw new SafetyReviewInputError(
      'Alasan perbaikan wajib diisi minimal 5 karakter.',
    );
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: participantSafetyData.id })
      .from(participantSafetyData)
      .where(eq(participantSafetyData.bookingParticipantId, participantId))
      .limit(1);
    if (!existing) {
      throw new SafetyReviewInputError(
        'Data keselamatan peserta belum dikirim.',
      );
    }
    const now = new Date();
    const [updated] = await tx
      .update(participantSafetyData)
      .set({
        status: decision === 'approve' ? 'complete' : 'needs_revision',
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        reviewNote: note || null,
        updatedAt: now,
      })
      .where(eq(participantSafetyData.id, existing.id))
      .returning({
        status: participantSafetyData.status,
        reviewedAt: participantSafetyData.reviewedAt,
      });
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking_participant',
      entityId: participantId,
      action:
        decision === 'approve'
          ? 'participant_safety_approved'
          : 'participant_safety_revision_requested',
      payload: { note: note || null },
    });
    return updated;
  });
}
