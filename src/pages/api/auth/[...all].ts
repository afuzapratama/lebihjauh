import type { APIRoute } from 'astro';
import { auth } from '../../../lib/auth';

// Handler untuk semua rute Better Auth: /api/auth/sign-in, /api/auth/sign-out, dll.
export const ALL: APIRoute = async (ctx) => {
  return auth.handler(ctx.request);
};
