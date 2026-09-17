import { createHash } from 'node:crypto';
import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingConfigurationError,
  BookingOriginError,
  invoiceAccessCookie,
} from '../../lib/booking-security';
import {
  BookingLookupInputError,
  BookingLookupNotFoundError,
  lookupBooking,
  parseBookingLookupInput,
} from '../../lib/booking-lookup';

export const prerender = false;

const windowMs = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function consume(key: string, limit: number) {
  const now = Date.now();
  if (attempts.size > 5_000) {
    for (const [storedKey, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(storedKey);
    }
  }
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

const json = (body: unknown, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
  });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const input = parseBookingLookupInput(body);
    const ipKey = createHash('sha256').update(clientAddress).digest('hex');
    const pairKey = createHash('sha256')
      .update(`${clientAddress}:${input.number}`)
      .digest('hex');
    if (!consume(`ip:${ipKey}`, 30) || !consume(`pair:${pairKey}`, 8)) {
      return json(
        { message: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' },
        429,
        { 'Retry-After': '600' },
      );
    }
    const result = await lookupBooking(input);
    return json(
      {
        booking: {
          ...result,
          accessToken: undefined,
          invoicePath: `/invoice/${result.number}`,
        },
      },
      200,
      { 'Set-Cookie': invoiceAccessCookie(result.accessToken) },
    );
  } catch (error) {
    if (error instanceof BookingLookupInputError) {
      return json({ message: error.message }, 422);
    }
    if (error instanceof BookingLookupNotFoundError) {
      return json({ message: error.message }, 404);
    }
    if (error instanceof BookingOriginError) {
      return json({ message: error.message }, 403);
    }
    if (error instanceof BookingConfigurationError) {
      return json(
        { message: 'Konfigurasi keamanan booking belum lengkap.' },
        503,
      );
    }
    console.error('Gagal memeriksa booking', error);
    return json({ message: 'Booking belum dapat diperiksa. Coba lagi.' }, 500);
  }
};
