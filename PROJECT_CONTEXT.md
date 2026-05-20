# PROJECT CONTEXT — Koperasi Digital (Next.js)
> Last updated: 2026-05-19 | Version: 3.2.0

---

## 1. STACK TEKNOLOGI

| Layer | Tech |
|-------|------|
| Framework | **Next.js 16.2.6** (App Router, Turbopack) |
| Language | TypeScript (Strict Mode) |
| Auth | NextAuth.js v5 (Auth.js) — JWT Strategy |
| ORM | Prisma 5.22 (MySQL) |
| UI | shadcn/ui + **@base-ui/react ^1.4.1** + Tailwind CSS v4 |
| Icons | Lucide React ^1.14 |
| Toasts | Sonner ^2 |
| Charts | Recharts ^3.8 |
| Export | ExcelJS ^4.4 + jsPDF ^4.2 + jspdf-autotable ^5 + xlsx ^0.18 |
| Motion | Framer Motion ^12 |
| Mobile | **Capacitor 8.3.4** (Android APK — remote server mode) |
| DB | MySQL via Laragon (`koperasi_digital`) |
| Runtime | React 19.2.4 |

---

## 2. ENVIRONMENT

```
DATABASE_URL=mysql://root:@localhost:3306/koperasi_digital
NEXTAUTH_SECRET=<secret>
# NEXTAUTH_URL di-comment agar URL otomatis terdeteksi dari IP jaringan
# NEXTAUTH_URL=http://localhost:3000
```

> Server berjalan di **port 3000** (eksplisit di `package.json` script `-p 3000`)

---

## 3. SKEMA DATABASE (Key Models)

> ⚠️ **ATURAN KERAS: DILARANG DROP/ALTER kolom existing.**

| Model Prisma | Tabel MySQL | Catatan |
|---|---|---|
| `User` | `users` | `role` enum: superadmin/admin/pengurus/**ketua**/kasir/anggota |
| `saving_types` | `saving_types` | Jenis simpanan: code, name, is_mandatory, min_amount, monthly_amount, is_withdrawable |
| `Member` | `members` | `nik` = kode unik anggota (dipakai login) |
| `Unit` | `units` | Unit/cabang koperasi |
| `products` | `products` | `image_path`, `member_price`, `stock`, `is_active` |
| `product_categories` | `product_categories` | Kategori barang |
| `orders` | `orders` | `payment_method`: cash/paylater/qris/transfer; `channel`: pos/online |
| `order_items` | `order_items` | Detail per transaksi POS |
| `loan_applications` | `loan_applications` | Status: **pending**/approved/rejected (BUKAN submitted) |
| `loan_products` | `loan_products` | Master produk pinjaman |
| `loans` | `loans` | Pinjaman aktif (dibuat saat approved) |
| `loan_schedules` | `loan_schedules` | Jadwal cicilan amortisasi |
| `savings` | `savings` | Simpanan anggota — relasi `saving_types` (bukan field `type`) |
| `saving_transactions` | `saving_transactions` | Mutasi simpanan |
| `journal_entries` | `journal_entries` | Buku besar — jurnal akuntansi |
| `journal_lines` | `journal_lines` | Detail debit/kredit per jurnal |
| `chart_of_accounts` | `chart_of_accounts` | Kode akun akuntansi |
| `app_settings` | `app_settings` | `shu_config` JSON (format nested v3.1), `loan_rules` JSON — keduanya di-generate Prisma |
| `suppliers` | `suppliers` | Master supplier untuk procurement |
| `purchase_orders` | `purchase_orders` | PO pembelian (status: draft/sent/partial/received/cancelled) |
| `po_items` | `po_items` | Detail item dalam PO |
| `good_receipts` | `good_receipts` | GR barang masuk (linked to PO) |
| `gr_items` | `gr_items` | Detail item dalam GR |
| `accounts_payable` | `accounts_payable` | Hutang dagang ke supplier |
| `accounts_receivable` | `accounts_receivable` | Piutang dagang ke customer |
| `inventory_locations` | `inventory_locations` | Lokasi gudang/rak |
| `inventory_movements` | `inventory_movements` | Mutasi stok (transfer, opname) |
| `consignment_items` | `consignment_items` | Barang konsinyasi titip jual — field: `product_id`, `supplier_id`, `consignment_date`, `qty_received`, `qty_sold`, `qty_returned`, `status`. **TIDAK ADA** `unit_price`/`qty_remaining` (dihitung dinamis) |
| `consignment_payables` | `consignment_payables` | Tagihan ke supplier — field: `consignment_id`, `supplier_id`, `qty_sold`, `unit_price`, `total_amount`, `status`. **Payable dibuat atomik saat penerimaan** |
| `consignment_settlements` | `consignment_settlements` | Pembayaran tagihan — field: `payable_id`, `settlement_no`, `settlement_date`, `amount_paid`, `payment_method`, `processed_by` (bukan `paid_at`) |
| `promotions` | `promotions` | Promosi/diskon produk |
| `crm_customers` | `crm_customers` | Data customer/profil CRM |
| `loyalty_points` | `loyalty_points` | Poin loyalitas anggota |

