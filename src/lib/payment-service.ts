import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  adminAuditLog,
  booking,
  bookingAllocation,
  invoice,
  invoiceAccessGrant,
  payment,
  paymentMethod,
} from '../db/schema';
import { hashSecret } from './booking-security';
import {
  assertPaymentProofExists,
  isPaymentProofObjectKey,
  UploadInputError,
} from './r2';

export class PaymentInputError extends Error {}
export class PaymentConflictError extends Error {}

const rupiah = (value: unknown, name: string) => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (!/^\d+$/.test(text) || BigInt(text) < 1n) {
    throw new PaymentInputError(
      `${name} harus berupa Rupiah bulat lebih dari nol.`,
    );
  }
  return text;
};

const note = (value: unknown, name: string, required = false) => {
  const text =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && text.length < 3)
    throw new PaymentInputError(`${name} wajib diisi.`);
  if (text.length > 500)
    throw new PaymentInputError(`${name} terlalu panjang.`);
  return text || null;
};

/** Input datetime-local selalu ditafsirkan sebagai waktu operasional Jakarta. */
const receivedAt = (value: unknown) => {
  if (value == null || value === '') return new Date();
  if (typeof value !== 'string') {
    throw new PaymentInputError('Tanggal dana masuk tidak valid.');
  }
  const text = value.trim();
  const localMatch = text.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/,
  );
  const date = localMatch
    ? new Date(`${localMatch[1]}T${localMatch[2]}:00+07:00`)
    : new Date(text);
  if (
    Number.isNaN(date.getTime()) ||
    date.getTime() < Date.UTC(2020, 0, 1) ||
    date.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    throw new PaymentInputError('Tanggal dana masuk tidak valid.');
  }
  return date;
};

const sum = (values: Array<{ amount: string }>) =>
  values.reduce((total, item) => total + BigInt(item.amount), 0n);

