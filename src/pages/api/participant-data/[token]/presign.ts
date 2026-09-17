import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
} from '../../../../lib/booking-security';
import {
  getParticipantDataAccess,
  ParticipantSafetyInputError,
} from '../../../../lib/participant-safety';
import {
  createParticipantDocumentUpload,
  R2ConfigurationError,
  UploadInputError,
} from '../../../../lib/r2';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    const access = await getParticipantDataAccess(params.token);
    if (!access)
      return json({ message: 'Tautan data peserta sudah tidak berlaku.' }, 403);
    const input = await request.json();
    return json({ upload: await createParticipantDocumentUpload(input) }, 201);
  } catch (error) {
    if (
      error instanceof ParticipantSafetyInputError ||
      error instanceof UploadInputError
    ) {
      return json({ message: error.message }, 422);
    }
    if (error instanceof BookingOriginError)
      return json({ message: error.message }, 403);
    if (error instanceof R2ConfigurationError)
      return json({ message: error.message }, 503);
    console.error('Gagal menyiapkan unggahan dokumen peserta', error);
    return json({ message: 'Dokumen belum dapat diunggah.' }, 500);
  }
};
