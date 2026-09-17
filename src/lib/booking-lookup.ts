import { createHash, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { booking, invoice, invoiceAccessGrant } from '../db/schema';
import { createAccessToken } from './booking-security';
import { getPaymentSummary } from './payment-service';

const lookupGrantLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export class BookingLookupInputError extends Error {}
export class BookingLookupNotFoundError extends Error {}

export type BookingLookupInput = {
  number: string;
  whatsapp: string;
};

export function canonicalWhatsApp(value: unknown) {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (!/^\d{9,16}$/.test(digits)) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function parseBookingLookupInput(value: unknown): BookingLookupInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BookingLookupInputError('Data cek booking tidak valid.');
  }
  const values = value as Record<string, unknown>;
  const number =
    typeof values.number === 'string' ? values.number.trim().toUpperCase() : '';
  const whatsapp = canonicalWhatsApp(values.whatsapp);
  if (!/^LJ-OT-\d{6,}$/.test(number)) {
    throw new BookingLookupInputError(
      'Nomor booking harus mengikuti format LJ-OT-000000.',
    );
  }
  if (!whatsapp) {
    throw new BookingLookupInputError('Nomor WhatsApp PIC tidak valid.');
  }
  return { number, whatsapp };
}

function equalSecret(left: string, right: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}

function maskedName(value: string) {
  const words = value.trim().split(/\s+/);
  if (words.length === 1) {
    return `${words[0]?.slice(0, 2) ?? ''}${'•'.repeat(
      Math.max(2, (words[0]?.length ?? 0) - 2),
    )}`;
  }
  return `${words[0]} ${words
    .slice(1)
    .map((word) => `${word[0] ?? ''}.`)
    .join(' ')}`;
}

/**
 * The booking number is an identifier, not a secret. The WhatsApp comparison is
 * deliberately done after the row is loaded so equivalent 08 / +628 formats work
 * without weakening the database query into a suffix match.
 */
export async function lookupBooking(input: BookingLookupInput) {
  const db = getDb();
  const [found] = await db
    .select({
      bookingId: booking.id,
      number: invoice.number,
      state: booking.state,
      bookingSource: booking.bookingSource,
      picName: booking.picName,
      picWhatsApp: booking.picWhatsApp,
      pax: booking.pax,
      packageSnapshot: booking.packageSnapshot,
      holdExpiresAt: booking.holdExpiresAt,
      invoiceId: invoice.id,
      total: invoice.total,
      minimumDp: invoice.minimumDp,
      issuedAt: invoice.issuedAt,
    })
    .from(invoice)
    .innerJoin(booking, eq(invoice.bookingId, booking.id))
    .where(eq(invoice.number, input.number))
    .limit(1);

  const storedWhatsApp = canonicalWhatsApp(found?.picWhatsApp);
  if (
    !found ||
    !storedWhatsApp ||
    !equalSecret(storedWhatsApp, input.whatsapp)
  ) {
    throw new BookingLookupNotFoundError(
      'Nomor booking atau WhatsApp PIC tidak cocok.',
    );
  }

  const paymentSummary = await getPaymentSummary(found.invoiceId);
  const verified = BigInt(paymentSummary.verified);
  const total = BigInt(found.total);
  const snapshot = found.packageSnapshot as {
    tripName?: string;
    startAt?: string;
    pickup?: { locationName?: string };
  };
  const token = createAccessToken();
  await db.insert(invoiceAccessGrant).values({
    bookingId: found.bookingId,
    tokenHash: token.hash,
    expiresAt: new Date(Date.now() + lookupGrantLifetimeMs),
  });

  return {
    number: found.number,
    state: found.state,
    bookingSource: found.bookingSource,
    picName: maskedName(found.picName),
    pax: found.pax,
    tripName: snapshot.tripName ?? 'Trip LebihJauh',
    startAt: snapshot.startAt ?? null,
    pickup: snapshot.pickup?.locationName ?? null,
    holdExpiresAt: found.holdExpiresAt,
    issuedAt: found.issuedAt,
    total: found.total,
    minimumDp: found.minimumDp,
    verified: paymentSummary.verified,
    remaining: (total > verified ? total - verified : 0n).toString(),
    paymentState:
      verified >= total
        ? 'paid'
        : verified >= BigInt(found.minimumDp)
          ? 'dp'
          : 'unpaid',
    accessToken: token.value,
  };
}
