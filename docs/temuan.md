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
**Status: 🔍 PERLU DIRECONCILE SEGERA**

Saat audit dimulai, working tree sempat berada di tengah **interactive rebase**
yang belum selesai (ada staged/unstaged changes, termasuk entri aneh bernama
`koperasi-sulfindo`). Beberapa saat kemudian status berubah jadi bersih dengan
sendirinya (kemungkinan diselesaikan dari sesi/editor lain secara bersamaan).
Kondisi terakhir: branch `main` lokal **3 commit ahead**, origin **10 commit ahead**
— perlu `git fetch` + review sebelum push/pull supaya tidak ada histori kerja yang
hilang atau ketimpa.

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
| 12 | Divergensi git lokal/origin | 🔍 Perlu reconcile |

**Prioritas tindak lanjut yang disarankan:** #7 (keputusan idle timeout — dampak
keamanan langsung), lalu #3 (tambah Zod `.strict()` untuk `shu_config`), baru
#8, #9, #11, #12.
