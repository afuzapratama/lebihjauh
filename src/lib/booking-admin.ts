import { and, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  adminAuditLog,
  booking,
  bookingAllocation,
  departure,
  invoice,
  invoiceAccessGrant,
} from '../db/schema';
import { createAccessToken } from './booking-security';

const holdLifetimeMs = 24 * 60 * 60 * 1000;
const grantLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export class BookingAdminInputError extends Error {}
export class BookingAdminConflictError extends Error {}

type Tx = Parameters<ReturnType<typeof getDb>['transaction']>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;

async function expireDueHoldsForDeparture(
  tx: Tx,
  departureId: string,
  now: Date,
) {
  const due = await tx
    .select({ bookingId: bookingAllocation.bookingId })
    .from(bookingAllocation)
    .where(
      and(
        eq(bookingAllocation.departureId, departureId),
        eq(bookingAllocation.state, 'held'),
        lte(bookingAllocation.expiresAt, now),
      ),
    );
  if (!due.length) return 0;
  await tx
    .update(bookingAllocation)
    .set({ state: 'released', releasedAt: now, updatedAt: now })
    .where(
      and(
        eq(bookingAllocation.departureId, departureId),
        eq(bookingAllocation.state, 'held'),
        lte(bookingAllocation.expiresAt, now),
      ),
    );
  await tx
    .update(booking)
    .set({ state: 'expired', updatedAt: now })
    .where(
      and(
        inArray(
          booking.id,
          due.map((item) => item.bookingId),
        ),
        eq(booking.state, 'awaiting_payment'),
      ),
    );
  return due.length;
}

/** Called by the order workspace so operational status does not wait for a new sale. */
export async function expireDueBookingHolds() {
  const db = getDb();
  const now = new Date();
  const due = await db
    .selectDistinct({ departureId: bookingAllocation.departureId })
    .from(bookingAllocation)
    .where(
      and(
        eq(bookingAllocation.state, 'held'),
        lte(bookingAllocation.expiresAt, now),
      ),
    );
  let expired = 0;
  for (const item of due) {
    expired += await db.transaction((tx) =>
      expireDueHoldsForDeparture(tx, item.departureId, now),
    );
  }
  return expired;
}

async function lockBooking(tx: Tx, bookingId: string) {
  await tx.execute(
    sql`select id from bookings where id = ${bookingId} for update`,
  );
  const [found] = await tx
    .select({
      id: booking.id,
      number: booking.publicNumber,
      state: booking.state,
      pax: booking.pax,
      departureId: booking.departureId,
    })
    .from(booking)
    .where(eq(booking.id, bookingId))
    .limit(1);
  if (!found) throw new BookingAdminInputError('Booking tidak ditemukan.');
  return found;
}

export async function cancelBookingByCustomer(
  bookingId: string,
  reason: string,
  actorUserId: string,
) {
  const normalizedReason = reason.trim().replace(/\s+/g, ' ');
  if (normalizedReason.length < 5 || normalizedReason.length > 500) {
    throw new BookingAdminInputError(
      'Alasan pembatalan wajib diisi (5–500 karakter).',
    );
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    const found = await lockBooking(tx, bookingId);
    if (found.state !== 'awaiting_payment') {
      throw new BookingAdminConflictError(
        'Hanya booking yang masih menunggu pembayaran dapat dibatalkan pada tahap ini.',
      );
    }
    const now = new Date();
    await tx
      .update(bookingAllocation)
      .set({ state: 'released', releasedAt: now, updatedAt: now })
      .where(
        and(
          eq(bookingAllocation.bookingId, found.id),
          inArray(bookingAllocation.state, ['held', 'committed']),
        ),
      );
    await tx
      .update(booking)
      .set({ state: 'cancelled', updatedAt: now })
      .where(eq(booking.id, found.id));
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking',
      entityId: found.id,
      action: 'cancelled_by_customer',
      payload: { number: found.number, reason: normalizedReason },
    });
    return { number: found.number, state: 'cancelled' };
  });
}

export async function reopenExpiredBooking(
  bookingId: string,
  actorUserId: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const found = await lockBooking(tx, bookingId);
    if (found.state !== 'expired') {
      throw new BookingAdminConflictError(
        'Hanya booking yang sudah kedaluwarsa dapat dibuka ulang.',
      );
    }
    const now = new Date();
    await tx.execute(
      sql`select id from departures where id = ${found.departureId} for update`,
    );
    await expireDueHoldsForDeparture(tx, found.departureId, now);
    const [schedule] = await tx
      .select({
        capacity: departure.capacity,
        publicationState: departure.publicationState,
        bookingCutoffAt: departure.bookingCutoffAt,
      })
      .from(departure)
      .where(eq(departure.id, found.departureId))
      .limit(1);
    if (
      !schedule ||
      schedule.publicationState !== 'open' ||
      schedule.bookingCutoffAt <= now
    ) {
      throw new BookingAdminConflictError(
        'Jadwal sudah tidak dibuka untuk booking.',
      );
    }
    const active = await tx
      .select({ pax: bookingAllocation.pax })
      .from(bookingAllocation)
      .where(
        and(
          eq(bookingAllocation.departureId, found.departureId),
          or(
            eq(bookingAllocation.state, 'committed'),
            and(
              eq(bookingAllocation.state, 'held'),
              gt(bookingAllocation.expiresAt, now),
            ),
          ),
        ),
      );
    const occupied = active.reduce((total, item) => total + item.pax, 0);
    if (schedule.capacity - occupied < found.pax) {
      throw new BookingAdminConflictError(
        'Kuota saat ini tidak cukup untuk membuka ulang booking ini. Tawarkan jadwal lain kepada PIC.',
      );
    }
    const holdExpiresAt = new Date(
      Math.min(
        now.getTime() + holdLifetimeMs,
        schedule.bookingCutoffAt.getTime(),
      ),
    );
    await tx
      .update(booking)
      .set({ state: 'awaiting_payment', holdExpiresAt, updatedAt: now })
      .where(eq(booking.id, found.id));
    await tx
      .update(bookingAllocation)
      .set({
        state: 'held',
        expiresAt: holdExpiresAt,
        releasedAt: null,
        updatedAt: now,
      })
      .where(eq(bookingAllocation.bookingId, found.id));
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking',
      entityId: found.id,
      action: 'reopened_after_expiry',
      payload: {
        number: found.number,
        holdExpiresAt: holdExpiresAt.toISOString(),
      },
    });
    return { number: found.number, holdExpiresAt };
  });
}

export async function issueReplacementInvoiceLink(
  bookingId: string,
  actorUserId: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const found = await lockBooking(tx, bookingId);
    const [document] = await tx
      .select({ number: invoice.number })
      .from(invoice)
      .where(eq(invoice.bookingId, found.id))
      .limit(1);
    if (!document)
      throw new BookingAdminInputError('Invoice booking tidak ditemukan.');
    const now = new Date();
    await tx
      .update(invoiceAccessGrant)
      .set({ revokedAt: now })
      .where(
        and(
          eq(invoiceAccessGrant.bookingId, found.id),
          isNull(invoiceAccessGrant.revokedAt),
        ),
      );
    const token = createAccessToken();
    await tx.insert(invoiceAccessGrant).values({
      bookingId: found.id,
      tokenHash: token.hash,
      expiresAt: new Date(now.getTime() + grantLifetimeMs),
    });
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking',
      entityId: found.id,
      action: 'invoice_access_reissued',
      payload: { number: document.number },
    });
    return { number: document.number, token: token.value };
  });
}
