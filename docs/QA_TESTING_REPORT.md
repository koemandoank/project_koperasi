# Manual QA Testing Report - Koperasi Sulfindo Digital Management System

Dokumen ini memetakan skenario pengujian manual, ekspektasi perilaku sistem (berdasarkan analisis kode dan arsitektur), hasil aktual/verifikasi statis, serta rekomendasi pengujian untuk rilis produksi.

---

## 1. Role-Based Access Control (RBAC) Test Matrix

Pengujian ini memastikan bahwa setiap *role* hanya dapat mengakses data dan melakukan tindakan yang diizinkan sesuai batasan keamanan Server Actions.

| Modul / Fitur | Superadmin | Admin | Pengurus / Ketua | Kasir | Petugas Akuntan | Pengawas | Anggota |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard Utama** | ✅ Full | ✅ Full | ✅ Full | ✅ Kasir | ✅ Full | ❌ No Access | ✅ Portal |
| **Penerimaan Pembayaran Pinjaman** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Kelola Online Orders (Toko)** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Kelola Produk & Aturan Pinjaman** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Data Simpanan Admin** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Laporan Akuntansi & Keuangan** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Audit Logs** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 2. Skenario Pengujian Per Role

### Skenario 1: Login & Dashboard Access
*   **Aktor**: `superadmin` / `admin` / `pengurus` / `petugas_akuntan`
    *   **Langkah**: Login ke sistem → buka `/dashboard`.
    *   **Ekspektasi**: Halaman dashboard terbuka. Menampilkan ringkasan statistik anggota, total simpanan, dan pinjaman aktif berjalan secara paralel.
    *   **Status**: `VERIFIED (Code Review)` — Pembatasan RBAC pada `getAdminStats` terbukti aman untuk semua aktor di atas.
*   **Aktor**: `kasir`
    *   **Langkah**: Login ke sistem → buka `/dashboard`.
    *   **Ekspektasi**: Hanya menampilkan data kasir (ringkasan penjualan harian, sesi POS aktif). Menu admin tidak muncul.
    *   **Status**: `VERIFIED (Code Review)` — `getKasirStats` membatasi data sensitif non-kasir.
*   **Aktor**: `anggota`
    *   **Langkah**: Login ke sistem → buka `/dashboard` (diarahkan ke portal anggota).
    *   **Ekspektasi**: Hanya menampilkan data pinjaman personal, simpanan personal, dan riwayat mutasi sendiri.
    *   **Status**: `VERIFIED (Code Review)` — Sistem membatasi `member-portal.ts` dengan deteksi role session server-side.

### Skenario 2: Transaksi Pembayaran Pinjaman (IDOR/BOLA Protection)
*   **Aktor**: `anggota` (Mencoba bypass ID pinjaman milik anggota lain)
    *   **Langkah**: Mengirimkan request ke `getLoanPayments` dengan parameter `loanId` milik anggota lain.
    *   **Ekspektasi**: Server mengembalikan error `Unauthorized: Cannot access this resource` karena `member_id` dari session tidak cocok dengan `member_id` pada pinjaman.
    *   **Status**: `VERIFIED (Code Review)` — BOLA protection aktif di `loan-payments.ts`.
*   **Aktor**: `kasir` / `admin`
    *   **Langkah**: Mencatat pembayaran pinjaman melalui menu kasir.
    *   **Ekspektasi**: Transaksi tercatat dengan sukses, mutasi saldo terupdate, dan log aktivitas tercatat di audit trail.
    *   **Status**: `VERIFIED (Code Review)` — Diizinkan oleh fungsi `recordLoanPayment`.

---

## 3. Pengujian Optimistic Updates (UX Responsiveness)

Fitur ini memastikan UI terupdate seketika sebelum respon server diterima, dengan fallback/rollback jika transaksi gagal.

### Skenario 3: POS Checkout (Wasenda Kasir)
*   **Langkah**:
    1.  Pilih produk dan masukkan ke keranjang belanja (cart).
    2.  Pilih metode pembayaran dan klik tombol **Bayar / Checkout**.
