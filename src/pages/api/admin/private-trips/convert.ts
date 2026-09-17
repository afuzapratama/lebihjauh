import type { APIRoute } from 'astro';
import {
  convertPrivateOfferToBooking,
  PrivateTripConflictError,
  PrivateTripInputError,
} from '../../../../lib/private-trip-service';
import { toPayload, InputError } from '../../../../lib/trip-admin';

export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const actor = locals.user?.id;
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const values = await toPayload(request);
    const offerId =
      typeof values.offerId === 'string' &&
      /^[0-9a-f-]{36}$/i.test(values.offerId)
        ? values.offerId
        : '';
    if (!offerId)
      throw new PrivateTripInputError('Penawaran private trip tidak valid.');
    const result = await convertPrivateOfferToBooking(offerId, values, actor);
    return json(
      {
        booking: {
          id: result.bookingId,
          number: result.number,
          invoicePath: `/invoice/${result.number}#access=${encodeURIComponent(result.invoiceToken)}`,
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof PrivateTripInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof PrivateTripConflictError)
      return json({ message: error.message }, 409);
    console.error('Gagal mengonversi private trip', error);
    return json({ message: 'Booking private trip belum dapat dibuat.' }, 500);
  }
};
