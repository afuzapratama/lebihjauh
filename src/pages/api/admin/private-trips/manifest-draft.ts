import type { APIRoute } from 'astro';
import {
  discardPrivateOfferManifestDraft,
  PrivateTripConflictError,
  PrivateTripInputError,
  savePrivateOfferManifestDraft,
} from '../../../../lib/private-trip-service';
import { InputError, toPayload } from '../../../../lib/trip-admin';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const offerId = (value: unknown) =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : '';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const actor = locals.user?.id;
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const values = await toPayload(request);
    const id = offerId(values.offerId);
    if (!id)
      throw new PrivateTripInputError('Penawaran private trip tidak valid.');
    return json({
      draft: await savePrivateOfferManifestDraft(id, values, actor),
    });
  } catch (error) {
    if (error instanceof PrivateTripInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof PrivateTripConflictError)
      return json({ message: error.message }, 409);
    console.error('Gagal menyimpan draf manifest private trip', error);
    return json({ message: 'Draf manifest belum dapat disimpan.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const actor = locals.user?.id;
    if (!actor) return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const values = await toPayload(request);
    const id = offerId(values.offerId);
    if (!id)
      throw new PrivateTripInputError('Penawaran private trip tidak valid.');
    await discardPrivateOfferManifestDraft(id, actor);
    return json({ deleted: true });
  } catch (error) {
    if (error instanceof PrivateTripInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof PrivateTripConflictError)
      return json({ message: error.message }, 409);
    console.error('Gagal membuang draf manifest private trip', error);
    return json({ message: 'Draf manifest belum dapat dibuang.' }, 500);
  }
};
