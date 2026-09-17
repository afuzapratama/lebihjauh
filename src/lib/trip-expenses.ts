import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { adminAuditLog, departure, tripExpense } from '../db/schema';
import {
  assertExpenseProofExists,
  isExpenseProofObjectKey,
  UploadInputError,
} from './r2';

export class ExpenseInputError extends Error {}

const categories = [
  'transport',
  'guide',
  'porter',
  'simaksi',
  'logistik',
  'penginapan',
  'sewa_alat',
  'dokumentasi',
  'komisi',
  'lainnya',
] as const;

const uuid = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value))
    throw new ExpenseInputError(`${label} tidak valid.`);
  return value;
};
const text = (value: unknown, label: string, min: number, max: number) => {
  const result =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (result.length < min) throw new ExpenseInputError(`${label} wajib diisi.`);
  if (result.length > max)
    throw new ExpenseInputError(`${label} terlalu panjang.`);
  return result;
};

const expenseDate = (value: unknown) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  // Input datetime-local tidak membawa zona waktu. Biaya operasional LebihJauh
  // dicatat dalam WIB agar hasilnya tetap sama pada server lokal dan produksi.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return new Date(`${raw}:00+07:00`);
  }
  return new Date(raw);
};

export async function recordTripExpense(input: unknown, actorUserId: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ExpenseInputError('Data pengeluaran tidak valid.');
  const values = input as Record<string, unknown>;
  const scope = values.scope === 'general' ? 'general' : 'departure';
  const departureId =
    scope === 'departure' ? uuid(values.departureId, 'Jadwal') : null;
  const category = text(values.category, 'Kategori', 2, 40);
  if (!categories.includes(category as (typeof categories)[number]))
    throw new ExpenseInputError('Kategori pengeluaran tidak valid.');
  const vendor = text(values.vendor, 'Vendor / penerima', 2, 160);
  const method = text(values.method, 'Metode pembayaran', 2, 80);
  const reference =
    typeof values.reference === 'string'
      ? values.reference.trim().replace(/\s+/g, ' ')
      : '';
  if (reference.length > 500)
    throw new ExpenseInputError('Referensi terlalu panjang.');
  const amount = typeof values.amount === 'string' ? values.amount : '';
  if (!/^\d+$/.test(amount) || BigInt(amount) < 1n)
    throw new ExpenseInputError('Nominal pengeluaran tidak valid.');
  const paidAt = expenseDate(values.paidAt);
  if (Number.isNaN(paidAt.getTime()))
    throw new ExpenseInputError('Tanggal biaya tidak valid.');
  if (paidAt.getTime() > Date.now() + 5 * 60_000)
    throw new ExpenseInputError('Tanggal biaya tidak boleh di masa depan.');
  const proofObjectKey =
    typeof values.proofObjectKey === 'string' && values.proofObjectKey
      ? values.proofObjectKey
      : null;
  if (proofObjectKey && !isExpenseProofObjectKey(proofObjectKey))
    throw new ExpenseInputError('Berkas bukti biaya tidak valid.');
  if (proofObjectKey) {
    try {
      await assertExpenseProofExists(proofObjectKey);
    } catch (error) {
      if (error instanceof UploadInputError)
        throw new ExpenseInputError(error.message);
      throw error;
    }
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    if (departureId) {
      const [schedule] = await tx
        .select({ id: departure.id })
        .from(departure)
        .where(eq(departure.id, departureId))
        .limit(1);
      if (!schedule) throw new ExpenseInputError('Jadwal tidak ditemukan.');
    }
    const [created] = await tx
      .insert(tripExpense)
      .values({
        departureId,
        scope,
        category,
        paidAt,
        vendor,
        amount,
        method,
        reference: reference || null,
        proofObjectKey,
        recordedByUserId: actorUserId,
      })
      .returning();
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'trip_expense',
      entityId: created.id,
      action: 'trip_expense_recorded',
      payload: { departureId, scope, category, amount },
    });
    return created;
  });
}

export async function voidTripExpense(input: unknown, actorUserId: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ExpenseInputError('Data pembatalan tidak valid.');
  const values = input as Record<string, unknown>;
  const expenseId = uuid(values.expenseId, 'Pengeluaran');
  const reason = text(values.reason, 'Alasan pembatalan', 5, 500);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: tripExpense.id, state: tripExpense.state })
      .from(tripExpense)
      .where(eq(tripExpense.id, expenseId))
      .limit(1);
    if (!existing) throw new ExpenseInputError('Pengeluaran tidak ditemukan.');
    if (existing.state === 'voided')
      throw new ExpenseInputError('Pengeluaran sudah dibatalkan.');
    const now = new Date();
    const [updated] = await tx
      .update(tripExpense)
      .set({
        state: 'voided',
        voidReason: reason,
        voidedByUserId: actorUserId,
        voidedAt: now,
        updatedAt: now,
      })
      .where(eq(tripExpense.id, expenseId))
      .returning();
    await tx.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'trip_expense',
      entityId: expenseId,
      action: 'trip_expense_voided',
      payload: { reason },
    });
    return updated;
  });
}
