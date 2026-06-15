# NEXT.JS APP ROUTER ARCHITECTURE ANALYSIS
## Koperasi Sulfindo Digital Management System

**Date**: June 15, 2026  
**Analyzed By**: Next.js App Router Architect  
**Project**: Koperasi Sulfindo - Sistem Manajemen Koperasi Digital  

---

## 1. OVERVIEW APLIKASI

### Tujuan Aplikasi
Platform manajemen digital terintegrasi untuk Koperasi Sulfindo yang mencakup:
- Manajemen anggota (profil, data keanggotaan, KYC)
- Produk simpanan & pinjaman dengan sistem cicilan/bunga fleksibel
- Akuntansi double-entry dengan laporan keuangan real-time (Neraca, PHU, Arus Kas)
- Toko Waserda dengan sistem POS, inventory multi-lokasi, dan konsinyasi supplier
- Sistem pembagian SHU (Sisa Hasil Usaha) massal dengan bobot partisipasi
- Modul PPOB (Tagihan Listrik, Air, BPJS, Pulsa)
- Dashboard analytics berbasis role (superadmin, admin, pengurus, kasir, anggota)

### Domain
**Internal Tools + ERP-Lite untuk Koperasi**  
- Hybrid: Web dashboard (desktop-first) + APK mobile (Capacitor)
- Multi-tenant readiness (future: multi-koperasi)
- Role-based access control (RBAC) dengan 5 peran utama

### Core Features Utama
1. **CRM & Member Management**: Profil anggota, riwayat transaksi, audit trail
2. **Savings & Loans**: Produk simpanan (Pokok, Wajib, Sukarela), pinjaman dengan bunga flat/anuitas/efektif, cicilan terotomasi
3. **Accounting & Reporting**: Chart of Accounts (COA), jurnal double-entry, laporan bulanan & RAT
4. **Retail & Inventory**: POS kasir, stock opname multi-lokasi, transfer stock, konsinyasi
5. **Analytics & Executive Dashboard**: Real-time KPI, SHU distribution, member participation tracking
6. **Audit & Security**: Role-based middleware, activity logging, session management

---

## 2. APP ROUTER STRUCTURE ANALYSIS (/app)

### Struktur Folder Hierarchy

