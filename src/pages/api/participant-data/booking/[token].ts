import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
} from '../../../../lib/booking-security';
import {
  getBookingParticipantDataForm,
  ParticipantSafetyConflictError,
  ParticipantSafetyInputError,
  saveBookingParticipantSafetyData,
  saveBookingParticipantSafetyDraft,
} from '../../../../lib/participant-safety';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const participantId = url.searchParams.get('participantId');
    if (!participantId) return json({ message: 'Peserta belum dipilih.' }, 422);
    return json({
      participant: await getBookingParticipantDataForm(
        params.token,
        participantId,
      ),
    });
  } catch (error) {
    if (error instanceof ParticipantSafetyInputError) {
      const current = error as ParticipantSafetyInputError;
      return json({ message: current.message }, 422);
    }
    if (error instanceof ParticipantSafetyConflictError) {
      const current = error as ParticipantSafetyConflictError;
      return json({ message: current.message }, 403);
    }
    console.error('Gagal memuat data peserta booking', error);
    return json({ message: 'Data peserta belum dapat dimuat.' }, 500);
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return json({ message: 'Permintaan tidak valid.' }, 422);
    const { participantId, ...values } = body as Record<string, unknown>;
    return json({
      result: await saveBookingParticipantSafetyData(
        params.token,
        participantId,
        values,
      ),
    });
  } catch (error) {
    if (error instanceof ParticipantSafetyInputError) {
      const current = error as ParticipantSafetyInputError;
      return json({ message: current.message }, 422);
    }
    if (
      error instanceof ParticipantSafetyConflictError ||
      error instanceof BookingOriginError
    ) {
      const current = error as Error;
      return json({ message: current.message }, 403);
    }
    console.error('Gagal menyimpan data peserta booking', error);
    return json({ message: 'Data peserta belum dapat disimpan.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return json({ message: 'Permintaan tidak valid.' }, 422);
    const { participantId, ...values } = body as Record<string, unknown>;
    return json({
      result: await saveBookingParticipantSafetyDraft(
        params.token,
        participantId,
        values,
      ),
    });
  } catch (error) {
    if (error instanceof ParticipantSafetyInputError) {
      const current = error as ParticipantSafetyInputError;
      return json({ message: current.message }, 422);
    }
    if (
      error instanceof ParticipantSafetyConflictError ||
      error instanceof BookingOriginError
    ) {
      const current = error as Error;
      return json({ message: current.message }, 403);
    }
    console.error('Gagal menyimpan draf peserta booking', error);
    return json({ message: 'Draf peserta belum dapat disimpan.' }, 500);
  }
};
