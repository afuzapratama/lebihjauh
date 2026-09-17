import type { APIRoute } from 'astro';
import { and, desc, eq, gte, or } from 'drizzle-orm';
import { getDb } from '../../../db/client';
import {
  booking,
  bookingAllocation,
  departure,
  invoice,
  payment,
  privateTripRequest,
  trip,
  tripVersion,
} from '../../../db/schema';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });

const sumMoney = (values: Iterable<string>) => {
  let total = 0n;
  for (const value of values) total += BigInt(value);
  return total.toString();
};
const formatMoney = (value: string) =>
  `Rp${new Intl.NumberFormat('id-ID').format(Number(value))}`;

const tripName = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return 'Trip LebihJauh';
  const name = (value as Record<string, unknown>).tripName;
  return typeof name === 'string' && name.trim() ? name : 'Trip LebihJauh';
};

const jakartaMonthStart = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month', number>;
  return new Date(
    Date.UTC(values.year, values.month - 1, 1) - 7 * 60 * 60 * 1000,
  );
};

export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const now = new Date();
    const monthStart = jakartaMonthStart(now);

    const [
      awaitingBookingRows,
      recentBookingRows,
      paymentRows,
      departureRows,
      allocationRows,
      privateRows,
    ] = await Promise.all([
      db
        .select({
          id: booking.id,
          holdExpiresAt: booking.holdExpiresAt,
        })
        .from(booking)
        .where(
          and(
            eq(booking.state, 'awaiting_payment'),
            gte(booking.holdExpiresAt, now),
          ),
        ),
      db
        .select({
          id: booking.id,
          number: booking.publicNumber,
          state: booking.state,
          pax: booking.pax,
          picName: booking.picName,
          packageSnapshot: booking.packageSnapshot,
          createdAt: booking.createdAt,
          total: invoice.total,
        })
        .from(booking)
        .innerJoin(invoice, eq(invoice.bookingId, booking.id))
        .orderBy(desc(booking.createdAt))
        .limit(5),
      db
        .select({
          state: payment.state,
          amount: payment.amount,
          submittedAt: payment.submittedAt,
          receivedAt: payment.receivedAt,
        })
        .from(payment)
        .where(
          or(
            eq(payment.state, 'submitted'),
            and(
              eq(payment.state, 'verified'),
              gte(payment.receivedAt, monthStart),
            ),
          ),
        )
        .orderBy(desc(payment.submittedAt)),
      db
        .select({
          id: departure.id,
          tripName: trip.name,
          startAt: departure.startAt,
          endAt: departure.endAt,
          publicationState: departure.publicationState,
          capacity: departure.capacity,
        })
        .from(departure)
        .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
        .innerJoin(trip, eq(tripVersion.tripId, trip.id))
        .where(gte(departure.startAt, now))
        .orderBy(departure.startAt),
      db
        .select({
          departureId: bookingAllocation.departureId,
          pax: bookingAllocation.pax,
          state: bookingAllocation.state,
        })
        .from(bookingAllocation)
        .innerJoin(departure, eq(bookingAllocation.departureId, departure.id))
        .where(
          and(
            gte(departure.startAt, now),
            or(
              eq(bookingAllocation.state, 'committed'),
              and(
                eq(bookingAllocation.state, 'held'),
                gte(bookingAllocation.expiresAt, now),
              ),
            ),
          ),
        ),
      db
        .select({ id: privateTripRequest.id })
        .from(privateTripRequest)
        .where(eq(privateTripRequest.state, 'new'))
        .orderBy(desc(privateTripRequest.createdAt)),
    ]);

    const pendingPayments = paymentRows.filter(
      (item) => item.state === 'submitted',
    );
    const verifiedThisMonth = paymentRows.filter(
      (item) =>
        item.state === 'verified' &&
        item.receivedAt >= monthStart &&
        item.receivedAt <= now,
    );
    const urgentHolds = awaitingBookingRows.filter(
      (item) =>
        item.holdExpiresAt > now &&
        item.holdExpiresAt.getTime() - now.getTime() <= 6 * 60 * 60 * 1000,
    );
    const newPrivateTrips = privateRows;
    const paxByDeparture = new Map<string, number>();
    for (const allocation of allocationRows) {
      paxByDeparture.set(
        allocation.departureId,
        (paxByDeparture.get(allocation.departureId) ?? 0) + allocation.pax,
      );
    }

    const priorities = [
      pendingPayments.length
        ? {
            key: 'payments',
            count: pendingPayments.length,
            label: 'Pembayaran perlu diverifikasi',
            description: `${formatMoney(sumMoney(pendingPayments.map((item) => item.amount)))} menunggu pemeriksaan`,
            href: '/admin/payments',
            tone: 'urgent' as const,
          }
        : null,
      urgentHolds.length
        ? {
            key: 'holds',
            count: urgentHolds.length,
            label: 'Hold berakhir ≤ 6 jam',
            description: 'Tindak lanjuti PIC sebelum kursi dilepas',
            href: '/admin/orders?state=awaiting_payment',
            tone: 'warning' as const,
          }
        : null,
      newPrivateTrips.length
        ? {
            key: 'private-trips',
            count: newPrivateTrips.length,
            label: 'Permintaan Private Trip baru',
            description: 'Belum dihubungi oleh tim',
            href: '/admin/private-trips?state=new',
            tone: 'neutral' as const,
          }
        : null,
    ].filter((item) => item !== null);

    return json({
      summary: {
        monthlyRevenue: sumMoney(verifiedThisMonth.map((item) => item.amount)),
        monthlyRevenueCount: verifiedThisMonth.length,
        pendingPaymentCount: pendingPayments.length,
        pendingPaymentAmount: sumMoney(
          pendingPayments.map((item) => item.amount),
        ),
        awaitingBookingCount: awaitingBookingRows.length,
        upcomingDepartureCount: departureRows.length,
      },
      priorities,
      departures: departureRows.slice(0, 4).map((item) => ({
        ...item,
        startAt: item.startAt.toISOString(),
        endAt: item.endAt.toISOString(),
        allocatedPax: paxByDeparture.get(item.id) ?? 0,
      })),
      recentBookings: recentBookingRows.map((item) => ({
        id: item.id,
        number: item.number,
        tripName: tripName(item.packageSnapshot),
        picName: item.picName,
        pax: item.pax,
        state: item.state,
        createdAt: item.createdAt.toISOString(),
        total: item.total,
      })),
    });
  } catch (error) {
    console.error('Gagal memuat dashboard admin', error);
    return json({ message: 'Dashboard belum dapat dimuat. Coba lagi.' }, 500);
  }
};
