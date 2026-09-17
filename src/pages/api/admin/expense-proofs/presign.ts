import type { APIRoute } from 'astro';
import {
  createExpenseProofUpload,
  R2ConfigurationError,
  UploadInputError,
} from '../../../../lib/r2';

export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    return json(await createExpenseProofUpload(await request.json()), 201);
  } catch (error) {
    if (error instanceof UploadInputError)
      return json({ message: error.message }, 422);
    if (error instanceof R2ConfigurationError)
      return json({ message: error.message }, 503);
    console.error('Gagal membuat URL unggah bukti biaya', error);
    return json({ message: 'Upload bukti biaya belum tersedia.' }, 500);
  }
};
