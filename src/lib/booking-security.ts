import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

export class BookingConfigurationError extends Error {}
export class BookingOriginError extends Error {}

const cookieName = 'lj_booking_guest';

function encryptionKey() {
  // `process.env` adalah sumber utama saat Node production. Pada dev server Astro,
  // Vite dapat memuat ulang .env tanpa mengganti object process lama; env SSR Vite
  // dipakai sebagai fallback agar perubahan konfigurasi ikut terbaca saat reload.
  const value =
    process.env.BOOKING_DATA_ENCRYPTION_KEY ||
    import.meta.env.BOOKING_DATA_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new BookingConfigurationError(
      'BOOKING_DATA_ENCRYPTION_KEY harus berupa 64 karakter heksadesimal.',
    );
  }
  return Buffer.from(value, 'hex');
}

/** Fail early instead of accepting a form whose identity data cannot be secured. */
export function assertBookingConfiguration() {
  encryptionKey();
}

/**
 * Public write endpoints use the browser Origin header as a CSRF boundary.
 * SameSite cookies are a useful second layer, but not the only control.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;

  const configuredUrl =
    process.env.BETTER_AUTH_URL || import.meta.env.BETTER_AUTH_URL;
  const configuredOrigin =
    configuredUrl && URL.canParse(configuredUrl)
      ? new URL(configuredUrl).origin
      : undefined;

  if (origin !== new URL(request.url).origin && origin !== configuredOrigin) {
    throw new BookingOriginError('Origin permintaan booking tidak diizinkan.');
  }
}

export function getCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

export function getGuestScope(request: Request) {
  const existing = getCookie(request, cookieName);
  const value =
    existing && /^[A-Za-z0-9_-]{32,128}$/.test(existing)
      ? existing
      : randomBytes(32).toString('base64url');
  const isNew = value !== existing;
  return {
    hash: createHash('sha256').update(`guest-scope:${value}`).digest('hex'),
    setCookie: isNew
      ? `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`
      : undefined,
  };
}

export function hashSecret(value: string, namespace: string) {
  return createHash('sha256').update(`${namespace}:${value}`).digest('hex');
}

export function createAccessToken() {
  const value = randomBytes(32).toString('base64url');
  return { value, hash: hashSecret(value, 'invoice-access') };
}

export function invoiceAccessCookie(token: string) {
  return `lj_invoice_access=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${
    process.env.NODE_ENV === 'production' ? '; Secure' : ''
  }`;
}

export function createParticipantDataToken() {
  const value = randomBytes(32).toString('base64url');
  return { value, hash: hashSecret(value, 'participant-data') };
}

export function encryptIdentity(value: string) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptIdentity(value: string) {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (!version || version !== 'v1' || !iv || !tag || !ciphertext) {
    throw new Error('Ciphertext identitas tidak valid.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function identityHash(value: string) {
  return createHmac('sha256', encryptionKey())
    .update(`identity:${value}`)
    .digest('hex');
}

export function maskIdentity(value: string) {
  return `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}
