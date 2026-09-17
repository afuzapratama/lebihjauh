import type { APIRoute } from 'astro';
import {
  createBookingParticipantDataGrant,
  createParticipantDataGrants,
  ParticipantSafetyConflictError,
  ParticipantSafetyInputError,
} from '../../../../../lib/participant-safety';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    if (!locals.user?.id) {
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    }
    const input = await request.json().catch(() => ({}));
    const participantId =
      input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>).participantId
        : null;
    if (input && typeof input === 'object' && input.bookingLevel === true) {
      const grant = await createBookingParticipantDataGrant(
        params.id,
        locals.user.id,
        new URL(request.url).origin,
      );
      return json(
        {
          mode: 'booking',
          link: {
            ...grant,
            kind: 'booking',
            fullName: 'PIC rombongan',
          },
          grant,
        },
        201,
      );
    }
    const result = await createParticipantDataGrants(
      params.id,
      locals.user.id,
      new URL(request.url).origin,
      participantId,
    );
    const selectedLink = participantId
      ? result.links.find((link) => link.participantId === participantId)
      : undefined;
    return json(
      {
        mode: participantId ? 'participant' : 'participants',
        link: selectedLink
          ? { ...selectedLink, kind: 'participant' }
          : undefined,
        grants: result,
      },
      201,
    );
  } catch (error) {
    if (error instanceof ParticipantSafetyInputError)
      return json({ message: error.message }, 422);
    if (error instanceof ParticipantSafetyConflictError)
      return json({ message: error.message }, 409);
    console.error('Gagal menerbitkan tautan data peserta', error);
    return json({ message: 'Tautan data peserta belum dapat dibuat.' }, 500);
  }
};
