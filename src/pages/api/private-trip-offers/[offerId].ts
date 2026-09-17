import type { APIRoute } from 'astro';
import {
  PrivateTripConflictError,
  PrivateTripInputError,
  getPublicPrivateOffer,
  respondToPrivateOffer,
} from '../../../lib/private-trip-service';
import {
  assertSameOrigin,
  BookingOriginError,
} from '../../../lib/booking-security';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ params }) => {
  const offerId = params.offerId ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(offerId))
    return json({ message: 'Penawaran tidak ditemukan.' }, 404);
  const found = await getPublicPrivateOffer(offerId);
  if (!found)
    return json(
      { message: 'Penawaran tidak ditemukan atau sudah tidak berlaku.' },
      404,
    );
  return json({
    offer: found.offer,
    request: {
      publicNumber: found.request.publicNumber,
      picName: found.request.picName,
    },
  });
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    assertSameOrigin(request);
    const offerId = params.offerId ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(offerId))
      throw new PrivateTripInputError('Penawaran tidak valid.');
    const body = await request.json();
    const state =
      body?.state === 'accepted' || body?.state === 'declined'
        ? body.state
        : '';
    if (!state)
      throw new PrivateTripInputError('Keputusan penawaran tidak valid.');
    return json(
      await respondToPrivateOffer(
        offerId,
        state,
        typeof body.note === 'string' ? body.note : '',
      ),
    );
  } catch (error) {
    if (
      error instanceof PrivateTripInputError ||
      error instanceof PrivateTripConflictError
    )
      return json(
        { message: error.message },
        error instanceof PrivateTripConflictError ? 409 : 422,
      );
    if (error instanceof BookingOriginError)
      return json({ message: error.message }, 403);
    return json({ message: 'Keputusan penawaran belum dapat disimpan.' }, 500);
  }
};
