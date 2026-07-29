# Laporan Temuan (Bug & Security Findings) — Koperasi Sulfindo

> Status terakhir diperbarui: 27 Juli 2026 (audit lanjutan oleh Claude terhadap live site,
> GitHub repo, dan source lokal `D:\laragon\www\koperasi-sulfindo`).
>
> Legenda status:
> - ✅ **CASE CLOSED** — sudah ada fix di kode saat ini, terverifikasi langsung dari source.
> - 🟡 **SEBAGIAN CLOSED** — sudah ada mitigasi, tapi belum lengkap/ada celah residual.
> - 🔴 **OPEN** — belum ada mitigasi, masih perlu ditindaklanjuti.
> - 🔍 **PERLU VERIFIKASI** — indikasi ada di kode tapi belum diuji end-to-end.

---

## Bagian A — Audit Keamanan (Security Assessment) v3.1

### 1. BROKEN OBJECT LEVEL AUTHORIZATION (BOLA/IDOR) & BigInt Serialization
**Status: ✅ CASE CLOSED**

Diverifikasi di `src/lib/actions/loans.ts` fungsi `getLoanTransaction()`: query
di-filter dengan `member_id: user.members.id` untuk role non-admin, dan admin
(`superadmin/admin/pengurus`) baru boleh query tanpa filter kepemilikan. Pola ini
sudah sesuai remediasi yang direkomendasikan.

> Catatan: verifikasi ini baru mencakup fungsi loan detail. Server Action lain yang
> menerima `id` dari client (simpanan, transaksi toko, dsb.) sebaiknya di-spot-check
> dengan pola yang sama sebelum dianggap tertutup total.

---

### 2. PRIVILEGE ESCALATION VIA SERVER ACTIONS & RBAC BYPASS
**Status: ✅ CASE CLOSED (untuk fungsi yang dicek)**

`src/lib/actions/settings.ts`, `shu-calculation.ts`, `loans.ts`, dan `payroll.ts`
semuanya memanggil helper `checkRole([...])` di awal fungsi mutasi sensitif, contoh:
```ts
await checkRole(["superadmin", "ketua"]);
```
Ini menutup skenario "hanya cek `session ada/tidak`" yang didokumentasikan di temuan awal.


---

### 3. MASS ASSIGNMENT & DATA INTEGRITY (SHU / LOAN RULES JSON)
**Status: ✅ CASE CLOSED**

> Koreksi dari laporan audit sebelumnya: awalnya ditandai "sebagian closed" karena
> pencarian hanya menyisir `shu-calculation.ts`. Setelah dicek lebih lanjut, skema
> Zod strict-nya ternyata ada di file terpisah `src/lib/types/shu-config.types.ts`
> dan memang dipakai di jalur simpan.

- ✅ **POS checkout** (`src/lib/actions/pos.ts` + `posCheckoutSchema` di
  `src/lib/validations/index.ts`): `.strict()` per item cart.
- ✅ **`shu_config`** (`src/lib/actions/shu-calculation.ts` fungsi `saveShuConfig()`):
  ```ts
  const session = await checkRole(["superadmin", "ketua"]);
  const parsedData = ShuConfigSchema.parse(config);      // Zod .strict() — tolak key asing
  const validationError = validateShuConfig(parsedData); // rule bisnis: total alokasi=100%, dst.
  ```
  `ShuConfigSchema` di `src/lib/types/shu-config.types.ts` didefinisikan dengan
  `.strict()` di setiap sub-objek maupun objek root — payload dengan key di luar
  skema akan otomatis ditolak Zod sebelum menyentuh Prisma.

---

### 4. CAPACITOR ANDROID APK & NETWORK SECURITY (MITM)
**Status: ✅ CASE CLOSED**

Terverifikasi tiga lapis mitigasi sudah aktif di kode:
- `capacitor.config.ts` → `server.cleartext: false`, `url` mengarah ke
  `https://projectkoperasi.vercel.app` (bukan LAN IP).
- `android/app/src/main/AndroidManifest.xml` → `android:usesCleartextTraffic="false"`.
- `src/auth.config.ts` → `useSecureCookies: process.env.NODE_ENV === "production"`.

---

