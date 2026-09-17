import type { APIRoute } from 'astro';
import {
  createPrivateTripOffer,
  PrivateTripConflictError,
  PrivateTripInputError,
  updatePrivateTripOfferState,
} from '../../../../lib/private-trip-service';
import { toPayload, InputError } from '../../../../lib/trip-admin';

export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const validId = (value: unknown) =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const actor = locals.user?.id;
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const values = await toPayload(request);
    const requestId = validId(values.requestId);
    if (!requestId)
      throw new PrivateTripInputError('Permintaan private trip tidak valid.');
    const offer = await createPrivateTripOffer(
      requestId,
      values,
      actor,
      values.send === true || values.send === 'true',
    );
    return json({ offer }, 201);
  } catch (error) {
    if (
      error instanceof PrivateTripInputError ||
      error instanceof PrivateTripConflictError ||
      error instanceof InputError
    )
      return json(
        { message: error.message },
        error instanceof PrivateTripConflictError ? 409 : 400,
      );
    console.error('Gagal membuat penawaran private trip', error);
    return json({ message: 'Penawaran belum dapat disimpan.' }, 500);
  }
};
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const actor = locals.user?.id;
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const values = await toPayload(request);
    const offerId = validId(values.offerId);
    if (
      !offerId ||
      (values.state !== 'accepted' && values.state !== 'declined')
    )
      throw new PrivateTripInputError('Penawaran atau tindakan tidak valid.');
    const result = await updatePrivateTripOfferState(
      offerId,
      values.state,
      typeof values.note === 'string' ? values.note : '',
      actor,
    );
    return json(result);
  } catch (error) {
    if (
      error instanceof PrivateTripInputError ||
      error instanceof PrivateTripConflictError ||
      error instanceof InputError
    )
      return json(
        { message: error.message },
        error instanceof PrivateTripConflictError ? 409 : 400,
      );
    return json({ message: 'Status penawaran belum dapat diperbarui.' }, 500);
  }
};
