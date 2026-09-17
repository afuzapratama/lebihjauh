import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type ImageContentType = keyof typeof imageTypes;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

type PrivateR2Config = Omit<R2Config, 'publicBaseUrl'>;

export class R2ConfigurationError extends Error {}
export class UploadInputError extends Error {}

function getConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !publicBaseUrl
  ) {
    throw new R2ConfigurationError(
      'Upload foto belum siap. Lengkapi konfigurasi Cloudflare R2 di server.',
    );
  }

  try {
    const url = new URL(publicBaseUrl);
    if (url.hostname.endsWith('.r2.cloudflarestorage.com')) {
      throw new Error('S3 API endpoint is not a public media URL');
    }
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new Error('Production URL must use HTTPS');
    }
  } catch {
    throw new R2ConfigurationError(
      'R2_PUBLIC_BASE_URL harus berupa custom domain media atau URL r2.dev, bukan endpoint S3 API.',
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

function getPrivateConfig(): PrivateR2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PAYMENT_PROOF_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new R2ConfigurationError(
      'Upload bukti belum siap. Buat bucket R2 privat lalu isi R2_PAYMENT_PROOF_BUCKET_NAME di server.',
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getParticipantDocumentConfig(): PrivateR2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PARTICIPANT_DOCUMENT_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new R2ConfigurationError(
      'Upload dokumen peserta belum siap. Buat bucket R2 privat lalu isi R2_PARTICIPANT_DOCUMENT_BUCKET_NAME di server.',
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createClient(
  config: Pick<R2Config, 'accountId' | 'accessKeyId' | 'secretAccessKey'>,
) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function validateImageUpload(input: {
  fileName?: unknown;
  contentType?: unknown;
  size?: unknown;
}) {
  if (typeof input.fileName !== 'string' || !input.fileName.trim()) {
    throw new UploadInputError('Nama file foto tidak valid.');
  }
  if (
    typeof input.contentType !== 'string' ||
    !(input.contentType in imageTypes)
  ) {
    throw new UploadInputError('Gunakan foto JPEG, PNG, atau WebP.');
  }
  if (
    typeof input.size !== 'number' ||
    !Number.isSafeInteger(input.size) ||
    input.size < 1 ||
    input.size > 8 * 1024 * 1024
  ) {
    throw new UploadInputError('Ukuran foto maksimal 8 MB.');
  }

  return {
    contentType: input.contentType as ImageContentType,
    size: input.size,
  };
}

export async function createTripCoverUpload(input: {
  fileName?: unknown;
  contentType?: unknown;
  size?: unknown;
}) {
  const { contentType } = validateImageUpload(input);
  const config = getConfig();
  const extension = imageTypes[contentType];
  const now = new Date();
  const key = `trip-covers/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${extension}`;
  const client = createClient(config);
  const expiresIn = 5 * 60;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );

  return {
    uploadUrl,
    publicUrl: `${config.publicBaseUrl}/${key}`,
    contentType,
    expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
  };
}

/** Public images for Gallery and News. The prefix is fixed server-side so an
 * admin form cannot write objects outside the content-media namespace. */
export async function createContentImageUpload(
  kind: 'gallery' | 'news' | 'home' | 'about',
  input: { fileName?: unknown; contentType?: unknown; size?: unknown },
) {
  const { contentType } = validateImageUpload(input);
  const config = getConfig();
  const now = new Date();
  const key = `content/${kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${imageTypes[contentType]}`;
  const expiresIn = 5 * 60;
  const uploadUrl = await getSignedUrl(
    createClient(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
  return {
    uploadUrl,
    publicUrl: `${config.publicBaseUrl}/${key}`,
    contentType,
    expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
  };
}

const paymentProofKey = (key: string) =>
  /^payment-proofs\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(key);

export async function createPaymentProofUpload(input: {
  fileName?: unknown;
  contentType?: unknown;
  size?: unknown;
}) {
  const { contentType } = validateImageUpload(input);
  const config = getPrivateConfig();
  const now = new Date();
  const key = `payment-proofs/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${imageTypes[contentType]}`;
  const expiresIn = 5 * 60;
  const uploadUrl = await getSignedUrl(
    createClient(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: { purpose: 'payment-proof' },
    }),
    { expiresIn },
  );
  return {
    uploadUrl,
    objectKey: key,
    contentType,
    expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
  };
}

export function isPaymentProofObjectKey(value: unknown): value is string {
  return typeof value === 'string' && paymentProofKey(value);
}

export async function assertPaymentProofExists(key: string) {
  if (!paymentProofKey(key))
    throw new UploadInputError('Berkas bukti pembayaran tidak valid.');
  const config = getPrivateConfig();
  try {
    await createClient(config).send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  } catch {
    throw new UploadInputError(
      'Berkas bukti belum tersedia. Unggah ulang bukti pembayaran.',
    );
  }
}

export async function createPaymentProofReadUrl(key: string) {
  if (!paymentProofKey(key))
    throw new UploadInputError('Berkas bukti pembayaran tidak valid.');
  const config = getPrivateConfig();
  return getSignedUrl(
    createClient(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: 'inline',
    }),
    { expiresIn: 60 },
  );
}

const expenseProofKey = (key: string) =>
  /^expense-proofs\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(key);

export async function createExpenseProofUpload(input: {
  fileName?: unknown;
  contentType?: unknown;
  size?: unknown;
}) {
  const { contentType } = validateImageUpload(input);
  const config = getPrivateConfig();
  const now = new Date();
  const key = `expense-proofs/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${imageTypes[contentType]}`;
  const expiresIn = 5 * 60;
  const uploadUrl = await getSignedUrl(
    createClient(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: { purpose: 'trip-expense-proof' },
    }),
    { expiresIn },
  );
  return {
    uploadUrl,
    objectKey: key,
    contentType,
    expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
  };
}

export function isExpenseProofObjectKey(value: unknown): value is string {
  return typeof value === 'string' && expenseProofKey(value);
}

export async function assertExpenseProofExists(key: string) {
  if (!expenseProofKey(key))
    throw new UploadInputError('Berkas bukti biaya tidak valid.');
  const config = getPrivateConfig();
  try {
    await createClient(config).send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  } catch {
    throw new UploadInputError(
      'Berkas bukti biaya belum tersedia. Unggah ulang berkas.',
    );
  }
}

export async function createExpenseProofReadUrl(key: string) {
  if (!expenseProofKey(key))
    throw new UploadInputError('Berkas bukti biaya tidak valid.');
  const config = getPrivateConfig();
  return getSignedUrl(
    createClient(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: 'inline',
    }),
    { expiresIn: 60 },
  );
}

const participantDocumentKey = (key: string) =>
  /^participant-documents\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(
    key,
  );

export async function createParticipantDocumentUpload(input: {
  fileName?: unknown;
  contentType?: unknown;
  size?: unknown;
}) {
  const { contentType } = validateImageUpload(input);
  const config = getParticipantDocumentConfig();
  const now = new Date();
  const key = `participant-documents/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${imageTypes[contentType]}`;
  const expiresIn = 5 * 60;
  const uploadUrl = await getSignedUrl(
    createClient(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: { purpose: 'participant-identity-document' },
    }),
    { expiresIn },
  );
  return {
    uploadUrl,
    objectKey: key,
    contentType,
    expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
  };
}

export function isParticipantDocumentObjectKey(
  value: unknown,
): value is string {
  return typeof value === 'string' && participantDocumentKey(value);
}

export async function assertParticipantDocumentExists(key: string) {
  if (!participantDocumentKey(key)) {
    throw new UploadInputError('Berkas dokumen identitas tidak valid.');
  }
  const config = getParticipantDocumentConfig();
  try {
    await createClient(config).send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
  } catch {
    throw new UploadInputError(
      'Berkas dokumen belum tersedia. Unggah ulang foto identitas.',
    );
  }
}

export async function createParticipantDocumentReadUrl(key: string) {
  if (!participantDocumentKey(key)) {
    throw new UploadInputError('Berkas dokumen identitas tidak valid.');
  }
  const config = getParticipantDocumentConfig();
  return getSignedUrl(
    createClient(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: 'inline',
    }),
    { expiresIn: 60 },
  );
}
