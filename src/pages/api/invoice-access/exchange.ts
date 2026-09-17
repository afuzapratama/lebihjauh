import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  BookingOriginError,
  invoiceAccessCookie,
} from '../../../lib/booking-security';
import { exchangeInvoiceAccessToken } from '../../../lib/booking-service';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
      return new Response(
        JSON.stringify({ message: 'Tautan invoice tidak valid.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    const result = await exchangeInvoiceAccessToken(token);
    if (!result) {
      return new Response(
        JSON.stringify({ message: 'Tautan invoice tidak berlaku.' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    return new Response(
      JSON.stringify({ invoicePath: `/invoice/${result.number}` }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': invoiceAccessCookie(token),
        },
      },
    );
  } catch (error) {
    if (error instanceof BookingOriginError) {
      return new Response(JSON.stringify({ message: error.message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ message: 'Tautan invoice belum dapat diproses.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
