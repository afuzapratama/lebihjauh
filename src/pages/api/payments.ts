import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
  getCookie,
  getGuestScope,
} from '../../lib/booking-security';
import {
  PaymentConflictError,
  PaymentInputError,
  submitPayment,
} from '../../lib/payment-service';

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
    const guest = getGuestScope(request);
    const submitted = await submitPayment(
      await request.json(),
      guest.hash,
      getCookie(request, 'lj_invoice_access'),
    );
    return json({ payment: submitted }, 201, guest.setCookie);
  } catch (error) {
    if (error instanceof PaymentInputError)
      return json({ message: error.message }, 422);
    if (error instanceof PaymentConflictError)
      return json({ message: error.message }, 409);
    if (error instanceof BookingOriginError)
      return json({ message: error.message }, 403);
    console.error('Gagal menerima konfirmasi transfer', error);
    return json({ message: 'Konfirmasi transfer belum dapat disimpan.' }, 500);
  }
};
