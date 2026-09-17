import { count, desc, eq, gt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { session, user } from '../db/schema';
import { getAuth } from './auth';

export class AdminAccountError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type AdminAccountListItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  activeSessionCount: number;
};

export async function listAdminAccounts(): Promise<AdminAccountListItem[]> {
  const db = getDb();
  const [users, activeSessions] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt)),
    db
      .select({ userId: session.userId, value: count() })
      .from(session)
      .where(gt(session.expiresAt, new Date()))
      .groupBy(session.userId),
  ]);
  const sessionCounts = new Map(
    activeSessions.map((item) => [item.userId, Number(item.value)]),
  );
  return users.map((item) => ({
    ...item,
    activeSessionCount: sessionCounts.get(item.id) ?? 0,
  }));
}

const cleanName = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const cleanEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export async function createAdminAccount(input: {
  name: unknown;
  email: unknown;
  password: unknown;
}) {
  const name = cleanName(input.name);
  const email = cleanEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';

  if (name.length < 2 || name.length > 80)
    throw new AdminAccountError('Nama admin harus 2–80 karakter.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new AdminAccountError('Alamat email tidak valid.');

  const auth = getAuth();
  const context = await auth.$context;
  if (
    password.length < context.password.config.minPasswordLength ||
    password.length > context.password.config.maxPasswordLength
  ) {
    throw new AdminAccountError(
      `Password harus ${context.password.config.minPasswordLength}–${context.password.config.maxPasswordLength} karakter.`,
    );
  }
  if (await context.internalAdapter.findUserByEmail(email))
    throw new AdminAccountError('Email tersebut sudah digunakan.', 409);

  let created: Awaited<
    ReturnType<typeof context.internalAdapter.createUser>
  > | null = null;
  try {
    created = await context.internalAdapter.createUser(
      { name, email, isActive: true },
      { method: 'admin-account-management' },
    );
    const hashedPassword = await context.password.hash(password);
    await context.internalAdapter.linkAccount({
      userId: created.id,
      providerId: 'credential',
      accountId: created.id,
      password: hashedPassword,
    });
    return {
      id: created.id,
      name: created.name,
      email: created.email,
      isActive: true,
      createdAt: created.createdAt,
      activeSessionCount: 0,
    } satisfies AdminAccountListItem;
  } catch (error) {
    if (created)
      await context.internalAdapter.deleteUser(created.id).catch(() => {});
    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes('unique') ||
        error.message.toLowerCase().includes('already'))
    ) {
      throw new AdminAccountError('Email tersebut sudah digunakan.', 409);
    }
    throw error;
  }
}

export async function setAdminAccountActive(input: {
  actorUserId: string;
  userId: unknown;
  isActive: unknown;
}) {
  const userId = typeof input.userId === 'string' ? input.userId : '';
  if (!userId || typeof input.isActive !== 'boolean')
    throw new AdminAccountError('Permintaan perubahan akun tidak valid.');
  if (userId === input.actorUserId)
    throw new AdminAccountError(
      'Akun yang sedang digunakan tidak dapat dinonaktifkan sendiri.',
    );

  const [target] = await getDb()
    .select({ id: user.id, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!target) throw new AdminAccountError('Akun admin tidak ditemukan.', 404);

  if (target.isActive !== input.isActive) {
    await getDb()
      .update(user)
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }
  if (!input.isActive) {
    const context = await getAuth().$context;
    await context.internalAdapter.deleteUserSessions(userId);
  }
  return { id: userId, isActive: input.isActive };
}
