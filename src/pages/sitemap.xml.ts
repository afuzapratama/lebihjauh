import type { APIRoute } from 'astro';
import { publishedNews } from '../lib/public-content';
import { getPublicTrips } from '../lib/public-trips';

export const prerender = false;

const escapeXml = (value: string) =>
  value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[character]!,
  );

export const GET: APIRoute = async ({ url }) => {
  const origin =
    process.env.PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? url.origin;
  const [articles, trips] = await Promise.all([
    publishedNews(),
    getPublicTrips(),
  ]);
  const staticPages = [
    '/',
    '/trip',
    '/private-trip',
    '/about',
    '/galeri',
    '/news',
    '/pembayaran',
  ].map((path) => ({ path }));
  const entries: Array<{ path: string; updatedAt?: Date }> = [
    ...staticPages,
    ...trips.map((trip) => ({ path: `/trip/${trip.slug}` })),
    ...articles.map((article) => ({
      path: `/news/${article.slug}`,
      updatedAt: article.updatedAt,
    })),
  ];
  const body = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(new URL(entry.path, origin).toString())}</loc>${
      entry.updatedAt
        ? `\n    <lastmod>${entry.updatedAt.toISOString()}</lastmod>`
        : ''
    }
  </url>`,
    )
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  );
};
