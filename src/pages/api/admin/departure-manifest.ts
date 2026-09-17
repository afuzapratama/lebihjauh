import type { APIRoute } from 'astro';
import {
  DepartureOperationsConflictError,
  DepartureOperationsInputError,
  includeBookingInDepartureManifest,
  removeBookingFromDepartureManifest,
} from '../../../lib/departure-operations';
import { InputError, toPayload } from '../../../lib/trip-admin';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const action = typeof values.action === 'string' ? values.action : '';
    if (action === 'include') {
      return json({
        manifest: await includeBookingInDepartureManifest(values, actorUserId),
      });
    }
    if (action === 'remove') {
      return json({
        manifest: await removeBookingFromDepartureManifest(values, actorUserId),
      });
    }
    throw new DepartureOperationsInputError('Tindakan manifest tidak dikenal.');
  } catch (error) {
    if (
      error instanceof DepartureOperationsInputError ||
      error instanceof InputError
    ) {
      return json({ message: error.message }, 400);
    }
    if (error instanceof DepartureOperationsConflictError) {
      return json({ message: error.message }, 409);
    }
    console.error('Gagal memperbarui manifest jadwal', error);
    return json({ message: 'Manifest jadwal belum dapat diperbarui.' }, 500);
  }
};
