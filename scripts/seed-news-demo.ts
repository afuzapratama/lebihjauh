import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { newsArticle, trip, user } from '../src/db/schema';

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=82`;

// Foto demo dipilih dari foto gratis Unsplash dan sengaja memakai URL image CDN
// yang stabil, bukan endpoint source.unsplash.com yang berubah tiap request.
const articles = [
  {
    slug: 'panduan-pertama-mendaki-gunung-rinjani',
    title: 'Pertama Kali ke Rinjani? Ini yang Perlu Disiapkan',
    category: 'Panduan Pendakian',
    excerpt:
      'Panduan ringkas untuk menyiapkan fisik, perlengkapan, dan ritme perjalanan sebelum menyusuri jalur Gunung Rinjani.',
    body: `Rinjani bukan sekadar gunung tinggi yang perlu ditaklukkan. Perjalanan ke sana meminta kita mengatur tenaga, menerima perubahan cuaca, dan berjalan dalam ritme kelompok. Persiapan terbaik dimulai beberapa minggu sebelum keberangkatan, bukan malam saat ransel mulai dipacking.

Latihan sederhana seperti berjalan cepat, naik turun tangga, dan membawa beban ringan sudah cukup membantu tubuh beradaptasi. Lakukan secara bertahap tiga sampai empat kali seminggu. Tujuannya bukan mengejar kecepatan, melainkan menjaga napas tetap stabil ketika jalur mulai panjang dan menanjak.

Untuk perlengkapan, prioritaskan barang yang menjaga tubuh tetap kering dan hangat. Jaket tahan angin, lapisan pakaian yang cepat kering, penutup kepala, sarung tangan, serta kaus kaki cadangan jauh lebih berguna daripada membawa terlalu banyak baju. Pisahkan pakaian tidur dalam dry bag agar selalu tersedia dalam kondisi kering.

Selama perjalanan, jangan malu meminta ritme diperlambat. Minum sedikit tetapi rutin, makan sebelum benar-benar lapar, dan beri tahu trip leader ketika tubuh mulai terasa berbeda. Pendakian yang baik bukan tentang siapa yang tiba lebih dulu, melainkan bagaimana seluruh kelompok pulang dengan cerita yang utuh.

Terakhir, sisakan ruang di kepala untuk menerima bahwa cuaca dan kondisi jalur dapat mengubah rencana. Puncak memang indah, tetapi keputusan untuk berhenti atau kembali juga bagian dari pengalaman mendaki yang bertanggung jawab.`,
    authorName: 'Tim LebihJauh',
    seoTitle: 'Panduan Pertama Mendaki Gunung Rinjani',
    seoDescription:
      'Persiapan fisik, perlengkapan, dan tips mengatur ritme untuk pendakian pertama ke Gunung Rinjani bersama LebihJauh.',
    coverImageUrl: image('photo-1741845351763-302030e2f126'),
    coverAltText: 'Dua pendaki berjalan di jalur punggungan Gunung Rinjani',
    contentImageUrl: image('photo-1779606854108-95f81f20efa5'),
    contentImageAlt: 'Tenda-tenda berdiri di padang rumput saat senja',
    contentImageCaption:
      'Suasana camp saat senja. Foto demo: Regi Munandar / Unsplash.',
    relatedTripSlug: 'gunung-rinjani',
  },
  {
    slug: 'membaca-cuaca-sebelum-naik-gunung',
    title: 'Membaca Cuaca Sebelum Naik Gunung',
    category: 'Tips Perjalanan',
    excerpt:
      'Langit cerah di kota belum tentu berarti jalur akan bersahabat. Kenali sinyal cuaca sebelum dan selama pendakian.',
    body: `Prakiraan cuaca adalah titik awal, bukan jawaban mutlak. Kondisi di gunung dapat berubah lebih cepat karena ketinggian, arah angin, dan bentuk lereng. Karena itu, cek prakiraan dari beberapa sumber dan lihat pola selama beberapa hari, bukan hanya ikon cuaca pada hari keberangkatan.

