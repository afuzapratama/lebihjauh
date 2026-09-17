import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  booking,
  departure,
  invoice,
  payment,
  paymentMethod,
  trip,
  tripExpense,
  tripVersion,
  user,
} from '../db/schema';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const tripName = (value: unknown): string => {
  const snapshot =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  return typeof snapshot?.tripName === 'string'
    ? snapshot.tripName
    : 'Trip LebihJauh';
};
const pickupName = (value: unknown): string => {
  const snapshot =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const pickup =
    snapshot?.pickup &&
    typeof snapshot.pickup === 'object' &&
    !Array.isArray(snapshot.pickup)
      ? (snapshot.pickup as Record<string, unknown>)
      : null;
  return [pickup?.zoneName, pickup?.locationName]
    .filter((part): part is string => typeof part === 'string' && !!part)
    .join(' · ');
};
const methodName = (value: unknown): string => {
  const snapshot =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  return typeof snapshot?.name === 'string'
    ? snapshot.name
    : 'Metode tidak tercatat';
};
const sum = (values: Iterable<string>) => {
  let total = 0n;
  for (const value of values) total += BigInt(value);
  return total;
};

export type RevenuePeriod = { year: number; month: number };
export type RevenueFilters = RevenuePeriod & {
  tripName: string | null;
  paymentMethodId: string | null;
  bookingSource: 'open_trip' | 'private_trip' | null;
  departureId: string | null;
  pickupName: string | null;
};

const jakartaParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day', string>;
};

const monthStart = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1) - JAKARTA_OFFSET_MS);

const monthKey = (date: Date) => {
  const parts = jakartaParts(date);
  return `${parts.year}-${parts.month}`;
};

