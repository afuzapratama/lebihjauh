import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BookingLookupInputError,
  canonicalWhatsApp,
  parseBookingLookupInput,
} from '../src/lib/booking-lookup';
import { createAccessToken, hashSecret } from '../src/lib/booking-security';

test('WhatsApp Indonesia dinormalisasi tanpa suffix matching', () => {
  assert.equal(canonicalWhatsApp('0812-3456-7890'), '6281234567890');
  assert.equal(canonicalWhatsApp('+62 812 3456 7890'), '6281234567890');
  assert.equal(canonicalWhatsApp('81234567890'), '6281234567890');
  assert.equal(canonicalWhatsApp('123'), '');
});

test('input lookup hanya menerima nomor booking dan WhatsApp yang valid', () => {
  assert.deepEqual(
    parseBookingLookupInput({
      number: ' lj-ot-000123 ',
      whatsapp: '081234567890',
    }),
    { number: 'LJ-OT-000123', whatsapp: '6281234567890' },
  );
  assert.throws(
    () =>
      parseBookingLookupInput({
        number: 'LJ-PT-000123',
        whatsapp: '081234567890',
      }),
    BookingLookupInputError,
  );
});

test('grant aksi pembayaran memakai token acak dan database hanya menerima hash', () => {
  const first = createAccessToken();
  const second = createAccessToken();
  assert.notEqual(first.value, second.value);
  assert.equal(first.hash, hashSecret(first.value, 'invoice-access'));
  assert.notEqual(first.hash, first.value);
});