### 5. BUSINESS LOGIC FLAW DI POS & ONLINE ORDERS (Race Condition / Qty Negatif)
**Status: ✅ CASE CLOSED (untuk POS checkout)**

`src/lib/actions/pos.ts`:
- Validasi qty: `posCheckoutSchema` mewajibkan `Number.isInteger(val) && val >= 1`
  ("Kuantitas minimal 1") — menutup celah *negative quantity injection*.
- Update stok pakai **atomic conditional update** Prisma:
  ```ts
  where: { stock: { gte: item.qty } },
  data: { stock: { decrement: item.qty } }
  ```
  Ini mencegah race condition/oversell karena pengecekan & pengurangan terjadi
  dalam satu operasi di level database, bukan check-then-act di memori.
- Ada juga pengecekan manipulasi total harga:
  `if (validated.grandTotal !== calculatedGrandTotal) throw new Error("Manipulasi harga terdeteksi.")`.

> Catatan: closed untuk POS. Alur "Online Order" (di luar `pos.ts`) belum dicek
> terpisah — sebaiknya dipastikan pakai pola atomic update yang sama.

---

### 6. DATABASE CONSTRAINT & ENUM HANDLING (Crash/DoS Prevention)
**Status: ✅ CASE CLOSED (untuk approve/reject pinjaman)**

`src/lib/actions/loans.ts` baris ~292: `z.enum(["approve","reject"]).parse(action)`
dipakai sebelum menyentuh Prisma, dan fungsi-fungsi terkait sudah dibungkus
`try/catch` (multiple occurrences terverifikasi di file yang sama).

---

## Bagian B — Temuan Baru (Audit 27 Juli 2026)

### 7. Idle Session Timeout Tidak Sesuai Komentar Kode
**Status: ✅ CASE CLOSED (diperbaiki 27 Juli 2026 — ternyata cuma komentar basi)**

Ditelusuri lewat `git log -p`: komentar "1 jam" adalah sisa dari commit lama
(`992b30d`). Commit berikutnya, `05d940a "chore: extend idle timeout to 30 days
for mobile convenience"`, **sengaja** mengubah nilai jadi 30 hari demi kenyamanan
pengguna mobile, tapi lupa update komentar log di sebelahnya. Jadi nilai **30 hari
memang perilaku yang diinginkan**, bukan bug fungsional/keamanan — cuma dokumentasi
yang menyesatkan. Fix: komentar di `auth.config.ts` diperbarui jadi
`// Sesi idle > 30 hari (lihat IDLE_TIMEOUT_SECONDS) → paksa logout...` supaya
konsisten dengan kode.

> Jika ke depannya tim ingin timeout lebih ketat untuk keamanan (mis. shared/kiosk
> device), ubah nilai `IDLE_TIMEOUT_SECONDS` — bukan sekadar komentarnya.

---

### 8. Middleware Tidak Melindungi `/api/*`
**Status: ✅ CASE CLOSED (audit selesai, 1 bug nyata ditemukan & diperbaiki 27 Juli 2026)**

`middleware.ts`:
```ts
matcher: ['/((?!api|_next/static|_next/image|...).*)']
```
Semua route `/api/**` sengaja di-exclude dari NextAuth middleware (karena Server
Actions memang tidak lewat middleware, jadi ini desain yang wajar) — tapi
konsekuensinya **setiap** route handler `/api/...` wajib melakukan pengecekan
sesi/role sendiri.

**Audit menyeluruh** ke semua `src/app/api/**/route.ts` (total 4 file):

| Route | Auth check | Status |
|---|---|---|
| `api/app-version/route.ts` | Tidak ada (memang publik — info versi APK) | ✅ Aman, sengaja publik |
| `api/ping/route.ts` | Tidak ada (memang publik — health check) | ✅ Aman, sengaja publik |
| `api/auth/[...nextauth]/route.ts` | Handler NextAuth sendiri | ✅ Aman, ini mekanisme login |
| `api/upload/route.ts` | ❌ **Tidak ada sama sekali** | 🔴 **Ditemukan bug nyata** |

