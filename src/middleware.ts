import { defineMiddleware } from 'astro:middleware';
import { eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { user } from './db/schema';
import { auth } from './lib/auth';

// Rute yang memerlukan login admin
const PROTECTED_PREFIXES = ['/admin', '/api/admin'];

// Rute yang tidak perlu dicek saat sudah login (hindari redirect loop)
const PUBLIC_AUTH_PATHS = ['/admin/login'];

const matchesRoute = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const secureAdminResponse = (response: Response) => {
  // Header milik Response.redirect bersifat immutable, jadi salin responsenya
  // sebelum menambahkan kebijakan keamanan.
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const onRequest = defineMiddleware(async (ctx, next) => {
  const requestUrl = new URL(ctx.request.url);
  const { pathname } = requestUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    matchesRoute(pathname, prefix),
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
    return secureAdminResponse(await next());
  }

  // Periksa sesi aktif
  const session = await auth.api.getSession({ headers: ctx.request.headers });

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return secureAdminResponse(
        new Response(
          JSON.stringify({ message: 'Autentikasi admin diperlukan.' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    }
    const loginUrl = new URL('/admin/login', ctx.request.url);
    loginUrl.searchParams.set(
      'redirect',
      `${pathname}${isDraftPreview ? '?preview=draft' : ''}`,
    );
    return secureAdminResponse(ctx.redirect(loginUrl.toString(), 302));
  }

  // Cookie cache mempercepat validasi sesi, tetapi status aktif tetap dibaca dari
  // database pada setiap request admin agar pencabutan akses berlaku langsung.
  const [currentUser] = await getDb()
    .select({ isActive: user.isActive })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!currentUser?.isActive) {
    if (pathname.startsWith('/api/')) {
      return secureAdminResponse(
        new Response(JSON.stringify({ message: 'Akun admin tidak aktif.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return secureAdminResponse(ctx.redirect('/admin/login?inactive=1', 302));
  }

  // Simpan session di locals agar tersedia di halaman
  ctx.locals.session = session.session;
  ctx.locals.user = session.user;

  return secureAdminResponse(await next());
});