```
/app
├── layout.tsx                          # Root layout (Geist font, global Toaster)
├── page.tsx                            # Root page → redirect ke /dashboard
├── globals.css                         # Tailwind + custom CSS tokens
├── error.tsx                           # Global error boundary
│
├── (auth)/                             # Route Group: Public auth pages
│   ├── layout.tsx                      # Auth wrapper layout
│   └── login/
│       └── page.tsx                    # Server Component (async): fetch settings, detect mobile
│
├── (dashboard)/                        # Route Group: Protected dashboard (auth required)
│   ├── layout.tsx                      # Server Component (async): auth check, SessionProvider wrapper
│   │
│   ├── dashboard/
│   │   ├── page.tsx                    # Role-based conditional server fetch + render
│   │   ├── pengurus-dashboard.tsx      # "use client" - Interactive charts
│   │   ├── admin-dashboard.tsx         # "use client"
│   │   ├── kasir-dashboard.tsx         # "use client"
│   │   ├── kredit-dashboard.tsx        # "use client"
│   │   ├── member-dashboard.tsx        # "use client"
│   │   ├── home/
│   │   │   └── home-page-client.tsx    # "use client"
│   │   └── floating-promotions.tsx     # "use client"
│   │
│   ├── anggota/
│   │   ├── page.tsx                    # Server: fetch members data
│   │   ├── member-table.tsx            # "use client" - Table + sorting/search
│   │   └── member-form.tsx             # "use client" - Form handling
│   │
│   ├── pinjaman/
│   │   ├── page.tsx                    # Server: conditional render by role
│   │   ├── approval/
│   │   │   └── approval-client.tsx     # "use client"
│   │   ├── transaksi/
│   │   │   └── [id]/page.tsx           # "use client" - Dynamic route
│   │   ├── produk/
│   │   │   ├── loan-product-form.tsx   # "use client"
│   │   │   ├── loan-product-table.tsx  # "use client"
│   │   │   └── loan-rules-modal.tsx    # "use client"
│   │   ├── rules/
│   │   │   └── rules-client.tsx        # "use client"
│   │   ├── kelola-pinjaman-client.tsx  # "use client"
│   │   └── member-loan-form.tsx        # "use client"
│   │
│   ├── simpanan/
│   │   ├── page.tsx                    # Server: fetch by role
│   │   ├── simpanan-admin-client.tsx   # "use client"
│   │   └── saving-types-modal.tsx      # "use client"
│   │
│   ├── toko/
│   │   ├── produk/
│   │   │   ├── product-form.tsx        # "use client" - Form
│   │   │   ├── product-table.tsx       # "use client" - Table
│   │   │   └── page.tsx
│   │   ├── kasir/
│   │   │   ├── pos-client.tsx          # "use client" - Full POS UI
│   │   │   └── sesi/
│   │   │       └── sesi-client.tsx     # "use client"
│   │   ├── inventaris/
│   │   │   ├── page.tsx                # Server: fetch read models
│   │   │   ├── client.tsx              # "use client" - Inventory table
│   │   │   ├── transfer-stock.tsx      # "use client" - Transfer form
│   │   │   └── opname-stock.tsx        # "use client" - Opname form
│   │   ├── pesanan/
│   │   │   └── online-pesanan-client.tsx # "use client"
│   │   ├── konsinyasi/
│   │   │   └── konsinyasi-client.tsx   # "use client"
│   │   └── toko-anggota-client.tsx     # "use client"
│   │
│   ├── akuntansi/
│   │   ├── transaksi/
│   │   │   └── transaksi-client.tsx    # "use client" - Manual journal entry
│   │   ├── buku-besar/
│   │   │   └── buku-besar-client.tsx   # "use client"
│   │   ├── tutup-buku/
│   │   │   └── closing-client.tsx      # "use client"
│   │   ├── aset-tetap/
│   │   │   └── page.tsx                # "use client"
│   │   ├── anggaran/
│   │   │   └── anggaran-client.tsx     # "use client"
│   │   ├── laporan-keuangan/
│   │   │   └── laporan-keuangan-client.tsx # "use client"
│   │   ├── rat-absensi/
│   │   │   └── rat-absensi-client.tsx  # "use client"
│   │   └── pembagian-shu/
│   │       └── pembagian-shu-client.tsx # "use client"
│   │
│   ├── laporan/
│   │   ├── harian/
│   │   │   └── laporan-harian-client.tsx # "use client"
│   │   ├── stok/
│   │   │   └── laporan-stok-client.tsx # "use client"
│   │   ├── analitik/
│   │   │   └── laporan-analitik-client.tsx # "use client"
│   │   ├── po-konsinyasi/
│   │   │   └── laporan-po-konsinyasi-client.tsx # "use client"
│   │   ├── potongan-gaji/
│   │   │   └── report-client.tsx       # "use client"
│   │   └── partisipasi-anggota/
│   │       └── partisipasi-client.tsx  # "use client"
│   │
│   ├── ppob/
│   │   └── ppob-client.tsx             # "use client"
│   │
│   ├── pengaturan/
│   │   ├── settings-form.tsx           # "use client"
│   │   ├── cache/
│   │   │   └── cache-client.tsx        # "use client"
│   │   ├── kop-surat/
│   │   │   └── kop-surat-client.tsx    # "use client"
│   │   ├── promosi/
│   │   │   └── promotions-manager.tsx  # "use client"
│   │   ├── shu/
│   │   │   └── shu-settings-form.tsx   # "use client"
│   │   ├── ppob/
│   │   │   └── ppob-settings-form.tsx  # "use client"
│   │   └── dashboard-anggota/
│   │       └── dashboard-anggota-settings-form.tsx # "use client"
│   │
│   ├── profil/
│   │   └── profil-client.tsx           # "use client"
│   │
│   ├── keuangan/
│   │   └── keuangan-client.tsx         # "use client"
│   │
│   ├── pengawas/
│   │   └── pengawas-client.tsx         # "use client"
│   │
│   ├── akun/
│   │   └── users-client.tsx            # "use client"
│   │
│   ├── pembelian/
│   │   └── pembelian-client.tsx        # "use client"
│   │
│   └── log/
│       ├── log-client.tsx              # "use client"
│       └── role-summary.tsx            # "use client"
│
└── api/                                # Route Handlers (Backend-for-Frontend)
    ├── auth/
    │   └── [...nextauth]/route.ts      # NextAuth endpoint
    ├── koperasi-settings/
    │   └── route.ts                    # GET/PUT for unit settings
    ├── loan-rules/
    │   └── route.ts
    ├── loan-transaction/
    │   └── route.ts
    ├── shu-config/
    │   └── route.ts
    ├── upload/
    │   └── route.ts                    # Cloudinary upload proxy
    ├── ping/
    │   └── route.ts                    # Health check
    └── app-version/
        └── route.ts                    # Version check for APK
```

### Analisis Routing Organization

**Positif:**
- ✅ Route Groups `(auth)` dan `(dashboard)` memisahkan public vs protected routes dengan jelas
- ✅ Nested routes menggunakan dynamic routes `[id]` untuk detail halaman
- ✅ Konsisten menggunakan naming convention `*-client.tsx` untuk client components
- ✅ API routes terorganisir per feature module (settings, loans, shu, etc.)

