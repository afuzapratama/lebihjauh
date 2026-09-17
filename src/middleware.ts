import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/auth';

// Rute yang memerlukan login admin
const PROTECTED_PREFIXES = ['/admin', '/api/admin'];

// Rute yang tidak perlu dicek saat sudah login (hindari redirect loop)
const PUBLIC_AUTH_PATHS = ['/admin/login'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const requestUrl = new URL(ctx.request.url);
  const { pathname } = requestUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  // Preview draf hanya dapat dibuka oleh admin yang sedang login. Halaman publik
  // biasa tidak membayar biaya pemeriksaan sesi ini.
  const isDraftPreview =
    requestUrl.searchParams.get('preview') === 'draft' &&
    (pathname === '/' || pathname === '/about');

  if (!isProtected && !isDraftPreview) {
    return next();
  }

  // Halaman login sendiri boleh diakses tanpa sesi
  if (PUBLIC_AUTH_PATHS.includes(pathname)) {
    return next();
  }

  // Periksa sesi aktif
  const session = await auth.api.getSession({ headers: ctx.request.headers });

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ message: 'Autentikasi admin diperlukan.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    const loginUrl = new URL('/admin/login', ctx.request.url);
    loginUrl.searchParams.set(
      'redirect',
      `${pathname}${isDraftPreview ? '?preview=draft' : ''}`,
    );
    return ctx.redirect(loginUrl.toString(), 302);
  }

  // Simpan session di locals agar tersedia di halaman
  ctx.locals.session = session.session;
  ctx.locals.user = session.user;

  return next();
});
