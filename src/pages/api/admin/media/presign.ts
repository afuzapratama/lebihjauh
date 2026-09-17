import type { APIRoute } from 'astro';
import {
  createTripCoverUpload,
  R2ConfigurationError,
  UploadInputError,
} from '../../../../lib/r2';
import { InputError, toPayload } from '../../../../lib/trip-admin';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id) {
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    }
    const upload = await createTripCoverUpload(await toPayload(request));
    return json(upload, 201);
  } catch (error) {
    if (error instanceof InputError || error instanceof UploadInputError) {
      return json({ message: error.message }, 400);
    }
    if (error instanceof R2ConfigurationError) {
      return json({ message: error.message }, 503);
    }
    console.error('Gagal menerbitkan URL upload R2', error);
    return json({ message: 'Gagal menyiapkan upload foto. Coba lagi.' }, 500);
  }
};
