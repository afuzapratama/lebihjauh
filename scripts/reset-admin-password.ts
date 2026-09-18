/**
 * Pemulihan password admin dari terminal ketika admin tidak dapat login.
 *
 *   npm run reset-admin-password -- admin@contoh.com
 *
 * Password selalu diminta tanpa echo agar tidak tersimpan di argumen command,
 * environment, atau riwayat shell.
 */

import { randomUUID } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';
import { betterAuth } from 'better-auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import postgres from 'postgres';
import * as schema from '../src/db/schema';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} diperlukan.`);
  return value;
};

const cleanEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      'Terminal interaktif diperlukan untuk memasukkan password dengan aman.',
    );

  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;

  return new Promise((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
    };

    const finish = () => {
      process.stdout.write('\n');
      cleanup();
      resolve(value);
    };

    const cancel = () => {
      process.stdout.write('\n');
      cleanup();
      reject(new Error('Reset password dibatalkan.'));
    };

    const onKeypress = (
      chunk: string | undefined,
      key: { ctrl?: boolean; meta?: boolean; name?: string },
    ) => {
      if (key.ctrl && key.name === 'c') return cancel();
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') {
        value = [...value].slice(0, -1).join('');
        return;
      }
      if (
        !key.ctrl &&
        !key.meta &&
        chunk &&
        !/[\u0000-\u001f\u007f]/u.test(chunk)
      )
        value += chunk;
    };

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', onKeypress);
  });
}

async function main() {
  const email = cleanEmail(process.argv[2]);
  if (!email) {
    throw new Error(
      'Gunakan: npm run reset-admin-password -- admin@contoh.com',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error('Alamat email admin tidak valid.');

  const databaseUrl = required('DATABASE_URL');
  const secret = required('BETTER_AUTH_SECRET');
  const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:4321';
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });
  const auth = betterAuth({
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    user: {
      additionalFields: {
        isActive: {
          type: 'boolean',
          required: false,
          defaultValue: true,
          input: false,
        },
      },
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
    secret,
    baseURL,
    trustedOrigins: [baseURL],
  });

  try {
    const context = await auth.$context;
    const found = await context.internalAdapter.findUserByEmail(email, {
      includeAccounts: true,
    });
    if (!found) throw new Error(`Admin dengan email ${email} tidak ditemukan.`);
    if (!found.accounts.some(({ providerId }) => providerId === 'credential'))
      throw new Error('Akun tersebut tidak memiliki login email/password.');

    const password = await readSecret('Password baru: ');
    const confirmation = await readSecret('Ulangi password baru: ');

    if (password !== confirmation)
      throw new Error('Konfirmasi password tidak sama.');

    const { minPasswordLength, maxPasswordLength } = context.password.config;
    if (
      password.length < minPasswordLength ||
      password.length > maxPasswordLength
    )
      throw new Error(
        `Password harus ${minPasswordLength}–${maxPasswordLength} karakter.`,
      );

    const passwordHash = await context.password.hash(password);
    await context.internalAdapter.updatePassword(found.user.id, passwordHash);
    await context.internalAdapter.deleteUserSessions(found.user.id);

    let auditRecorded = true;
    try {
      await db.insert(schema.adminAuditLog).values({
        actorUserId: found.user.id,
        entityType: 'admin_account_recovery',
        entityId: randomUUID(),
        action: 'password_reset_cli',
        payload: {
          targetUserId: found.user.id,
          sessionsRevoked: true,
        },
      });
    } catch {
      auditRecorded = false;
    }

    console.log(`✓ Password admin ${found.user.email} berhasil diganti.`);
    console.log('✓ Seluruh sesi login lama telah dicabut.');
    if (!auditRecorded)
      console.warn(
        '⚠ Password sudah diganti, tetapi pencatatan audit tidak berhasil.',
      );
    if (
      (found.user as typeof found.user & { isActive?: boolean }).isActive ===
      false
    )
      console.warn(
        '⚠ Akun ini masih nonaktif dan harus diaktifkan oleh admin lain sebelum dapat login.',
      );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
