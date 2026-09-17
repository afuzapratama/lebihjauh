import ridge from '../assets/ridge.jpg';
import hero from '../assets/hero.jpg';
import camp from '../assets/camp.jpg';
import hiker from '../assets/hiker.jpg';
import forest from '../assets/forest.jpg';
import bromo from '../assets/bromo.jpg';

// Preview content: replace with verified operational data before accepting bookings.
export const trips = [
  {
    id: 'merbabu',
    name: 'Merbabu',
    subtitle: 'Savana luas. Cerita tanpa batas.',
    location: 'Boyolali, Jawa Tengah',
    category: 'Pendakian',
    date: '10–11 Okt 2026',
    duration: '2 hari, 1 malam',
    meeting: 'Basecamp Selo',
    price: 650000,
    image: ridge,
    alt: 'Ilustrasi punggungan pegunungan yang diterangi matahari',
    tag: 'SAVANA & SUNRISE',
    route: 'Via Selo',
    description:
      'Bayangkan berjalan melewati lanskap terbuka, berbagi cerita di tenda, lalu menyambut pagi bersama. Merbabu menjadi inspirasi perjalanan untuk kamu yang ingin meluangkan waktu lebih lama di alam.',
  },
  {
    id: 'prau',
    name: 'Prau',
    subtitle: 'Bangun pagi, di atas awan.',
    location: 'Wonosobo, Jawa Tengah',
    category: 'Pendakian',
    date: '17–18 Okt 2026',
    duration: '2 hari, 1 malam',
    meeting: 'Basecamp Patak Banteng',
    price: 450000,
    image: hero,
    alt: 'Ilustrasi lapisan pegunungan dan awan di pagi hari',
    tag: 'CHASE THE SUNRISE',
    route: 'Via Patak Banteng',
    description:
      'Satu akhir pekan untuk mengganti pemandangan, menikmati udara pagi, dan membawa pulang cerita baru. Konsep perjalanan Prau berfokus pada pengalaman bermalam dan menikmati waktu bersama.',
  },
  {
    id: 'papandayan',
    name: 'Papandayan',
    subtitle: 'Pelan-pelan, nikmati perjalanan.',
    location: 'Garut, Jawa Barat',
    category: 'Camping',
    date: '24–25 Okt 2026',
    duration: '2 hari, 1 malam',
    meeting: 'Basecamp Camp David',
    price: 550000,
    image: camp,
    alt: 'Ilustrasi tenda untuk bermalam di alam terbuka',
    tag: 'A WEEKEND OUTSIDE',
    route: 'Camping trip',
    description:
      'Matikan sejenak rutinitas, dirikan tenda, dan beri ruang untuk obrolan yang biasanya tertunda. Papandayan menjadi inspirasi camping trip bersama teman-teman baru.',
  },
];

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);

