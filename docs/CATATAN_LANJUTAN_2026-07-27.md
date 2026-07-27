# Catatan Lanjutan — Audit & Fix Koperasi Sulfindo (27 Juli 2026)

> Baca ini dulu sebelum lanjut kerja. Detail lengkap tiap temuan ada di
> `docs/temuan.md` (sudah diupdate hari ini, 11/12 poin closed).

## Status Singkat

- ✅ **11 dari 12 temuan sudah selesai diperbaiki & diverifikasi** (`npx tsc --noEmit` = 0 error).
- 🔴 **1 yang belum selesai: #12 — divergensi Git lokal vs origin.** Ini yang
  harus dikerjakan besok, dan **butuh keputusan manusia**, tidak bisa diotomatisasi.
- Commit lokal terakhir hari ini: `3012109` (docs: finalize temuan.md) di atas
  `daef400` (fix: audit temuan.md - upload auth check, dst).
- Working tree bersih saat sesi berakhir (`git status` → nothing to commit).

## PEKERJAAN UNTUK BESOK: Selesaikan #12 (Divergensi Git)

### Konteks
```
Branch 'main' lokal dan 'origin/main' sudah diverged:
  - 5 commit hanya di lokal (3 redesign UI + 2 dari sesi audit hari ini)
  - 10 commit hanya di origin, termasuk beberapa yang KRITIS untuk produksi:
      - fix: revert schema.prisma provider to postgresql for Vercel Neon compatibility
      - fix(schema): add directUrl for Neon pooled connection
      - fix(db): ensure rat_attendances table via raw SQL at startup
      - fix(auth): remove unnecessary PrismaAdapter
      - feat: backup google drive, backup scheduler
```

### Kenapa belum dieksekusi
`prisma/schema.prisma` di origin sudah migrasi sintaks MySQL (`@db.Timestamp(0)`)
ke PostgreSQL (`@db.Timestamp()`) di puluhan model — ini bukan hal sepele, ini
keputusan provider database. File yang overlap antara lokal & origin juga
termasuk persis file yang baru diperbaiki hari ini (`header-client.tsx`,
`pengurus-dashboard.tsx`), jadi risiko konflik saat merge/rebase nyata.

### Langkah yang disarankan (urutan)
1. **Cek dulu provider database yang benar-benar dipakai sekarang:**
   ```powershell
   cd D:\laragon\www\koperasi-sulfindo
   Get-Content .env | Select-String "DATABASE_URL"
   ```
   Apakah mengarah ke Neon (Postgres) atau MySQL lokal Laragon? Ini menentukan
   versi `schema.prisma` mana yang benar.

2. **Review penuh diff schema sebelum putuskan apa-apa:**
   ```powershell
   git fetch origin
   git --no-pager diff main origin/main -- prisma/schema.prisma
   ```

3. **Rebase (bukan merge, bukan force-push) supaya histori tetap rapi:**
   ```powershell
   git rebase origin/main
   ```
   Kemungkinan besar akan ada conflict di:
   - `prisma/schema.prisma`
   - `src/components/shared/header-client.tsx`
   - `src/app/(dashboard)/dashboard/pengurus-dashboard.tsx`
   - kemungkinan file lain yang tumpang tindih (lihat daftar lengkap di
     `docs/temuan.md` bagian #12)

4. **Untuk file yang bentrok karena fix hari ini vs origin:** cek apakah origin
   sudah punya fix yang sama (mis. kalau origin ternyata sudah memperbaiki
   breadcrumb `require()` dengan cara berbeda) — kalau iya, pilih versi origin
   dan buang perubahan lokal untuk file itu supaya tidak duplikat logic.

5. **Setelah rebase selesai tanpa error, verifikasi ulang sebelum push:**
   ```powershell
   npx tsc --noEmit -p tsconfig.json
   npx prisma validate
   npx prisma generate
   ```

6. **Baru push** (`git push origin main`), jangan pakai `--force` kecuali
   sudah yakin betul tidak ada yang akan kehilangan pekerjaan.

7. Setelah selesai, update `docs/temuan.md` #12 jadi ✅ Case Closed dengan
   ringkasan bagaimana konfliknya diresolve.

## Pengingat Lain
- Ada file aneh bernama `koperasi-sulfindo` (sama dengan nama folder) yang
  sempat muncul di `git status` di awal sesi kemarin — kalau muncul lagi saat
  rebase, kemungkinan itu artefak dari command yang salah ketik, aman dihapus,
  tapi cek dulu isinya sebelum didelete.
- Semua fix hari ini (#7–#11) sudah diverifikasi jalan (`tsc` bersih), tapi
  belum di-*push* ke GitHub — masih nunggu proses reconcile #12 ini selesai.
