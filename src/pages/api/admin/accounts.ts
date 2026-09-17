import type { APIRoute } from 'astro';
import {
  AdminAccountError,
  createAdminAccount,
  listAdminAccounts,
  setAdminAccountActive,
} from '../../../lib/admin-accounts';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const readBody = async (request: Request) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new AdminAccountError('Origin permintaan tidak diizinkan.', 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AdminAccountError('Format permintaan harus JSON.', 415);
  return (await request.json()) as Record<string, unknown>;
};

export const GET: APIRoute = async () =>
  json({ accounts: await listAdminAccounts() });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await readBody(request);
    const account = await createAdminAccount({
      name: body.name,
      email: body.email,
      password: body.password,
    });
    return json({ account }, 201);
  } catch (error) {
    if (error instanceof AdminAccountError)
      return json({ message: error.message }, error.status);
    return json({ message: 'Akun admin belum dapat dibuat.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      throw new AdminAccountError('Sesi admin tidak ditemukan.', 401);
    const body = await readBody(request);
    const account = await setAdminAccountActive({
      actorUserId: locals.user.id,
      userId: body.userId,
      isActive: body.isActive,
    });
    return json({ account });
  } catch (error) {
    if (error instanceof AdminAccountError)
      return json({ message: error.message }, error.status);
    return json({ message: 'Status akun belum dapat diubah.' }, 500);
  }
};
