# Rangkuman Lengkap Proses, Rule, dan Design Koperasi Digital Sulfindo

Dokumen ini menyajikan arsitektur lengkap, proses bisnis, aturan teknis (*coding rules*), dan desain sistem Koperasi Digital Sulfindo dari awal (*nol*) hingga status saat ini (versi 3.2). Dokumen ini berfungsi sebagai panduan utama bagi tim pengembang (*developer handbook*) dan arsitek sistem (*technical architect*).

---

## 1. PENDAHULUAN & KONSEP BISNIS

Koperasi Digital Sulfindo adalah platform tata kelola koperasi modern yang mengintegrasikan tiga pilar bisnis utama koperasi ke dalam satu sistem terpadu:
1. **Unit Simpan Pinjam**: Mengelola simpanan anggota (Wajib, Pokok, Sukarela) dan pengajuan pinjaman dengan kalkulasi bunga/amortisasi otomatis serta penegakan batas aturan peminjaman (*loan rules*).
2. **Unit Toko & Retail (POS)**: Aplikasi kasir langsung (*Point of Sale*) untuk melayani transaksi belanja harian anggota dan umum, baik secara offline maupun online melalui portal anggota.
3. **Sistem Keuangan & Akuntansi**: Mengotomatisasi pencatatan jurnal akuntansi (*double-entry bookkeeping*), mengelola utang (*Accounts Payable*) dan piutang (*Accounts Receivable*), kalkulasi SHU (Sisa Hasil Usaha), dan pembuatan Laporan Laba Rugi (*P&L*).

---

## 2. STACK TEKNOLOGI

Platform ini dibangun menggunakan arsitektur modern berkinerja tinggi dengan susunan stack sebagai berikut:

| Layer | Teknologi / Library | Deskripsi & Versi |
|---|---|---|
| **Core Framework** | Next.js 15+ (App Router) | Menggunakan React 19, Server Components, Server Actions, dan Turbopack. |
| **Bahasa Pemrograman**| TypeScript | Strict mode diaktifkan untuk keamanan tipe data secara penuh. |
| **Authentication** | NextAuth.js v5 (Auth.js) | Strategi JWT (*JSON Web Token*) dengan adapter Prisma untuk persistensi sesi. |
| **Database ORM** | Prisma ORM v5.22 | Penghubung database relasional berbasis skema deklaratif. |
| **Database Server** | MySQL | Dihosting secara lokal menggunakan Laragon di port 3000. |
| **UI Components** | shadcn/ui + `@base-ui/react` | Menggunakan Tailwind CSS v4 untuk *styling* antarmuka responsif dan modern. |
| **Export Engines** | ExcelJS, jsPDF, jspdf-autotable, XLSX | Digunakan untuk mengunduh laporan keuangan berstandar tinggi. |
| **Mobile Bridge** | Capacitor v8.3.4 | Membungkus web aplikasi menjadi aplikasi native Android (.apk). |
| **Utilities** | Lucide React, Sonner, Recharts | Pendukung ikon, notifikasi toast, dan visualisasi grafik analitik. |

---

## 3. ARSITEKTUR DATABASE & KEY MODELS

Skema database diatur menggunakan Prisma (`schema.prisma`) dan MySQL dengan beberapa aturan keras (*hard rules*):

### A. Aturan Penting Database
1. **BigInt ID Rule**: Semua field ID utama bertipe `BigInt` untuk performa jangka panjang. Field ini harus diubah ke tipe `number` menggunakan `Number(id)` sebelum dikirim dari Server Action ke Client Component karena JavaScript tidak dapat men-serialisasi `BigInt` ke JSON secara native.
2. **Decimal Field Handling**: Semua nilai keuangan menggunakan tipe `Decimal` di Prisma. Untuk menghindari *serialization error* ("Only plain objects can be passed..."), nilai Decimal harus dipetakan ke tipe `number` di tingkat Server Action menggunakan `.toString()` terlebih dahulu: `Number(val?.toString() || 0)`.
3. **No Drop/Alter Existing Columns**: Dilarang menghapus atau mengubah kolom yang sudah ada untuk menjaga integritas data historis.

### B. Tabel Utama dan Fungsi
*   **users & members**:
    *   `users`: Menyimpan kredensial login, email, username, dan `role`.
    *   `members`: Profil lengkap anggota koperasi, termasuk NIK unik (sebagai alternatif login), batas paylater, dan poin loyalitas. Relasi satu-ke-satu dengan `users`.
