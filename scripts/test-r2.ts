/**
 * Health check Cloudflare R2 yang aman untuk dijalankan berulang.
 * Membuat satu object test dengan key unik, membaca lewat domain publik dan CORS,
 * lalu selalu menghapus object itu.
 *
 * npm run test:r2
 */
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { createTripCoverUpload } from '../src/lib/r2';

const required = (name: string) => {
  const value = process.env[name];
  if (!value || value.startsWith('GANTI_')) {
    throw new Error(`${name} belum diisi di .env.`);
  }
  return value;
};

const accountId = required('R2_ACCOUNT_ID');
const accessKeyId = required('R2_ACCESS_KEY_ID');
const secretAccessKey = required('R2_SECRET_ACCESS_KEY');
const bucket = required('R2_BUCKET_NAME');
const publicBaseUrl = new URL(required('R2_PUBLIC_BASE_URL'));
if (publicBaseUrl.hostname.endsWith('.r2.cloudflarestorage.com')) {
  throw new Error(
    'R2_PUBLIC_BASE_URL masih memakai endpoint S3 API. Isi dengan custom domain media atau URL r2.dev.',
  );
}
const corsOrigin =
  process.env.R2_CORS_TEST_ORIGIN ??
  process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')[0]?.trim() ??
  process.env.BETTER_AUTH_URL;

if (!corsOrigin)
  throw new Error('Atur R2_CORS_TEST_ORIGIN atau BETTER_AUTH_URL di .env.');

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: { accessKeyId, secretAccessKey },
});

const webp = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=',
  'base64',
);
let objectKey = '';

try {
  const signed = await createTripCoverUpload({
    fileName: `r2-health-${randomUUID()}.webp`,
    contentType: 'image/webp',
    size: webp.byteLength,
  });
  objectKey = new URL(signed.publicUrl).pathname.slice(1);

  const put = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': signed.contentType },
    body: webp,
  });
  if (!put.ok) throw new Error(`Upload R2 ditolak (${put.status}).`);

  const metadata = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
  );
  if (
    metadata.ContentType !== 'image/webp' ||
    metadata.ContentLength !== webp.byteLength
  ) {
    throw new Error('Metadata object R2 tidak sesuai dengan file uji.');
  }

  const publicResponse = await fetch(signed.publicUrl, { cache: 'no-store' });
  if (!publicResponse.ok) {
    throw new Error(
      `Foto tidak dapat dibaca dari R2_PUBLIC_BASE_URL (${publicResponse.status}).`,
    );
  }

  const corsResponse = await fetch(signed.publicUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: corsOrigin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });
  const allowedOrigin = corsResponse.headers.get('access-control-allow-origin');
  const methods =
    corsResponse.headers.get('access-control-allow-methods') ?? '';
  if (
    !corsResponse.ok ||
    allowedOrigin !== corsOrigin ||
    !methods.includes('PUT')
  ) {
    throw new Error(
      `CORS R2 belum mengizinkan PUT dari ${corsOrigin}. Periksa policy bucket.`,
    );
  }

  console.log(
    'R2 berhasil: signed upload, object metadata, custom domain, dan CORS PUT terverifikasi.',
  );
} finally {
  if (objectKey) {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
    console.log('Object health check sudah dihapus dari R2.');
  }
}
