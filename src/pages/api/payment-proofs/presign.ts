import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
  getCookie,
  getGuestScope,
} from '../../../lib/booking-security';
import { getPublicInvoice } from '../../../lib/booking-service';
import {
  createPaymentProofUpload,
  R2ConfigurationError,
  UploadInputError,
} from '../../../lib/r2';

export const prerender = false;

const json = (body: unknown, status = 200, setCookie?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
    },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const invoiceNumber =
      typeof body?.invoiceNumber === 'string' ? body.invoiceNumber : '';
    const guest = getGuestScope(request);
    const invoice = await getPublicInvoice(
      invoiceNumber,
      guest.hash,
      getCookie(request, 'lj_invoice_access'),
    );
    if (!invoice?.canManage)
      return json(
        { message: 'Invoice tidak dapat diakses dari perangkat ini.' },
        403,
        guest.setCookie,
      );
    return json(
      { upload: await createPaymentProofUpload(body) },
      201,
      guest.setCookie,
    );
  } catch (error) {
    if (error instanceof UploadInputError)
      return json({ message: error.message }, 422);
    if (error instanceof BookingOriginError)
      return json({ message: error.message }, 403);
    if (error instanceof R2ConfigurationError)
      return json({ message: error.message }, 503);
    console.error('Gagal menyiapkan unggahan bukti dari pembeli', error);
    return json({ message: 'Bukti pembayaran belum dapat diunggah.' }, 500);
  }
};