> **BigInt Rule:** Semua `id` field adalah `BigInt` di Prisma. Selalu konversi dengan `BigInt(id)` saat query, dan `Number(id)` saat dikirim ke Client Component. Jangan `JSON.stringify(BigInt)`.

> **Savings Schema Rule:** `savings` punya relasi `saving_types` (bukan field langsung). Query harus `include: { saving_types: true }` lalu akses `s.saving_types.name`.

---

## 4. ARSITEKTUR FILE PENTING

```
src/
├── auth.ts                          # NextAuth config (JWT + Prisma)
├── auth.config.ts                   # RBAC route protection (canAccess per role)
├── middleware.ts                    # NextAuth middleware guard
│
├── lib/actions/                     # Server Actions (SEMUA mutasi data di sini)
│   ├── auth.ts                      # login (email/username/NIK) + logout
│   ├── members.ts                   # CRUD anggota + reset password + edit role
│   ├── products.ts                  # CRUD produk toko + upload gambar
│   ├── loan-products.ts             # CRUD master produk pinjaman
│   ├── loans.ts                     # Approval + submit pengajuan + disbursement
│   ├── pos.ts                       # Proses checkout POS (cash/paylater/qris)
│   ├── pos-transactions.ts          # Laporan transaksi POS detail
│   ├── online-orders.ts             # Pesanan online anggota (konfirmasi/proses)
│   ├── member-portal.ts             # getMySimpanan/getMyPinjaman/getMyOrders/getMyLoyalty
│   ├── laporan-harian.ts            # getLaporanHarian (summary POS harian)
│   ├── buku-besar.ts                # getJournalEntries (buku besar akuntansi)
│   ├── accounting.ts                # Tutup buku bulanan
│   ├── settings.ts                  # getAppSettings, updateAppSettings, getShuSettings (legacy)
│   ├── saving-types.ts              # [NEW v3.1] CRUD jenis simpanan (getSavingTypes, create, update, toggle)
│   ├── loan-rules.ts                # Server Actions loan rules (import types dari lib/types/)
│   ├── simpanan-admin.ts            # Admin view simpanan semua anggota
│   ├── profile.ts                   # Update profil + ganti password + upload foto
│   ├── dashboard-stats.ts           # getAdminStats/getKreditStats/getKasirStats
│   ├── koperasi-stats.ts            # Statistik global koperasi (anggota aktif, dll)
│   ├── procurement.ts               # CRUD suppliers + Purchase Orders + Good Receipt
│   ├── inventory.ts                 # Stock management, transfer, opname
│   ├── inventory-ui.ts              # Read models untuk Inventaris UI
│   ├── accounts.ts                  # Accounts Payable (AP) + Accounts Receivable (AR)
│   ├── promotions.ts                # CRUD promosi/diskon
│   ├── crm.ts                       # CRM customers + loyalty points
│   ├── consignment.ts               # [NEW v3.2] Konsinyasi: penerimaan, retur, payable, settlement
│   └── reports.ts                   # Export laporan (Excel/PDF)
│
├── lib/types/                       # [NEW v3.1] Shared types (NO "use server")
│   ├── loan-rules.types.ts          # LoanRules, RuleConfig, DEFAULT_LOAN_RULES
│   └── shu-config.types.ts          # ShuConfig, validateShuConfig(), migrateLegacyShuConfig()
│
├── app/
│   ├── (dashboard)/                 # Protected layout (sidebar + header)
│   │   ├── layout.tsx               # Fetch session + settings → Sidebar + Header
│   │   │
│   │   ├── dashboard/               # Role-based dashboard
│   │   │   ├── page.tsx             # Router: PengurusDashboard/KreditDashboard/KasirDashboard/MemberDashboard
│   │   │   ├── pengurus-dashboard.tsx
│   │   │   ├── kredit-dashboard.tsx
│   │   │   ├── kasir-dashboard.tsx
│   │   │   ├── member-dashboard.tsx
│   │   │   └── home/page.tsx        # Mobile home landing setelah login
│   │   │
│   │   ├── anggota/                 # Manajemen anggota (admin/pengurus)
│   │   │   ├── page.tsx
│   │   │   ├── member-form.tsx      # Dialog add/edit + radio button role
│   │   │   └── member-table.tsx
│   │   │
│   │   ├── toko/
│   │   │   ├── page.tsx             # Anggota: toko online (katalog + cart)
│   │   │   ├── toko-anggota-client.tsx  # Katalog, cart, checkout, riwayat
│   │   │   ├── kasir/               # POS Mesin Kasir
│   │   │   │   └── pos-client.tsx   # Fullscreen, search NIK/nama, cart, QRIS
│   │   │   ├── produk/              # Katalog barang (admin)
│   │   │   │   ├── product-form.tsx
│   │   │   │   └── product-table.tsx
│   │   │   ├── inventaris/          # Manajemen Inventaris
│   │   │   │   ├── client.tsx
│   │   │   │   ├── transfer-stock.tsx
│   │   │   │   └── opname-stock.tsx
│   │   │   ├── konsinyasi/          # [NEW v3.2] Modul Konsinyasi (Titip Jual)
│   │   │   │   ├── page.tsx         # Server: fetch items+payables+suppliers+products
│   │   │   │   └── konsinyasi-client.tsx  # Client: tab Stok Titipan + Tagihan & Settlement
│   │   │   └── pesanan/             # Pesanan online (kasir view)
│   │   │
│   │   ├── pinjaman/
│   │   │   ├── page.tsx             # Anggota: form pengajuan + riwayat + jadwal
│   │   │   ├── member-loan-form.tsx
│   │   │   ├── produk/              # Master produk pinjaman (admin)
│   │   │   ├── approval/            # Approval pinjaman (admin/pengurus)
│   │   │   └── transaksi/[id]/      # Tabel amortisasi detail per pinjaman
│   │   │
│   │   ├── simpanan/
│   │   │   ├── page.tsx             # Admin: parallel fetch adminData + savingTypes
│   │   │   ├── simpanan-admin-client.tsx  # [FIXED v3.1] Typed AdminData (no any)
│   │   │   └── saving-types-modal.tsx    # [NEW v3.1] CRUD jenis simpanan
│   │   │
│   │   ├── pembelian/               # Procurement
│   │   │   ├── page.tsx             # [v3.2] Filter produk konsinyasi dari query
│   │   │   └── pembelian-client.tsx # Supplier CRUD + PO (konsinyasi excluded) + Good Receipt
│   │   │
│   │   ├── keuangan/                # AP/AR Dagang (NEW)
│   │   │   ├── page.tsx
│   │   │   └── keuangan-client.tsx  # AP, AR, Aging Schedule
│   │   │
│   │   ├── laporan/
│   │   │   ├── harian/              # Laporan harian POS + Export Excel/PDF
│   │   │   ├── analitik/            # P&L, Top/Slow Product, Payment Method (NEW)
│   │   │   │   └── laporan-analitik-client.tsx
│   │   │   └── potongan-gaji/       # Export CSV potongan gaji + paylater
│   │   │
│   │   ├── akuntansi/
│   │   │   ├── buku-besar/          # Journal entries viewer
│   │   │   └── tutup-buku/          # Monthly closing
│   │   │
│   │   ├── profil/                  # Profil user: ganti password + foto
│   │   │
│   │   └── pengaturan/
│   │       ├── page.tsx             # Setting: nama koperasi, logo, alamat
│   │       ├── settings-form.tsx
│   │       ├── promosi/             # Manajemen Promosi/Diskon (NEW)
│   │       │   └── promotions-manager.tsx
│   │       └── shu/                 # [UPGRADED v3.1] Konfigurasi Parameter SHU
│   │           ├── page.tsx         # Load config + pass userRole (RBAC-aware)
│   │           └── shu-settings-form.tsx  # Multi-tab (5 seksi A-E) + audit log
│   │
│   ├── api/
│   │   ├── auth/[...nextauth]/      # NextAuth API handler
│   │   ├── loan-rules/route.ts      # [FIXED v3.1] GET+POST (Prisma generate fix)
│   │   ├── shu-config/route.ts      # [NEW v3.1] GET+POST RBAC + audit log
│   │   └── upload/route.ts          # Upload gambar → /public/uploads/products/
│   │
│   └── login/                       # Halaman login
│
└── components/
    ├── shared/
    │   ├── sidebar.tsx              # Per-role menu
    │   ├── header.tsx               # Server: fetch notif + settings
    │   ├── header-client.tsx        # Client: Bell dropdown notifikasi
    │   └── dashboard-mobile-redirect.tsx  # Redirect mobile ke /dashboard/home
    └── ui/                          # shadcn + base-ui components
        └── textarea.tsx             # Manual created
```

