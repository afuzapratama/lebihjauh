import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../../../db/client';
import { payment } from '../../../../../db/schema';
import {
  createPaymentProofReadUrl,
  R2ConfigurationError,
  UploadInputError,
} from '../../../../../lib/r2';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response('Bukti tidak ditemukan.', { status: 404 });
  try {
    const [found] = await getDb()
      .select({ proofObjectKey: payment.proofObjectKey })
      .from(payment)
      .where(eq(payment.id, id))
      .limit(1);
    if (!found?.proofObjectKey)
      return new Response('Bukti pembayaran belum tersedia.', { status: 404 });
    return Response.redirect(
      await createPaymentProofReadUrl(found.proofObjectKey),
      302,
    );
  } catch (error) {
    if (error instanceof UploadInputError)
      return new Response(error.message, { status: 404 });
    if (error instanceof R2ConfigurationError)
      return new Response(error.message, { status: 503 });
    console.error('Gagal membuka bukti pembayaran', error);
    return new Response('Bukti pembayaran belum dapat dibuka.', {
      status: 500,
    });
  }
};
