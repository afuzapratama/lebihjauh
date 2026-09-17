import { getDb } from '../db/client';
import { eq } from 'drizzle-orm';
import {
  adminAuditLog,
  contentAlbum,
  galleryItem,
  newsArticle,
} from '../db/schema';

type Values = Record<string, unknown>;
export class ContentInputError extends Error {}
const text = (v: Values, n: string, max: number, required = false) => {
  const x = typeof v[n] === 'string' ? v[n].trim().replace(/\s+/g, ' ') : '';
  if (required && !x) throw new ContentInputError(`${n} wajib diisi.`);
  if (x.length > max) throw new ContentInputError(`${n} terlalu panjang.`);
  return x;
};
const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const state = (v: Values) => {
  const x = text(v, 'publicationState', 20, true);
  if (x !== 'draft' && x !== 'published')
    throw new ContentInputError('Status publikasi tidak valid.');
  return x;
};
const safeUrl = (v: Values, n: string) => {
  const x = text(v, n, 2000);
  if (!x) return null;
  try {
    const u = new URL(x);
    if (u.protocol !== 'https:') throw new Error();
    if (
      ![
        'instagram.com',
        'www.instagram.com',
        'tiktok.com',
        'www.tiktok.com',
      ].includes(u.hostname)
    )
      throw new Error();
    return u.toString();
  } catch {
    throw new ContentInputError(
      'Embed sosial hanya boleh berupa URL HTTPS Instagram atau TikTok.',
    );
  }
};
const publicImage = (v: Values, n: string, required = false) => {
  const x = text(v, n, 2000, required);
  if (!x) return null;
  try {
    const u = new URL(x);
    if (u.protocol !== 'https:') throw new Error();
    return u.toString();
  } catch {
    throw new ContentInputError('URL foto tidak valid.');
  }
};
export async function createContent(values: Values, actor: string) {
  const type = text(values, 'type', 20, true);
  const db = getDb();
  if (type === 'album') {
    const name = text(values, 'name', 100, true);
    const [row] = await db
      .insert(contentAlbum)
      .values({
        name,
        slug: slugify(name),
        description: text(values, 'description', 500),
        publicationState: state(values),
      })
      .returning();
    await db.insert(adminAuditLog).values({
      actorUserId: actor,
      entityType: 'content_album',
      entityId: row.id,
      action: 'created',
      payload: { name },
    });
    return row;
  }
  if (type === 'gallery') {
    const [row] = await db
      .insert(galleryItem)
      .values({
        imageUrl: publicImage(values, 'imageUrl', true)!,
        altText: text(values, 'altText', 180, true),
        caption: text(values, 'caption', 180, true),
        socialUrl: safeUrl(values, 'socialUrl'),
        publicationState: state(values),
        publishedAt:
          values.publicationState === 'published' ? new Date() : null,
        sortOrder: Number(text(values, 'sortOrder', 8) || '0') || 0,
      })
      .returning();
    await db.insert(adminAuditLog).values({
      actorUserId: actor,
      entityType: 'gallery_item',
      entityId: row.id,
      action: 'created',
      payload: { caption: row.caption },
    });
    return row;
  }
  if (type === 'news') {
    const title = text(values, 'title', 180, true);
    const [row] = await db
      .insert(newsArticle)
      .values({
        title,
        slug: slugify(title),
        category: text(values, 'category', 60, true),
        excerpt: text(values, 'excerpt', 400, true),
        body: text(values, 'body', 20_000, true),
        coverImageUrl: publicImage(values, 'coverImageUrl'),
        coverAltText: text(values, 'coverAltText', 180),
        socialUrl: safeUrl(values, 'socialUrl'),
        publicationState: state(values),
        publishedAt:
          values.publicationState === 'published' ? new Date() : null,
        createdByUserId: actor,
      })
      .returning();
    await db.insert(adminAuditLog).values({
      actorUserId: actor,
      entityType: 'news_article',
      entityId: row.id,
      action: 'created',
      payload: { title },
    });
    return row;
  }
  throw new ContentInputError('Jenis konten tidak valid.');
}

const validId = (values: Values) => {
  const id = text(values, 'id', 64, true);
  if (!/^[0-9a-f-]{36}$/i.test(id))
    throw new ContentInputError('ID konten tidak valid.');
  return id;
};

export async function updateContent(values: Values, actor: string) {
  const type = text(values, 'type', 20, true);
  const id = validId(values);
  const now = new Date();
  const db = getDb();
  if (type === 'gallery') {
    const [row] = await db
      .update(galleryItem)
      .set({
        imageUrl: publicImage(values, 'imageUrl', true)!,
        altText: text(values, 'altText', 180, true),
        caption: text(values, 'caption', 180, true),
        socialUrl: safeUrl(values, 'socialUrl'),
        publicationState: state(values),
        publishedAt: values.publicationState === 'published' ? now : null,
        updatedAt: now,
      })
      .where(eq(galleryItem.id, id))
      .returning();
    if (!row) throw new ContentInputError('Foto galeri tidak ditemukan.');
    await db.insert(adminAuditLog).values({
      actorUserId: actor,
      entityType: 'gallery_item',
      entityId: id,
      action: 'updated',
      payload: { caption: row.caption },
    });
    return row;
  }
  if (type === 'news') {
    const title = text(values, 'title', 180, true);
    const [row] = await db
      .update(newsArticle)
      .set({
        title,
        slug: slugify(title),
        category: text(values, 'category', 60, true),
        excerpt: text(values, 'excerpt', 400, true),
        body: text(values, 'body', 20_000, true),
        coverImageUrl: publicImage(values, 'coverImageUrl'),
        coverAltText: text(values, 'coverAltText', 180),
        socialUrl: safeUrl(values, 'socialUrl'),
        publicationState: state(values),
        publishedAt: values.publicationState === 'published' ? now : null,
        updatedAt: now,
      })
      .where(eq(newsArticle.id, id))
      .returning();
    if (!row) throw new ContentInputError('Artikel tidak ditemukan.');
    await db.insert(adminAuditLog).values({
      actorUserId: actor,
      entityType: 'news_article',
      entityId: id,
      action: 'updated',
      payload: { title: row.title },
    });
    return row;
  }
  throw new ContentInputError('Jenis konten tidak valid.');
}

export async function deleteContent(values: Values, actor: string) {
  const type = text(values, 'type', 20, true);
  const id = validId(values);
  const db = getDb();
  if (type === 'gallery') {
    const [removed] = await db
      .delete(galleryItem)
      .where(eq(galleryItem.id, id))
      .returning();
    if (!removed) throw new ContentInputError('Foto galeri tidak ditemukan.');
    await db.insert(adminAuditLog).values({
      actorUserId: actor,
      entityType: 'gallery_item',
      entityId: id,
      action: 'deleted',
      payload: { caption: removed.caption },
    });
    return removed;
  }
  if (type === 'news') {
    const [removed] = await db
      .delete(newsArticle)
      .where(eq(newsArticle.id, id))
      .returning();
    if (!removed) throw new ContentInputError('Artikel tidak ditemukan.');
    await db.insert(adminAuditLog).values({
      actorUserId: actor,
      entityType: 'news_article',
      entityId: id,
      action: 'deleted',
      payload: { title: removed.title },
    });
    return removed;
  }
  throw new ContentInputError('Jenis konten tidak valid.');
}