---

## 5. RBAC — HAK AKSES PER ROLE

| Role | Akses |
|---|---|
| `superadmin` | Semua route + Edit Konfigurasi SHU |
| `ketua` | Setara pengurus + **Edit Konfigurasi SHU** (`/pengaturan/shu`) |
| `pengurus` | Dashboard (Pengurus), Anggota, POS, Katalog, Pinjaman, Approval, Simpanan, Pembelian, Keuangan, Inventaris, Laporan, Analitik, Akuntansi, Promosi |
| `admin` | Dashboard (Kredit), Anggota, POS, Katalog, Pinjaman, Approval, Simpanan (admin view), Laporan, Pembelian |
| `kasir` | Dashboard (Kasir), Mesin Kasir, Katalog, Laporan Harian, Pesanan Online |
| `anggota` | Dashboard (Member), Simpanan Saya, Pinjaman Saya, Toko Online |

> Definisi di `src/auth.config.ts` → `ROLE_ROUTES` map.
> Sidebar otomatis menyesuaikan menu berdasarkan role.
> **SHU Config RBAC**: dicek di `POST /api/shu-config` — `SHU_CONFIG_ALLOWED_ROLES = ["superadmin", "ketua"]`.

---

## 6. LOGIN SYSTEM

- Field: **Email** atau **Username** atau **NIK anggota** (`members.nik`)
- Query: `findFirst({ OR: [email, username, members.nik] })`
- Password: bcrypt hash, default reset = `123456`
- Contoh: NIK `S0002` → cari di `members.nik = 'S0002'` → ambil `user_id` → cek password

