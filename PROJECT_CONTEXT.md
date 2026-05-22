# PROJECT_CONTEXT.md

## 1. Stack Teknologi
- **Frontend & Backend Core**: Next.js (App Router, Server Actions, React 18, TypeScript)
- **Database Access & ORM**: Prisma Client JS
- **Database Engine**: MySQL (Hosted on Aiven Cloud with SSL forced connection)
- **Styling**: TailwindCSS & Custom Vanilla CSS Tokens, Shadcn UI compatible premium styles
- **Icons**: Lucide React
- **Toast Notifications**: Sonner Toast

---

## 2. Skema Database Utama
Berikut adalah struktur data inti yang digunakan dalam sistem Koperasi Sulfindo:

- **`users`**: Menyimpan kredensial login, peran pengguna (`superadmin`, `admin`, `pengurus`, `kasir`, `anggota`), status aktif, dan hubungan dengan tabel `members`.
- **`members`**: Profil lengkap anggota koperasi, mencakup `member_code` (Kode Anggota unik), `nik`, `full_name` (Nama Lengkap), email, telepon, alamat, status keanggotaan (`active`, dll.), unit kerja (`unit_id`), dan tanggal bergabung.
- **`units`**: Unit usaha/kerja di bawah koperasi (`simpan_pinjam`, `toko`, `ppob`, dll.).
- **`savings`**: Menyimpan saldo simpanan anggota untuk setiap jenis simpanan (diidentifikasi dengan `member_id` dan `saving_type_id`).
- **`saving_types`**: Konfigurasi jenis simpanan (`POKOK` / Pokok, `WAJIB` / Wajib, `SUKARELA` / Sukarela).
- **`saving_transactions`**: Riwayat mutasi/transaksi simpanan (`deposit`, `withdraw`, `shu_credit`, dll.) yang mencatat saldo sebelum dan sesudah transaksi secara berurutan.
- **`loans`**: Data kontrak pinjaman anggota, mencakup plafon utama, bunga flat/anuitas/efektif, tenor bulan, status kontrak (`active`, `settled`, dll.), dan total pengembalian.
- **`loan_payments`**: Rekam jejak cicilan pinjaman yang dibayar oleh anggota, merinci porsi pokok, bunga, denda (`penalty_amount`), dan tanggal pembayaran.
- **`orders`**: Transaksi penjualan retail di Toko Waserda baik via kasir POS maupun online.
- **`chart_of_accounts` (COA)**: Daftar Rekening Akuntansi standard koperasi yang dikelompokkan berdasarkan tipe (`asset`, `liability`, `equity`, `revenue`, `expense`).
- **`journal_entries` & `journal_lines`**: Jurnal Akuntansi berpasangan (Double-entry Ledger) untuk setiap peristiwa transaksi finansial (penjualan, pembayaran cicilan, pencairan simpanan, pembagian SHU, dan penyesuaian manual).
- **`shu_periods`**: Data rekapitulasi tahun buku RAT koperasi, melacak total SHU bersih, alokasi makro anggota (55%), cadangan koperasi (20%), pengurus (5%), pegawai (5%), pendidikan (5%), dan sosial (10%).
- **`shu_distributions`**: Detail pembagian SHU per anggota yang mencakup bobot simpanan (`savings_weight`), bobot partisipasi usaha (`activity_weight`), dan total nilai SHU yang didistribusikan secara riil.

---

## 3. Status Fitur & Modul Saat Ini

### A. Modul Akuntansi & Laporan RAT (Terbaru & Komplet)
1. **Laporan Neraca (Balance Sheet)**:
   - Menyajikan data Aset Lancar, Aset Tetap, Kewajiban, dan Ekuitas secara real-time.
   - **Double-Entry Balance Guarantee**: Menghitung secara otomatis `currentShu` sebagai penyeimbang ekuitas sehingga total Aset selalu seimbang ($Assets = Liabilities + Equity$) dengan deviasi Rp 0.00.
2. **Laporan PHU (Perhitungan Hasil Usaha / Laba Rugi)**:
   - Mengakumulasi pendapatan penjualan retail Toko Waserda, pendapatan jasa bunga dari angsuran pinjaman, pendapatan denda, dan entri manual dari jurnal umum.
   - Mengurangkan Harga Pokok Penjualan (HPP) toko secara akurat dan beban operasional koperasi untuk menghasilkan SHU Bersih Tahun Berjalan.
3. **Pembagian SHU Massal otomatis**:
   - Menghitung porsi makro dan proporsi hak per anggota (Jasa Modal 40% & Jasa Usaha 60%).
   - Mendistribusikan dana secara massal dalam satu database transaction aman (`prisma.$transaction`) langsung ke saldo Simpanan Sukarela masing-masing anggota.
   - Mencatat log transaksi simpanan bertipe `shu_credit` secara otomatis untuk transparansi audit.
4. **Buku Pembantu RAT (Partisipasi Anggota)**:
   - Filter real-time per tahun buku RAT.
   - Pencarian cerdas nama/kode anggota, ekspor data partisipasi ke format CSV.
   - Modal audit detail anggota untuk pertanggungjawaban kontribusi modal dan partisipasi belanja/pinjaman.

### B. Modul Penutupan Buku Bulanan (Monthly Closing)
- Memindahkan saldo COA ke tabel `monthly_closures`.
- Menghitung bunga pinjaman dan denda berjalan secara otomatis sebagai pendapatan operasional berjalan.
- Mengurangkan persediaan toko (HPP) secara historis untuk laporan laba rugi bulanan yang akurat.

### C. Modul Transaksi Retail & Konsinyasi
- Penjualan kasir POS terintegrasi metode pembayaran potong simpanan atau tunai.
- Penerimaan barang konsinyasi supplier dengan manajemen status penerimaan yang aman dari bug zero-date dan enum-crashes.

---

## 4. Technical Changelog (Changelog Teknis)
- **Fix (RAT & Loan Aggregation)**:
  - Mengalihkan seluruh query agregasi bunga pinjaman dan denda dari tabel `loan_payments` (yang kosong) ke tabel `loan_schedules` dengan status `paid`.
  - Mengubah `getMemberActivityInterestPaid` pada `src/lib/actions/shu-calculation.ts` agar mengagregasi partisipasi bunga anggota dari `loan_schedules`.
  - Mengubah `calculateLoanInterestForPeriod` & `calculateLoanPenaltyForPeriod` pada `src/lib/actions/laporan-keuangan.ts` agar menyajikan pendapatan operasional bunga & denda secara riil dari tabel `loan_schedules`.
  - Mengubah `calculateOperationalRevenue` pada `src/lib/actions/accounting.ts` agar menutup buku bulanan dengan basis data operasional bunga & denda yang seimbang.
  - Memperbarui logic pencatatan kasir manual `recordLoanPayment` pada `src/lib/actions/loan-payments.ts` agar sinkron menulis pokok, bunga, dan denda terbayar ke dalam `loan_schedules`.
- **Fix (Promotions Data Resilience)**:
  - Mendaftarkan model `Promotion` secara resmi ke dalam `prisma/schema.prisma` agar terintegrasi penuh dalam siklus migrasi database dan tidak terhapus (dropped) saat `npx prisma db push`.
  - Menambahkan kueri raw SQL DDL `CREATE TABLE IF NOT EXISTS promotions` di awal berkas `prisma/seed.ts` sebagai proteksi ganda (idempotensi) agar database reset dapat langsung merekonstruksi tabel promosi secara otomatis sebelum pengisian data.