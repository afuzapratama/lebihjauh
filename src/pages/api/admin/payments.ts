import type { APIRoute } from 'astro';
import {
  PaymentConflictError,
  PaymentInputError,
  recordVerifiedPayment,
  reviewPayment,
} from '../../../lib/payment-service';
import { InputError, toPayload } from '../../../lib/trip-admin';

export const prerender = false;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    if (values.action === 'record-verify') {
      return json(
        { payment: await recordVerifiedPayment(values, actorUserId) },
        201,
      );
    }
    const paymentId =
      typeof values.paymentId === 'string' &&
      /^[0-9a-f-]{36}$/i.test(values.paymentId)
        ? values.paymentId
        : '';
    const decision =
      values.decision === 'verify' || values.decision === 'reject'
        ? values.decision
        : null;
    if (!paymentId || !decision)
      throw new PaymentInputError('Tindakan pembayaran tidak valid.');
    const note = typeof values.note === 'string' ? values.note : '';
    return json({
      payment: await reviewPayment(paymentId, decision, note, actorUserId),
    });
  } catch (error) {
    if (error instanceof PaymentInputError || error instanceof InputError)
      return json({ message: error.message }, 400);
    if (error instanceof PaymentConflictError)
      return json({ message: error.message }, 409);
    console.error('Gagal meninjau pembayaran', error);
    return json({ message: 'Pembayaran belum dapat diproses.' }, 500);
  }
};
