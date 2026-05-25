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
- **Feature & Fix (Monitoring Stocks Financial & Seeding)**:
  - Mengubah penyajian data tab "Monitoring Stocks" di Laporan Analitik `/laporan/analitik` dari format QTY barang menjadi nominal Rupiah (laporan keuangan), mengalikan mutasi pergerakan dengan `purchase_price` (untuk masuk/stok awal/stok akhir/retur/opname) dan `price` (untuk penjualan keluar).
  - Melakukan formatting Rupiah (`formatRp`) pada desktop UI tabel, mobile card feed view, dan ekspor berkas Excel/PDF terpadu secara premium dan konsisten.
  - Menulis dan mengeksekusi script seeder data demo pergerakan stok untuk bulan berjalan (Mei 2026), termasuk transaksi Pembelian (`type: 'in'`), Laporan Stock Opname berstatus `approved`, serta transaksi Retur Supplier (`type: 'return'`) sehingga kolom PEMBELIAN, STOCK OPNAME, dan RETUR tidak lagi kosong dan terisi dengan data riil yang realistis.
- **Refactor & Fix (Resilience and Modularization of Arus Kas Report)**:
  - Memecah query database besar di `src/lib/actions/laporan-arus-kas.ts` menjadi 12 helper functions kecil yang terfokus (masing-masing di bawah 20-30 baris) demi mematuhi batas SOLID/DRY.
  - Menerapkan penanganan kesalahan (`try-catch`) dan fallback aman bernilai `0` pada Server Actions untuk meredam kegagalan koneksi database temporer MySQL Aiven Cloud (`PrismaClientKnownRequestError`).
  - Mengoptimalkan kueri aggregasi (seperti saldo awal kas & perolehan aset tetap) dari kueri berulang (N+1 loop) menjadi kueri agregasi tunggal berbasis operator `in` (IN operator), mengurangi overhead database secara drastis.
- **Feature & Fix (Inventory Dropdown Products & Stock Opname Reconciliation)**:
  - Mengubah kolom input manual ID Produk pada panel Transfer Stok dan Stock Opname menjadi dropdown pilihan nama barang untuk meningkatkan keramahan pengguna (*user experience*) dan mencegah kesalahan manusia (*human error*).
  - Melakukan integrasi data stok katalog (`products.stock`) dan saldo stok per lokasi (`stock_balances.qty_on_hand`) secara transaksional ke dalam form dropdown sebagai nilai awal (default).
  - Merombak fungsi persetujuan draf opname (`approveStockOpname`) di `src/lib/actions/inventory.ts` agar berjalan secara transaksional penuh (`prisma.$transaction`) untuk memperbarui saldo stok fisik per lokasi (`stock_balances`), stok katalog global (`products`), dan mencatat log kartu pergerakan stok bertipe `'adjustment'`.
  - Memperbarui formula ringkasan kartu mutasi, penentuan warna font Qty (merah/hijau), visualisasi simbol prefix (`+` / `-`) pada halaman mutasi stok `laporan-stok-client.tsx`, serta format warna cell Excel agar mendukung transaksi bertipe `'adjustment'` yang bernilai kuantitas positif maupun negatif secara akurat dan konsisten.
- **Documentation (Database Architecture & Relation Mapping)**:
  - Melakukan analisis mendalam terhadap berkas `prisma/schema.prisma` yang mencakup 7 kelompok modul bisnis dan 50+ tabel.
  - Membuat berkas rancangan komprehensif `rancangan_struktur_database.md` di folder artifacts yang menjabarkan nama tabel, kolom (PK, FK), tipe data, constraints (not null, unique, check), jenis relasi (1:1, 1:N, N:M), skema logis ERD Mermaid, alur data transaksional, serta strategi optimasi integritas dan efisiensi kueri.
  - Memetakan alur request-to-response persetujuan stock opname transaksional terenkapsulasi di dalam database transaction (`prisma.$transaction`) dengan row-level locking (`SELECT FOR UPDATE`).
- **Fix & Feature (Manual Transactions & Bank COA Account Number Input)**:
  - Memperbaiki kegagalan pengenalan query parameters (`typeParam`, `amountParam`, `notesParam`) pada halaman input transaksi server-side `/akuntansi/transaksi/page.tsx` dengan mendeklarasikan `searchParams` sebagai `Promise` dan melakukan `await` sebelum ekstraksi nilai (Next.js 16 Promise Fix).
  - Melakukan pembulatan integer (`Math.round`) pada parameter nominal uang di server-side untuk menghilangkan bagian decimal (contoh: `.01` dari bagi hasil angsuran) agar parser non-digit client-side tidak melipatgandakan nominal menjadi angka raksasa yang melanggar batas presisi database.
  - Menambahkan state `addModalNumber` di [transaksi-client.tsx](file:///d:/laragon/www/koperasi-sulfindo/src/app/(dashboard)/akuntansi/transaksi/transaksi-client.tsx) serta field input **"Nomor Rekening"** secara dinamis di modal tambah rekening bank baru.
  - Melakukan penggabungan otomatis nama bank dan nomor rekening menjadi format `[Nama Bank] (No. [Nomor Rekening])` sebelum memanggil Server Action `createAdditionalAccount` untuk disimpan ke database MySQL.
  - Memperbarui Server Action `getGeneralLedgerNotifications` di [buku-besar.ts](file:///d:/laragon/www/koperasi-sulfindo/src/lib/actions/buku-besar.ts) untuk memeriksa apakah jurnal penerimaan kas harian (dengan deskripsi mengandung kata kunci "angsuran" atau "pembayaran") sudah dicatat, lalu menyembunyikan notifikasi PR angsuran jika transaksi sudah berhasil disimpan.