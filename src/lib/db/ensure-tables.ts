let ensured = false;

// FIX (28 Jul 2026): Sebelumnya fungsi ini mencoba CREATE TABLE + CREATE INDEX
// dalam SATU $executeRawUnsafe() - gagal di koneksi pooled Neon dengan error
// "cannot insert multiple commands into a prepared statement" (pgbouncer/pooler
// tidak mendukung multi-statement dalam satu prepared statement). Errornya
// di-catch & cuma warning, jadi tidak fatal - TAPI tetap membuang 1 round-trip
// DB gagal di SETIAP pemanggilan action RAT (5 tempat di rat-absensi.ts).
//
// Root cause sebenarnya: tabel `rat_attendances` SEKARANG SUDAH ADA secara resmi
// lewat model Prisma di schema.prisma (dibuat via `prisma db push`/migrasi),
// jadi workaround runtime create-table ini sudah tidak diperlukan lagi.
// Dijadikan no-op daripada dihapus total supaya 5 titik pemanggil di
// rat-absensi.ts tidak perlu diubah satu-satu.
export async function ensureTables() {
  if (ensured) return;
  ensured = true;
}
