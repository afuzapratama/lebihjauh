import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '../db/client';
import * as schema from '../db/schema';

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:4321';
  const trustedOrigins = [
    baseURL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];

  if (!secret)
    throw new Error('BETTER_AUTH_SECRET environment variable is required');

  return betterAuth({
    // Signup publik dinonaktifkan; akun hanya dibuat lewat bootstrap atau admin aktif.
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
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    baseURL,
    trustedOrigins,
    secret,
    // Aktif juga di development agar perilaku pengamanan login konsisten.
    // Better Auth memberi batas lebih ketat otomatis untuk sign-in dan ganti password.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
    databaseHooks: {
      session: {
        create: {
          async before(session, context) {
            // Operasi internal Better Auth tertentu tidak membawa request context.
            // Pemeriksaan request admin tetap dilakukan lagi oleh middleware.
            if (!context) return;
            const sessionUser =
              await context.context.internalAdapter.findUserById(
                session.userId,
              );
            const isActive = (
              sessionUser as
                (typeof sessionUser & { isActive?: boolean }) | null
            )?.isActive;
            if (!sessionUser || isActive === false) return false;
          },
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 menit cache di cookie
      },
    },
  });
}

// Singleton
let _auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (!_auth) _auth = createAuth();
  return _auth;
}

// Proxy untuk backward compat — panggilan auth.xxx akan delegate ke getAuth().xxx
export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get(_target, prop) {
    return (getAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Auth = ReturnType<typeof createAuth>;