---

## 7. FITUR STATUS

| Modul | Status | Versi |
|---|---|---|
| Auth (email/NIK/username) | ✅ Done | v1.0 |
| RBAC (per role) | ✅ Done | v1.0 |
| Logout | ✅ Done | v1.0 |
| Manajemen Anggota + Edit Role | ✅ Done | v2.1.2 |
| Mesin Kasir POS | ✅ Done | v1.0 |
| Laporan Harian + Export Excel/PDF | ✅ Done | v2.2 |
| Katalog Barang + Upload Foto | ✅ Done | v1.5 |
| Master Pinjaman | ✅ Done | v1.5 |
| Approval Pinjaman + Disbursement | ✅ Done | v2.1.2 |
| Portal Anggota - Simpanan | ✅ Done | v2.0 |
| Portal Anggota - Pinjaman + Amortisasi | ✅ Done | v2.1.5 |
| Portal Anggota - Toko Online | ✅ Done | v2.0 |
| Pesanan Online (Kasir View) | ✅ Done | v2.0 |
| Notifikasi Header (Bell Icon) | ✅ Done | v2.0 |
| Buku Besar | ✅ Done | v2.0 |
| Simpanan Admin View | ✅ Done | v2.0 |
| Pengaturan Umum (logo, nama, alamat) | ✅ Done | v2.0 |
| Profil User (ganti password + foto) | ✅ Done | v2.1 |
| Integrasi Tagihan Paylater di Dashboard | ✅ Done | v2.2.0 |
| Laporan Potongan Gaji + Paylater | ✅ Done | v2.2.0 |
| **Pembelian (Procurement)** | ✅ Done | v3.0 |
| **Inventaris (Stock Transfer + Opname)** | ✅ Done | v3.0 |
| **Keuangan (AP/AR Dagang + Aging)** | ✅ Done | v3.0 |
| **Laporan Analitik (P&L, Top/Slow Product)** | ✅ Done | v3.0 |
| **Manajemen Promosi/Diskon** | ✅ Done | v3.0 |
| **Loyalty Points (CRM)** | ✅ Done | v3.0 |
| **APK Android - Offline Error Page** | ✅ Done | v3.0 |
| Dashboard Role Kasir | ✅ Done | v3.0 |
| Dashboard Role Kredit/Admin | ✅ Done | v3.0 |
| **Loan Rules Enforcement & Persistence** | ✅ Done | v3.1 |
| **Pengaturan Jenis Simpanan** | ✅ Done | v3.1 |
| **Konfigurasi Parameter SHU (Multi-tab + RBAC + Audit)** | ✅ Done | v3.1 |
| **Role Ketua Koperasi** | ✅ Done | v3.1 |
| **Modul Konsinyasi (Titip Jual)** | ✅ Done | v3.2 |
| Tutup Buku | 🚧 Partial | v2.0 |
| PPOB | ❌ Pending | — |

---

## 8. KNOWN BUGS & GOTCHAS

