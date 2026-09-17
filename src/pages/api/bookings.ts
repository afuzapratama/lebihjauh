import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingConfigurationError,
  BookingOriginError,
  getGuestScope,
  invoiceAccessCookie,
} from '../../lib/booking-security';
import {
  BookingConflictError,
  BookingInputError,
  createBooking,
  parseBookingInput,
} from '../../lib/booking-service';

export const prerender = false;

const json = (body: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const idempotencyKey = request.headers.get('Idempotency-Key') ?? '';
    const input = parseBookingInput(await request.json());
    const guest = getGuestScope(request);
    const result = await createBooking(guest.hash, idempotencyKey, input);
    const cookies = [
      guest.setCookie,
      result.invoiceToken
        ? invoiceAccessCookie(result.invoiceToken)
        : undefined,
    ].filter((value): value is string => Boolean(value));
    return json(
      {
        number: result.number,
        invoicePath: `/invoice/${result.number}`,
        reused: result.reused,
      },
      result.reused ? 200 : 201,
      cookies,
    );
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
    console.error('Gagal membuat booking', error);
    return json({ message: 'Booking belum dapat disimpan. Coba lagi.' }, 500);
  }
};
