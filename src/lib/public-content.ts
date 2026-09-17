import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { galleryItem, newsArticle } from '../db/schema';

export const publishedGallery = () =>
  getDb()
    .select()
    .from(galleryItem)
    .where(eq(galleryItem.publicationState, 'published'))
    .orderBy(desc(galleryItem.publishedAt), desc(galleryItem.createdAt));

export const publishedNews = () =>
  getDb()
    .select()
    .from(newsArticle)
    .where(eq(newsArticle.publicationState, 'published'))
    .orderBy(desc(newsArticle.publishedAt), desc(newsArticle.createdAt));

export async function publishedArticle(slug: string) {
  const [article] = await getDb()
    .select()
    .from(newsArticle)
    .where(
      and(
        eq(newsArticle.slug, slug),
        eq(newsArticle.publicationState, 'published'),
      ),
    )
    .limit(1);
  return article ?? null;
}
