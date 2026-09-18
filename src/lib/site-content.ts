import { eq } from 'drizzle-orm';
import bromo from '../assets/bromo.jpg';
import hiker from '../assets/hiker.jpg';
import { getDb } from '../db/client';
import { adminAuditLog, sitePage } from '../db/schema';
import {
  defaultWhatsAppGreeting,
  normalizeWhatsAppNumber,
  whatsappNumberFromUrl,
} from './contact-settings';
import {
  sanitizeSiteContent,
  SiteContentInputError,
} from './site-content-validation';
import { emptySocialLinks, validateSocialLinks } from './social-platforms';

export { SiteContentInputError } from './site-content-validation';

export type SitePageKey = 'home' | 'about' | 'global';

const image = (
  imageUrl: string,
  alt: string,
  caption = '',
  credit = '',
  sourceUrl = '',
) => ({ imageUrl, alt, caption, credit, sourceUrl, focalPoint: 'center' });

export const defaultHomeContent = {
  seo: {
    title: 'LebihJauh — Pergi jauh. Pulang lebih hidup.',
    description:
      'LebihJauh. Ruang untuk perjalanan, teman baru, dan cerita yang dibawa pulang. Jelajahi inspirasi open trip gunung dan rencanakan private trip-mu.',
    shareImageUrl: '',
  },
  hero: {
    image: image(
      bromo.src,
      'Kabut pagi menyelimuti lanskap Bromo dan pegunungan di kejauhan',
      'BROMO, INDONESIA',
      'FOTO ILUSTRASI',
    ),
    topline: 'INDONESIA & BEYOND',
    edition: 'A LITTLE FURTHER. A LITTLE MORE ALIVE.',
    titleLine1: 'PERGI.',
    titleLine2: 'YANG JAUH',
    titleAccent: 'PULANG.',
    description:
      'Keluar dari rutinitas. Ketemu teman baru.\nBawa pulang cerita yang nggak ada di layar.',
    ctaLabel: 'Temukan trip-mu',
    handwriting: 'same curiosity.\ndifferent destinations.',
  },
  manifesto: {
    items: ['MORE PEOPLE.', 'FARTHER PLACES.', 'SAME CURIOSITY.', 'GO FURTHER'],
  },
  trips: {
    eyebrow: '01 / PILIH PERJALANANMU',
    titleLine1: 'Rencana kecil.',
    titleLine2: 'Cerita',
    titleAccent: 'besar.',
    intro:
      'Gunungnya boleh sama.\nOrang dan ceritanya selalu beda.\nJadi, ke mana kita berikutnya?',
    emptyTitle: 'Jadwal baru sedang disiapkan.',
    emptyCopy: 'Silakan kembali lagi atau rencanakan perjalanan Private Trip.',
    browseCopy: 'Cari berdasarkan nama, lokasi, atau jenis perjalanan.',
  },
  story: {
    image: image(
      hiker.src,
      'Teman perjalanan menyusuri jalur di antara pegunungan',
      'a little lost, a lot more alive.',
    ),
    fieldNote: 'FIELD NOTES — VOL. 001 / OUTSIDE IS CALLING',
    eyebrow: '02 / KENALAN DULU, YUK',
    titleLine1: 'BUKAN CUMA',
    titleLine2: 'SAMPAI',
    titleAccent: 'puncak.',
    lead: 'Tapi tentang siapa yang berjalan di sampingmu,\ndan cerita yang kamu bawa pulang.',
    body1:
      'LebihJauh berawal dari rasa penasaran. Tentang tempat yang belum didatangi, orang yang belum ditemui, dan versi diri yang belum kita kenali.',
    body2:
      'Kami ingin jadi ruang untuk itu. Pergi bersama, menikmati prosesnya, lalu pulang dengan sesuatu yang lebih.',
    values: ['Teman perjalanan', 'Rasa ingin tahu', 'Cerita baru'],
    signature: 'Pergi. Yang jauh. Pulang.',
  },
  privateTrip: {
    eyebrow: 'YOUR PEOPLE. YOUR OWN ADVENTURE.',
    title: 'ROMBONGAN SENDIRI?',
    titleAccent: 'Jalan cerita sendiri.',
    description:
      'Bareng sahabat, keluarga, atau teman satu komunitas.\nKamu pilih orangnya. Kita rencanakan perjalanannya.',
    ctaLabel: 'Rencanakan Private Trip',
  },
  gallery: {
    eyebrow: '03 / POSTCARDS FROM OUTSIDE',
    titleLine1: 'Momen lewat.',
    titleLine2: 'Kenangan',
    titleAccent: 'melekat.',
    intro:
      'Sedikit gambaran dari luar sana.\nSisanya, kamu harus rasakan sendiri.',
    archiveCopy: 'Lihat lebih banyak potongan momen dari perjalanan kami.',
    archiveLabel: 'Lihat semua galeri',
  },
  news: {
    eyebrow: '04 / CATATAN PERJALANAN',
    titleLine1: 'Dari jalan,',
    titleLine2: 'jadi',
    titleAccent: 'cerita.',
    intro: 'Cerita ringan, inspirasi perjalanan,\ndan kabar trip berikutnya.',
    archiveCopy: 'Temukan cerita, inspirasi, dan kabar perjalanan lainnya.',
    archiveLabel: 'Baca semua cerita',
  },
  featured: {
    tripIds: [] as string[],
    galleryIds: [] as string[],
    newsIds: [] as string[],
  },
  faq: {
    eyebrow: 'SEBELUM BERANGKAT',
    title: 'Masih',
    titleAccent: 'penasaran?',
    intro: 'Beberapa hal yang mungkin\nlagi kamu pikirkan.',
    items: [
      {
        question: 'Apa bedanya Open Trip dan Private Trip?',
        answer:
          'Open Trip memiliki jadwal dan rute yang sudah ditentukan. Private Trip direncanakan khusus untuk rombonganmu melalui permintaan dan penawaran terlebih dahulu.',
      },
      {
        question: 'Bagaimana cara booking Open Trip?',
        answer:
          'Buka detail trip, pilih keberangkatan yang tersedia, lalu isi data PIC dan seluruh peserta. Invoice dibuat setelah booking berhasil.',
      },
      {
        question: 'Bagaimana pembayaran diverifikasi?',
        answer:
          'Pilih metode pembayaran lalu unggah bukti dari halaman invoice. Admin memeriksa mutasi sebelum memperbarui status; WhatsApp tetap tersedia untuk komunikasi.',
      },
      {
        question: 'Bisa request trip untuk komunitas?',
        answer:
          'Bisa. Isi form Private Trip dengan tujuan, tanggal, peserta, dan kebutuhanmu. Belum ada tagihan sebelum penawaran disepakati.',
      },
    ],
  },
  closing: {
    eyebrow: "THE WORLD IS BIG. YOUR STORY ISN'T FINISHED.",
    titleLine1: 'SAMPAI KETEMU',
    titleLine2: 'DI LUAR SANA.',
    ctaLabel: 'Ayo, jalan lebih jauh',
    note: 'Good places. Better company.',
  },
};

