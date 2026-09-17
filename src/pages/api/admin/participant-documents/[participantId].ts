import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../../db/client';
import { adminAuditLog, participantSafetyData } from '../../../../db/schema';
import { createParticipantDocumentReadUrl } from '../../../../lib/r2';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const actorUserId = locals.user?.id;
  const participantId = params.participantId ?? '';
  if (!actorUserId || !/^[0-9a-f-]{36}$/i.test(participantId)) {
    return new Response('Dokumen tidak ditemukan.', { status: 404 });
  }
  const db = getDb();
  const [document] = await db
    .select({ objectKey: participantSafetyData.documentObjectKey })
    .from(participantSafetyData)
    .where(eq(participantSafetyData.bookingParticipantId, participantId))
    .limit(1);
  if (!document)
    return new Response('Dokumen tidak ditemukan.', { status: 404 });
  try {
    const url = await createParticipantDocumentReadUrl(document.objectKey);
    await db.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking_participant',
      entityId: participantId,
      action: 'participant_identity_document_opened',
      payload: {},
    });
    return Response.redirect(url, 302);
  } catch (error) {
    console.error('Gagal membuka dokumen peserta', error);
    return new Response('Dokumen belum dapat dibuka.', { status: 503 });
  }
};
