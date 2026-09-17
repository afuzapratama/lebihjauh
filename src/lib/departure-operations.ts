import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  adminAuditLog,
  booking,
  bookingAllocation,
  bookingParticipant,
  departure,
  departureManifestException,
  departurePickupOption,
  invoice,
  payment,
  trip,
  tripExpense,
  tripPickupPoint,
  tripVersion,
} from '../db/schema';

export class DepartureOperationsInputError extends Error {}
export class DepartureOperationsConflictError extends Error {}

const numericSum = (values: string[]) =>
  values.reduce((total, value) => total + BigInt(value), 0n);

const normalizedReason = (value: unknown) => {
  const reason =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (reason.length < 5 || reason.length > 500) {
    throw new DepartureOperationsInputError(
      'Alasan izin manifest wajib diisi (5–500 karakter).',
    );
  }
  return reason;
};

const uuid = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DepartureOperationsInputError(`${label} tidak valid.`);
  }
  return value;
};

const optionalSnapshotText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const pickupFromSnapshot = (
  packageSnapshot: unknown,
  fallback?: {
    id: string;
    zoneName: string;
    locationName: string;
    address: string;
  },
) => {
  const snapshot =
    packageSnapshot &&
    typeof packageSnapshot === 'object' &&
    !Array.isArray(packageSnapshot)
      ? (packageSnapshot as Record<string, unknown>)
      : null;
  const rawPickup =
    snapshot?.pickup &&
    typeof snapshot.pickup === 'object' &&
    !Array.isArray(snapshot.pickup)
      ? (snapshot.pickup as Record<string, unknown>)
      : null;
  const pickup = {
    id: optionalSnapshotText(rawPickup?.id) ?? fallback?.id ?? null,
    zoneName:
      optionalSnapshotText(rawPickup?.zoneName) ?? fallback?.zoneName ?? null,
    locationName:
      optionalSnapshotText(rawPickup?.locationName) ??
      fallback?.locationName ??
      null,
    address:
      optionalSnapshotText(rawPickup?.address) ?? fallback?.address ?? null,
  };
  return {
    ...pickup,
    label:
      [pickup.zoneName, pickup.locationName].filter(Boolean).join(' · ') ||
      'Belum tercatat',
  };
};

