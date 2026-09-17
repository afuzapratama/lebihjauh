import type { APIRoute } from 'astro';
import { desc } from 'drizzle-orm';
import { getDb } from '../../../db/client';
import { privateTripRequest } from '../../../db/schema';
import {
  PrivateTripInputError,
  updatePrivateTripRequestState,
} from '../../../lib/private-trip-service';
import { toPayload, InputError } from '../../../lib/trip-admin';

export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const validId = (value: unknown) =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null;

export const GET: APIRoute = async () => {
  const requests = await getDb()
    .select()
    .from(privateTripRequest)
    .orderBy(desc(privateTripRequest.createdAt));
  return json({ requests });
};
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const actor = locals.user?.id;
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const values = await toPayload(request);
    const id = validId(values.id);
    if (!id || typeof values.state !== 'string')
      throw new PrivateTripInputError('Permintaan atau status tidak valid.');
    const updated = await updatePrivateTripRequestState(
      id,
      values.state as never,
      actor,
    );
    return json({ request: updated });
  } catch (error) {
    if (error instanceof PrivateTripInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    return json(
      { message: 'Status private trip belum dapat diperbarui.' },
      500,
    );
  }
};