**Bug yang ditemukan:** `POST /api/upload` bisa diakses **tanpa login** — siapa pun
bisa mengunggah file ke Cloudinary milik aplikasi (risiko: penyalahgunaan storage,
biaya, hosting konten sembarangan lewat akun Cloudinary koperasi).

**Fix yang diterapkan** di `src/app/api/upload/route.ts`:
```ts
import { auth } from "@/auth"
...
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```
Dicek boleh diakses semua role yang login (bukan dibatasi role tertentu) karena
endpoint ini dipakai lintas fitur (foto profil, foto produk, dsb.) — yang penting
sudah tidak bisa diakses anonim. Diverifikasi `npx tsc --noEmit` tetap 0 error
setelah perubahan ini.

---

### 9. Breadcrumb Pakai `require()` Dinamis untuk Memanggil Hook
**Status: ✅ CASE CLOSED (diperbaiki 27 Juli 2026)**

Fix: `header-client.tsx` sekarang `import { usePathname } from "next/navigation"` di
top-level, `eslint-disable-next-line react-hooks/rules-of-hooks` dan `require()` dihapus.
`.map((seg: string, i: number) => ...)` juga sudah diberi tipe eksplisit.

---

### 10. Cache `.next` Basi — Referensi Route yang Sudah Dihapus
**Status: ✅ CASE CLOSED (diperbaiki 27 Juli 2026)**

Fix: `rm -rf .next` lalu rebuild. `npx tsc --noEmit` sekarang bersih dari error
`Cannot find module '.../pengaturan/backup/page.js'` dkk.

---

### 11. Type Error pada Custom Tooltip Recharts
**Status: ✅ CASE CLOSED (diperbaiki 27 Juli 2026)**

Root cause: `ChartTooltip` di-type pakai `TooltipProps<ValueType,NameType>` (tipe
untuk *prop yang dikirim ke* `<Tooltip>`, yang sengaja meng-Omit `payload`/`label`
karena itu properti yang diisi Recharts dari context internal) — seharusnya pakai
`TooltipContentProps<ValueType,NameType>` (tipe untuk *komponen custom yang dipanggil
Recharts sebagai content*, yang punya `payload`/`label`).

Fix yang diterapkan di `pengurus-dashboard.tsx`:
1. Ganti import `TooltipProps` → `TooltipContentProps` dari `"recharts"`.
2. Ganti pemakaian `<Tooltip content={<ChartTooltip />} />` (JSX instance, salah)
   menjadi `<Tooltip content={ChartTooltip} />` (component reference, pola yang benar
   untuk Recharts) di 2 chart (BarChart & AreaChart).
3. Tambah tipe eksplisit pada parameter `.map((p, i: number) => ...)`.

Diverifikasi: `npx tsc --noEmit` sekarang **0 error** di seluruh project.

---

### 12. Divergensi Git Lokal vs Origin
**Status: 🔴 OPEN — sengaja TIDAK di-auto-merge, perlu keputusan manual**

Saat audit dimulai, working tree sempat berada di tengah **interactive rebase**
yang belum selesai (ada staged/unstaged changes, termasuk entri aneh bernama
`koperasi-sulfindo`). Beberapa saat kemudian status berubah jadi bersih dengan
sendirinya (kemungkinan diselesaikan dari sesi/editor lain secara bersamaan).

**Investigasi 27 Juli 2026** (`git fetch` + `git log origin/main..main` /
`git log main..origin/main`):

- **3 commit lokal** yang belum di-push (redesign UI desktop: font Inter,
  collapsible sidebar, command palette, typography).
- **10 commit di origin** yang belum ditarik ke lokal — termasuk beberapa yang
  **kritis untuk produksi**: `fix: revert schema.prisma provider to postgresql
  for Vercel Neon compatibility`, `fix(db): ensure rat_attendances table via raw
  SQL`, `fix(schema): add directUrl for Neon pooled connection`, `fix(auth): remove
  unnecessary PrismaAdapter`, dan fitur backup Google Drive.
- **Overlap file sangat besar** antara kedua sisi — termasuk persis file yang
  saya perbaiki hari ini (`header-client.tsx`, `pengurus-dashboard.tsx`) dan
  `prisma/schema.prisma`.