Perhatikan tiga hal sederhana: peluang hujan, kecepatan angin, dan suhu terendah. Hujan ringan dengan angin kencang dapat terasa jauh lebih berat daripada hujan yang turun di kota. Suhu juga terasa lebih rendah ketika pakaian basah atau tubuh berhenti bergerak terlalu lama.

Di jalur, awan yang menebal cepat, angin yang berubah arah, dan suara petir adalah tanda untuk mengevaluasi perjalanan. Trip leader mungkin mengubah waktu istirahat, mempercepat turun, atau membatalkan bagian tertentu. Keputusan seperti ini dibuat untuk keselamatan kelompok, bukan karena perjalanan gagal.

Simpan jas hujan di bagian ransel yang mudah dijangkau. Lindungi pakaian, obat, dan perangkat elektronik dengan lapisan kedap air terpisah. Jangan menunggu hujan deras untuk mengenakan perlindungan, karena menjaga tubuh tetap kering jauh lebih mudah daripada menghangatkannya kembali.

Cuaca yang tidak sesuai rencana sering kali justru mengajarkan hal paling penting: perjalanan alam selalu merupakan kerja sama dengan kondisi, bukan pertarungan untuk memaksakan tujuan.`,
    authorName: 'Tim LebihJauh',
    seoTitle: 'Cara Membaca Cuaca Sebelum Naik Gunung',
    seoDescription:
      'Pelajari cara membaca prakiraan, angin, suhu, dan perubahan awan agar perjalanan gunung lebih aman dan nyaman.',
    coverImageUrl: image('photo-1781813377841-a3a25348ed17'),
    coverAltText: 'Gunung berapi dengan kepulan awan di bawah langit lembut',
    contentImageUrl: image('photo-1786134016661-affe664394db'),
    contentImageAlt: 'Danau kawah berwarna biru dengan uap dan pegunungan',
    contentImageCaption:
      'Cuaca pegunungan bisa berubah cepat. Foto demo: Rowan Heuvel / Unsplash.',
    relatedTripSlug: 'gunung-sumbing-via-garung',
  },
  {
    slug: 'camp-pertama-tetap-nyaman-dan-ringkas',
    title: 'Camp Pertama: Nyaman Tanpa Membawa Seisi Rumah',
    category: 'Tips Perjalanan',
    excerpt:
      'Cara memilih barang yang benar-benar dipakai agar pengalaman camping pertama tetap hangat, ringan, dan menyenangkan.',
    body: `Kesalahan paling umum saat camping pertama adalah membawa terlalu banyak barang karena takut kekurangan. Ransel akhirnya berat, ruang tenda penuh, dan energi sudah habis sebelum tempat camp terlihat. Mulailah dari kebutuhan dasar: tidur, makan, perlindungan cuaca, dan kebersihan.

Untuk tidur, matras yang sesuai sering lebih menentukan daripada sleeping bag yang paling tebal. Matras memisahkan tubuh dari tanah yang dingin dan lembap. Padukan dengan sleeping bag sesuai suhu lokasi, lalu gunakan pakaian tidur kering yang tidak dipakai berjalan.

Susun barang berdasarkan waktu penggunaan. Jas hujan, air minum, camilan, dan obat pribadi berada di bagian mudah dijangkau. Perlengkapan tidur dapat masuk lebih dalam karena baru dipakai saat tiba di camp. Barang kecil sebaiknya dikumpulkan dalam pouch agar tidak tercecer di dalam ransel.

Di area camp, jaga suara dan cahaya agar tidak mengganggu kelompok lain. Hindari meninggalkan sisa makanan karena dapat mengundang satwa. Semua sampah, termasuk tisu dan kemasan kecil, harus kembali turun bersama kita.

