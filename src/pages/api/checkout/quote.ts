import type { APIRoute } from 'astro';
import {
  assertBookingConfiguration,
  assertSameOrigin,
  BookingConfigurationError,
  BookingOriginError,
  getGuestScope,
} from '../../../lib/booking-security';
import {
  BookingConflictError,
  BookingInputError,
  createCheckoutQuote,
} from '../../../lib/booking-service';

export const prerender = false;

const json = (body: unknown, status = 200, setCookie?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
    },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    assertBookingConfiguration();
    const body = await request.json();
    const departureId =
      typeof body?.departureId === 'string' ? body.departureId : '';
    const pickupOptionId =
      typeof body?.pickupOptionId === 'string' ? body.pickupOptionId : '';
    const pax = typeof body?.pax === 'number' ? body.pax : Number(body?.pax);
    const guest = getGuestScope(request);
    const quote = await createCheckoutQuote(
      guest.hash,
      departureId,
      pax,
      pickupOptionId,
    );
    return json({ quote }, 201, guest.setCookie);
  } catch (error) {
    if (error instanceof BookingInputError)
      return json({ message: error.message }, 422);
    if (error instanceof BookingConflictError)
      return json({ message: error.message }, 409);
    if (error instanceof BookingConfigurationError)
      return json(
        { message: 'Konfigurasi booking di server belum lengkap.' },
        503,
      );
    if (error instanceof BookingOriginError)
      return json({ message: error.message }, 403);
    console.error('Gagal membuat quote booking', error);
    return json({ message: 'Ringkasan booking belum dapat dibuat.' }, 500);
  }
};
