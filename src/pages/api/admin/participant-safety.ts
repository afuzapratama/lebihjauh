import type { APIRoute } from 'astro';
import {
  reviewParticipantSafety,
  SafetyReviewInputError,
} from '../../../lib/admin-participant-safety';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    return json({
      safety: await reviewParticipantSafety(
        await request.json(),
        locals.user.id,
      ),
    });
  } catch (error) {
    if (error instanceof SafetyReviewInputError)
      return json({ message: error.message }, 422);
    console.error('Gagal memeriksa data keselamatan peserta', error);
    return json({ message: 'Pemeriksaan belum dapat disimpan.' }, 500);
  }
};