export const stories = [
  {
    id: 'berangkat-sendiri',
    category: 'CERITA PERJALANAN',
    title: 'Berangkat sendiri, pulang bawa cerita.',
    intro: 'Kadang, langkah pertama cuma sesederhana berani bilang: ikut, yuk.',
    image: hiker,
    alt: 'Pendaki berjalan bersama di jalur pegunungan',
    paragraphs: [
      'Ada perjalanan yang dimulai dari grup teman. Ada juga yang dimulai dari satu orang yang akhirnya memutuskan untuk berangkat. Buat kami, keduanya punya ruang yang sama.',
      'Di perjalanan, obrolan bisa berawal dari hal kecil: lagu di kendaraan, kopi yang dibagi, atau saling menunggu saat mengambil foto. Kita datang dengan cerita masing-masing, lalu punya cerita baru yang bisa dibawa pulang.',
      'Itulah semangat yang ingin dibawa LebihJauh. Sebuah ajakan untuk membuka diri pada tempat, percakapan, dan pertemuan baru.',
    ],
  },
  {
    id: 'jeda-di-alam',
    category: 'CATATAN ALAM',
    title: 'Tentang jeda yang kita cari di alam.',
    intro:
      'Ruang untuk melambat, melihat sekitar, dan menikmati yang sederhana.',
    image: forest,
    alt: 'Cahaya masuk di antara pepohonan hutan',
    paragraphs: [
      'Tidak setiap perjalanan harus diisi banyak tujuan. Kadang yang kita inginkan hanya pagi yang lebih pelan, pemandangan berbeda, dan kesempatan untuk hadir sepenuhnya.',
      'Kami membayangkan perjalanan dengan ruang untuk menikmati hal-hal kecil. Duduk sebentar. Mendengar angin. Mengobrol tanpa buru-buru kembali ke pekerjaan.',
      'Pergi lebih jauh bisa menjadi cara untuk mengenal hal yang dekat: teman perjalanan, rasa ingin tahu, dan diri sendiri.',
    ],
  },
  {
    id: 'jadwal-oktober',
    category: 'KABAR TRIP',
    title: 'Oktober di luar ruangan. Kamu ikut?',
    intro:
      'Intip contoh destinasi untuk mengisi akhir pekan dengan cerita baru.',
    image: bromo,
    alt: 'Bentang alam Bromo dengan kabut di pagi hari',
    paragraphs: [
      'Untuk preview ini, kami menyiapkan tiga contoh perjalanan: Merbabu, Prau, dan Papandayan. Masing-masing menunjukkan bagaimana jadwal, meeting point, dan harga akan ditampilkan di website.',
      'Tanggal dan harga yang tampil masih berupa data contoh, bukan pengumuman keberangkatan resmi. Jadwal, fasilitas, ketentuan, dan ketersediaan akan diperbarui ketika layanan siap.',
      'Nantinya, setiap kabar jadwal akan terhubung ke informasi trip yang sama agar kamu mudah menemukan detail terbaru.',
    ],
  },
];

export const gallery = [
  {
    image: hiker,
    alt: 'Sekelompok pendaki menyusuri jalur pegunungan',
    caption: 'Langkah baru, teman baru.',
  },
  {
    image: bromo,
    alt: 'Pemandangan kawah dan kabut di Bromo',
    caption: 'Pagi yang layak ditunggu.',
  },
  {
    image: camp,
    alt: 'Tenda berkemah di tengah alam',
    caption: 'Rumah, untuk semalam.',
  },
  {
    image: hero,
    alt: 'Puncak gunung muncul di antara awan',
    caption: 'Lebih dekat dengan alam.',
  },
];

export const faqs = [
  {
    question: 'Apa bedanya Open Trip dan Private Trip?',
    answer:
      'Open Trip memiliki jadwal dan rute yang ditentukan, dan kamu bergabung dengan peserta lain. Private Trip direncanakan untuk rombonganmu sendiri, dengan usulan tanggal, tujuan, dan kebutuhan yang bisa didiskusikan.',
  },
  {
    question: 'Boleh ikut kalau berangkat sendiri?',
    answer:
      'Konsep Open Trip memang memungkinkan kamu bergabung tanpa membawa rombongan sendiri. Saat jadwal resmi tersedia, cek detail trip untuk mengetahui persyaratan peserta dan teknis pertemuannya.',
  },
  {
    question: 'Bagaimana cara melihat jadwal dan harga?',
    answer:
      'Lihat bagian Open Trip dan pilih “Lihat Trip” untuk membuka ringkasannya. Saat ini semua tanggal dan harga merupakan contoh untuk preview website, belum menjadi penawaran atau pemesanan aktif.',
  },
  {
    question: 'Bisa request trip untuk teman atau komunitas?',
    answer:
      'Bisa merencanakan lewat pilihan Private Trip. Pada preview ini, formulir membantu menyusun dan mengunduh ringkasan kebutuhanmu. Ringkasan tersebut tersimpan di perangkatmu dan belum dikirim ke tim LebihJauh.',
  },
];
