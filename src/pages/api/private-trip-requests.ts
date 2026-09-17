import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
  getGuestScope,
} from '../../lib/booking-security';
import {
  createPrivateTripRequest,
  PrivateTripInputError,
} from '../../lib/private-trip-service';

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
    const created = await createPrivateTripRequest(
      guest.hash,
      await request.json(),
    );
    return json(
      {
        request: {
          number: created.publicNumber,
          destination: created.destination,
        },
      },
      201,
      guest.setCookie,
    );
  } catch (error) {
    if (error instanceof PrivateTripInputError)
      return json({ message: error.message }, 422);
    if (error instanceof BookingOriginError)
      return json({ message: error.message }, 403);
    console.error('Gagal menyimpan permintaan private trip', error);
    return json(
      { message: 'Permintaan belum dapat disimpan. Coba lagi.' },
      500,
    );
  }
};
