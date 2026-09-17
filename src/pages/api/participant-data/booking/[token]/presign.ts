import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
} from '../../../../../lib/booking-security';
import {
  getBookingParticipantDataForm,
  ParticipantSafetyConflictError,
  ParticipantSafetyInputError,
} from '../../../../../lib/participant-safety';
import {
  createParticipantDocumentUpload,
  R2ConfigurationError,
  UploadInputError,
} from '../../../../../lib/r2';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    const input = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return json({ message: 'Permintaan unggah tidak valid.' }, 422);
    const { participantId } = input as Record<string, unknown>;
    await getBookingParticipantDataForm(params.token, participantId);
    return json({ upload: await createParticipantDocumentUpload(input) }, 201);
  } catch (error) {
    if (
      error instanceof ParticipantSafetyInputError ||
      error instanceof UploadInputError
    )
      return json({ message: error.message }, 422);
    if (
      error instanceof ParticipantSafetyConflictError ||
      error instanceof BookingOriginError
    )
      return json({ message: error.message }, 403);
    if (error instanceof R2ConfigurationError)
      return json({ message: error.message }, 503);
    console.error('Gagal menyiapkan unggahan dokumen booking', error);
    return json({ message: 'Dokumen belum dapat diunggah.' }, 500);
  }
};
