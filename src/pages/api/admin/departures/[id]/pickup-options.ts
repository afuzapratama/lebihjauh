import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../../../db/client';
import {
  adminAuditLog,
  departure,
  departurePickupOption,
  tripPickupPoint,
  tripVersion,
} from '../../../../../db/schema';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

class PickupInputError extends Error {}

const uuid = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new PickupInputError(`${label} tidak valid.`);
  }
  return value;
};

const text = (
  value: unknown,
  label: string,
  maximum: number,
  required = true,
) => {
  const result =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && !result) throw new PickupInputError(`${label} wajib diisi.`);
  if (result.length > maximum)
    throw new PickupInputError(`${label} terlalu panjang.`);
  return result;
};

// Untuk field multi-baris: hanya trim awal/akhir, jangan collapse newline.
const multilineText = (
  value: unknown,
  label: string,
  maximum: number,
  required = true,
) => {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new PickupInputError(`${label} wajib diisi.`);
  if (result.length > maximum)
    throw new PickupInputError(`${label} terlalu panjang.`);
  return result;
};

function parse(values: Record<string, unknown>) {
  const pricePerPax = text(values.pricePerPax, 'Harga per pax', 16);
  if (!/^\d+$/.test(pricePerPax) || BigInt(pricePerPax) < 1n) {
    throw new PickupInputError('Harga per pax harus Rupiah bulat yang valid.');
  }
  const rawPickupAt = text(values.pickupAt, 'Waktu jemput', 40, false);
  const pickupAt = rawPickupAt ? new Date(rawPickupAt) : null;
  if (pickupAt && Number.isNaN(pickupAt.getTime())) {
    throw new PickupInputError('Waktu jemput tidak valid.');
  }
  const mapsUrl = text(values.mapsUrl, 'Tautan peta', 2_000, false);
  if (mapsUrl) {
    try {
      const url = new URL(mapsUrl);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new PickupInputError(
        'Tautan peta harus berupa URL http atau https.',
      );
    }
  }
  const rawCapacity = text(values.capacity, 'Kuota meeting point', 10, false);
  const capacity = rawCapacity ? Number(rawCapacity) : null;
  if (
    capacity !== null &&
    (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10_000)
  )
    throw new PickupInputError('Kuota meeting point harus angka 1–10.000.');
  return {
    zoneName: text(values.zoneName, 'Nama zona', 120),
    locationName: text(values.locationName, 'Nama titik jemput', 160),
    address: text(values.address, 'Alamat', 1_000),
    pickupAt,
    pricePerPax,
    mapsUrl: mapsUrl || null,
    instructions: multilineText(
      values.instructions,
      'Petunjuk jemput',
      2_000,
      false,
    ),
    capacity,
    rundownText: multilineText(
      values.rundownText,
      'Rundown khusus',
      16_000,
      false,
    ),
  };
}

