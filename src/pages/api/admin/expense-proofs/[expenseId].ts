import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../../db/client';
import { adminAuditLog, tripExpense } from '../../../../db/schema';
import { createExpenseProofReadUrl } from '../../../../lib/r2';

export const prerender = false;
export const GET: APIRoute = async ({ params, locals }) => {
  const expenseId = params.expenseId ?? '';
  const actorUserId = locals.user?.id;
  if (!actorUserId || !/^[0-9a-f-]{36}$/i.test(expenseId))
    return new Response('Bukti tidak ditemukan.', { status: 404 });
  const db = getDb();
  const [expense] = await db
    .select({ proofObjectKey: tripExpense.proofObjectKey })
    .from(tripExpense)
    .where(eq(tripExpense.id, expenseId))
    .limit(1);
  if (!expense?.proofObjectKey)
    return new Response('Bukti tidak ditemukan.', { status: 404 });
  try {
    const url = await createExpenseProofReadUrl(expense.proofObjectKey);
    await db.insert(adminAuditLog).values({
      actorUserId,
      entityType: 'trip_expense',
      entityId: expenseId,
      action: 'trip_expense_proof_opened',
      payload: {},
    });
    return Response.redirect(url, 302);
  } catch (error) {
    console.error('Gagal membuka bukti biaya', error);
    return new Response('Bukti belum dapat dibuka.', { status: 503 });
  }
};
