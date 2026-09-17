import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Better Auth tables ───────────────────────────────────────────────────────
// Schema ini dihasilkan sesuai kebutuhan Better Auth dengan email/password.
// Jangan edit nama kolom; Better Auth bergantung pada nama ini.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  // Semua akun di aplikasi ini adalah admin karena pendaftaran publik ditutup.
  // Flag ini dipakai untuk mencabut akses tanpa menghapus jejak aktivitas lama.
  isActive: boolean('is_active').notNull().default(true),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Trip & departure (Phase 4C) ────────────────────────────────────────────
// Harga dan DP menggunakan NUMERIC(14, 0), bukan float, supaya nominal Rupiah
// tidak mengalami pembulatan JavaScript. Nilainya keluar dari Drizzle sebagai string.

export const trip = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tripVersion = pgTable(
  'trip_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    description: text('description').notNull(),
    included: text('included').notNull().default(''),
    excluded: text('excluded').notNull().default(''),
    itinerary: text('itinerary').notNull().default(''),
    // Format lama tetap disimpan untuk kompatibilitas. Data ini menjadi sumber
    // resmi rundown: satu baris merepresentasikan satu hari atau satu tahap.
    itineraryStages: jsonb('itinerary_stages')
      .$type<
        Array<{
          day: string;
          title: string;
          activities: Array<{
            time: string;
            activity: string;
            location: string;
          }>;
          details: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    preparation: text('preparation').notNull().default(''),
    meetingPoint: text('meeting_point').notNull().default(''),
    // Label destinasi ringkas untuk kartu katalog (contoh: Bandung · Jawa Barat).
    // Opsional agar versi trip lama tetap valid dan tidak merender tag kosong.
    locationLabel: text('location_label'),
    difficultyLevel: text('difficulty_level'),
    elevationMeters: integer('elevation_meters'),
    trailDistanceKm: numeric('trail_distance_km', {
      precision: 6,
      scale: 2,
    }),
    elevationGainMeters: integer('elevation_gain_meters'),
    trekDurationMinMinutes: integer('trek_duration_min_minutes'),
    trekDurationMaxMinutes: integer('trek_duration_max_minutes'),
    routeName: text('route_name'),
    terrainSummary: text('terrain_summary'),
    trailMapEmbedUrl: text('trail_map_embed_url'),
    terms: text('terms').notNull().default(''),
    coverImageUrl: text('cover_image_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('trip_versions_trip_version_unique').on(table.tripId, table.version),
    check(
      'trip_versions_difficulty_check',
      sql`${table.difficultyLevel} is null or ${table.difficultyLevel} in ('beginner', 'intermediate', 'advanced', 'expert')`,
    ),
    check(
      'trip_versions_elevation_check',
      sql`${table.elevationMeters} is null or ${table.elevationMeters} between 1 and 10000`,
    ),
    check(
      'trip_versions_trail_distance_check',
      sql`${table.trailDistanceKm} is null or (${table.trailDistanceKm} > 0 and ${table.trailDistanceKm} <= 1000)`,
    ),
    check(
      'trip_versions_elevation_gain_check',
      sql`${table.elevationGainMeters} is null or ${table.elevationGainMeters} between 0 and 20000`,
    ),
    check(
      'trip_versions_trek_duration_check',
      sql`(${table.trekDurationMinMinutes} is null or ${table.trekDurationMinMinutes} between 1 and 10080) and (${table.trekDurationMaxMinutes} is null or ${table.trekDurationMaxMinutes} between 1 and 10080) and (${table.trekDurationMinMinutes} is null or ${table.trekDurationMaxMinutes} is null or ${table.trekDurationMaxMinutes} >= ${table.trekDurationMinMinutes})`,
    ),
  ],
);

export const departure = pgTable(
  'departures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripVersionId: uuid('trip_version_id')
      .notNull()
      .references(() => tripVersion.id, { onDelete: 'restrict' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    capacity: integer('capacity').notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 0 }).notNull(),
    dpMode: text('dp_mode').notNull(),
    dpValue: numeric('dp_value', { precision: 14, scale: 0 }).notNull(),
    bookingCutoffAt: timestamp('booking_cutoff_at', {
      withTimezone: true,
    }).notNull(),
    balanceDueAt: timestamp('balance_due_at', { withTimezone: true }),
    publicationState: text('publication_state').notNull().default('draft'),
    // Override itinerary khusus jadwal ini. NULL berarti memakai itinerary
    // dari tripVersion yang ditautkan. Isi hanya bila jadwal ini memiliki
    // program yang berbeda dari itinerary inti paket.
    itineraryOverride: jsonb('itinerary_override').$type<
      Array<{
        day: string;
        title: string;
        activities: Array<{
          time: string;
          activity: string;
          location: string;
        }>;
        details: string;
      }>
    >(),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'departures_date_range_check',
      sql`${table.startAt} < ${table.endAt}`,
    ),
    check('departures_capacity_check', sql`${table.capacity} >= 0`),
    check('departures_price_check', sql`${table.unitPrice} > 0`),
    check(
      'departures_dp_mode_check',
      sql`${table.dpMode} in ('percent', 'amount')`,
    ),
    check('departures_dp_value_check', sql`${table.dpValue} >= 0`),
    check(
      'departures_dp_percent_check',
      sql`${table.dpMode} <> 'percent' or ${table.dpValue} <= 100`,
    ),
    check(
      'departures_state_check',
      sql`${table.publicationState} in ('draft', 'open', 'closed')`,
    ),
    check(
      'departures_cutoff_check',
      sql`${table.bookingCutoffAt} <= ${table.startAt}`,
    ),
  ],
);

