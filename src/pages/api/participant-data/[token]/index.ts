import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
} from '../../../../lib/booking-security';
import {
  ParticipantSafetyConflictError,
  ParticipantSafetyInputError,
  saveParticipantSafetyDraft,
  saveParticipantSafetyData,
} from '../../../../lib/participant-safety';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    return json({
      result: await saveParticipantSafetyData(
        params.token,
        await request.json(),
      ),
    });
  } catch (error) {
    if (error instanceof ParticipantSafetyInputError)
      return json({ message: error.message }, 422);
    if (
      error instanceof ParticipantSafetyConflictError ||
      error instanceof BookingOriginError
    ) {
      return json({ message: error.message }, 403);
    }
    console.error('Gagal menyimpan data keselamatan peserta', error);
    return json({ message: 'Data belum dapat disimpan. Coba lagi.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    return json({
      result: await saveParticipantSafetyDraft(
        params.token,
        await request.json(),
      ),
    });
  } catch (error) {
    if (error instanceof ParticipantSafetyInputError)
      return json({ message: error.message }, 422);
    if (
      error instanceof ParticipantSafetyConflictError ||
      error instanceof BookingOriginError
    )
      return json({ message: error.message }, 403);
    console.error('Gagal menyimpan draf data peserta', error);
    return json({ message: 'Draf belum dapat disimpan.' }, 500);
  }
};