function parseRundown(value: string) {
  if (!value) return null;
  const days: Array<{
    day: string;
    title: string;
    activities: Array<{ time: string; activity: string; location: string }>;
    details: string;
  }> = [];
  for (const line of value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const parts = line.split('|').map((item) => item.trim());
    if (/^(?:day|hari)\s*\d+/i.test(parts[0] ?? '')) {
      if (!parts[1])
        throw new PickupInputError(
          'Judul hari pada rundown khusus wajib diisi.',
        );
      days.push({
        day: parts[0],
        title: parts[1],
        activities: [],
        details: '',
      });
    } else if ((parts[0] ?? '').toLowerCase() === 'catatan') {
      const details = parts.slice(1).join(' | ').trim();
      if (!days.length || !details)
        throw new PickupInputError(
          'Catatan rundown harus berada setelah judul hari dan memiliki isi.',
        );
      days.at(-1)!.details = details;
    } else {
      // Skip baris yang seluruh fields-nya kosong (baris placeholder dari UI)
      if (parts.every((p) => !p)) continue;
      if (!days.length)
        throw new PickupInputError(
          'Format rundown khusus belum benar. Awali dengan "Hari 1 | Judul".',
        );
      if (!parts[1])
        throw new PickupInputError('Nama kegiatan pada rundown wajib diisi.');
      days.at(-1)!.activities.push({
        time: parts[0] ?? '',
        activity: parts[1],
        location: parts[2] ?? '',
      });
    }
  }
  if (days.some((day) => !day.activities.length))
    throw new PickupInputError(
      'Setiap hari pada rundown harus memiliki minimal satu kegiatan.',
    );
  return days;
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const departureId = uuid(params.id, 'Jadwal');
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new PickupInputError('Data meeting point tidak valid.');
    }
    const values = parse(body as Record<string, unknown>);
    const masterPickupPointId = uuid(
      (body as Record<string, unknown>).masterPickupPointId,
      'Titik jemput master',
    );
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [schedule] = await tx
        .select({
          id: departure.id,
          revision: departure.revision,
          capacity: departure.capacity,
          tripId: tripVersion.tripId,
        })
        .from(departure)
        .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
        .where(eq(departure.id, departureId))
        .limit(1);
      if (!schedule) throw new PickupInputError('Jadwal tidak ditemukan.');
      if (values.capacity && values.capacity > schedule.capacity)
        throw new PickupInputError(
          'Kuota meeting point tidak boleh melebihi kuota jadwal.',
        );
      const [master] = await tx
        .select()
        .from(tripPickupPoint)
        .where(
          and(
            eq(tripPickupPoint.id, masterPickupPointId),
            eq(tripPickupPoint.tripId, schedule.tripId),
            eq(tripPickupPoint.isActive, true),
          ),
        )
        .limit(1);
      if (!master)
        throw new PickupInputError(
          'Titik jemput master tidak tersedia untuk trip ini.',
        );
      const existingOptions = await tx
        .select({
          id: departurePickupOption.id,
          masterPickupPointId: departurePickupOption.masterPickupPointId,
        })
        .from(departurePickupOption)
        .where(
          and(
            eq(departurePickupOption.departureId, departureId),
            eq(departurePickupOption.isActive, true),
          ),
        );
      if (
        existingOptions.some(
          (option) => option.masterPickupPointId === master.id,
        )
      )
        throw new PickupInputError(
          'Titik jemput ini sudah digunakan pada jadwal. Edit konfigurasi yang sudah ada.',
        );
      const { rundownText, ...pickupValues } = values;
      const [created] = await tx
        .insert(departurePickupOption)
        .values({
          departureId,
          ...pickupValues,
          masterPickupPointId: master.id,
          zoneName: master.zoneName,
          locationName: master.locationName,
          address: master.address,
          mapsUrl: master.mapsUrl,
          instructions: pickupValues.instructions || master.instructions,
          pickupRundownStages: parseRundown(rundownText) ?? null,
          isDefault: existingOptions.length === 0,
        })
        .returning();
      await tx
        .update(departure)
        .set({ revision: schedule.revision + 1, updatedAt: new Date() })
        .where(eq(departure.id, departureId));
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'departure',
        entityId: departureId,
        action: 'pickup_option_created',
        payload: { pickupOptionId: created.id, zoneName: created.zoneName },
      });
      return created;
    });
    return json({ pickupOption: result }, 201);
  } catch (error) {
    if (error instanceof PickupInputError)
      return json({ message: error.message }, 422);
    console.error('Gagal membuat meeting point', error);
    return json({ message: 'Meeting point belum dapat disimpan.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  try {
    const actorUserId = locals.user?.id;
    if (!actorUserId)
      return json({ message: 'Sesi admin tidak ditemukan.' }, 401);
    const departureId = uuid(params.id, 'Jadwal');
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new PickupInputError('Data meeting point tidak valid.');
    }
    const values = body as Record<string, unknown>;
    const optionId = uuid(values.id, 'Meeting point');
    const action = ['deactivate', 'set_default'].includes(String(values.action))
      ? String(values.action)
      : 'update';
    const update = action === 'update' ? parse(values) : null;
    const masterPickupPointId =
      action === 'update'
        ? uuid(values.masterPickupPointId, 'Titik jemput master')
        : null;
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [schedule] = await tx
        .select({
          revision: departure.revision,
          capacity: departure.capacity,
          tripId: tripVersion.tripId,
        })
        .from(departure)
        .innerJoin(tripVersion, eq(departure.tripVersionId, tripVersion.id))
        .where(eq(departure.id, departureId))
        .limit(1);
      if (!schedule) throw new PickupInputError('Jadwal tidak ditemukan.');
      if (update?.capacity && update.capacity > schedule.capacity)
        throw new PickupInputError(
          'Kuota meeting point tidak boleh melebihi kuota jadwal.',
        );
      const [existing] = await tx
        .select({
          id: departurePickupOption.id,
          isDefault: departurePickupOption.isDefault,
          isActive: departurePickupOption.isActive,
        })
        .from(departurePickupOption)
        .where(
          and(
            eq(departurePickupOption.id, optionId),
            eq(departurePickupOption.departureId, departureId),
          ),
        )
        .limit(1);
      if (!existing)
        throw new PickupInputError('Meeting point tidak ditemukan.');
      if (action === 'set_default' && !existing.isActive)
        throw new PickupInputError(
          'Meeting point nonaktif tidak dapat dijadikan titik utama.',
        );
      if (action === 'set_default') {
        await tx
          .update(departurePickupOption)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(departurePickupOption.departureId, departureId));
        await tx
          .update(departurePickupOption)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(departurePickupOption.id, optionId));
      }
      if (action === 'deactivate' && existing.isDefault) {
        const alternatives = await tx
          .select({ id: departurePickupOption.id })
          .from(departurePickupOption)
          .where(
            and(
              eq(departurePickupOption.departureId, departureId),
              eq(departurePickupOption.isActive, true),
            ),
          );
        const replacement = alternatives.find((item) => item.id !== optionId);
        if (!replacement)
          throw new PickupInputError(
            'Satu-satunya meeting point aktif tidak dapat dinonaktifkan. Tambahkan titik pengganti dahulu.',
          );
        await tx
          .update(departurePickupOption)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(departurePickupOption.id, optionId));
        await tx
          .update(departurePickupOption)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(departurePickupOption.id, replacement.id));
      }
      const [master] =
        action === 'update'
          ? await tx
              .select()
              .from(tripPickupPoint)
              .where(
                and(
                  eq(tripPickupPoint.id, masterPickupPointId!),
                  eq(tripPickupPoint.tripId, schedule.tripId),
                ),
              )
              .limit(1)
          : [null];
      if (action === 'update' && !master)
        throw new PickupInputError(
          'Titik jemput master tidak tersedia untuk trip ini.',
        );
      if (action === 'update') {
        const sameMaster = await tx
          .select({ id: departurePickupOption.id })
          .from(departurePickupOption)
          .where(
            and(
              eq(departurePickupOption.departureId, departureId),
              eq(
                departurePickupOption.masterPickupPointId,
                masterPickupPointId!,
              ),
              eq(departurePickupOption.isActive, true),
            ),
          );
        if (sameMaster.some((option) => option.id !== optionId))
          throw new PickupInputError(
            'Titik jemput ini sudah digunakan pada jadwal.',
          );
      }
      const { rundownText, ...pickupValues } = update ?? { rundownText: '' };
      const [updated] =
        action === 'set_default'
          ? await tx
              .select()
              .from(departurePickupOption)
              .where(eq(departurePickupOption.id, optionId))
              .limit(1)
          : await tx
              .update(departurePickupOption)
              .set(
                action === 'deactivate'
                  ? { isActive: false, updatedAt: new Date() }
                  : {
                      ...pickupValues,
                      masterPickupPointId: master!.id,
                      zoneName: master!.zoneName,
                      locationName: master!.locationName,
                      address: master!.address,
                      mapsUrl: master!.mapsUrl,
                      instructions:
                        ('instructions' in pickupValues
                          ? pickupValues.instructions
                          : '') || master!.instructions,
                      pickupRundownStages: parseRundown(rundownText) ?? null,
                      updatedAt: new Date(),
                    },
              )
              .where(eq(departurePickupOption.id, optionId))
              .returning();
      await tx
        .update(departure)
        .set({ revision: schedule.revision + 1, updatedAt: new Date() })
        .where(eq(departure.id, departureId));
      await tx.insert(adminAuditLog).values({
        actorUserId,
        entityType: 'departure',
        entityId: departureId,
        action:
          action === 'deactivate'
            ? 'pickup_option_deactivated'
            : action === 'set_default'
              ? 'pickup_option_default_changed'
              : 'pickup_option_updated',
        payload: { pickupOptionId: optionId },
      });
      return updated;
    });
    return json({ pickupOption: result });
  } catch (error) {
    if (error instanceof PickupInputError)
      return json({ message: error.message }, 422);
    console.error('Gagal memperbarui meeting point', error);
    return json({ message: 'Meeting point belum dapat diperbarui.' }, 500);
  }
};
