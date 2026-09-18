import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const origin =
    process.env.PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? url.origin;
  const sitemap = new URL('/sitemap.xml', origin).toString();
  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /booking/
Disallow: /invoice/
Disallow: /rundown/
Disallow: /data-peserta/
Disallow: /private-trip-offer/

Sitemap: ${sitemap}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
};
