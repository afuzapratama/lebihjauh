import type { APIRoute } from 'astro';
import {
  createPaymentProofUpload,
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
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    return json(
      { upload: await createPaymentProofUpload(await toPayload(request)) },
      201,
    );
  } catch (error) {
    if (error instanceof UploadInputError || error instanceof InputError) {
      return json({ message: error.message }, 400);
    }
    if (error instanceof R2ConfigurationError) {
      return json({ message: error.message }, 503);
    }
    console.error('Gagal menyiapkan unggahan bukti pembayaran', error);
    return json({ message: 'Bukti pembayaran belum dapat diunggah.' }, 500);
  }
};