Camping yang nyaman tidak lahir dari barang paling lengkap. Ia datang dari perlengkapan yang tepat, pengaturan yang rapi, dan teman perjalanan yang saling membantu ketika udara mulai dingin.`,
    authorName: 'Tim LebihJauh',
    seoTitle: 'Panduan Camping Pertama yang Ringkas dan Nyaman',
    seoDescription:
      'Daftar kebutuhan dan cara packing camping pertama agar ransel tetap ringan, tidur nyaman, dan camp tetap bersih.',
    coverImageUrl: image('photo-1779606853847-ff58b4e837aa'),
    coverAltText: 'Meja dan kursi camping tertata di atas padang rumput',
    contentImageUrl: image('photo-1735611727780-86641eb78c5d'),
    contentImageAlt: 'Air terjun mengalir di tengah hutan tropis yang hijau',
    contentImageCaption:
      'Ruang singgah yang dijaga bersama. Foto demo: Michael Stevanus Hartono / Unsplash.',
    relatedTripSlug: 'gunung-ungaran',
  },
  {
    slug: 'mengejar-sunrise-bromo-tanpa-terburu-buru',
    title: 'Mengejar Sunrise Bromo Tanpa Kehilangan Momennya',
    category: 'Cerita Tempat',
    excerpt:
      'Bromo sebelum matahari terbit adalah udara dingin, langkah pelan, dan lanskap yang perlahan muncul dari gelap.',
    body: `Perjalanan menuju Bromo dimulai ketika sebagian besar kota masih tidur. Udara dini hari masuk dari celah jaket, lampu kendaraan bergerak seperti garis kecil, dan obrolan perlahan menghilang saat semua orang memilih menyimpan tenaga.

Di titik pandang, menunggu adalah bagian terpanjang sekaligus paling berharga. Langit tidak langsung berubah dramatis. Mula-mula hanya ada garis pucat di cakrawala, kemudian warna biru menjadi lebih ringan, dan bentuk pegunungan mulai terpisah dari kabut.

Banyak orang sibuk mencari posisi foto terbaik, tetapi sesekali menurunkan kamera justru membuat pemandangan terasa lebih utuh. Suara angin, langkah pengunjung, dan hangat minuman sederhana menjadi bagian dari ingatan yang tidak selalu tertangkap gambar.

Setelah matahari naik, lautan pasir memperlihatkan skala Bromo yang sebenarnya. Jarak yang tampak dekat dari atas berubah menjadi ruang luas yang harus dilalui perlahan. Debu mudah terangkat, jadi masker dan kacamata akan sangat membantu.

Bromo mengingatkan bahwa perjalanan tidak perlu selalu cepat. Kadang kita hanya perlu datang lebih awal, bertahan dalam dingin, dan memberi waktu bagi sebuah tempat untuk memperlihatkan dirinya sendiri.`,
    authorName: 'Tim LebihJauh',
    seoTitle: 'Cerita Sunrise Bromo dan Tips Menikmatinya',
    seoDescription:
      'Cerita perjalanan menikmati sunrise Bromo, lengkap dengan gambaran suasana dan persiapan kecil agar tetap nyaman.',
    coverImageUrl: image('photo-1684261968999-9cce1b05738f'),
    coverAltText: 'Gunung Bromo terlihat dari kejauhan saat pagi berkabut',
    contentImageUrl: image('photo-1781813377841-a3a25348ed17'),
    contentImageAlt: 'Kepulan asap putih muncul dari Gunung Bromo',
    contentImageCaption:
      'Pagi yang perlahan membuka lanskap Bromo. Foto demo: Rowan Heuvel / Unsplash.',
    relatedTripSlug: null,
  },
  {
    slug: 'kawah-ijen-biru-yang-menyimpan-banyak-cerita',
    title: 'Kawah Ijen: Biru yang Menyimpan Banyak Cerita',
    category: 'Cerita Tempat',
    excerpt:
      'Di balik warna biru Kawah Ijen ada medan vulkanik, udara tajam, dan pelajaran tentang menghormati sebuah tempat.',
    body: `Warna biru Kawah Ijen sering menjadi alasan pertama orang datang. Namun sebelum danau terlihat, perjalanan dimulai lewat jalur yang gelap, udara dingin, dan tanjakan yang membuat percakapan berubah menjadi potongan kalimat pendek.