### 🔴 KRITIS (wajib diingat di setiap sesi)
1. **BigInt serialization**: Selalu `Number(id)` sebelum kirim ke Client Component. `JSON.stringify(BigInt)` = crash.
2. **Base UI Button nesting**: Gunakan `render={<Button />}` prop pada `DialogTrigger`/`DialogClose`, **BUKAN** membungkus `<Button>` di dalam `<DialogTrigger>` (menyebabkan `<button>` dalam `<button>` → hydration error).
3. **Logout**: Harus `<button type="submit">` native dalam `<form action={...}>`, bukan `<Button>` shadcn.
4. **Loan status enum**: Nilai yang valid di DB adalah `pending` (BUKAN `submitted`). Jangan gunakan `submitted` di query manapun.
5. **Next.js 15+ async params**: Route params harus di-`await`: `const { id } = await params;` — bukan destructure langsung.

### 🟡 PERLU PERHATIAN
6. **Login NIK**: Query `OR: [email, username, members.nik]` — pastikan relasi `User → members` ada di schema.
7. **SHU Settings**: UI-only. Perlu kolom di `app_settings` atau tabel `shu_settings` untuk persistensi.
8. **Upload Gambar**: Disimpan di `/public/uploads/products/`. Saat deploy ke server luar → migrasi ke cloud storage.
9. **QRIS**: Simulasi konfirmasi manual. Belum terintegrasi payment gateway.
10. **Savings include**: Query savings selalu butuh `include: { saving_types: true }`, akses via `s.saving_types.name`.
11. **APK Capacitor**: Mode remote server (`url: 'https://projectkoperasi.vercel.app'`). Saat server berubah IP, update `capacitor.config.ts` + `MainActivity.java` (`SERVER_URL` constant) + rebuild APK.