// Satu jadwal dapat memiliki beberapa titik jemput/zona. Harga selalu melekat
// pada titik jemput, bukan hanya pada trip, sehingga quote dan invoice dapat
// menyimpan pilihan peserta secara pasti.
export const departurePickupOption = pgTable(
  'departure_pickup_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departureId: uuid('departure_id')
      .notNull()
      .references(() => departure.id, { onDelete: 'restrict' }),
    masterPickupPointId: uuid('master_pickup_point_id').references(
      () => tripPickupPoint.id,
      { onDelete: 'restrict' },
    ),
    zoneName: text('zone_name').notNull(),
    locationName: text('location_name').notNull(),
    address: text('address').notNull().default(''),
    pickupAt: timestamp('pickup_at', { withTimezone: true }),
    pricePerPax: numeric('price_per_pax', {
      precision: 14,
      scale: 0,
    }).notNull(),
    mapsUrl: text('maps_url'),
    instructions: text('instructions').notNull().default(''),
    // Rundown sebelum bergabung ke perjalanan utama (opsional).
    // NULL berarti tidak ada rundown penjemputan tambahan untuk titik ini —
    // bukan salinan itinerary paket. Isi hanya bila ada segmen kumpul/pickup
    // sebelum peserta bergabung ke perjalanan inti.
    pickupRundownStages: jsonb('pickup_rundown_stages').$type<
      Array<{
        day: string;
        title: string;
        activities: Array<{
          time: string;
          activity: string;
          location: string;
        }>;
        details: string;
      }>
    >(),
    capacity: integer('capacity'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'departure_pickup_options_price_check',
      sql`${table.pricePerPax} > 0`,
    ),
    check(
      'departure_pickup_options_capacity_check',
      sql`${table.capacity} is null or ${table.capacity} > 0`,
    ),
  ],
);

// Titik jemput adalah katalog milik paket. Jadwal hanya mengaktifkan titik ini
// dan menentukan harga/varian rundownnya, sehingga data lokasi tidak tercerai.
export const tripPickupPoint = pgTable('trip_pickup_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .notNull()
    .references(() => trip.id, { onDelete: 'restrict' }),
  zoneName: text('zone_name').notNull(),
  locationName: text('location_name').notNull(),
  address: text('address').notNull().default(''),
  mapsUrl: text('maps_url'),
  instructions: text('instructions').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Catatan perubahan tidak dapat diedit melalui UI. Payload hanya menyimpan ringkasan
// perubahan operasional; password, token, dan data pembayaran tidak pernah dicatat di sini.
export const adminAuditLog = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: text('actor_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Booking & invoice (Phase 4E) ───────────────────────────────────────────
// Nilai uang tetap NUMERIC(14,0). Nomor identitas tidak disimpan sebagai plaintext:
// ciphertext dipakai hanya bila admin berwenang perlu memeriksa data, sedangkan
// hash dipakai untuk mendeteksi duplikasi tanpa membuka nomor lengkap.

export const checkoutQuote = pgTable(
  'checkout_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guestScopeHash: text('guest_scope_hash').notNull(),
    departureId: uuid('departure_id')
      .notNull()
      .references(() => departure.id, { onDelete: 'restrict' }),
    pickupOptionId: uuid('pickup_option_id').references(
      () => departurePickupOption.id,
      { onDelete: 'restrict' },
    ),
    departureRevision: integer('departure_revision').notNull(),
    pax: integer('pax').notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 0 }).notNull(),
    total: numeric('total', { precision: 14, scale: 0 }).notNull(),
    minimumDp: numeric('minimum_dp', {
      precision: 14,
      scale: 0,
    }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('checkout_quotes_pax_check', sql`${table.pax} > 0`),
    check('checkout_quotes_total_check', sql`${table.total} > 0`),
    check('checkout_quotes_dp_check', sql`${table.minimumDp} > 0`),
  ],
);

