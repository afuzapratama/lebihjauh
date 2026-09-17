import type { APIRoute } from 'astro';
import {
  isSitePageKey,
  saveSitePage,
  SiteContentInputError,
} from '../../../lib/site-content';
import { InputError, toPayload } from '../../../lib/trip-admin';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const values = await toPayload(request);
    if (!isSitePageKey(values.page))
      throw new SiteContentInputError('Halaman tidak valid.');
    if (values.action !== 'draft' && values.action !== 'publish')
      throw new SiteContentInputError('Tindakan tidak valid.');
    return json({
      page: await saveSitePage(
        values.page,
        values.content,
        locals.user.id,
        values.action === 'publish',
      ),
    });
  } catch (error) {
    if (error instanceof SiteContentInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    return json({ message: 'Pengaturan halaman belum dapat disimpan.' }, 500);
  }
};
