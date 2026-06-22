# Koperasi Digital - To-Do List
> Daftar pekerjaan yang belum diselesaikan dan menjadi target untuk pengembangan selanjutnya.

## Prioritas Kritis (Security & Vulnerability Remediation v3.2)
- [ ] **IDOR / BOLA Fix**: Audit dan tambahkan klausa `user_id: session.user.id` pada semua Server Action di `lib/actions/` yang melayani role `anggota` (misal: `getMyPinjaman`, `getLoanDetails`, `getMySimpanan`, mutasi simpanan).
- [ ] **Inline RBAC di Server Action**: Buat utilitas `checkRole(session, allowedRoles)` dan terapkan secara eksplisit di awal fungsi pada setiap Server Action yang bersifat mutasi tingkat admin (seperti `updateAppSettings`, `createLoanProduct`, `POST /api/shu-config`).
- [ ] **Zod Strict Validation (Mass Assignment)**: Implementasikan skema validasi `zod` dengan metode `.strict()` untuk menolak key ilegal pada Server Actions yang menerima input JSON (terutama form SHU Config dan Loan Rules).
- [ ] **Atomic Update & Anti-Race Condition**: Refactor logika *Checkout POS*, Pengajuan Pinjaman, dan *Online Orders* di Prisma untuk menggunakan *Atomic Operations* (`decrement`/`increment`) daripada read-then-write (in-memory check). Pastikan Zod memvalidasi `qty` dan harga dengan `.positive()`.
- [ ] **Global Error & Enum Handling**: Bungkus proses operasi database (`create`/`update`) dalam blok `try-catch` dengan penanganan *graceful fallback*. Gunakan `z.enum()` untuk mencegah string invalid masuk ke kolom enum DB yang menyebabkan aplikasi crash.
- [ ] **APK Security Hardening**: Modifikasi `capacitor.config.ts` untuk menggunakan URL HTTPS dan ubah `android:usesCleartextTraffic="false"` di `AndroidManifest.xml` untuk mencegah serangan Man-In-The-Middle (MITM) saat dirilis ke Production.

## Prioritas Tinggi (Enforcement Loan Rules)
- [ ] Validasi Backend saat `submitLoanApplication`: 
  - Cek apakah anggota telah melewati batas frekuensi pinjaman kilat bulanan.
  - Cek kewajiban lunas (`strict_single_active_loan`) jika rule aktif pada produk yang diajukan.
  - Cek sisa cicilan berjalan (`min_remaining_installments_for_topup`) jika rule top-up diaktifkan.
  - Tolak otomatis jika pengajuan barang tidak melampirkan kwitansi.
  - Kalkulasi limit persentase berdasarkan total saldo simpanan anggota (`max_loan_percentage_of_savings`).
- [ ] Validasi Paylater Checkout: Cek total tagihan paylater berjalan terhadap batas maksimal hutang toko (`max_paylater_debt`).

## Prioritas Menengah (Fitur Modul)
- [ ] **Modul PPOB**: Pembuatan UI Loket Pembayaran Tagihan (Listrik, Air, BPJS, Pulsa) beserta logika pemotongan saldo simpanan secara langsung.
- [ ] **Distribusi SHU**: Memindahkan logika kalkulasi hardcoded ke parameter persentase yang sudah tersimpan di `app_settings`.

## Prioritas Sistem (Infrastruktur)
- [ ] **Sistem Notifikasi**: Implementasi interval polling atau Server-Sent Events (SSE) agar notifikasi header berbunyi dan berkedip real-time.
- [ ] **Cloud Asset Storage**: Mempersiapkan script S3 (AWS/Cloudflare R2) untuk memindahkan manajemen upload lokal (`/public/uploads`) menjadi berbasis Cloud URL agar APK Mobile dan Web selaras saat di-hosting.
- [ ] **Persiapan Deployment**: Konfigurasi eksekusi `NEXTAUTH_SECRET` Production, migrasi `npx prisma db push`, dan setup `PM2`.