export const booking = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicNumber: text('public_number').notNull().unique(),
    guestScopeHash: text('guest_scope_hash').notNull(),
    departureId: uuid('departure_id')
      .notNull()
      .references(() => departure.id, { onDelete: 'restrict' }),
    pickupOptionId: uuid('pickup_option_id').references(
      () => departurePickupOption.id,
      { onDelete: 'restrict' },
    ),
    tripVersionId: uuid('trip_version_id')
      .notNull()
      .references(() => tripVersion.id, { onDelete: 'restrict' }),
    pax: integer('pax').notNull(),
    picName: text('pic_name').notNull(),
    picWhatsApp: text('pic_whatsapp').notNull(),
    picEmail: text('pic_email'),
    picIsParticipant: boolean('pic_is_participant').notNull().default(true),
    picIdentityCiphertext: text('pic_identity_ciphertext'),
    picIdentityHash: text('pic_identity_hash'),
    picIdentityLast4: text('pic_identity_last4'),
    packageSnapshot: jsonb('package_snapshot').notNull(),
    policySnapshot: jsonb('policy_snapshot').notNull(),
    bookingSource: text('booking_source').notNull().default('open_trip'),
    state: text('state').notNull().default('awaiting_payment'),
    holdExpiresAt: timestamp('hold_expires_at', {
      withTimezone: true,
    }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    termsAcceptedAt: timestamp('terms_accepted_at', {
      withTimezone: true,
    }).notNull(),
    participantConsentAt: timestamp('participant_consent_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('bookings_pax_check', sql`${table.pax} > 0`),
    check(
      'bookings_state_check',
      sql`${table.state} in ('awaiting_payment', 'confirmed', 'expired', 'cancelled', 'completed')`,
    ),
    check(
      'bookings_source_check',
      sql`${table.bookingSource} in ('open_trip', 'private_trip')`,
    ),
  ],
);

export const bookingParticipant = pgTable(
  'booking_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => booking.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    fullName: text('full_name').notNull(),
    identityType: text('identity_type').notNull().default('pending'),
    // Identitas lengkap dipindahkan ke participant_safety_data setelah DP
    // terverifikasi. Kolom lama tetap dipertahankan untuk histori booking lama.
    identityCiphertext: text('identity_ciphertext'),
    identityHash: text('identity_hash'),
    identityLast4: text('identity_last4'),
    isPic: boolean('is_pic').notNull().default(false),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('booking_participants_booking_position_unique').on(
      table.bookingId,
      table.position,
    ),
    check('booking_participants_position_check', sql`${table.position} > 0`),
    check(
      'booking_participants_identity_type_check',
      sql`${table.identityType} in ('pending', 'nik', 'ktp', 'sim', 'student_card', 'passport', 'kitas')`,
    ),
  ],
);

export const participantSafetyData = pgTable(
  'participant_safety_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingParticipantId: uuid('booking_participant_id')
      .notNull()
      .unique()
      .references(() => bookingParticipant.id, { onDelete: 'restrict' }),
    addressCiphertext: text('address_ciphertext').notNull(),
    whatsappCiphertext: text('whatsapp_ciphertext'),
    emergencyNameCiphertext: text('emergency_name_ciphertext').notNull(),
    emergencyRelationshipCiphertext: text(
      'emergency_relationship_ciphertext',
    ).notNull(),
    emergencyWhatsAppCiphertext: text(
      'emergency_whatsapp_ciphertext',
    ).notNull(),
    identityType: text('identity_type').notNull(),
    identityCiphertext: text('identity_ciphertext').notNull(),
    identityHash: text('identity_hash').notNull(),
    identityLast4: text('identity_last4').notNull(),
    documentObjectKey: text('document_object_key').notNull(),
    documentContentType: text('document_content_type').notNull(),
    status: text('status').notNull().default('complete'),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'participant_safety_data_identity_type_check',
      sql`${table.identityType} in ('ktp', 'sim', 'student_card', 'passport', 'kitas')`,
    ),
    check(
      'participant_safety_data_status_check',
      sql`${table.status} in ('complete', 'needs_revision')`,
    ),
  ],
);