*   **saving_types & savings & saving_transactions**:
    *   `saving_types`: Jenis simpanan (Pokok, Wajib, Sukarela) beserta aturan minimal saldo, wajib bulanan, dan opsi penarikan.
    *   `savings`: Rekening simpanan aktif anggota (harus di-*query* dengan `include: { saving_types: true }`).
    *   `saving_transactions`: Mutasi debit/kredit simpanan.
*   **loan_products & loan_applications & loans & loan_schedules**:
    *   `loan_products`: Jenis pinjaman dengan tenor, bunga, dan konfigurasi denda.
    *   `loan_applications`: Pengajuan pinjaman anggota. Status valid: `pending`, `approved`, `rejected` (catatan: **TIDAK ADA** status `submitted`).
    *   `loans`: Pinjaman yang sedang berjalan setelah disetujui (*disbursed*).
    *   `loan_schedules`: Jadwal angsuran/amortisasi bulanan anggota.
*   **products & product_categories**:
    *   `products`: Data barang toko (SKU, nama, HPP/harga beli, harga jual umum, harga jual anggota, stok aktual, batas stok minimum, status restock).
    *   `product_categories`: Kategori barang. Kategori barang titipan menggunakan slug khusus `konsinyasi`.
*   **orders & order_items**:
    *   `orders`: Induk transaksi penjualan POS atau online. Metode pembayaran: `cash`, `paylater`, `qris`, `transfer`.
    *   `order_items`: Rincian produk, jumlah beli, harga satuan, dan diskon dalam suatu order.
*   **purchase_orders & po_items & good_receipts & gr_items**:
    *   `purchase_orders`: Dokumen PO ke supplier (status: `draft`, `submitted`, `approved`, `partial_received`, `received`, `cancelled`).
    *   `good_receipts` (GR): Penerimaan fisik barang di gudang. Mengotomatisasi penambahan stok produk dan pembuatan utang dagang (*Accounts Payable*).
*   **consignment_items & consignment_payables & consignment_settlements**:
    *   `consignment_items`: Catatan barang titip jual (konsinyasi). Stok aktual dibaca langsung dari tabel `products.stock`.
    *   `consignment_payables`: Kewajiban pembayaran konsinyasi yang dibuat secara otomatis saat barang laku terjual di POS.
    *   `consignment_settlements`: Dokumen pelunasan utang konsinyasi kepada pemilik barang (supplier).
*   **accounts_payable (AP) & accounts_receivable (AR)**:
    *   `accounts_payable`: Buku utang dagang (terutama dari transaksi Good Receipt PO standard).
    *   `accounts_receivable`: Buku piutang dagang (terutama dari transaksi belanja POS menggunakan metode `paylater`).
*   **journal_entries & journal_lines & chart_of_accounts (COA)**:
    *   Pencatatan akuntansi berbasis *double-entry* untuk mencatat setiap pergeseran dana di koperasi secara otomatis.

---

## 4. ALUR & ALGORITMA PROSES BISNIS

### A. Authentication & RBAC (Role-Based Access Control)
*   **Metode Login**: Pengguna dapat masuk menggunakan **Email**, **Username**, atau **NIK Anggota**. Sistem secara dinamis mencari kecocokan pada tabel `users` dan `members`.
*   **Hak Akses (RBAC)**:
    *   `superadmin`: Memiliki kontrol penuh atas seluruh sistem dan konfigurasi.
    *   `ketua`: Memiliki hak setara pengurus ditambah hak eksklusif mengedit konfigurasi SHU (`/pengaturan/shu`).
    *   `pengurus`: Mengelola operasional harian (pembelian, stok, persetujuan kredit, akuntansi, dll).
    *   `admin`: Berfokus pada pengelolaan anggota, POS kasir, pengajuan kredit, dan pembelian standar.
    *   `kasir`: Dibatasi pada antarmuka POS kasir, pesanan online, dan laporan penjualan harian.
    *   `anggota`: Hanya memiliki akses ke Portal Anggota (toko online, cek simpanan/pinjaman pribadi).
*   *Route Protection* didefinisikan di `src/auth.config.ts` (`ROLE_ROUTES` map) dan divalidasi ulang di dalam Server Actions secara inline untuk mencegah bypass *Client Component*.