- Dicek isi diff `prisma/schema.prisma`: origin sudah migrasi sintaks dari
  MySQL (`@db.Timestamp(0)`) ke PostgreSQL (`@db.Timestamp()`) di puluhan model
  — ini perubahan arsitektur provider database, bukan hal sepele.

**Kenapa tidak saya proses otomatis:** merge/rebase di sini punya risiko nyata
merusak schema yang sudah diperbaiki di production (Neon/Postgres), dan/atau
menimbulkan konflik di file yang barusan saya edit. Ini butuh keputusan sadar
dari yang paham konteks migrasi database-nya, bukan tebakan otomatis.

**Yang sudah dilakukan:** commit lokal `daef400` berisi semua fix hari ini
(#7–#11) supaya tidak hilang, `git fetch` sudah dijalankan.

**Rekomendasi langkah selanjutnya (manual):**
1. Pastikan `prisma/schema.prisma` lokal memang harus provider `postgresql`
   (cek `.env` — apakah `DATABASE_URL` sekarang mengarah ke Neon atau MySQL lokal).
2. `git diff main origin/main -- prisma/schema.prisma` untuk review penuh sebelum
   memutuskan.
3. Kemungkinan besar strategi teraman: `git rebase origin/main` lalu resolve
   konflik satu-satu (terutama di `header-client.tsx`, `pengurus-dashboard.tsx`,
   `prisma/schema.prisma`) — **bukan** `git push --force`.
4. Setelah rebase bersih, jalankan ulang `npx tsc --noEmit` dan `npx prisma
   validate` sebelum push.

---

## Ringkasan Status

| # | Temuan | Status |
|---|--------|--------|
| 1 | IDOR/BOLA pinjaman | ✅ Case Closed |
| 2 | Privilege escalation Server Actions | ✅ Case Closed |
| 3 | Mass assignment `shu_config` | ✅ Case Closed (koreksi — sudah lengkap sejak awal) |
| 4 | Capacitor MITM / cleartext traffic | ✅ Case Closed |
| 5 | Race condition & qty negatif POS | ✅ Case Closed |
| 6 | Enum invalid → crash/DoS | ✅ Case Closed |
| 7 | Idle timeout 30 hari vs komentar 1 jam | ✅ Case Closed (komentar basi, nilai memang disengaja) |
| 8 | Middleware exclude `/api/*` | ✅ Case Closed (bug di `/api/upload` ditemukan & diperbaiki) |
| 9 | Breadcrumb `require()` dinamis | ✅ Case Closed |
| 10 | Cache `.next` basi | ✅ Case Closed |
| 11 | Type error tooltip recharts | ✅ Case Closed |
| 12 | Divergensi git lokal/origin | ✅ Case Closed (rebase manual, font Poppins dipilih, push sukses) |
| 13 | Tailwind `--font-size-*` salah namespace → build gagal | ✅ Case Closed |
| 14 | Timeout SHU N+1 query → build gagal | ✅ Case Closed |
| 15 | Model `budgets` hilang dari schema → `/akuntansi/anggaran` selalu error | ✅ Case Closed |

**Sisa pekerjaan:** semua 15 temuan sudah ✅ case closed per 28 Juli 2026,
terverifikasi lewat `npx tsc --noEmit` (0 error), `npx prisma validate`, `npx
prisma db push` (sinkron tanpa data loss), dan `npm run build` production penuh
(0 error). Sudah di-push ke `origin/main`.

---

## Bagian C — Post-Rebase: Build Production Gagal di Vercel (28 Juli 2026)

### 13. Tailwind v4 `--font-size-*` Salah Namespace → Build Gagal
**Status: ✅ CASE CLOSED**

Setelah #12 di-rebase & push, build Vercel gagal total:
```
Error: Cannot apply unknown utility class `text-h1`
CssSyntaxError: tailwindcss: .../src/app/globals.css:1:1: Cannot apply unknown
utility class `text-h1`
```
**Root cause:** di Tailwind CSS v4, namespace `@theme` untuk font-size adalah
`--text-*`, BUKAN `--font-size-*`. `globals.css` mendefinisikan
`--font-size-h1`, `--font-size-h2`, dst., sehingga Tailwind tidak mengenali
`text-h1`/`text-h2` sebagai utility class yang valid saat dipakai di
`.page-title { @apply text-h1 ... }` dan `.section-title { @apply text-h2 ... }`.
Ini bug lama yang sudah ada sejak sebelum rebase (bukan hasil resolve conflict
font Poppins/Inter kemarin) — baru ketahuan sekarang karena baru kali ini
build production benar-benar dijalankan ulang dari awal.

**Fix:** ganti semua `--font-size-h1/h2/h3/body/small/data-lg/data` menjadi
`--text-h1/h2/h3/body/small/data-lg/data` di `src/app/globals.css`.

**Diverifikasi:** `npm run build` lokal (mereplikasi proses build Vercel) sukses
penuh, semua ~50 route ter-compile termasuk `/api/cron/backup` dan
`/pengaturan/backup` (memang benar sudah ada lagi dari fitur backup origin,
bukan cache basi). Sudah di-push (`ec1f246`).

---

## Bagian D — Ditemukan Saat Verifikasi Build Setelah Seeding Data (28 Juli 2026)

### 14. Build Vercel Gagal — Timeout Static Generation di `/akuntansi/pembagian-shu`
**Status: ✅ CASE CLOSED**

`getSHUProjection()` menghitung proyeksi SHU untuk SEMUA anggota aktif via
sequential loop (`for...await`) — 3 query database per anggota, satu-satu, tanpa
paralelisasi. Dengan 20 anggota (skala lama) ini cukup cepat, tapi setelah
seeding data (120 anggota + volume transaksi jauh lebih besar), total waktu
lewat batas 60 detik Next.js static generation → build Vercel gagal total
setelah 3x percobaan retry.

**Fix:**
1. `pembagian-shu/page.tsx` → tambah `export const dynamic = "force-dynamic"`
   supaya halaman dihitung saat request (serverless function), bukan saat build.
2. `shu-calculation.ts` → loop sequential diganti `Promise.all()` supaya semua
   perhitungan per-anggota berjalan paralel, bukan satu-satu.

Diverifikasi: `npm run build` lokal sukses penuh (`Compiled successfully`), semua
route ter-generate tanpa error.

### 15. `/akuntansi/anggaran` Selalu Error — Model `budgets` Tidak Ada di Schema
**Status: ✅ CASE CLOSED**

**Bug lama, TIDAK berkaitan dengan seeding data** — ditemukan saat investigasi
laporan error di halaman ini. `src/lib/actions/budgets.ts` aktif memanggil
`prisma.budgets.findMany/create/createMany`, tapi **`model budgets` sama sekali
tidak ada di `prisma/schema.prisma`** (0 hasil pencarian "budget" di seluruh
file). Akibatnya `prisma.budgets` selalu `undefined` di runtime →
`TypeError: Cannot read properties of undefined` → halaman selalu gagal untuk
siapa pun yang membukanya, sejak awal.

**Fix:** tambah `model budgets` baru ke schema (id, code unique, name, allocated,
used, color, year, created_at, updated_at — field disamakan persis dengan yang
dipakai di `budgets.ts`), lalu `prisma db push` untuk membuat tabel di database.
Tabel baru murni, tidak menyentuh data/tabel lain.

⚠️ **Temuan sampingan saat proses fix ini** — `prisma db push` awalnya mau
MENGHAPUS 3 kolom (`bank_name`, `bank_account`, `bank_holder`) dari tabel
`members` yang **masih berisi data 20 anggota**, karena kolom itu ADA di
database tapi hilang dari `schema.prisma` (schema drift lama, tidak diketahui
sejak kapan). **TIDAK dieksekusi** (`--accept-data-loss` sengaja tidak dipakai) —
sebagai gantinya, ketiga kolom dikembalikan ke `schema.prisma` supaya sinkron
dengan struktur DB asli. Setelah itu `prisma db push` jalan bersih tanpa
peringatan data loss apa pun. Data bank 20 anggota terverifikasi utuh.

**Pelajaran:** kejadian ini menunjukkan `schema.prisma` sempat tidak sinkron
dengan DB produksi untuk kolom lain juga — disarankan audit menyeluruh
`schema.prisma` vs `information_schema.columns` di kesempatan lain untuk
memastikan tidak ada drift tersembunyi lainnya.