export const participantDataGrant = pgTable('participant_data_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingParticipantId: uuid('booking_participant_id')
    .notNull()
    .references(() => bookingParticipant.id, { onDelete: 'restrict' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  // Draf selalu berupa ciphertext JSON agar data keselamatan tidak tersimpan
  // sebagai plaintext di browser atau tabel operasional biasa.
  draftCiphertext: text('draft_ciphertext'),
  draftSavedAt: timestamp('draft_saved_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdByUserId: text('created_by_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Satu akses PIC untuk seluruh roster booking. Grant peserta lama tetap
// dipertahankan agar tautan historis tidak rusak.
export const bookingParticipantDataGrant = pgTable(
  'booking_participant_data_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .unique()
      .references(() => booking.id, { onDelete: 'restrict' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// Draf PIC disimpan terpisah per peserta agar satu token booking dapat
// mengedit roster tanpa menimpa draf peserta lain.
export const bookingParticipantDataDraft = pgTable(
  'booking_participant_data_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingGrantId: uuid('booking_grant_id')
      .notNull()
      .references(() => bookingParticipantDataGrant.id, {
        onDelete: 'cascade',
      }),
    bookingParticipantId: uuid('booking_participant_id')
      .notNull()
      .unique()
      .references(() => bookingParticipant.id, { onDelete: 'cascade' }),
    draftCiphertext: text('draft_ciphertext').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const bookingAllocation = pgTable(
  'booking_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => booking.id, { onDelete: 'restrict' })
      .unique(),
    departureId: uuid('departure_id')
      .notNull()
      .references(() => departure.id, { onDelete: 'restrict' }),
    pax: integer('pax').notNull(),
    state: text('state').notNull().default('held'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('booking_allocations_pax_check', sql`${table.pax} > 0`),
    check(
      'booking_allocations_state_check',
      sql`${table.state} in ('held', 'committed', 'released')`,
    ),
  ],
);

// Peserta booking terkonfirmasi selalu masuk manifest jadwal. Tabel ini hanya
// menyimpan pengecualian sadar dari admin untuk booking yang masih menunggu
// pembayaran, misalnya ada kesepakatan pelunasan di lokasi. Ia tidak mengubah
// status booking, pembayaran, maupun alokasi kuota.
export const departureManifestException = pgTable(
  'departure_manifest_exceptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departureId: uuid('departure_id')
      .notNull()
      .references(() => departure.id, { onDelete: 'restrict' }),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => booking.id, { onDelete: 'restrict' })
      .unique(),
    reason: text('reason').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'departure_manifest_exceptions_reason_check',
      sql`char_length(${table.reason}) between 5 and 500`,
    ),
  ],
);

export const invoice = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => booking.id, { onDelete: 'restrict' })
      .unique(),
    number: text('number').notNull().unique(),
    currency: text('currency').notNull().default('IDR'),
    total: numeric('total', { precision: 14, scale: 0 }).notNull(),
    minimumDp: numeric('minimum_dp', {
      precision: 14,
      scale: 0,
    }).notNull(),
    balanceDueAt: timestamp('balance_due_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('invoices_currency_check', sql`${table.currency} = 'IDR'`),
    check('invoices_total_check', sql`${table.total} > 0`),
    check('invoices_dp_check', sql`${table.minimumDp} > 0`),
  ],
);

export const invoiceAccessGrant = pgTable('invoice_access_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => booking.id, { onDelete: 'restrict' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const idempotencyRecord = pgTable(
  'idempotency_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeHash: text('scope_hash').notNull(),
    operation: text('operation').notNull(),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    resourceId: uuid('resource_id').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('idempotency_scope_operation_key_unique').on(
      table.scopeHash,
      table.operation,
      table.key,
    ),
  ],
);

// ─── Private trip (Phase 4G) ───────────────────────────────────────────────
// Permintaan private tidak otomatis menjadi booking atau menahan kuota Open
// Trip. Nilai penawaran disimpan sebagai revisi agar kesepakatan via WhatsApp
// tetap dapat ditelusuri sebelum admin membuat booking/invoice.
export const privateTripRequest = pgTable(
  'private_trip_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicNumber: text('public_number').notNull().unique(),
    guestScopeHash: text('guest_scope_hash').notNull(),
    destination: text('destination').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),
    pax: integer('pax').notNull(),
    picName: text('pic_name').notNull(),
    picWhatsApp: text('pic_whatsapp').notNull(),
    picEmail: text('pic_email'),
    needs: text('needs').notNull().default(''),
    state: text('state').notNull().default('new'),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('private_trip_requests_pax_check', sql`${table.pax} > 0`),
    check(
      'private_trip_requests_date_check',
      sql`${table.endDate} is null or ${table.startDate} <= ${table.endDate}`,
    ),
    check(
      'private_trip_requests_state_check',
      sql`${table.state} in ('new', 'contacted', 'offer_sent', 'accepted', 'declined', 'expired', 'converted')`,
    ),
  ],
);