### 🟢 RESOLVED (historical log)
12. `Textarea` component dibuat manual di `src/components/ui/textarea.tsx`.
13. `loan-product-table.tsx` di `/pinjaman/produk/` (bukan `product-table.tsx`).
14. **Header notif**: Dipisah ke `header.tsx` (Server) + `header-client.tsx` (Client).
15. **Prisma Enum FIX**: `loan_applications_status` = `pending`, bukan `submitted`.
16. **Localhost Routing FIX**: `NEXTAUTH_URL` di-comment agar IP jaringan terdeteksi dinamis.
17. **Gambar POS**: Native `<img>` tag menggantikan `next/image` di modul kasir.
18. **Manajemen User RBAC**: Radio button untuk pemberian hak akses anggota.
19. **Preview Foto Edit Produk**: `useEffect` di `product-form.tsx` untuk reset `imagePreview`.
20. **Header Notif FIX**: Filter ke `order_status: "pending"` (bukan `unpaidOrders`).
21. **Amortisasi Pinjaman**: Halaman `/pinjaman/transaksi/[id]` dengan tabel cicilan lengkap.
22. **Disbursement Otomatis**: `loans` + `loan_schedules` langsung dibuat saat pinjaman diapprove.
23. **Paylater Dashboard**: Tagihan paylater unpaid tampil di dashboard anggota + laporan potongan gaji.
24. **TypeScript Tutup Buku FIX**: `onValueChange={(value) => setMonth(value)}`.
25. **React Fragment Key FIX** (Buku Besar): `<React.Fragment key={entry.id}>` menggantikan `<>`.
26. **DialogTrigger Hydration FIX**: `<DialogTrigger render={<Button />}>` — `product-form.tsx` (v3.0).
27. **APK Offline Page**: `MainActivity.java` intercept WebView error → load bundled `offline.html` dengan ping loop + notif merah/hijau (v3.0).
28. **[v3.1] Loan Rules POST 500**: Root cause = `prisma generate` tidak dijalankan setelah `loan_rules` ditambah ke schema. Fix: stop Node → `prisma generate` → clear `.next` → restart.
29. **[v3.1] Loan Rules Bundler Crash**: `"use server"` module tidak boleh re-export type. Tipe dipindah ke `lib/types/loan-rules.types.ts` (file netral).
30. **[v3.1] Nested Button `LoanRulesModal`**: Hapus `DialogTrigger asChild`, ganti dengan `Button onClick` terpisah dari `Dialog`.
31. **[v3.1] SHU Config JSON Migration**: Format lama (8 key flat) auto-migrate ke format baru (nested) via `migrateLegacyShuConfig()` di `shu-config.types.ts`.
32. **[v3.2] Konsinyasi `unit_price` Field Error**: Field `unit_price` tidak ada di tabel `consignment_items`. Fix: simpan di `consignment_payables` + buat payable atomik saat penerimaan.
33. **[v3.2] Konsinyasi `orderBy` Error**: `getConsignmentItems` menggunakan `orderBy: { received_at }` — field tidak ada. Fix: ganti ke `consignment_date`.
34. **[v3.2] Konsinyasi `qty_remaining` Field Error**: Kolom tidak ada di tabel. Fix: hitung dinamis via `qty_received - qty_sold - qty_returned`.
35. **[v3.2] Konsinyasi Settlement Field Mismatch**: `paid_at` → `settlement_date`, tambah `settlement_no` & `processed_by` yang wajib di schema.
36. **[v3.2] Decimal → NaN**: `Number(decimal_prisma)` dari Server→Client menjadi NaN. Fix: selalu `.toString()` dulu: `Number(val?.toString() || 0)`.
37. **[v3.2] Date instanceof Error**: Date object tidak survive serialisasi Server→Client. Fix: gunakan `new Date(val)` bukan `val instanceof Date`.
38. **[v3.2] react-hot-toast not found**: Paket tidak ada, ganti ke `sonner` yang sudah terpasang.
39. **[v3.2] formatCurrency missing**: Fungsi belum ada di `lib/utils.ts`. Fix: tambah `Intl.NumberFormat('id-ID', currency: 'IDR')`.
40. **[v3.2] Konsinyasi Form Produk Non-Konsinyasi**: Barang non-konsinyasi muncul di form penerimaan. Fix: filter produk dengan `product_categories: { slug: 'konsinyasi' }`.
41. **[v3.2] Konsinyasi `qty_remaining` Discrepancy**: Penjualan POS memotong `products.stock` tapi tidak memotong `qty_sold` di konsinyasi, sehingga stok konsinyasi out-of-sync. Fix: UI sekarang membaca nilai aktual dari `products.stock` untuk `qty_remaining` agar konsisten.
42. **[v3.2] Katalog Produk ID HTML Collision**: Gagal update produk karena ID statis (`img-upload`) terduplikasi di list row, menyebabkan input file mengambil target salah. Fix: gunakan `useId()` dari React.
43. **[v3.2] 1MB Next.js Payload Limit (Gambar)**: Update produk dengan resolusi tinggi gagal (silent). Fix: naikkan body limit di `next.config.ts` jadi `5mb` dan di `product-form.tsx` validasi *client-side* max 5MB.
44. **[v3.2] Next.js Serialization Decimal Error**: Error `Only plain objects can be passed to Client Components...` saat me-render Server Components. Root cause: Server Actions (seperti `getConsignmentItems`) di-wrap Next.js untuk Client Component sehingga mengeksekusi serialization check. Jika Action return `Decimal` dari Prisma, Next.js throw error ke aplikasi. Fix: Map value dengan `Number(item.decimal_value)` sebelum me-return data di Server Action.
45. **[v3.2] Next.js Client Component BigInt Error**: Tombol Retur & Settlement macet di "Loading". Root cause: `konsinyasi-client.tsx` mengirim objek `BigInt` (misal `BigInt(id)`) langsung ke Server Actions yang menyebabkan *unhandled RSC serialization error* sebelum *request* dikirim. Fix: Ubah tipe parameter di Server Actions menjadi `number` dan lakukan *casting* `BigInt()` di dalam lingkungan Server.
46. **[v3.2] Konsinyasi `qty_sold` Dynamic Sync**: Stok barang terjual tidak bertambah karena transaksi POS tidak menyentuh tabel `consignment_items`. Fix: Hitung `qty_sold` secara dinamis dengan rumus `qty_received - qty_returned - actual_stock` pada *query* `getConsignmentItems()` agar 100% *real-time* dengan transaksi kasir.
---

## 9. ANDROID APK — OFFLINE STRATEGY

```
Capacitor Config (capacitor.config.ts):
  appId: com.koperasi.sulfindo
  server.url: https://projectkoperasi.vercel.app

Offline Interceptor (MainActivity.java):
  BridgeActivity → override WebViewClient
  onReceivedError (ERROR_HOST_LOOKUP | ERROR_CONNECT | ERROR_TIMEOUT | ERROR_IO | ERROR_UNKNOWN)
    → loadUrl("file:///android_asset/public/offline.html")

Offline Page (android/app/src/main/assets/public/offline.html):
  - Logo koperasi (koperasi.png — bundled in APK)
  - Status dot: 🔴 SERVER TIME OUT | 🟢 SERVER TERHUBUNG
  - Ping loop tiap 5 detik ke SERVER_URL
  - Auto-redirect ke app saat server kembali online

Build:
  cd android && gradlew.bat assembleRelease
  Output: android/app/build/outputs/apk/release/app-release.apk
```