const formatRupiah = (amount: bigint) =>
  `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;

export async function getPaymentSummary(invoiceId: string) {
  const db = getDb();
  const rows = await db
    .select({ amount: payment.amount, state: payment.state })
    .from(payment)
    .where(eq(payment.invoiceId, invoiceId));
  const verified = sum(rows.filter((row) => row.state === 'verified'));
  const submitted = sum(rows.filter((row) => row.state === 'submitted'));
  return { verified: verified.toString(), submitted: submitted.toString() };
}

const uuid = (value: unknown, name: string) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new PaymentInputError(`${name} tidak valid.`);
  }
  return value;
};

/**
 * Dipakai ketika admin sudah mencocokkan mutasi dan bukti WhatsApp. Tidak ada
 * pilihan "DP" atau "lunas" di UI: statusnya selalu dihitung dari nominal yang
 * benar-benar diverifikasi terhadap minimum DP dan total invoice.
 */
export async function recordVerifiedPayment(
  input: unknown,
  actorUserId: string,
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PaymentInputError('Data pembayaran tidak valid.');
  }
  const values = input as Record<string, unknown>;
  const bookingId = uuid(values.bookingId, 'Booking');
  const paymentMethodId = uuid(values.paymentMethodId, 'Metode pembayaran');
  const amount = rupiah(values.amount, 'Nominal masuk');
  const fundsReceivedAt = receivedAt(values.receivedAt);
  const reference = note(values.reference, 'Referensi mutasi');
  let proofObjectKey: string | null = null;
  if (values.proofObjectKey != null && values.proofObjectKey !== '') {
    if (!isPaymentProofObjectKey(values.proofObjectKey)) {
      throw new PaymentInputError('Berkas bukti pembayaran tidak valid.');
    }
    proofObjectKey = values.proofObjectKey;
  }
  if (proofObjectKey) {
    try {
      await assertPaymentProofExists(proofObjectKey);
    } catch (error) {
      if (error instanceof UploadInputError)
        throw new PaymentInputError(error.message);
      throw error;
    }
  }
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from bookings where id = ${bookingId} for update`,
    );
    const [document] = await tx
      .select({
        bookingId: booking.id,
        invoiceId: invoice.id,
        total: invoice.total,
        minimumDp: invoice.minimumDp,
        bookingState: booking.state,
        holdExpiresAt: booking.holdExpiresAt,
      })
      .from(booking)
      .innerJoin(invoice, eq(invoice.bookingId, booking.id))
      .where(eq(booking.id, bookingId))
      .limit(1);
    if (!document) throw new PaymentInputError('Booking tidak ditemukan.');

    const now = new Date();
    if (
      !['awaiting_payment', 'confirmed'].includes(document.bookingState) ||
      (document.bookingState === 'awaiting_payment' &&
        document.holdExpiresAt <= now)
    ) {
      throw new PaymentConflictError(
        'Booking tidak menerima pembayaran saat ini. Buka ulang booking bila kuota masih tersedia.',
      );
    }

    const [method] = await tx
      .select()
      .from(paymentMethod)
      .where(
        and(
          eq(paymentMethod.id, paymentMethodId),
          eq(paymentMethod.isActive, true),
          isNull(paymentMethod.archivedAt),
        ),
      )
      .limit(1);
    if (!method)
      throw new PaymentInputError(
        'Metode pembayaran tidak aktif atau tidak ditemukan.',
      );

    const verifiedRows = await tx
      .select({ amount: payment.amount })
      .from(payment)
      .where(
        and(
          eq(payment.invoiceId, document.invoiceId),
          eq(payment.state, 'verified'),
        ),
      );
    const nextVerified = sum(verifiedRows) + BigInt(amount);
    if (nextVerified > BigInt(document.total)) {
      throw new PaymentInputError('Nominal masuk melebihi sisa total invoice.');
    }

    const snapshot = {
      name: method.name,
      kind: method.kind,
      accountName: method.accountName,
      accountNumber: method.accountNumber,
      qrisImageUrl: method.qrisImageUrl,
      instructions: method.instructions,
    };
    const [created] = await tx
      .insert(payment)
      .values({
        bookingId: document.bookingId,
        invoiceId: document.invoiceId,
        amount,
        // Kolom lama tetap bank_transfer demi kompatibilitas riwayat Phase 4F.
        method: 'bank_transfer',
        paymentMethodId: method.id,
        paymentMethodSnapshot: snapshot,
        reference,
        proofObjectKey,
        state: 'verified',
        receivedAt: fundsReceivedAt,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        reviewNote: 'Dicatat dan diverifikasi admin.',
        updatedAt: now,
      })
      .returning({ id: payment.id });

    const paymentState =
      nextVerified >= BigInt(document.total)
        ? 'paid'
        : nextVerified >= BigInt(document.minimumDp)
          ? 'dp'
          : 'unpaid';
    if (nextVerified >= BigInt(document.minimumDp)) {
      await tx
        .update(booking)
        .set({ state: 'confirmed', confirmedAt: now, updatedAt: now })
        .where(eq(booking.id, document.bookingId));
      await tx
        .update(bookingAllocation)
        .set({ state: 'committed', expiresAt: null, updatedAt: now })
        .where(
          and(
            eq(bookingAllocation.bookingId, document.bookingId),
            eq(bookingAllocation.state, 'held'),
          ),
        );
    }
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking',
      entityId: document.bookingId,
      action: 'payment_recorded_verified',
      payload: {
        paymentId: created.id,
        amount,
        paymentMethod: method.name,
        paymentState,
        receivedAt: fundsReceivedAt.toISOString(),
      },
    });
    return {
      id: created.id,
      state: 'verified',
      paymentState,
      verified: nextVerified.toString(),
    };
  });
}