export const privateTripOffer = pgTable(
  'private_trip_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => privateTripRequest.id, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    title: text('title').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    pax: integer('pax').notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 0 }).notNull(),
    dpMode: text('dp_mode').notNull(),
    dpValue: numeric('dp_value', { precision: 14, scale: 0 }).notNull(),
    minimumDp: numeric('minimum_dp', { precision: 14, scale: 0 }).notNull(),
    included: text('included').notNull().default(''),
    excluded: text('excluded').notNull().default(''),
    meetingPoint: text('meeting_point').notNull().default(''),
    pickupDetails: jsonb('pickup_details')
      .$type<{
        zoneName: string;
        locationName: string;
        address: string;
        pickupAt: string | null;
        mapsUrl: string | null;
        instructions: string;
      }>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    itineraryStages: jsonb('itinerary_stages')
      .$type<
        Array<{
          day: string;
          title: string;
          activities: Array<{
            time: string;
            activity: string;
            location: string;
          }>;
          details: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    preparation: text('preparation').notNull().default(''),
    notes: text('notes').notNull().default(''),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    state: text('state').notNull().default('draft'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedNote: text('accepted_note'),
    convertedBookingId: uuid('converted_booking_id')
      .references(() => booking.id, { onDelete: 'restrict' })
      .unique(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('private_trip_offers_request_revision_unique').on(
      table.requestId,
      table.revision,
    ),
    check(
      'private_trip_offers_date_check',
      sql`${table.startAt} < ${table.endAt}`,
    ),
    check('private_trip_offers_pax_check', sql`${table.pax} > 0`),
    check('private_trip_offers_price_check', sql`${table.unitPrice} > 0`),
    check(
      'private_trip_offers_dp_mode_check',
      sql`${table.dpMode} in ('percent', 'amount')`,
    ),
    check('private_trip_offers_dp_value_check', sql`${table.dpValue} >= 0`),
    check(
      'private_trip_offers_dp_percent_check',
      sql`${table.dpMode} <> 'percent' or ${table.dpValue} <= 100`,
    ),
    check('private_trip_offers_dp_check', sql`${table.minimumDp} > 0`),
    check(
      'private_trip_offers_state_check',
      sql`${table.state} in ('draft', 'sent', 'accepted', 'declined', 'superseded', 'expired')`,
    ),
  ],
);

// Draf manifest dibuat sebelum booking/invoice private diterbitkan. NIK di
// dalam JSON selalu tersimpan sebagai ciphertext; halaman admin hanya menerima
// nama dan empat digit akhir agar NIK tidak kembali sebagai plaintext.
export const privateTripManifestDraft = pgTable(
  'private_trip_manifest_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => privateTripOffer.id, { onDelete: 'restrict' })
      .unique(),
    participants: jsonb('participants').notNull().default([]),
    picIsParticipant: boolean('pic_is_participant').notNull().default(true),
    savedByUserId: text('saved_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ─── Public content (Phase 4H) ─────────────────────────────────────────────
// Konten publik memakai state eksplisit. Draft tidak pernah ikut query halaman
// publik; URL embed disimpan sebagai URL biasa, bukan HTML/script dari admin.
export const contentAlbum = pgTable(
  'content_albums',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull().default(''),
    publicationState: text('publication_state').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'content_albums_state_check',
      sql`${table.publicationState} in ('draft', 'published')`,
    ),
  ],
);

export const galleryItem = pgTable(
  'gallery_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    albumId: uuid('album_id').references(() => contentAlbum.id, {
      onDelete: 'restrict',
    }),
    imageUrl: text('image_url').notNull(),
    altText: text('alt_text').notNull(),
    caption: text('caption').notNull(),
    socialUrl: text('social_url'),
    publicationState: text('publication_state').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'gallery_items_state_check',
      sql`${table.publicationState} in ('draft', 'published')`,
    ),
  ],
);

