import type { APIRoute } from 'astro';
import {
  ExpenseInputError,
  recordTripExpense,
  voidTripExpense,
} from '../../../lib/trip-expenses';

export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    return json(
      {
        expense: await recordTripExpense(await request.json(), locals.user.id),
      },
      201,
    );
  } catch (error) {
    if (error instanceof ExpenseInputError)
      return json({ message: error.message }, 422);
    console.error('Gagal mencatat pengeluaran', error);
    return json({ message: 'Pengeluaran belum dapat dicatat.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    return json({
      expense: await voidTripExpense(await request.json(), locals.user.id),
    });
  } catch (error) {
    if (error instanceof ExpenseInputError)
      return json({ message: error.message }, 422);
    console.error('Gagal membatalkan pengeluaran', error);
    return json({ message: 'Pengeluaran belum dapat dibatalkan.' }, 500);
  }
};