export async function submitPayment(
  input: unknown,
  guestScopeHash: string,
  accessToken?: string | null,
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PaymentInputError('Data pembayaran tidak valid.');
  }
  const values = input as Record<string, unknown>;
  const invoiceNumber =
    typeof values.invoiceNumber === 'string' ? values.invoiceNumber : '';
  if (!/^LJ-OT-\d{6,}$/i.test(invoiceNumber))
    throw new PaymentInputError('Nomor invoice tidak valid.');
  const amount = rupiah(values.amount, 'Nominal transfer');
  const reportedTransferAt = receivedAt(values.reportedTransferAt);
  const reference = note(values.reference, 'Referensi transfer', true);
  const paymentMethodId = uuid(values.paymentMethodId, 'Metode pembayaran');
  const proofObjectKey = values.proofObjectKey;
  if (!isPaymentProofObjectKey(proofObjectKey)) {
    throw new PaymentInputError('Unggah bukti pembayaran terlebih dahulu.');
  }
  try {
    await assertPaymentProofExists(proofObjectKey);
  } catch (error) {
    if (error instanceof UploadInputError)
      throw new PaymentInputError(error.message);
    throw error;
  }
  const accessHash = accessToken
    ? hashSecret(accessToken, 'invoice-access')
    : null;
  const db = getDb();
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({
        invoiceId: invoice.id,
        bookingId: booking.id,
        total: invoice.total,
        state: booking.state,
        holdExpiresAt: booking.holdExpiresAt,
        minimumDp: invoice.minimumDp,
      })
      .from(invoice)
      .innerJoin(booking, eq(invoice.bookingId, booking.id))
      .leftJoin(
        invoiceAccessGrant,
        and(
          eq(invoiceAccessGrant.bookingId, booking.id),
          isNull(invoiceAccessGrant.revokedAt),
          gt(invoiceAccessGrant.expiresAt, new Date()),
        ),
      )
      .where(
        and(
          eq(invoice.number, invoiceNumber),
          or(
            accessHash
              ? eq(invoiceAccessGrant.tokenHash, accessHash)
              : sql`false`,
            and(
              eq(booking.state, 'awaiting_payment'),
              eq(booking.guestScopeHash, guestScopeHash),
            ),
          ),
        ),
      )
      .limit(1);
    if (!found)
      throw new PaymentInputError(
        'Invoice tidak dapat diakses dari perangkat ini.',
      );
    // Serialisasi pengiriman bukti per booking. Dua tab yang dikirim bersamaan
    // tidak boleh sama-sama membaca sisa invoice sebelum salah satunya tersimpan.
    await tx.execute(
      sql`select id from bookings where id = ${found.bookingId} for update`,
    );
    if (
      !['awaiting_payment', 'confirmed'].includes(found.state) ||
      (found.state === 'awaiting_payment' && found.holdExpiresAt <= new Date())
    ) {
      throw new PaymentConflictError(
        'Booking ini tidak lagi menerima konfirmasi transfer. Hubungi admin untuk bantuan.',
      );
    }
    const [method] = await tx
      .select()
      .from(paymentMethod)
      .where(
        and(
          eq(paymentMethod.id, paymentMethodId),
          eq(paymentMethod.isActive, true),
          isNull(paymentMethod.archivedAt),
        ),
      )
      .limit(1);
    if (!method) {
      throw new PaymentInputError(
        'Metode pembayaran tidak aktif atau tidak ditemukan.',
      );
    }
    const previous = await tx
      .select({ amount: payment.amount })
      .from(payment)
      .where(
        and(
          eq(payment.invoiceId, found.invoiceId),
          or(eq(payment.state, 'submitted'), eq(payment.state, 'verified')),
        ),
      );
    const outstanding = BigInt(found.total) - sum(previous);
    if (BigInt(amount) > outstanding) {
      throw new PaymentInputError(
        `Nominal melebihi sisa total invoice. Maksimal yang dapat dikirim saat ini ${formatRupiah(outstanding)}.`,
      );
    }
    const [created] = await tx
      .insert(payment)
      .values({
        bookingId: found.bookingId,
        invoiceId: found.invoiceId,
        amount,
        paymentMethodId: method.id,
        paymentMethodSnapshot: {
          name: method.name,
          kind: method.kind,
          accountName: method.accountName,
          accountNumber: method.accountNumber,
          qrisImageUrl: method.qrisImageUrl,
          instructions: method.instructions,
        },
        reference,
        proofObjectKey,
        reportedTransferAt,
        state: 'submitted',
      })
      .returning({
        id: payment.id,
        amount: payment.amount,
        state: payment.state,
      });
    return created;
  });
}

