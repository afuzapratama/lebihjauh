import type { APIRoute } from 'astro';
import { getDb } from '../../../db/client';
import { adminAuditLog } from '../../../db/schema';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const actorUserId = locals.user?.id;
  if (!actorUserId)
    return new Response(
      JSON.stringify({ message: 'Sesi admin tidak ditemukan.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  const values = await request.json().catch(() => null);
  const departureId = values?.departureId;
  if (
    typeof departureId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(departureId)
  ) {
    return new Response(JSON.stringify({ message: 'Jadwal tidak valid.' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const participantCount = Number.isInteger(values?.participantCount)
    ? Math.max(0, Math.min(10_000, values.participantCount))
    : null;
  const filterText = (value: unknown) =>
    typeof value === 'string' ? value.trim().slice(0, 160) : '';
  const filters = {
    search: filterText(values?.filters?.search),
    pickup: filterText(values?.filters?.pickup),
    booking: filterText(values?.filters?.booking),
  };
  await getDb()
    .insert(adminAuditLog)
    .values({
      actorUserId,
      entityType: 'departure',
      entityId: departureId,
      action: 'emergency_manifest_printed',
      payload: {
        printedAt: new Date().toISOString(),
        participantCount,
        filters,
      },
    });
  return new Response(JSON.stringify({ recorded: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