const dayKey = (date: Date) => {
  const parts = jakartaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function revenueFilters(searchParams: URLSearchParams): RevenueFilters {
  const now = jakartaParts(new Date());
  const requestedYear = Number(searchParams.get('year'));
  const requestedMonth = Number(searchParams.get('month'));
  const year =
    Number.isInteger(requestedYear) &&
    requestedYear >= 2020 &&
    requestedYear <= 2100
      ? requestedYear
      : Number(now.year);
  const month =
    Number.isInteger(requestedMonth) &&
    requestedMonth >= 1 &&
    requestedMonth <= 12
      ? requestedMonth
      : Number(now.month);
  const rawTrip = searchParams.get('trip')?.trim() ?? '';
  const rawMethod = searchParams.get('method')?.trim() ?? '';
  const rawSource = searchParams.get('source');
  const rawDeparture = searchParams.get('departure')?.trim() ?? '';
  const rawPickup = searchParams.get('pickup')?.trim() ?? '';
  return {
    year,
    month,
    tripName: rawTrip && rawTrip.length <= 160 ? rawTrip : null,
    paymentMethodId: /^[0-9a-f-]{36}$/i.test(rawMethod) ? rawMethod : null,
    bookingSource:
      rawSource === 'open_trip' || rawSource === 'private_trip'
        ? rawSource
        : null,
    departureId: /^[0-9a-f-]{36}$/i.test(rawDeparture) ? rawDeparture : null,
    pickupName: rawPickup && rawPickup.length <= 300 ? rawPickup : null,
  };
}

export async function getRevenueReport(filters: RevenueFilters) {
  const db = getDb();
  const start = monthStart(filters.year, filters.month);
  const end = monthStart(
    filters.month === 12 ? filters.year + 1 : filters.year,
    filters.month === 12 ? 1 : filters.month + 1,
  );
  const historyStart = monthStart(filters.year, filters.month - 11);
  const methodCondition = filters.paymentMethodId
    ? eq(payment.paymentMethodId, filters.paymentMethodId)
    : undefined;
  const verifiedRows = await db
    .select({
      id: payment.id,
      amount: payment.amount,
      paymentMethodId: payment.paymentMethodId,
      paymentMethodSnapshot: payment.paymentMethodSnapshot,
      reference: payment.reference,
      receivedAt: payment.receivedAt,
      reviewedAt: payment.reviewedAt,
      reviewedByName: user.name,
      bookingId: booking.id,
      departureId: booking.departureId,
      bookingNumber: booking.publicNumber,
      bookingState: booking.state,
      picName: booking.picName,
      pax: booking.pax,
      trip: booking.packageSnapshot,
      invoiceTotal: invoice.total,
      bookingSource: booking.bookingSource,
    })
    .from(payment)
    .innerJoin(invoice, eq(payment.invoiceId, invoice.id))
    .innerJoin(booking, eq(payment.bookingId, booking.id))
    .leftJoin(user, eq(payment.reviewedByUserId, user.id))
    .where(
      and(
        eq(payment.state, 'verified'),
        gte(payment.receivedAt, historyStart),
        methodCondition,
      ),
    )
    .orderBy(desc(payment.receivedAt));
  const selectedTrip = (row: (typeof verifiedRows)[number]) =>
    (!filters.tripName || tripName(row.trip) === filters.tripName) &&
    (!filters.bookingSource || row.bookingSource === filters.bookingSource) &&
    (!filters.departureId || row.departureId === filters.departureId) &&
    (!filters.pickupName || pickupName(row.trip) === filters.pickupName);
  const historyRows = verifiedRows.filter(selectedTrip);
  const rows = historyRows.filter(
    (row) => row.receivedAt >= start && row.receivedAt < end,
  );

  const [
    pendingRows,
    orderRows,
    methods,
    tripRows,
    receivableDocuments,
    verifiedTotals,
    rawExpenses,
    expenseSourceRows,
    scheduleBookings,
    scheduleVerifiedPayments,
    scheduleExpenseRows,
  ] = await Promise.all([
    db
      .select({
        amount: payment.amount,
        bookingTrip: booking.packageSnapshot,
        bookingSource: booking.bookingSource,
        departureId: booking.departureId,
      })
      .from(payment)
      .innerJoin(booking, eq(payment.bookingId, booking.id))
      .where(
        and(
          eq(payment.state, 'submitted'),
          gte(payment.submittedAt, start),
          lt(payment.submittedAt, end),
          methodCondition,
        ),
      ),
    db
      .select({
        id: booking.id,
        total: invoice.total,
        trip: booking.packageSnapshot,
        bookingSource: booking.bookingSource,
        departureId: booking.departureId,
      })
      .from(booking)
      .innerJoin(invoice, eq(invoice.bookingId, booking.id))
      .where(and(gte(booking.createdAt, start), lt(booking.createdAt, end))),
    db
      .select({ id: paymentMethod.id, name: paymentMethod.name })
      .from(paymentMethod)
      .orderBy(asc(paymentMethod.sortOrder), asc(paymentMethod.name)),
    db
      .select({
        trip: booking.packageSnapshot,
        bookingSource: booking.bookingSource,
        departureId: booking.departureId,
      })
      .from(booking),
    db
      .select({
        bookingId: booking.id,
        bookingState: booking.state,
        total: invoice.total,
        trip: booking.packageSnapshot,
        bookingSource: booking.bookingSource,
        departureId: booking.departureId,
      })
      .from(booking)
      .innerJoin(invoice, eq(invoice.bookingId, booking.id))
      .where(
        inArray(booking.state, ['awaiting_payment', 'confirmed', 'completed']),
      ),
    db
      .select({
        bookingId: payment.bookingId,
        amount: payment.amount,
        receivedAt: payment.receivedAt,
        trip: booking.packageSnapshot,
        bookingSource: booking.bookingSource,
        departureId: booking.departureId,
      })
      .from(payment)
      .innerJoin(booking, eq(payment.bookingId, booking.id))
      .where(eq(payment.state, 'verified')),
    db
      .select({
        id: tripExpense.id,
        departureId: tripExpense.departureId,
        category: tripExpense.category,
        paidAt: tripExpense.paidAt,
        vendor: tripExpense.vendor,
        amount: tripExpense.amount,
        method: tripExpense.method,
        reference: tripExpense.reference,
        proofObjectKey: tripExpense.proofObjectKey,
        state: tripExpense.state,
        scope: tripExpense.scope,
        voidReason: tripExpense.voidReason,
        tripName: trip.name,
        departureStartAt: departure.startAt,
      })
      .from(tripExpense)
      .leftJoin(departure, eq(tripExpense.departureId, departure.id))
      .leftJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
      .leftJoin(trip, eq(tripVersion.tripId, trip.id))
      .where(and(gte(tripExpense.paidAt, start), lt(tripExpense.paidAt, end)))
      .orderBy(desc(tripExpense.paidAt)),
    db
      .selectDistinct({
        departureId: booking.departureId,
        bookingSource: booking.bookingSource,
        trip: booking.packageSnapshot,
      })
      .from(booking),
    db
      .select({
        bookingId: booking.id,
        departureId: booking.departureId,
        total: invoice.total,
        pax: booking.pax,
        tripName: trip.name,
        trip: booking.packageSnapshot,
        startAt: departure.startAt,
        bookingSource: booking.bookingSource,
      })
      .from(booking)
      .innerJoin(invoice, eq(invoice.bookingId, booking.id))
      .innerJoin(departure, eq(booking.departureId, departure.id))
      .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
      .innerJoin(trip, eq(tripVersion.tripId, trip.id))
      .where(
        and(
          inArray(booking.state, [
            'awaiting_payment',
            'confirmed',
            'completed',
          ]),
          gte(departure.startAt, start),
          lt(departure.startAt, end),
        ),
      ),
    db
      .select({ bookingId: payment.bookingId, amount: payment.amount })
      .from(payment)
      .where(eq(payment.state, 'verified')),
    db
      .select({
        departureId: tripExpense.departureId,
        amount: tripExpense.amount,
      })
      .from(tripExpense)
      .where(eq(tripExpense.state, 'active')),
  ]);
  const matchesTrip = (value: unknown) =>
    !filters.tripName || tripName(value) === filters.tripName;
  const matchesSource = (value: string) =>
    !filters.bookingSource || value === filters.bookingSource;
  const matchesDeparture = (value: string) =>
    !filters.departureId || value === filters.departureId;
  const matchesPickup = (value: unknown) =>
    !filters.pickupName || pickupName(value) === filters.pickupName;
  const pending = pendingRows.filter(
    (row) =>
      matchesTrip(row.bookingTrip) &&
      matchesSource(row.bookingSource) &&
      matchesDeparture(row.departureId) &&
      matchesPickup(row.bookingTrip),
  );
  const newOrders = orderRows.filter(
    (row) =>
      matchesTrip(row.trip) &&
      matchesSource(row.bookingSource) &&
      matchesDeparture(row.departureId) &&
      matchesPickup(row.trip),
  );
  const sourcesByDeparture = new Map<string, Set<string>>();
  const tripsByDeparture = new Map<string, Set<string>>();
  const pickupsByDeparture = new Map<string, Set<string>>();
  for (const row of expenseSourceRows) {
    if (!row.departureId) continue;
    const sources =
      sourcesByDeparture.get(row.departureId) ?? new Set<string>();
    sources.add(row.bookingSource);
    sourcesByDeparture.set(row.departureId, sources);
    const tripNames =
      tripsByDeparture.get(row.departureId) ?? new Set<string>();
    tripNames.add(tripName(row.trip));
    tripsByDeparture.set(row.departureId, tripNames);
    const pickupNames =
      pickupsByDeparture.get(row.departureId) ?? new Set<string>();
    const pickup = pickupName(row.trip);
    if (pickup) pickupNames.add(pickup);
    pickupsByDeparture.set(row.departureId, pickupNames);
  }
  const expenses = rawExpenses.filter((row) => {
    if (row.scope === 'general')
      return (
        !filters.tripName &&
        !filters.bookingSource &&
        !filters.departureId &&
        !filters.pickupName
      );
    if (!row.departureId) return false;
    return (
      (!filters.tripName ||
        tripsByDeparture.get(row.departureId)?.has(filters.tripName)) &&
      (!filters.bookingSource ||
        sourcesByDeparture.get(row.departureId)?.has(filters.bookingSource)) &&
      matchesDeparture(row.departureId) &&
      (!filters.pickupName ||
        pickupsByDeparture.get(row.departureId)?.has(filters.pickupName))
    );
  });
  const activeExpenses = expenses.filter((row) => row.state === 'active');
  const paidByBooking = new Map<string, bigint>();
  for (const item of verifiedTotals) {
    paidByBooking.set(
      item.bookingId,
      (paidByBooking.get(item.bookingId) ?? 0n) + BigInt(item.amount),
    );
  }
  const receivables = receivableDocuments
    .filter(
      (row) =>
        matchesTrip(row.trip) &&
        matchesSource(row.bookingSource) &&
        matchesDeparture(row.departureId) &&
        matchesPickup(row.trip),
    )
    .map((row) => {
      const outstanding =
        BigInt(row.total) - (paidByBooking.get(row.bookingId) ?? 0n);
      return outstanding > 0n ? outstanding : 0n;
    });

  const byMethod = new Map<
    string,
    { name: string; amount: bigint; count: number }
  >();
  const byTrip = new Map<
    string,
    {
      name: string;
      amount: bigint;
      transactions: number;
      bookings: Set<string>;
      pax: number;
    }
  >();
  const byDay = new Map<string, bigint>();
  for (const row of rows) {
    const amount = BigInt(row.amount);
    const method = methodName(row.paymentMethodSnapshot);
    const currentMethod = byMethod.get(method) ?? {
      name: method,
      amount: 0n,
      count: 0,
    };
    currentMethod.amount += amount;
    currentMethod.count += 1;
    byMethod.set(method, currentMethod);
    const name = tripName(row.trip);
    const currentTrip = byTrip.get(name) ?? {
      name,
      amount: 0n,
      transactions: 0,
      bookings: new Set<string>(),
      pax: 0,
    };
    currentTrip.amount += amount;
    currentTrip.transactions += 1;
    if (!currentTrip.bookings.has(row.bookingId)) {
      currentTrip.bookings.add(row.bookingId);
      currentTrip.pax += row.pax;
    }
    byTrip.set(name, currentTrip);
    const key = dayKey(row.receivedAt);
    byDay.set(key, (byDay.get(key) ?? 0n) + amount);
  }
  const totalReceived = sum(rows.map((row) => row.amount));
  const totalExpenses = sum(activeExpenses.map((row) => row.amount));
  const cashReceived = sum(
    verifiedTotals
      .filter(
        (row) =>
          row.receivedAt >= start &&
          row.receivedAt < end &&
          matchesTrip(row.trip) &&
          matchesSource(row.bookingSource) &&
          matchesDeparture(row.departureId) &&
          matchesPickup(row.trip),
      )
      .map((row) => row.amount),
  );
  const verifiedByScheduleBooking = new Map<string, bigint>();
  for (const row of scheduleVerifiedPayments) {
    verifiedByScheduleBooking.set(
      row.bookingId,
      (verifiedByScheduleBooking.get(row.bookingId) ?? 0n) + BigInt(row.amount),
    );
  }
  const expenseBySchedule = new Map<string, bigint>();
  for (const row of scheduleExpenseRows) {
    if (!row.departureId) continue;
    expenseBySchedule.set(
      row.departureId,
      (expenseBySchedule.get(row.departureId) ?? 0n) + BigInt(row.amount),
    );
  }
  const scheduleMap = new Map<
    string,
    {
      departureId: string;
      tripName: string;
      startAt: Date;
      orderCount: number;
      pax: number;
      invoiced: bigint;
      verified: bigint;
    }
  >();
  for (const row of scheduleBookings) {
    if (filters.tripName && row.tripName !== filters.tripName) continue;
    if (!matchesSource(row.bookingSource)) continue;
    if (!matchesDeparture(row.departureId) || !matchesPickup(row.trip))
      continue;
    const current = scheduleMap.get(row.departureId) ?? {
      departureId: row.departureId,
      tripName: row.tripName,
      startAt: row.startAt,
      orderCount: 0,
      pax: 0,
      invoiced: 0n,
      verified: 0n,
    };
    current.orderCount += 1;
    current.pax += row.pax;
    current.invoiced += BigInt(row.total);
    current.verified += verifiedByScheduleBooking.get(row.bookingId) ?? 0n;
    scheduleMap.set(row.departureId, current);
  }
  const scheduleFinance = [...scheduleMap.values()]
    .map((item) => {
      const expense = expenseBySchedule.get(item.departureId) ?? 0n;
      const receivable = item.invoiced - item.verified;
      return {
        ...item,
        expense,
        receivable: receivable > 0n ? receivable : 0n,
        cashPosition: item.verified - expense,
        bookingMargin: item.invoiced - expense,
      };
    })
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const daysInMonth = new Date(filters.year, filters.month, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(Date.UTC(filters.year, filters.month - 1, index + 1));
    const key = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
    return { day: index + 1, amount: byDay.get(key) ?? 0n, date };
  });
  const largestDay = daily.reduce(
    (highest, item) => (item.amount > highest ? item.amount : highest),
    0n,
  );
  const history = new Map<string, bigint>();
  for (const row of historyRows) {
    const key = monthKey(row.receivedAt);
    history.set(key, (history.get(key) ?? 0n) + BigInt(row.amount));
  }
  const monthlyHistory = Array.from({ length: 12 }, (_, index) => {
    const monthIndex = filters.month - 1 - index;
    const date = new Date(Date.UTC(filters.year, monthIndex, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return { year, month, amount: history.get(key) ?? 0n };
  });

  return {
    filters,
    rows,
    methods,
    trips: [
      ...new Set(
        tripRows
          .filter((row) => matchesSource(row.bookingSource))
          .map((row) => tripName(row.trip)),
      ),
    ].sort((a, b) => a.localeCompare(b, 'id')),
    departures: [
      ...new Map(
        scheduleBookings.map((row) => [
          row.departureId,
          {
            id: row.departureId,
            label: `${row.tripName} · ${row.startAt.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
          },
        ]),
      ).values(),
    ].sort((a, b) => a.label.localeCompare(b.label, 'id')),
    pickupPoints: [
      ...new Set(
        tripRows
          .filter((row) => matchesSource(row.bookingSource))
          .map((row) => pickupName(row.trip))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, 'id')),
    totalReceived,
    verifiedCount: rows.length,
    bookingCount: new Set(rows.map((row) => row.bookingId)).size,
    pendingAmount: sum(pending.map((row) => row.amount)),
    pendingCount: pending.length,
    expenses,
    totalExpenses,
    expenseCount: activeExpenses.length,
    voidedExpenseCount: expenses.filter((row) => row.state === 'voided').length,
    cashReceived,
    cashPosition: cashReceived - totalExpenses,
    scheduleFinance,
    newOrderAmount: sum(newOrders.map((row) => row.total)),
    newOrderCount: newOrders.length,
    receivableAmount: receivables.reduce((total, value) => total + value, 0n),
    receivableCount: receivables.filter((value) => value > 0n).length,
    byMethod: [...byMethod.values()].sort((a, b) =>
      Number(b.amount - a.amount),
    ),
    byTrip: [...byTrip.values()]
      .map((item) => ({ ...item, bookings: item.bookings.size }))
      .sort((a, b) => Number(b.amount - a.amount)),
    daily,
    largestDay,
    monthlyHistory,
  };
}
