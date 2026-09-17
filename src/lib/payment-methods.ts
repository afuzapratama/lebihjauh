import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import { paymentMethod } from '../db/schema';

export class PaymentMethodInputError extends Error {}
const kinds = ['bank_transfer', 'ewallet', 'qris'] as const;
export type PaymentMethodKind = (typeof kinds)[number];

const text = (value: unknown, name: string, max: number, required = false) => {
  const result =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && !result)
    throw new PaymentMethodInputError(`${name} wajib diisi.`);
  if (result.length > max)
    throw new PaymentMethodInputError(`${name} terlalu panjang.`);
  return result || null;
};

export function parsePaymentMethod(value: Record<string, unknown>) {
  const kind = text(value.kind, 'Jenis metode', 30, true) as PaymentMethodKind;
  if (!kinds.includes(kind))
    throw new PaymentMethodInputError('Jenis metode pembayaran tidak valid.');
  const name = text(value.name, 'Nama metode', 100, true)!;
  const accountName = text(value.accountName, 'Atas nama', 120);
  const accountNumber = text(value.accountNumber, 'Nomor rekening/akun', 120);
  const qrisImageUrl = text(value.qrisImageUrl, 'URL QRIS', 2_000);
  if (kind !== 'qris' && (!accountName || !accountNumber)) {
    throw new PaymentMethodInputError(
      'Atas nama dan nomor rekening/akun wajib diisi.',
    );
  }
  if (kind === 'qris' && !qrisImageUrl)
    throw new PaymentMethodInputError('URL gambar QRIS wajib diisi.');
  if (qrisImageUrl) {
    try {
      if (!/^https?:$/.test(new URL(qrisImageUrl).protocol)) throw new Error();
    } catch {
      throw new PaymentMethodInputError(
        'URL QRIS harus http atau https yang valid.',
      );
    }
  }
  const sortOrder = Number(value.sortOrder ?? 0);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999)
    throw new PaymentMethodInputError('Urutan tampil tidak valid.');
  return {
    kind,
    name,
    accountName,
    accountNumber,
    qrisImageUrl,
    instructions: text(value.instructions, 'Instruksi', 2_000) ?? '',
    sortOrder,
  };
}

export async function activePaymentMethods() {
  return getDb()
    .select()
    .from(paymentMethod)
    .where(
      and(eq(paymentMethod.isActive, true), isNull(paymentMethod.archivedAt)),
    )
    .orderBy(asc(paymentMethod.sortOrder), asc(paymentMethod.name));
}