> Jika IP server berubah: update `SERVER_URL` di `MainActivity.java` (line constant) → rebuild APK.

---

## 10. ALUR PESANAN ONLINE ANGGOTA

```
Anggota → /toko
  → Pilih produk → cart → Checkout Dialog
  → Pilih: Ambil Sendiri (pickup) / Dikirim (delivery + alamat)
  → Pilih: Paylater / Tunai / QRIS
  → createOnlineOrder() → orders (channel=online, status=pending)
  → Stock langsung terpotong
  → Notif muncul di Bell Icon kasir/admin

Kasir/Admin → /toko/pesanan
  → Tab "Menunggu (N)" → Konfirmasi → Diproses → Selesai
  → Atau: Batalkan pesanan
```

---

## 11. ALUR PROCUREMENT

```
Admin/Pengurus → /pembelian
  → Tab Supplier: CRUD supplier (kode, nama, kontak, payment terms)
  → Tab Purchase Order: buat PO (pilih supplier + item + qty + harga)
  → PO status: draft → sent → partial/received → cancelled
  → Tab Good Receipt: terima barang dari PO (GR)
  → GR otomatis update stock produk

/keuangan → Accounts Payable (dari PO received) + Accounts Receivable
  → Aging Schedule: current vs overdue
```

---

## 12. ARSITEKTUR HEADER NOTIFIKASI

```
header.tsx (Server Component)
  → getNotifications(role) → prisma queries:
     - loan_applications.count({ status: 'pending' })
     - orders.count({ channel: 'online', order_status: 'pending' })
  → pass notifications[] ke HeaderClient

header-client.tsx (Client Component)
  → Bell button → toggle dropdown
  → Link ke /pinjaman/approval atau /toko/pesanan
```

---

## 13. DASHBOARD PER ROLE

| Role | Dashboard Component | Data Source |
|---|---|---|
| superadmin/pengurus | `PengurusDashboard` | `getAdminStats()` |
| admin | `KreditDashboard` | `getKreditStats()` |
| kasir | `KasirDashboard` | `getKasirStats()` |
| anggota | `MemberDashboard` | `getMySimpanan` + `getMyPinjaman` + `getMyOrders` + `getKoperasiStats` + `getMyLoyalty` |

> Mobile: `DashboardMobileRedirect` mengarahkan ke `/dashboard/home` jika viewport mobile.

---

## 14. SEED DATA / AKUN TEST

| Role | Login | Password |
|---|---|---|
| superadmin | admin@koperasi.digital | 123456 |
| superadmin | superadmin | 654321 |
| **ketua** | **ketua@koperasisulfindo.id** | **ketua2024** |
| anggota | S0002 (NIK) | 123456 |

---

## 15. PROGRESS TERAKHIR (17 MEI 2026 — v3.1)

### Sesi 16 Mei 2026 (v3.0 — sebelumnya)
1. Aesthetic Login Page, Manajemen Promosi (fix hydration + upload), Floating Carousel anggota.
2. Dashboard Simpanan Admin format 4-kotak tab.
3. Loan Rules UI: tombol di halaman Master Produk, form per-produk, 6 jenis rule.

### Sesi 17 Mei 2026 (v3.1)
4. **[FIX] Loan Rules Persistence** — root cause `prisma generate` tidak dijalankan.
5. **[FIX] Bundler Crash** — tipe dipindah ke `lib/types/loan-rules.types.ts`.
6. **[FIX] Nested Button** — `LoanRulesModal` trigger dipisah dari `Dialog`.
7. **[NEW] Pengaturan Jenis Simpanan** — modal CRUD di halaman admin simpanan.
8. **[NEW] Konfigurasi Parameter SHU** — multi-tab 5 seksi, RBAC, audit log.
9. **[NEW] Role Ketua Koperasi** — MySQL enum + Prisma generate + user baru.

### Sesi 18–19 Mei 2026 (v3.2 — Konsinyasi Module)
10. **[NEW] Modul Konsinyasi** — halaman `toko/konsinyasi/` dengan tab Stok Titipan & Tagihan + Settlement.
11. **[FIX] Import Error** — ganti `react-hot-toast` ke `sonner`; tambah `formatCurrency` ke `lib/utils.ts`.
12. **[FIX] Schema Sync Konsinyasi** — seluruh field actions diselaraskan ke schema DB aktual:
    - `consignment_items`: hapus `unit_price`/`qty_remaining`, pakai `consignment_date`
    - `consignment_payables`: pakai `consignment_id`, `qty_sold`, `unit_price`, `total_amount`
    - `consignment_settlements`: pakai `settlement_date`, `settlement_no`, `processed_by`
