/**
 * Bootstrap script untuk membuat admin pertama.
 * Jalankan SEKALI setelah migrasi database selesai:
 *
 *   node --env-file=.env --import=tsx/esm scripts/bootstrap-admin.ts
 *
 * Script ini akan gagal jika email sudah terdaftar.
 * Setelah admin pertama tersedia, akun berikutnya dibuat lewat Management Akun.
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from '../src/db/schema';

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} diperlukan`);
  return val;
};

const DATABASE_URL = required('DATABASE_URL');
const BETTER_AUTH_SECRET = required('BETTER_AUTH_SECRET');
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:4321';

// Ambil email dan password dari argumen atau env
const email = process.env.ADMIN_EMAIL ?? process.argv[2];
const password = process.env.ADMIN_PASSWORD ?? process.argv[3];
const name = process.env.ADMIN_NAME ?? process.argv[4] ?? 'Admin';

if (!email || !password) {
  console.error(
    'Gunakan: ADMIN_EMAIL=... ADMIN_PASSWORD=... node ... scripts/bootstrap-admin.ts',
  );
  console.error(
    'Atau: node ... scripts/bootstrap-admin.ts email@contoh.com password NamaAdmin',
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password minimal 8 karakter');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    disableSignUp: false, // Aktifkan sementara hanya untuk script ini
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: BETTER_AUTH_SECRET,
  trustedOrigins: [BETTER_AUTH_URL],
  baseURL: BETTER_AUTH_URL,
});

try {
  console.log(`Membuat admin: ${email} (${name})`);

  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });

  console.log('✓ Admin berhasil dibuat');
  console.log(`  ID   : ${result.user.id}`);
  console.log(`  Email: ${result.user.email}`);
  console.log(`  Nama : ${result.user.name}`);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('unique') || message.includes('already')) {
    console.error(`✗ Email ${email} sudah terdaftar`);
  } else {
    console.error('✗ Gagal membuat admin:', message);
  }
  process.exit(1);
} finally {
  await client.end();
}