Mendekati kawasan kawah, bau belerang mulai terasa. Masker yang sesuai bukan aksesori, melainkan perlengkapan penting. Arah angin dapat berubah dan membawa gas ke jalur, sehingga instruksi petugas serta pemandu perlu diikuti tanpa menawar.

Ketika cahaya pagi tiba, warna danau terlihat hampir tidak nyata. Pemandangan ini indah, tetapi lingkungan di sekitarnya tetap aktif dan memiliki risiko. Menjaga jarak aman jauh lebih penting daripada mengejar sudut foto yang tampak sempurna.

Ijen juga memperlihatkan sisi lain dari lanskap wisata: para pekerja yang hidup berdampingan dengan medan berat. Datang dengan sikap hormat berarti tidak menghalangi jalur mereka, tidak menjadikan pekerjaan sebagai tontonan, dan meminta izin sebelum mengambil foto dekat.

Perjalanan terbaik meninggalkan rasa kagum sekaligus kesadaran. Kita pulang bukan hanya membawa foto danau biru, tetapi juga pemahaman bahwa setiap tempat memiliki kehidupan yang berlangsung jauh sebelum kita datang.`,
    authorName: 'Tim LebihJauh',
    seoTitle: 'Cerita Perjalanan Kawah Ijen Sebelum Sunrise',
    seoDescription:
      'Mengenal suasana, medan, dan etika berkunjung ke Kawah Ijen agar perjalanan tetap aman dan penuh hormat.',
    coverImageUrl: image('photo-1786134016661-affe664394db'),
    coverAltText: 'Danau Kawah Ijen berwarna biru dengan uap vulkanik',
    contentImageUrl: image('photo-1786029492126-5c405dd730e7'),
    contentImageAlt: 'Pendaki dengan ransel duduk di punggungan gunung hijau',
    contentImageCaption:
      'Berhenti sejenak untuk membaca keadaan. Foto demo: Nasik Lababan / Unsplash.',
    relatedTripSlug: null,
  },
] as const;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL wajib diisi.');
const client = postgres(databaseUrl);
const db = drizzle(client);
const [actor] = await db.select({ id: user.id }).from(user).limit(1);

if (!actor)
  throw new Error('Buat minimal satu akun admin sebelum menjalankan seed.');

const relatedSlugs = new Set<string>(
  articles.flatMap((article) =>
    article.relatedTripSlug ? [article.relatedTripSlug] : [],
  ),
);
const tripRows = await db.select({ id: trip.id, slug: trip.slug }).from(trip);
const tripIds = new Map(
  tripRows
    .filter((item) => relatedSlugs.has(item.slug))
    .map((item) => [item.slug, item.id]),
);
const now = new Date();

for (const [index, article] of articles.entries()) {
  const publishedAt = new Date(now.getTime() - index * 86_400_000);
  const values = {
    slug: article.slug,
    title: article.title,
    category: article.category,
    excerpt: article.excerpt,
    body: article.body,
    authorName: article.authorName,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    coverImageUrl: article.coverImageUrl,
    coverAltText: article.coverAltText,
    contentImageUrl: article.contentImageUrl,
    contentImageAlt: article.contentImageAlt,
    contentImageCaption: article.contentImageCaption,
    relatedTripId: article.relatedTripSlug
      ? (tripIds.get(article.relatedTripSlug) ?? null)
      : null,
    publicationState: 'published',
    publishedAt,
    updatedAt: now,
  };
  await db
    .insert(newsArticle)
    .values({ ...values, createdByUserId: actor.id })
    .onConflictDoUpdate({
      target: newsArticle.slug,
      set: values,
    });
  console.log(`✓ ${article.title}`);
}

console.log(`${articles.length} artikel demo diterbitkan.`);
await client.end();