export const defaultAboutContent = {
  seo: {
    title: 'About — LebihJauh',
    description:
      'Kenalan dengan LebihJauh, ruang untuk perjalanan yang mempertemukan orang, tempat, dan cerita baru.',
    shareImageUrl: '',
  },
  hero: {
    image: image(
      'https://images.unsplash.com/photo-1770563181870-eca60076ffd8?auto=format&fit=crop&w=1800&q=85',
      'Sekelompok teman berjalan bersama di jalur pegunungan hijau',
      'FIELD NOTES / 001',
      'Timur Shakerzianov / Unsplash',
      'https://unsplash.com/photos/xiOFB4wEjvo',
    ),
    eyebrow: 'ABOUT / LEBIHJAUH',
    titleLine1: 'PERGI.',
    titleLine2: 'YANG JAUH',
    titleAccent: 'PULANG.',
    lead: 'Kami membuat perjalanan untuk orang-orang yang ingin keluar sebentar, bertemu lebih banyak cerita, dan kembali dengan sesuatu yang berbeda.',
    scrollLabel: 'KENALAN LEBIH JAUH',
    note: 'farther places.\ncloser stories.',
  },
  intro: {
    kicker: 'BUKAN TENTANG\nSEBERAPA JAUH.',
    eyebrow: '01 / KENAPA KAMI ADA',
    title: 'Karena hidup kadang butuh',
    titleAccent: 'jalan memutar.',
    body1:
      'LebihJauh lahir dari satu gagasan sederhana: perjalanan yang baik bukan hanya membawa kita ke tempat baru, tetapi juga mendekatkan kita pada orang lain dan diri sendiri.',
    body2:
      'Kami merancang ruang untuk berangkat tanpa harus mengenal semua orang, berjalan tanpa harus paling cepat, dan pulang dengan cerita yang layak disimpan lebih lama.',
  },
  story: {
    mainImage: image(
      'https://images.unsplash.com/photo-1765412295905-01083c2d792e?auto=format&fit=crop&w=1400&q=82',
      'Rombongan pendaki menyusuri jalur hutan pinus',
      '',
      'Chaewool Kim / Unsplash',
      'https://unsplash.com/photos/lMSpBFXc4pE',
    ),
    secondaryImage: image(
      'https://images.unsplash.com/photo-1758599668542-53e8c63c8e68?auto=format&fit=crop&w=1400&q=82',
      'Teman-teman dengan ransel berjalan dan berbincang di dalam hutan',
      '',
      'Vitaly Gariev / Unsplash',
      'https://unsplash.com/photos/pc8BUVAVXzo',
    ),
    eyebrow: '02 / PERJALANAN VERSI KAMI',
    title: 'TUJUANNYA BOLEH SAMA.',
    titleAccent: 'Rasanya selalu baru.',
    lead: 'Gunung yang sama bisa memberi cerita berbeda, tergantung siapa yang berjalan di samping kita.',
    body: 'Karena itu, kami memperhatikan lebih dari sekadar itinerary. Kami memikirkan ritme perjalanan, rasa aman, ruang untuk saling mengenal, dan momen kecil yang biasanya tidak tertulis di rundown.',
    quote:
      'Pergi jauh bukan untuk lari. Kadang, kita hanya perlu ruang yang lebih luas untuk melihat hidup dengan lebih jelas.',
  },
  values: {
    eyebrow: '03 / YANG KAMI PEGANG',
    titleLine1: 'CARA KAMI',
    titleLine2: 'MELANGKAH.',
    intro:
      'Tiga hal sederhana yang ingin kami bawa dalam setiap perjalanan. Bukan aturan kaku—lebih seperti kompas.',
    items: [
      {
        title: 'Orangnya dulu.',
        copy: 'Perjalanan terasa berarti karena orang yang saling menjaga, berbagi cerita, dan memberi ruang satu sama lain.',
      },
      {
        title: 'Nikmati jalannya.',
        copy: 'Kami tidak hanya mengejar tujuan akhir. Istirahat, salah jalan kecil, dan obrolan di jalur juga bagian dari cerita.',
      },
      {
        title: 'Pulang bawa lebih.',
        copy: 'Bukan sekadar foto. Kami ingin setiap orang pulang membawa keberanian, teman baru, dan versi diri yang lebih hidup.',
      },
    ],
  },
  outro: {
    image: image(
      'https://images.unsplash.com/photo-1772041045313-0500d3706819?auto=format&fit=crop&w=1600&q=84',
      'Seorang pendaki menikmati cahaya matahari dari puncak gunung',
      '',
      'Marek Piwnicki / Unsplash',
      'https://unsplash.com/photos/N4d8smR0Yj8',
    ),
    eyebrow: 'NEXT GOOD STORY',
    titleLine1: 'MUNGKIN KITA',
    titleLine2: 'BERANGKAT',
    titleAccent: 'bareng.',
    description:
      'Pilih perjalanan yang sudah kami siapkan, atau ceritakan rencana khususmu. Dari sana, kita mulai menyusun cerita berikutnya.',
    primaryCtaLabel: 'Lihat Open Trip',
    secondaryCtaLabel: 'Rencanakan Private Trip',
  },
};

