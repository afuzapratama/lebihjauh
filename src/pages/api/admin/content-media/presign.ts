import type { APIRoute } from 'astro';
import {
  createContentImageUpload,
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
    const values = await toPayload(request);
    const kind = ['gallery', 'news', 'home', 'about'].includes(
      String(values.kind),
    )
      ? (values.kind as 'gallery' | 'news' | 'home' | 'about')
      : null;
    if (!kind) throw new UploadInputError('Jenis media tidak valid.');
    return json(await createContentImageUpload(kind, values), 201);
  } catch (error) {
    if (error instanceof InputError || error instanceof UploadInputError)
      return json({ message: error.message }, 400);
    if (error instanceof R2ConfigurationError)
      return json({ message: error.message }, 503);
    return json({ message: 'Gagal menyiapkan upload foto.' }, 500);
  }
};