export const newsArticle = pgTable(
  'news_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    category: text('category').notNull(),
    excerpt: text('excerpt').notNull(),
    body: text('body').notNull(),
    coverImageUrl: text('cover_image_url'),
    coverAltText: text('cover_alt_text').notNull().default(''),
    socialUrl: text('social_url'),
    publicationState: text('publication_state').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'news_articles_state_check',
      sql`${table.publicationState} in ('draft', 'published')`,
    ),
  ],
);

// ─── Payment verification (Phase 4F) ────────────────────────────────────────
// Fixed website pages (Phase 4L).
// Home dan About memiliki satu dokumen terstruktur per halaman. Draf disimpan
// terpisah dari versi publik agar perubahan besar dapat dipratinjau lebih dulu.
export const sitePage = pgTable(
  'site_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageKey: text('page_key').notNull().unique(),
    draftContent: jsonb('draft_content')
      .$type<Record<string, unknown>>()
      .notNull(),
    publishedContent:
      jsonb('published_content').$type<Record<string, unknown>>(),
    updatedByUserId: text('updated_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    publishedByUserId: text('published_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('site_pages_key_check', sql`${table.pageKey} in ('home', 'about')`),
  ],
);

// Payment verification (Phase 4F). Nilai pembayaran bersifat append-only secara
// bisnis: status boleh berubah, tetapi riwayatnya tidak dihapus.
export const paymentMethod = pgTable(
  'payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    accountName: text('account_name'),
    accountNumber: text('account_number'),
    qrisImageUrl: text('qris_image_url'),
    instructions: text('instructions').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'payment_methods_kind_check',
      sql`${table.kind} in ('bank_transfer', 'ewallet', 'qris')`,
    ),
  ],
);

export const payment = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => booking.id, { onDelete: 'restrict' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoice.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 14, scale: 0 }).notNull(),
    method: text('method').notNull().default('bank_transfer'),
    paymentMethodId: uuid('payment_method_id').references(
      () => paymentMethod.id,
      {
        onDelete: 'restrict',
      },
    ),
    paymentMethodSnapshot: jsonb('payment_method_snapshot')
      .notNull()
      .default({}),
    reference: text('reference'),
    proofObjectKey: text('proof_object_key'),
    state: text('state').notNull().default('submitted'),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Waktu transfer menurut pembeli. Ini hanya petunjuk pencocokan dan tidak
    // menggantikan receivedAt yang ditetapkan admin dari mutasi rekening.
    reportedTransferAt: timestamp('reported_transfer_at', {
      withTimezone: true,
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    reviewNote: text('review_note'),
    // Tanggal dana benar-benar diterima. Berbeda dengan reviewedAt karena
    // admin dapat memverifikasi mutasi pada hari setelah transfer terjadi.
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('payments_amount_check', sql`${table.amount} > 0`),
    check('payments_method_check', sql`${table.method} = 'bank_transfer'`),
    check(
      'payments_state_check',
      sql`${table.state} in ('submitted', 'verified', 'rejected')`,
    ),
  ],
);

// Biaya operasional dicatat sebagai ledger; entri salah dibatalkan dengan alasan,
// tidak dihapus, agar laporan jadwal dan audit tetap dapat ditelusuri.
export const tripExpense = pgTable(
  'trip_expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departureId: uuid('departure_id').references(() => departure.id, {
      onDelete: 'restrict',
    }),
    scope: text('scope').notNull().default('departure'),
    category: text('category').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    vendor: text('vendor').notNull(),
    amount: numeric('amount', { precision: 14, scale: 0 }).notNull(),
    method: text('method').notNull(),
    reference: text('reference'),
    proofObjectKey: text('proof_object_key'),
    state: text('state').notNull().default('active'),
    voidReason: text('void_reason'),
    recordedByUserId: text('recorded_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    voidedByUserId: text('voided_by_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'trip_expenses_scope_check',
      sql`${table.scope} in ('departure', 'general')`,
    ),
    check('trip_expenses_amount_check', sql`${table.amount} > 0`),
    check(
      'trip_expenses_state_check',
      sql`${table.state} in ('active', 'voided')`,
    ),
    check(
      'trip_expenses_departure_scope_check',
      sql`(${table.scope} = 'departure' and ${table.departureId} is not null) or (${table.scope} = 'general' and ${table.departureId} is null)`,
    ),
  ],
);