*   **Perilaku Optimistic**:
    *   Seketika setelah tombol ditekan, keranjang belanja langsung di-clear (`setCart([])`) dan drawer pembayaran tertutup tanpa menunggu loading API server.
*   **Ekspektasi Rollback (Jika API Server Error/Koneksi Putus)**:
    *   Jika transaksi gagal (misal: stok habis di DB di detik terakhir), sistem harus mengembalikan keranjang belanja ke kondisi semula (`setCart(snapshotCart)`) dan memunculkan toast notifikasi error merah.
*   **Status**: `VERIFIED (Code Review)` — Diimplementasikan di `src/app/(dashboard)/toko/kasir/pos-client.tsx` dalam fungsi `handleCheckoutProcess`.

### Skenario 4: Tambah/Edit Anggota (Member Form)
*   **Langkah**:
    1.  Buka form tambah anggota (drawer/sheet).
    2.  Isi data anggota baru dan klik **Simpan**.
*   **Perilaku Optimistic**:
    *   Drawer input langsung tertutup (`setOpen(false)`) seketika, dan toast loading ("Menyimpan data...") langsung muncul.
*   **Ekspektasi Rollback (Jika API Server Error)**:
    *   Jika server mengembalikan status gagal, drawer input harus terbuka kembali (`setOpen(true)`) sehingga data yang diinput user tidak hilang dan user dapat mencoba lagi.
*   **Status**: `VERIFIED (Code Review)` — Diimplementasikan di `src/app/(dashboard)/anggota/member-form.tsx`.

---

## 4. Pengujian Suspense Boundaries (Streaming & Fallback UI)

Pengujian ini memastikan tidak ada "white-screen" atau blocking rendering penuh saat data sedang di-load dari database.

### Skenario 5: Pemuatan Halaman Dashboard
*   **Langkah**: Buka halaman `/dashboard`.
    *   **Ekspektasi**: Rangkaian layout halaman (Sidebar, Header) langsung ter-render. Bagian widget utama menampilkan skeleton abu-abu animasi (`Skeleton` & `StatsGridSkeleton`) saat sub-komponen sedang fetch data secara asinkron dari DB. Setelah data siap, skeleton berganti menjadi data riil secara dinamis tanpa merefresh halaman.
    *   **Status**: `VERIFIED (Code Review)` — Menggunakan modular `<Suspense>` wrapper di `src/app/(dashboard)/dashboard/page.tsx` dengan fallback UI dari `src/components/ui/skeletons.tsx`.

### Skenario 6: Pemuatan Halaman Laporan (Harian, Analitik, Stok, dll.)
*   **Langkah**: Navigasi ke menu laporan, misalnya `/laporan/neraca` atau `/laporan/harian`.
    *   **Ekspektasi**: Halaman langsung beralih ke rute tersebut dan menampilkan UI skeleton tabel asinkron (`TableSkeleton` / `LaporanSkeleton`) selama server memproses kalkulasi laporan akuntansi yang berat.
    *   **Status**: `VERIFIED (Code Review)` — Diimplementasikan melalui file `loading.tsx` asinkron di masing-masing sub-direktori laporan Next.js App Router.

---

## 5. Temuan Penting & Rekomendasi Perbaikan

1.  **Offline State Handling**:
    *   *Temuan*: Perubahan optimistik pada POS dan Member Form berjalan dengan baik di memori React. Namun jika koneksi internet terputus permanen, data input tidak tersimpan di local cache permanen (misal: IndexedDB).
    *   *Rekomendasi*: Untuk POS toko fisik yang rawan putus internet, pertimbangkan integrasi service worker offline atau sinkronisasi antrean transaksi via PWA (Progressive Web App).
2.  **Pagination Integration**:
    *   *Temuan*: Logika pagination (`skip` dan `take`) sudah didefinisikan di utility, namun integrasi di halaman list data besar (seperti riwayat pesanan toko dan mutasi jurnal akuntansi) masih dalam status opsional/belum aktif.
    *   *Rekomendasi*: Segera aktifkan pagination pada tabel utama untuk mencegah penurunan performa query saat jumlah data mencapai puluhan ribu baris.