**Issues:**
- ⚠️ **Flat component architecture**: Semua client components ada di level page, tidak ada sub-folder per feature
  - Contoh: `/toko/produk/`, `/toko/kasir/`, `/toko/inventaris/` → seharusnya `/toko/(produk)/`, `/toko/(kasir)/`, `/toko/(inventaris)/`
- ⚠️ **Mixed responsibility di page.tsx**: Server data fetching + conditional logic mencampur data layer dengan routing
  - Better: Extract conditional logic ke helper functions
- ⚠️ **API routes vs Server Actions redundancy**: Ada `/api/koperasi-settings/route.ts` tapi juga `settings.ts` server action
  - Harus jelas: API untuk external/mobile, Server Actions untuk web internal

---

## 3. SERVER COMPONENTS VS CLIENT COMPONENTS ANALYSIS

### Server Components (Data fetching, Server-Only Logic)

**Root & Layout Level (Server)**:
- ✅ `src/app/layout.tsx` - Root layout (metadata, fonts, global UI)
- ✅ `src/app/(dashboard)/layout.tsx` - **Excellent**: Auth check, SessionProvider, data fetching
  - Memiliki: `auth()` call, `getAppSettings()`, conditional render berdasar role
  - Issue: `SessionProvider` di server layout, perlu wrap client component
- ✅ `src/app/(auth)/login/page.tsx` - Server fetch: settings, headers parsing
- ✅ `src/app/(dashboard)/dashboard/page.tsx` - Server fetch + role-based render

**Page Level (Server)**:
- ✅ `src/app/(dashboard)/anggota/page.tsx` - Likely fetches member list
- ✅ `src/app/(dashboard)/toko/inventaris/page.tsx` - Fetches `getInventarisReadModels()`
- ✅ Multiple page.tsx files fetch data then pass to client components

### Client Components ("use client")

**Count**: ~58 client components identified

**Patterns**:
1. **Interactive UI** (58 files):
   - Tables with sorting/search: `member-table.tsx`, `product-table.tsx`, `loan-product-table.tsx`
   - Forms: `member-form.tsx`, `product-form.tsx`, `loan-product-form.tsx`, `member-loan-form.tsx`
   - Dashboard interactive: `pengurus-dashboard.tsx`, `kasir-dashboard.tsx`, `member-dashboard.tsx`
   - Data management clients: `*-client.tsx` suffix pattern for container components

2. **Overuse of "use client"** (ISSUES):
   - ❌ `closing-client.tsx` - Should be server if only reading data
   - ❌ `laporan-*-client.tsx` (reports) - Could fetch server-side then render static client
   - ❌ `aset-tetap/page.tsx` - Marked "use client" but should be server page.tsx
   - ❌ `transaksi/[id]/page.tsx` - Dynamic route marked "use client", should be server fetch + client form

3. **Problematic Patterns**:
   ```typescript
   // ANTI-PATTERN: Client component doing server action call via import
   const fetchData = () => {
     startTransition(async () => {
       const mod = await import("@/lib/actions/inventory-ui");
       const res = await mod.getInventarisReadModels();
       setReadModel(res.data);
     });
   };
   // This works but is awkward - should be server fetch then pass data
   ```

### Server/Client Boundary Issues

**CRITICAL ISSUE #1: SessionProvider in Server Layout**
```typescript
// src/app/(dashboard)/layout.tsx
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ← Server Component
  
  return (
    <SessionProvider>  {/* ← Client Provider INSIDE Server Component */}
      <ActivityTracker /> {/* ← Client Component */}
      {children}
    </SessionProvider>
  );
}
```
**Fix**: Extract to dedicated client wrapper:
```typescript
// app/(dashboard)/layout-client.tsx
"use client"
export function DashboardLayoutClient({ children }) {
  return (
    <SessionProvider>
      <ActivityTracker />
      {children}
    </SessionProvider>
  );
}

// app/(dashboard)/layout.tsx - Server
export default async function DashboardLayout({ children }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
```

**ISSUE #2: Over-reliance on useTransition for server action calls**
- Multiple clients doing `startTransition(async () => { const mod = await import(...) })` 
- Anti-pattern: Server actions should be imported at module level, not dynamically
- Better: Pass data from server page, not client fetching

---

## 4. SERVER ACTIONS ANALYSIS

### Server Actions File Structure
**Location**: `src/lib/actions/` (54 files)

#### Organized by Domain Module:
1. **Auth & Users** (3 files):
   - `auth.ts` - `authenticate()`, `logout()` → Form actions
   - `users.ts` - User management
   - `profile.ts` - Member profile updates