export async function getDepartureOperations(departureId: string) {
  const db = getDb();
  const now = new Date();
  const [schedule] = await db
    .select({
      id: departure.id,
      startAt: departure.startAt,
      endAt: departure.endAt,
      timezone: departure.timezone,
      capacity: departure.capacity,
      unitPrice: departure.unitPrice,
      publicationState: departure.publicationState,
      bookingCutoffAt: departure.bookingCutoffAt,
      balanceDueAt: departure.balanceDueAt,
      tripName: trip.name,
      tripId: trip.id,
      tripCategory: trip.category,
      meetingPoint: tripVersion.meetingPoint,
    })
    .from(departure)
    .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
    .innerJoin(trip, eq(tripVersion.tripId, trip.id))
    .where(eq(departure.id, departureId))
    .limit(1);
  if (!schedule) return null;

  const masterPickupPoints = await db
    .select()
    .from(tripPickupPoint)
    .where(
      and(
        eq(tripPickupPoint.tripId, schedule.tripId),
        eq(tripPickupPoint.isActive, true),
      ),
    )
    .orderBy(asc(tripPickupPoint.sortOrder), asc(tripPickupPoint.createdAt));

  const pickupOptions = await db
    .select({
      id: departurePickupOption.id,
      masterPickupPointId: departurePickupOption.masterPickupPointId,
      zoneName: departurePickupOption.zoneName,
      locationName: departurePickupOption.locationName,
      address: departurePickupOption.address,
      pickupAt: departurePickupOption.pickupAt,
      pricePerPax: departurePickupOption.pricePerPax,
      mapsUrl: departurePickupOption.mapsUrl,
      instructions: departurePickupOption.instructions,
      pickupRundownStages: departurePickupOption.pickupRundownStages,
      capacity: departurePickupOption.capacity,
      isDefault: departurePickupOption.isDefault,
      isActive: departurePickupOption.isActive,
      sortOrder: departurePickupOption.sortOrder,
    })
    .from(departurePickupOption)
    .where(eq(departurePickupOption.departureId, schedule.id))
    .orderBy(
      asc(departurePickupOption.sortOrder),
      asc(departurePickupOption.createdAt),
    );

  const expenses = await db
    .select({
      id: tripExpense.id,
      category: tripExpense.category,
      paidAt: tripExpense.paidAt,
      vendor: tripExpense.vendor,
      amount: tripExpense.amount,
      method: tripExpense.method,
      reference: tripExpense.reference,
      proofObjectKey: tripExpense.proofObjectKey,
      state: tripExpense.state,
      voidReason: tripExpense.voidReason,
      createdAt: tripExpense.createdAt,
    })
    .from(tripExpense)
    .where(eq(tripExpense.departureId, schedule.id))
    .orderBy(asc(tripExpense.paidAt), asc(tripExpense.createdAt));

  const rawOrders = await db
    .select({
      id: booking.id,
      number: booking.publicNumber,
      state: booking.state,
      pax: booking.pax,
      picName: booking.picName,
      picWhatsApp: booking.picWhatsApp,
      picEmail: booking.picEmail,
      pickupOptionId: booking.pickupOptionId,
      holdExpiresAt: booking.holdExpiresAt,
      confirmedAt: booking.confirmedAt,
      createdAt: booking.createdAt,
      packageSnapshot: booking.packageSnapshot,
      allocationState: bookingAllocation.state,
      allocationExpiresAt: bookingAllocation.expiresAt,
      invoiceId: invoice.id,
      total: invoice.total,
      minimumDp: invoice.minimumDp,
    })
    .from(booking)
    .innerJoin(invoice, eq(invoice.bookingId, booking.id))
    .leftJoin(bookingAllocation, eq(bookingAllocation.bookingId, booking.id))
    .where(eq(booking.departureId, schedule.id))
    .orderBy(asc(booking.createdAt));

  const orderIds = rawOrders.map((item) => item.id);
  const payments = orderIds.length
    ? await db
        .select({
          bookingId: payment.bookingId,
          amount: payment.amount,
          state: payment.state,
        })
        .from(payment)
        .where(inArray(payment.bookingId, orderIds))
    : [];
  const exceptions = orderIds.length
    ? await db
        .select({
          bookingId: departureManifestException.bookingId,
          reason: departureManifestException.reason,
          createdAt: departureManifestException.createdAt,
        })
        .from(departureManifestException)
        .where(eq(departureManifestException.departureId, schedule.id))
    : [];
  const exceptionByBooking = new Map(
    exceptions.map((item) => [item.bookingId, item]),
  );
  const paymentByBooking = new Map<
    string,
    { verified: bigint; submitted: bigint }
  >();
  for (const item of payments) {
    const current = paymentByBooking.get(item.bookingId) ?? {
      verified: 0n,
      submitted: 0n,
    };
    if (item.state === 'verified') current.verified += BigInt(item.amount);
    if (item.state === 'submitted') current.submitted += BigInt(item.amount);
    paymentByBooking.set(item.bookingId, current);
  }

  const orders = rawOrders.map((item) => {
    const paymentsForOrder = paymentByBooking.get(item.id) ?? {
      verified: 0n,
      submitted: 0n,
    };
    const isLiveHold =
      item.state === 'awaiting_payment' &&
      item.allocationState === 'held' &&
      !!item.allocationExpiresAt &&
      item.allocationExpiresAt > now;
    const isConfirmed =
      item.state === 'confirmed' || item.state === 'completed';
    const isActive = isConfirmed || isLiveHold;
    const exception = exceptionByBooking.get(item.id);
    const isManualManifest = isLiveHold && !!exception;
    const total = BigInt(item.total);
    return {
      ...item,
      isLiveHold,
      isConfirmed,
      isActive,
      isManualManifest,
      manifestReason: exception?.reason ?? null,
      exceptionCreatedAt: exception?.createdAt ?? null,
      verifiedAmount: paymentsForOrder.verified.toString(),
      submittedAmount: paymentsForOrder.submitted.toString(),
      outstandingAmount: (total - paymentsForOrder.verified).toString(),
    };
  });

  const manifestOrderIds = orders
    .filter((item) => item.isConfirmed || item.isManualManifest)
    .map((item) => item.id);
  const rawParticipants = manifestOrderIds.length
    ? await db
        .select({
          id: bookingParticipant.id,
          bookingId: bookingParticipant.bookingId,
          position: bookingParticipant.position,
          fullName: bookingParticipant.fullName,
          identityLast4: bookingParticipant.identityLast4,
          isPic: bookingParticipant.isPic,
          checkedInAt: bookingParticipant.checkedInAt,
        })
        .from(bookingParticipant)
        .where(inArray(bookingParticipant.bookingId, manifestOrderIds))
        .orderBy(
          asc(bookingParticipant.bookingId),
          asc(bookingParticipant.position),
        )
    : [];
  const orderById = new Map(orders.map((item) => [item.id, item]));
  const pickupById = new Map(pickupOptions.map((item) => [item.id, item]));
  const manifest = rawParticipants
    .map((person) => {
      const order = orderById.get(person.bookingId)!;
      const pickup = pickupFromSnapshot(
        order.packageSnapshot,
        order.pickupOptionId ? pickupById.get(order.pickupOptionId) : undefined,
      );
      return {
        ...person,
        number: order.number,
        picName: order.picName,
        pickup,
        pickupLabel: pickup.label,
        manuallyIncluded: order.isManualManifest,
      };
    })
    .sort(
      (a, b) =>
        a.number.localeCompare(b.number, 'id') || a.position - b.position,
    );

  const activeOrders = orders.filter((item) => item.isActive);
  const confirmedSeats = orders
    .filter((item) => item.isConfirmed)
    .reduce((total, item) => total + item.pax, 0);
  const heldSeats = orders
    .filter((item) => item.isLiveHold)
    .reduce((total, item) => total + item.pax, 0);
  const totalInvoiced = numericSum(activeOrders.map((item) => item.total));
  const verifiedAmount = numericSum(
    activeOrders.map((item) => item.verifiedAmount),
  );
  const submittedAmount = numericSum(
    activeOrders.map((item) => item.submittedAmount),
  );
  const expenseAmount = numericSum(
    expenses
      .filter((item) => item.state === 'active')
      .map((item) => item.amount),
  );

  return {
    schedule,
    masterPickupPoints,
    pickupOptions,
    expenses,
    orders,
    manifest,
    summary: {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      confirmedOrders: orders.filter((item) => item.isConfirmed).length,
      confirmedSeats,
      heldSeats,
      availableSeats: Math.max(
        0,
        schedule.capacity - confirmedSeats - heldSeats,
      ),
      manifestSeats: manifest.length,
      manuallyIncludedOrders: orders.filter((item) => item.isManualManifest)
        .length,
      totalInvoiced: totalInvoiced.toString(),
      verifiedAmount: verifiedAmount.toString(),
      outstandingAmount: (totalInvoiced - verifiedAmount).toString(),
      submittedAmount: submittedAmount.toString(),
      expenseAmount: expenseAmount.toString(),
      cashPosition: (verifiedAmount - expenseAmount).toString(),
      bookingMargin: (totalInvoiced - expenseAmount).toString(),
    },
  };
}