13. **[FIX] Decimal/Date Serialization** — fix Decimal → `.toString()` dan Date → `new Date(val)` di Server Component mapping.
14. **[FIX] getConsignmentItems orderBy** — ubah `received_at` → `consignment_date`; tambah `include: { payables }` untuk baca `unit_price`.
15. **[FIX] createConsignmentItem** — hapus tulis ke field yang tidak ada, buat payable record atomik saat penerimaan.
16. **[FIX] createConsignmentSettlement** — fix field `paid_at` → `settlement_date`, tambah `settlement_no` auto-generate, isi `processed_by`.
17. **[FIX] returnConsignmentItem** — `qty_remaining` dihitung dinamis (tidak disimpan di DB).
18. **[SYNC DB] Sinkronisasi Konsinyasi** — buat `consignment_items` + `consignment_payables` untuk 2 produk (`Kacang Garuda`, `Roti Aoka`) yang sudah ada di kategori Konsinyasi tapi belum punya record.
19. **[NEW] Pemisahan PO vs Konsinyasi (Opsi A)** — produk kategori `konsinyasi` dikecualikan dari dropdown form PO Biasa via query filter `product_categories: { slug: { not: 'konsinyasi' } }`; banner info ditambahkan di form PO.
20. **[FIX] Hapus tombol PO Konsinyasi** — tombol placeholder dihapus dari tab Purchase Order di halaman Pembelian.

---

## 16. LANGKAH SELANJUTNYA (TODO)

1. **PPOB Module**: Integrasi layanan tagihan (listrik, BPJS, dll) di POS/portal anggota.
2. **SHU Engine**: Implementasi kalkulasi distribusi SHU per anggota berdasarkan `shu_config` yang sudah tersimpan.
3. **Tutup Buku**: Finalisasi alur closing bulanan + jurnal otomatis.
4. **Cloud Storage**: Migrasi aset gambar dari `/public/uploads/` ke cloud (S3/Cloudinary).
5. **Notifikasi Real-time**: Polling interval / SSE agar notif Bell update otomatis.
6. **Deployment**: PM2/Docker, `NEXTAUTH_SECRET` produksi, HTTPS, env separation.

---

## 17. SECURITY AUDIT & VULNERABILITY ASSESSMENT (v3.2 PLAN)

Berdasarkan Security Assessment, berikut adalah 6 area kritikal yang menjadi fokus perbaikan pada v3.2:

1. **BOLA / IDOR (BigInt ID)**
   - **Risiko**: User dapat mengubah parameter ID di Server Action untuk melihat/mengubah data user lain.
   - **Mitigasi**: Implementasi filter kepemilikan (`where: { id: BigInt(id), user_id: session.user.id }`) pada operasi yang dilakukan oleh role `anggota`.

2. **Privilege Escalation & RBAC Bypass**
   - **Risiko**: Perlindungan middleware berbasis URL dapat di-bypass dengan memanggil Server Action secara langsung menggunakan session role rendah.
   - **Mitigasi**: Enkapsulasi pengecekan role secara inline di dalam setiap Server Action (misal: `if(session.user.role !== 'superadmin') throw Error`).

3. **Mass Assignment & JSON Data Integrity**
   - **Risiko**: Input JSON kompleks (`shu_config`, `loan_rules`) rentan disisipi properti ilegal yang memengaruhi logika bisnis.
   - **Mitigasi**: Gunakan Zod `strict()` validator untuk membersihkan (strip) key yang tidak dikenali sebelum dikirim ke Prisma.

4. **Man-In-The-Middle (MITM) di Capacitor APK**
   - **Risiko**: Mode remote server HTTP dengan `usesCleartextTraffic="true"` mengekspos kredensial dan JWT di lingkungan produksi.
   - **Mitigasi**: Wajib HTTPS di `capacitor.config.ts` untuk produksi dan blokir cleartext traffic di `AndroidManifest.xml`.

5. **Business Logic Flaws (Race Condition & Negatif Qty)**
   - **Risiko**: Double spending (limit minus) karena concurrent requests dan manipulasi total harga via qty negatif.
   - **Mitigasi**: Gunakan Prisma `$transaction` dan Atomic Operations (`decrement`/`increment`) bukan pengecekan in-memory. Wajibkan validasi kuantitas selalu positif (> 0).

6. **Database Constraint & DoS Crash**
   - **Risiko**: Input string ilegal ke Enum database memicu Unhandled Promise Rejection yang menyebabkan server crash.
   - **Mitigasi**: Gunakan global `try-catch` di Server Action dan Zod Enum parser untuk melempar Error 400 gracefully.