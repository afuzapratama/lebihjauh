import type { APIRoute } from 'astro';
import { desc } from 'drizzle-orm';
import { getDb } from '../../../db/client';
import { contentAlbum, galleryItem, newsArticle } from '../../../db/schema';
import {
  createContent,
  ContentInputError,
  deleteContent,
  updateContent,
} from '../../../lib/content-admin';
import { InputError, toPayload } from '../../../lib/trip-admin';
export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
export const GET: APIRoute = async () =>
  json({
    albums: await getDb()
      .select()
      .from(contentAlbum)
      .orderBy(desc(contentAlbum.createdAt)),
    gallery: await getDb()
      .select()
      .from(galleryItem)
      .orderBy(desc(galleryItem.createdAt)),
    articles: await getDb()
      .select()
      .from(newsArticle)
      .orderBy(desc(newsArticle.createdAt)),
  });
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    return json(
      {
        content: await createContent(await toPayload(request), locals.user.id),
      },
      201,
    );
  } catch (error) {
    if (error instanceof ContentInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof Error && /unique/i.test(error.message))
      return json({ message: 'Judul atau slug sudah dipakai.' }, 409);
    return json({ message: 'Konten belum dapat disimpan.' }, 500);
  }
};
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    return json({
      content: await updateContent(await toPayload(request), locals.user.id),
    });
  } catch (error) {
    if (error instanceof ContentInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof Error && /unique/i.test(error.message))
      return json({ message: 'Judul atau slug sudah dipakai.' }, 409);
    return json({ message: 'Konten belum dapat diperbarui.' }, 500);
  }
};
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    await deleteContent(await toPayload(request), locals.user.id);
    return json({ deleted: true });
  } catch (error) {
    if (error instanceof ContentInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    return json({ message: 'Konten belum dapat dihapus.' }, 500);
  }
};