export async function includeBookingInDepartureManifest(
  values: Record<string, unknown>,
  actorUserId: string,
) {
  const departureId = uuid(values.departureId, 'Jadwal');
  const bookingId = uuid(values.bookingId, 'Booking');
  const reason = normalizedReason(values.reason);
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const [found] = await tx
      .select({
        id: booking.id,
        number: booking.publicNumber,
        state: booking.state,
        departureId: booking.departureId,
        allocationState: bookingAllocation.state,
        allocationExpiresAt: bookingAllocation.expiresAt,
      })
      .from(booking)
      .leftJoin(bookingAllocation, eq(bookingAllocation.bookingId, booking.id))
      .where(eq(booking.id, bookingId))
      .limit(1);
    if (!found || found.departureId !== departureId) {
      throw new DepartureOperationsInputError(
        'Booking tidak berada pada jadwal ini.',
      );
    }
    if (
      found.state !== 'awaiting_payment' ||
      found.allocationState !== 'held' ||
      !found.allocationExpiresAt ||
      found.allocationExpiresAt <= now
    ) {
      throw new DepartureOperationsConflictError(
        'Hanya booking yang masih menahan kursi dan menunggu pembayaran yang dapat diizinkan masuk manifest.',
      );
    }
    await tx
      .insert(departureManifestException)
      .values({
        departureId,
        bookingId,
        reason,
        createdByUserId: actorUserId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: departureManifestException.bookingId,
        set: { reason, createdByUserId: actorUserId, updatedAt: now },
      });
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'departure',
      entityId: departureId,
      action: 'manifest_exception_included',
      payload: { bookingId, number: found.number, reason },
    });
    return { number: found.number, reason };
  });
}

export async function removeBookingFromDepartureManifest(
  values: Record<string, unknown>,
  actorUserId: string,
) {
  const departureId = uuid(values.departureId, 'Jadwal');
  const bookingId = uuid(values.bookingId, 'Booking');
  const db = getDb();
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({
        number: booking.publicNumber,
        departureId: booking.departureId,
      })
      .from(booking)
      .where(eq(booking.id, bookingId))
      .limit(1);
    if (!found || found.departureId !== departureId) {
      throw new DepartureOperationsInputError(
        'Booking tidak berada pada jadwal ini.',
      );
    }
    await tx
      .delete(departureManifestException)
      .where(
        and(
          eq(departureManifestException.departureId, departureId),
          eq(departureManifestException.bookingId, bookingId),
        ),
      );
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'departure',
      entityId: departureId,
      action: 'manifest_exception_removed',
      payload: { bookingId, number: found.number },
    });
    return { number: found.number };
  });
}
