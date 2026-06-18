# Skema dan Alur Distribusi SHU (Sisa Hasil Usaha)

Dokumen ini menjelaskan arsitektur pembagian dan distribusi SHU di Koperasi Sulfindo, khususnya perbedaan perlakuan antara alokasi **Jasa Anggota** dan alokasi makro seperti **Honor Ketua/Pengurus**.

---

## 1. Pembagian Alokasi: Makro vs. Mikro

Dalam sistem akuntansi Koperasi Sulfindo, dana SHU dibagi menjadi dua tingkat operasional:

### A. Distribusi Mikro (Jasa Anggota)
Alokasi ini ditujukan langsung untuk seluruh anggota aktif dan dihitung secara individual:
* **Komponen:** Terdiri dari **Jasa Modal** (kontribusi simpanan) dan **Jasa Usaha** (partisipasi belanja di Toko & pembayaran bunga Pinjaman).
* **Perhitungan:**
  * Bobot Simpanan Anggota (`savingsWeight`) dihitung secara proporsional dari total simpanan seluruh anggota.
  * Bobot Aktivitas Anggota (`activityWeight`) dihitung berdasarkan transaksi belanja (`orders`) dan bunga pinjaman yang lunas (`loan_schedules`).
* **Penyaluran:** Ketika tombol **"Eksekusi Distribusi SHU Massal"** ditekan, sistem secara otomatis:
  1. Menyimpan data di tabel `shu_distributions`.
  2. Menambah saldo **Simpanan Sukarela** masing-masing anggota secara riil.
  3. Mencatat transaksi dengan tipe `shu_credit` pada tabel `saving_transactions`.

### B. Alokasi Makro (Dana Koperasi)
Alokasi ini adalah dana kolektif tingkat koperasi yang dikonfigurasi melalui persentase di Pengaturan SHU:
* **Komponen:** Terdiri dari **Cadangan Koperasi**, **Honor Ketua**, **Honor Pengurus**, **Kesejahteraan Pegawai**, **Dana Pendidikan**, dan **Dana Sosial & Pembangunan**.
* **Perhitungan:** Dihitung global dari persentase Net SHU, disimpan di tabel `shu_periods` (seperti kolom `shu_for_reserve`, `shu_for_pengurus`, dll.), dan ditampilkan pada ringkasan atas dashboard.
* **Penyaluran:** **Tidak dibagikan secara otomatis ke simpanan anggota**.

---

## 2. Mengapa Nilai Ketua & Pengurus Tidak Muncul di Buku Pembantu Anggota?

Meskipun persentase alokasi untuk Ketua (misal: 5%) dan Pengurus (misal: 5%) sudah dikonfigurasi dan nilainya terhitung di panel ringkasan, nominal tersebut tidak muncul pada baris nama mereka di tabel buku pembantu anggota karena alasan berikut:

### A. Ketiadaan Struktur Jabatan di Database
Di dalam tabel `members` dan tabel `users` pada database (`schema.prisma`):
* **Tidak ada pemetaan programatis** untuk menandai secara spesifik siapa anggota yang menjabat sebagai "Ketua" atau siapa saja anggota yang tergolong sebagai "Pengurus" untuk menerima transfer nominal tersebut.
* Role user pada sistem (`users_role`) hanya mendefinisikan role `pengurus` tanpa adanya role `ketua`, dan relasi ini tidak dihubungkan untuk distribusi otomatis SHU.

### B. Standard Operating Procedure (SOP) Akuntansi Koperasi
Secara akuntansi koperasi, alokasi makro untuk Ketua, Pengurus, Karyawan, maupun Cadangan diselesaikan secara terpisah (bukan melalui kredit simpanan sukarela massal):
1. **Pecatatan Kewajiban:** Ketika SHU didistribusikan, nilai alokasi makro diakui sebagai kewajiban/dana alokasi koperasi.
2. **Pencairan Manual:** Pembayaran honor dilakukan secara terpisah oleh Bendahara/Akuntan melalui pengeluaran kas langsung.
3. **Penjurnalan Manual:** Bendahara mencatat pencairan menggunakan **Voucher Pengeluaran Kas (Cash Out)** atau **Jurnal Umum**:
   * **Debit:** `30203 - SHU Bagian Pengurus` (atau akun Kewajiban/Ekuitas Alokasi SHU terkait)
   * **Kredit:** `10101 - Kas/Bank`
