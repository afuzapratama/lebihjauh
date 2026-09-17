import type { APIRoute } from 'astro';
import {
  BookingAdminConflictError,
  BookingAdminInputError,
  cancelBookingByCustomer,
  issueReplacementInvoiceLink,
  reopenExpiredBooking,
} from '../../../lib/booking-admin';
import { InputError, toPayload } from '../../../lib/trip-admin';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const id = (value: unknown) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new BookingAdminInputError('ID booking tidak valid.');
  }
  return value;
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const values = await toPayload(request);
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const bookingId = id(values.bookingId);
    const action = typeof values.action === 'string' ? values.action : '';
    if (action === 'cancel') {
      const reason = typeof values.reason === 'string' ? values.reason : '';
      return json({
        booking: await cancelBookingByCustomer(bookingId, reason, actorUserId),
      });
    }
    if (action === 'reopen') {
      return json({
        booking: await reopenExpiredBooking(bookingId, actorUserId),
      });
    }
    if (action === 'reissue-invoice') {
      return json({
        invoice: await issueReplacementInvoiceLink(bookingId, actorUserId),
      });
    }
    throw new BookingAdminInputError('Tindakan booking tidak dikenal.');
  } catch (error) {
    if (
      error instanceof BookingAdminInputError ||
      error instanceof InputError
    ) {
      return json({ message: error.message }, 400);
    }
    if (error instanceof BookingAdminConflictError)
      return json({ message: error.message }, 409);
    console.error('Gagal memproses tindakan booking admin', error);
    return json({ message: 'Tindakan booking belum dapat diproses.' }, 500);
  }
};