### B. Point of Sale (POS) Kasir
1. **Pencarian Produk**: Kasir mencari barang berdasarkan nama atau scan barcode SKU.
2. **Kalkulasi Diskon & Promosi**: Sistem secara dinamis mengecek jika ada promosi aktif di tabel `promotions` untuk memotong harga jual.
3. **Pilihan Pelanggan**: Transaksi bisa bersifat umum (Anonim) atau diasosiasikan ke Anggota tertentu menggunakan NIK untuk memproses pembayaran non-tunai.
4. **Metode Pembayaran**:
    *   `cash`: Kasir memasukkan jumlah uang fisik, sistem menghitung kembalian.
    *   `qris`: Sistem menampilkan QR statis/dinamis untuk discan (verifikasi manual oleh kasir).
    *   `paylater` (Khusus Anggota): Mengurangi batas limit paylater anggota dan mencatat piutang di `accounts_receivable`.
5. **Penyelesaian Transaksi**:
    *   Stok barang dipotong secara atomik menggunakan instruksi Prisma `$transaction`.
    *   Membuat jurnal akuntansi otomatis (Kas/Piutang di debit, Pendapatan Toko di kredit, HPP di debit, Persediaan di kredit).
    *   Jika produk bertipe **konsinyasi**, sistem menghitung sisa barang terjual dan mencatat kewajiban bayar di `consignment_payables`.

### C. Alur Pengadaan (Procurement) & Pengelolaan Inventaris
1. **Pengajuan Restock**: Ketika stok produk reguler di bawah batas minimum (`stock <= min_stock`), Kasir dapat menekan tombol "Ajukan Restock" yang memicu flag `restock_requested = true`.
2. **Pembuatan PO**: Pengurus meninjau daftar pengajuan restock dan membuat draft Purchase Order (PO). Sistem memblokir dan menyaring barang konsinyasi agar tidak bisa diproses ke dalam PO reguler.
3. **Penerimaan Barang (Good Receipt - GR)**:
    *   Saat barang fisik datang, petugas gudang menginput jumlah barang yang diterima (bisa penuh atau sebagian).
    *   Setelah GR disetujui, stok produk otomatis bertambah di tabel `products` dan membuat log mutasi di `inventory_movements`.
    *   Sistem secara otomatis membuat faktur utang dagang di `accounts_payable` dengan nilai total penerimaan ditambah PPN 10%, dengan jatuh tempo berdasarkan *payment terms* supplier tersebut.

### D. Modul Konsinyasi (Titip Jual)
Modul Konsinyasi dipisahkan secara tegas dari modul pembelian reguler untuk menghindari kesalahan pencatatan utang dagang:
1. **Penerimaan Barang Konsinyasi**: Proses restock barang titipan langsung dicatat melalui modul Konsinyasi (`toko/konsinyasi`), bukan via Purchase Order. Kategori produk harus diatur ke `konsinyasi`.
2. **Dynamic Stock Tracking**: Stok barang konsinyasi terintegrasi langsung dengan stok produk di POS. Rumus pencatatan mutasi adalah:
    $$\text{Qty Remaining} = \text{Qty Received} - \text{Qty Sold} - \text{Qty Returned}$$
    Untuk menjaga keakuratan, $\text{Qty Sold}$ dihitung secara dinamis saat runtime dengan formula:
    $$\text{Qty Sold} = \text{Qty Received} - \text{Qty Returned} - \text{Stok Aktual}$$
3. **Settlement**: Pembayaran kepada supplier konsinyasi dihitung berdasarkan jumlah barang yang telah laku terjual ($\text{Qty Sold}$) dikalikan harga beli yang disepakati. Sistem mencatat pembayaran di `consignment_settlements` dengan melampirkan nomor pelunasan dan metode pembayaran.

### E. Kredit & Simpan Pinjam
1. **Simpanan**: Anggota menyetor dana yang akan dicatat ke dalam mutasi simpanan. Admin dapat mengatur limit dan jenis simpanan baru melalui modal CRUD di halaman Simpanan Admin.
2. **Pengajuan Pinjaman**: Anggota mengajukan kredit melalui portal.
3. **Evaluasi Batas Pinjaman (Loan Rules)**: Sebelum disetujui, sistem mengecek 6 aturan penegakan kredit:
    *   Maksimal jumlah pinjaman berdasarkan persentase gaji/simpanan.
    *   Batas minimum masa keanggotaan.
    *   Pengecekan pinjaman aktif yang belum lunas.
    *   Minimal rasio jaminan saldo simpanan wajib terhadap pinjaman.
4. **Persetujuan (Disbursement)**: Setelah disetujui oleh Admin/Pengurus, sistem secara atomik membuat entitas `loans` baru dan men-generate tabel amortisasi bulanan di `loan_schedules` menggunakan rumus bunga flat atau menurun.