2. **CRM & Members** (3 files):
   - `crm.ts` - Member interactions
   - `members.ts` - Member CRUD
   - `member-portal.ts` - Member dashboard data

3. **Savings & Loans** (5 files):
   - `saving-types.ts` - Saving product types
   - `simpanan-admin.ts` - Admin savings management
   - `loans.ts` - Loan CRUD
   - `loan-products.ts` - Loan product management
   - `loan-payments.ts` - Payment recording
   - `loan-rules.ts` - Rule enforcement

4. **Accounting & Reports** (10 files):
   - `accounting.ts` - COA, journal entries
   - `buku-besar.ts` - General ledger
   - `laporan-keuangan.ts` - Financial reports (PHU, Neraca, etc.)
   - `laporan-arus-kas.ts` - Cash flow reports
   - `laporan-analitik.ts` - Analytics data
   - `laporan-stok.ts` - Stock reports
   - `shu-calculation.ts` - SHU distribution calculations

5. **Inventory & Toko** (5 files):
   - `inventory.ts` - Stock management (656 lines)
   - `inventory-ui.ts` - Read models for inventory UI
   - `pos.ts` - POS transactions
   - `pos-transactions.ts` - Transaction recording
   - `products.ts` - Product management

6. **Procurement & Konsinyasi** (2 files):
   - `procurement.ts` - Purchase orders
   - `consignment.ts` - Supplier consignment

7. **Settings & Configuration** (5 files):
   - `settings.ts` - App settings CRUD
   - `ppob-settings.ts` - PPOB configuration
   - `koperasi-stats.ts` - Dashboard stats
   - `dashboard-stats.ts` - Role-based stats

8. **Utilities** (16 files):
   - `cache-actions.ts` - Cache invalidation
   - `audit-log.ts`, `log-audit.ts` - Audit logging
   - `report-*.ts` - Report generation helpers

### Server Actions Best Practices Analysis

**✅ GOOD PATTERNS:**
- All have `"use server"` directive at top
- Most use Zod validation (implicit from error handling)
- Proper error handling with try-catch + return { success, data, error }
- Consistent naming: camelCase, verb-noun pattern
- Organized by feature domain in single directory

**❌ ISSUES & ANTI-PATTERNS:**

1. **CRITICAL: Potential IDOR/BOLA Vulnerabilities**
   - From TODO.md: "Audit dan tambahkan klausa `user_id: session.user.id`"
   - Example risk: `getMemberActivityInterestPaid()` might not filter by session.user.id
   - **Impact**: Member A could call action with memberId=B and get private data

2. **Inline RBAC Missing**
   - No `checkRole(session, allowedRoles)` utility function
   - RBAC checks scattered throughout files
   - Example from API: `if (!["superadmin", "admin", "pengurus"].includes(String(role ?? "")))`
   - Better: Centralized `withRoleCheck()` middleware

3. **Zod Validation Not Strict**
   - Missing `.strict()` to reject unknown fields
   - Risk: Mass assignment attacks
   - Example: Loan product form could accept extra fields

4. **Race Condition in Checkout/Payments**
   - POS checkout, loan payments, online orders likely have:
     ```typescript
     const stock = await prisma.products.findUnique(...);
     if (stock.qty < qty) throw new Error(...);
     await prisma.products.update(...qty - qty...);  // ← Race condition!
     ```
   - Should use: `prisma.products.update({ data: { stock: { decrement: qty } } })`

5. **Inconsistent Error Handling**
   - Some return `{ success: false, error: "message" }`
   - Others throw Error directly
   - Missing graceful fallback for DB connection errors (MySQL Aiven Cloud)

6. **Large Action Files** (>300 lines):
   - `inventory.ts` - 656 lines (should split: locations, balances, transfers, opname)
   - `loans.ts` - Likely large (should split: CRUD, payments, schedules)
   - `accounting.ts` - Likely large (should split: COA, journals, reports)

### Example: Server Action File Size Issues
```
inventory.ts (656 lines)
├── Warehouse Locations Management (30 lines)
├── Stock Balance Tracking (150 lines)
├── Stock Movements & Adjustments (200 lines)
├── Transfer Stock (100 lines)
├── Stock Opname (150 lines)
└── Reorder Points (26 lines)

BETTER STRUCTURE:
├── inventory-locations.ts (30 lines)
├── inventory-balances.ts (150 lines)
├── inventory-movements.ts (200 lines)
├── inventory-transfers.ts (100 lines)
├── inventory-opname.ts (150 lines)
└── inventory-reorder.ts (26 lines)
```

---

## 5. ROUTE HANDLERS (/app/api) ANALYSIS

### Identified API Endpoints