export const defaultGlobalContent = {
  contact: {
    whatsappNumber: '',
    whatsappGreeting: defaultWhatsAppGreeting,
  },
  socials: { ...emptySocialLinks },
};

export type HomePageContent = typeof defaultHomeContent;
export type AboutPageContent = typeof defaultAboutContent;
export type GlobalSiteContent = typeof defaultGlobalContent;
export type SitePageContent =
  HomePageContent | AboutPageContent | GlobalSiteContent;

export const isSitePageKey = (value: unknown): value is SitePageKey =>
  value === 'home' || value === 'about' || value === 'global';

export function validateSitePageContent(
  page: SitePageKey,
  input: unknown,
): SitePageContent {
  const template =
    page === 'home'
      ? defaultHomeContent
      : page === 'about'
        ? defaultAboutContent
        : defaultGlobalContent;
  const content = sanitizeSiteContent(template, input) as SitePageContent;
  if (page === 'global') {
    try {
      const globalContent = content as GlobalSiteContent;
      globalContent.contact.whatsappNumber = normalizeWhatsAppNumber(
        globalContent.contact.whatsappNumber,
      );
      validateSocialLinks(globalContent.socials);
    } catch (error) {
      throw new SiteContentInputError(
        error instanceof Error
          ? error.message
          : 'Tautan sosial media tidak valid.',
      );
    }
  }
  return content;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const legacyEnvironmentWhatsApp = () => {
  try {
    return normalizeWhatsAppNumber(process.env.BOOKING_WHATSAPP_NUMBER);
  } catch {
    return '';
  }
};

function hydrateGlobalContent(value: unknown): GlobalSiteContent {
  const stored = record(value);
  const storedContact = record(stored.contact);
  const storedSocials = record(stored.socials);
  const hasContact = Object.hasOwn(stored, 'contact');
  const legacySocialNumber = whatsappNumberFromUrl(storedSocials.whatsapp);
  const fallbackNumber = legacySocialNumber || legacyEnvironmentWhatsApp();
  return {
    contact: {
      whatsappNumber:
        typeof storedContact.whatsappNumber === 'string'
          ? storedContact.whatsappNumber
          : hasContact
            ? ''
            : fallbackNumber,
      whatsappGreeting:
        typeof storedContact.whatsappGreeting === 'string'
          ? storedContact.whatsappGreeting
          : defaultWhatsAppGreeting,
    },
    socials: Object.fromEntries(
      Object.keys(emptySocialLinks).map((key) => [
        key,
        typeof storedSocials[key] === 'string' ? storedSocials[key] : '',
      ]),
    ) as GlobalSiteContent['socials'],
  };
}

export async function getSitePageState(page: SitePageKey) {
  const [row] = await getDb()
    .select()
    .from(sitePage)
    .where(eq(sitePage.pageKey, page))
    .limit(1);
  const fallback =
    page === 'home'
      ? defaultHomeContent
      : page === 'about'
        ? defaultAboutContent
        : hydrateGlobalContent(undefined);
  const draft =
    page === 'global'
      ? hydrateGlobalContent(row?.draftContent)
      : ((row?.draftContent as SitePageContent | undefined) ?? fallback);
  const published =
    page === 'global'
      ? hydrateGlobalContent(row?.publishedContent)
      : ((row?.publishedContent as SitePageContent | undefined) ?? fallback);
  return {
    draft,
    published,
    hasDraft: Boolean(row),
    hasPublished: Boolean(row?.publishedContent),
    updatedAt: row?.updatedAt ?? null,
    publishedAt: row?.publishedAt ?? null,
  };
}

export async function getSitePageContent(
  page: 'home',
  draft?: boolean,
): Promise<HomePageContent>;
export async function getSitePageContent(
  page: 'about',
  draft?: boolean,
): Promise<AboutPageContent>;
export async function getSitePageContent(
  page: 'global',
  draft?: boolean,
): Promise<GlobalSiteContent>;
export async function getSitePageContent(page: SitePageKey, draft = false) {
  const state = await getSitePageState(page);
  return (draft ? state.draft : state.published) as SitePageContent;
}

export async function saveSitePage(
  page: SitePageKey,
  input: unknown,
  actor: string,
  publish: boolean,
) {
  const content = validateSitePageContent(page, input) as Record<
    string,
    unknown
  >;
  const now = new Date();
  const db = getDb();
  const [row] = await db
    .insert(sitePage)
    .values({
      pageKey: page,
      draftContent: content,
      publishedContent: publish ? content : null,
      updatedByUserId: actor,
      publishedByUserId: publish ? actor : null,
      publishedAt: publish ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sitePage.pageKey,
      set: {
        draftContent: content,
        ...(publish
          ? {
              publishedContent: content,
              publishedByUserId: actor,
              publishedAt: now,
            }
          : {}),
        updatedByUserId: actor,
        updatedAt: now,
      },
    })
    .returning();
  await db.insert(adminAuditLog).values({
    actorUserId: actor,
    entityType: 'site_page',
    entityId: row.id,
    action: publish ? 'published' : 'draft_updated',
    payload: { page },
  });
  return row;
}