### F. Jurnal & Tutup Buku Akuntansi
*   Setiap mutasi kas, simpanan, POS, AP, dan AR memicu pembuatan record transaksi double-entry di tabel `journal_entries` dan `journal_lines`.
*   **Tutup Buku Bulanan**: Proses memindahkan saldo akun temporer (pendapatan & beban) ke modal/laba ditahan untuk membekukan pembukuan pada bulan berjalan.

---

## 5. INTEGRASI MOBILE (ANDROID CAPACITOR)

Sistem ini didesain agar dapat diakses dalam bentuk aplikasi Android APK menggunakan **Capacitor Remote Server Mode**:
*   Aplikasi dibungkus dengan konfigurasi target server URL di `capacitor.config.ts`.
*   **Strategi Offline**: Untuk mengatasi masalah koneksi di area minim sinyal, file `MainActivity.java` pada Android native meng-intercept error webview (seperti timeout atau host not found) dan mengarahkan pengguna ke halaman offline lokal (`offline.html`) yang dibundel di dalam APK.
*   Halaman `offline.html` menjalankan loop pengecekan (ping) ke server utama setiap 5 detik. Begitu server terdeteksi kembali online, aplikasi secara otomatis melakukan redirect kembali ke sistem utama tanpa intervensi pengguna.

---

## 6. CODING RULES & GOTCHAS PENTING

Seluruh pengembang wajib menaati panduan teknis berikut untuk menjaga stabilitas aplikasi:

1. **Hydration Error Prevention (shadcn Dialog)**:
    Jangan membungkus komponen `<Button>` di dalam `<DialogTrigger>` atau `<DialogClose>`. Hal ini memicu rendering tag `<button>` di dalam `<button>` yang merusak struktur DOM HTML. Gunakan atribut `render` dari Base UI:
    ```tsx
    // BENAR
    <DialogTrigger render={<Button>Buka Dialog</Button>} />
    
    // SALAH (Memicu Hydration Error)
    <DialogTrigger asChild>
      <Button>Buka Dialog</Button>
    </DialogTrigger>
    ```
2. **Next.js Server Actions Parameter Constraint**:
    Jangan mengirim data mentah `BigInt` atau objek JavaScript non-serializable (seperti `Date` instance) dari komponen klien ke Server Action. Konversikan parameter `BigInt` menjadi `number` sebelum memanggil Server Action, dan konversikan objek tanggal ke ISO string.
3. **Prisma Enum Constraints**:
    Pengecekan status harus selalu merujuk pada nilai enum yang didefinisikan secara ketat pada file `schema.prisma`. Misalnya, status pengajuan pinjaman menggunakan `pending` (bukan `submitted`). Penyimpangan nama enum akan memicu crash database runtime.
4. **Error Handling**:
    Terapkan blok `try-catch` di setiap database transaksi dan gunakan pencatatan log detail (*audit log*) menggunakan action `logAudit` untuk melacak riwayat perubahan data (CREATE, UPDATE, DELETE) demi keamanan forensik data keuangan.

---

## 7. SECURITY & INTEGRITY MATRIX (KEAMANAN)

Aplikasi menerapkan perlindungan berlapis terhadap potensi kerentanan keamanan:

*   **Proteksi IDOR/BOLA**: Server Actions yang melayani data anggota selalu menyertakan filter kepemilikan data berdasarkan ID pengguna yang terautentikasi di sesi (`where: { user_id: session.user.id }`).
*   **Pengecekan Hak Akses Inline**: Selain guard middleware, setiap Server Action sensitif (seperti mengubah parameter SHU atau menyetujui pinjaman) melakukan pengecekan role secara internal:
    ```typescript
    const session = await auth();
    if (!session || !['superadmin', 'ketua'].includes(session.user.role)) {
       throw new Error('Akses ditolak: Hak akses tidak memadai.');
    }
    ```
*   **Pencegahan Race Condition**: Mutasi stok produk dan batas limit kredit anggota dilakukan menggunakan transaksi atomik database (`increment`/`decrement` dari Prisma) untuk mencegah manipulasi data akibat request ganda yang dikirim secara bersamaan (*concurrent requests*).
*   **Validasi Masukan (Data Validation)**: Menggunakan skema validasi Zod untuk memfilter dan memastikan struktur data masukan bersih dari properti berbahaya sebelum disimpan ke database.

---
*Dokumen ini diperbarui secara berkala seiring dengan penambahan fitur dan perbaikan arsitektur sistem.*
