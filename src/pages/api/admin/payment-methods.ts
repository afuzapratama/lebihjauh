import type { APIRoute } from 'astro';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../../db/client';
import { adminAuditLog, paymentMethod } from '../../../db/schema';
import {
  PaymentMethodInputError,
  parsePaymentMethod,
} from '../../../lib/payment-methods';
import { InputError, toPayload } from '../../../lib/trip-admin';

export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const validId = (value: unknown) =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null;

export const GET: APIRoute = async () =>
  json({
    methods: await getDb()
      .select()
      .from(paymentMethod)
      .where(isNull(paymentMethod.archivedAt))
      .orderBy(asc(paymentMethod.sortOrder), asc(paymentMethod.name)),
  });
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const actor = locals.user?.id;
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const [created] = await getDb()
      .insert(paymentMethod)
      .values(parsePaymentMethod(values))
      .returning();
    await getDb()
      .insert(adminAuditLog)
      .values({
        actorUserId: actor,
        entityType: 'payment_method',
        entityId: created.id,
        action: 'created',
        payload: { name: created.name, kind: created.kind },
      });
    return json({ method: created }, 201);
  } catch (error) {
    if (error instanceof PaymentMethodInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    return json({ message: 'Metode pembayaran belum dapat disimpan.' }, 500);
  }
};
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const actor = locals.user?.id;
    const id = validId(values.id);
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    if (!id) throw new PaymentMethodInputError('ID metode tidak valid.');
    const [updated] = await getDb()
      .update(paymentMethod)
      .set({
        ...parsePaymentMethod(values),
        isActive: values.isActive !== false,
        updatedAt: new Date(),
      })
      .where(and(eq(paymentMethod.id, id), isNull(paymentMethod.archivedAt)))
      .returning();
    if (!updated)
      throw new PaymentMethodInputError('Metode pembayaran tidak ditemukan.');
    await getDb()
      .insert(adminAuditLog)
      .values({
        actorUserId: actor,
        entityType: 'payment_method',
        entityId: id,
        action: 'updated',
        payload: { name: updated.name },
      });
    return json({ method: updated });
  } catch (error) {
    if (error instanceof PaymentMethodInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    return json({ message: 'Metode pembayaran belum dapat diperbarui.' }, 500);
  }
};
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const actor = locals.user?.id;
    const id = validId(values.id);
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    if (!id) throw new PaymentMethodInputError('ID metode tidak valid.');
    const [archived] = await getDb()
      .update(paymentMethod)
      .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(eq(paymentMethod.id, id), isNull(paymentMethod.archivedAt)))
      .returning();
    if (!archived)
      throw new PaymentMethodInputError('Metode pembayaran tidak ditemukan.');
    await getDb()
      .insert(adminAuditLog)
      .values({
        actorUserId: actor,
        entityType: 'payment_method',
        entityId: id,
        action: 'archived',
        payload: { name: archived.name },
      });
    return json({ archived: true });
  } catch (error) {
    if (error instanceof PaymentMethodInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    return json(
      { message: 'Metode pembayaran belum dapat dinonaktifkan.' },
      500,
    );
  }
};