export async function reviewPayment(
  paymentId: string,
  decision: 'verify' | 'reject',
  reviewNote: string,
  actorUserId: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from payments where id = ${paymentId} for update`,
    );
    const [found] = await tx
      .select({
        id: payment.id,
        amount: payment.amount,
        invoiceId: payment.invoiceId,
        bookingId: payment.bookingId,
        state: payment.state,
      })
      .from(payment)
      .where(eq(payment.id, paymentId))
      .limit(1);
    if (!found)
      throw new PaymentInputError('Catatan pembayaran tidak ditemukan.');
    if (found.state !== 'submitted')
      throw new PaymentConflictError(
        'Pembayaran ini sudah ditinjau sebelumnya.',
      );
    const normalizedNote = note(
      reviewNote,
      decision === 'reject' ? 'Alasan penolakan' : 'Catatan verifikasi',
      decision === 'reject',
    );
    const now = new Date();
    if (decision === 'reject') {
      await tx
        .update(payment)
        .set({
          state: 'rejected',
          reviewNote: normalizedNote,
          reviewedAt: now,
          reviewedByUserId: actorUserId,
          updatedAt: now,
        })
        .where(eq(payment.id, found.id));
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'booking',
        entityId: found.bookingId,
        action: 'payment_rejected',
        payload: { paymentId: found.id, reason: normalizedNote },
      });
      return { state: 'rejected', paymentState: null };
    }
    await tx.execute(
      sql`select id from bookings where id = ${found.bookingId} for update`,
    );
    const [document] = await tx
      .select({
        total: invoice.total,
        minimumDp: invoice.minimumDp,
        bookingState: booking.state,
        holdExpiresAt: booking.holdExpiresAt,
      })
      .from(invoice)
      .innerJoin(booking, eq(invoice.bookingId, booking.id))
      .where(eq(invoice.id, found.invoiceId))
      .limit(1);
    if (
      !document ||
      !['awaiting_payment', 'confirmed'].includes(document.bookingState) ||
      (document.bookingState === 'awaiting_payment' &&
        document.holdExpiresAt <= now)
    ) {
      throw new PaymentConflictError(
        'Booking sudah kedaluwarsa atau tidak dapat dikonfirmasi. Buka ulang booking bila kuota masih tersedia.',
      );
    }
    const verifiedRows = await tx
      .select({ amount: payment.amount })
      .from(payment)
      .where(
        and(
          eq(payment.invoiceId, found.invoiceId),
          eq(payment.state, 'verified'),
        ),
      );
    const nextVerified = sum(verifiedRows) + BigInt(found.amount);
    if (nextVerified > BigInt(document.total))
      throw new PaymentInputError(
        'Verifikasi ini membuat total pembayaran melebihi invoice.',
      );
    await tx
      .update(payment)
      .set({
        state: 'verified',
        reviewNote: normalizedNote,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        updatedAt: now,
      })
      .where(eq(payment.id, found.id));
    const paymentState =
      nextVerified >= BigInt(document.total)
        ? 'paid'
        : nextVerified >= BigInt(document.minimumDp)
          ? 'dp'
          : 'unpaid';
    if (nextVerified >= BigInt(document.minimumDp)) {
      await tx
        .update(booking)
        .set({ state: 'confirmed', confirmedAt: now, updatedAt: now })
        .where(eq(booking.id, found.bookingId));
      await tx
        .update(bookingAllocation)
        .set({ state: 'committed', expiresAt: null, updatedAt: now })
        .where(
          and(
            eq(bookingAllocation.bookingId, found.bookingId),
            eq(bookingAllocation.state, 'held'),
          ),
        );
    }
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'booking',
      entityId: found.bookingId,
      action: 'payment_verified',
      payload: { paymentId: found.id, amount: found.amount, paymentState },
    });
    return {
      state: 'verified',
      paymentState,
      verified: nextVerified.toString(),
    };
  });
}
