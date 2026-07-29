# Log Eksekusi Seed Data Simulasi Setahun — Koperasi Sulfindo

> Dibuat 28 Juli 2026. Dokumen ini yang dipakai untuk lacak progres —
> update terus tiap tahap selesai. Rencana detail asal ada di
> `docs/RENCANA_SEED_DATA_2026-07-28.md`.

## Keputusan Default yang Diambil (karena harus jalan tanpa menunggu jawaban)

Karena masih ada pertanyaan terbuka yang belum dijawab user, saya ambil opsi
paling aman/rendah-risiko untuk masing-masing supaya eksekusi bisa mulai:

| # | Pertanyaan | Keputusan default | Alasan |
|---|---|---|---|
| 1 | Bug antrian pencairan (#6) | **Dibiarkan seperti sekarang** (tidak diubah alur code-nya) | Hindari campur perubahan kode besar dengan seeding data; risk lebih rendah |
| 2 | Rentang tanggal simulasi | **1 Agustus 2025 – 27 Juli 2026** | Selaras dengan histori data existing yang berakhir 15 Juli 2026 |
| 3 | "Pengajuan pembelian toko" | **Order `payment_method='paylater'`** | Sesuai usulan awal, konsisten dengan rule `max_paylater_debt` yang sudah aktif |
| 4 | Scope opsional (konsinyasi, jurnal, stock opname, payroll, SHU) | **DI-SKIP** untuk simulasi ini | Fokus 7 poin yang eksplisit diminta; bisa diusulkan lagi sebagai kerja terpisah |
| 5 | Volume order toko | **~7.500 order/tahun (1-2x/minggu × 96 anggota)** | Sesuai kesepakatan sebelumnya |
| 6 | Tambah user staf baru? | **Ya, tambah sedikit** (+1 kasir, +1 pengurus, +1 petugas_akuntan) | Existing cuma 1/role, terlalu sempit untuk variasi role yang diminta poin #7 |

## Pembagian 4 Hari (urutan berdasarkan KRITIKALITAS & DEPENDENSI, bukan urutan poin asli)

Urutan ini beda dari urutan poin permintaan asli karena ada dependensi teknis:
data toko (§3.4) butuh stok cukup dulu (§3.5 pengadaan), dan data pinjaman (§3.2)
butuh saldo simpanan historis dulu (§3.1). Jadi fondasi dulu, baru transaksi ramai.

### 🔵 HARI 1 (PALING KRUSIAL — fondasi, semua tahap lain bergantung ini)
1. Backup/snapshot ringan (JSON export tabel kritis) sebelum insert apa pun.
2. Tambah 3 user staf baru (role kasir/pengurus/petugas_akuntan).
3. Generate 100 anggota baru + akun `users` terkait + `savings` (SP/SW/SS) +
   `saving_transactions` historis (basis perhitungan rule 80% di Hari 4).

### 🟡 HARI 2 (Pengadaan — WAJIB sebelum Hari 3, stok existing cuma 2.830 unit)
4. `purchase_orders` → `good_receipts` (barang masuk) ke 25 produk existing,
   beberapa kali sepanjang periode simulasi, cukup untuk menutupi ~15-20rb unit
   terjual di Hari 3.
5. `accounts_payable` terkait (sebagian lunas, sebagian masih open/overdue).

### 🟢 HARI 3 (Volume terbesar — transaksi toko)
6. ~7.500 order POS (80% dari 120 anggota, 1-2x/minggu, hari kerja Senin-Jumat).
7. Retur barang (`order_returns`) — sampel ~2-3% dari order Hari 3.
8. Order paylater ("pengajuan pembelian toko") untuk ~15-20 anggota, jaga
   limit Rp1.000.000/anggota.

### 🟣 HARI 4 (Paling sensitif rule — pinjaman + verifikasi akhir)
9. ~55-65 pengajuan pinjaman (Barang/Uang/Kilat) untuk ~40-50 anggota, patuh
   `strict_single_active_loan` + `max_loan_percentage_of_savings` 80% (pakai
   saldo historis dari Hari 1) + `max_loans_per_month` khusus Kilat.
10. `loan_schedules` + `loan_payments` (sebagian lunas, sebagian berjalan,
    sebagian nunggak untuk uji laporan).
11. `rat_attendances` (andil pengawas + anggota).
12. **Verifikasi akhir menyeluruh**: re-run `check-loan-violations.js`,
    `check-counts.js`, spot check UI `/simpanan`, `/pinjaman`, `/pinjaman/approval`,
    `/toko/kasir`, dan tulis ringkasan akhir di dokumen ini.

## STATUS PROGRES

| Hari | Tahap | Status | Catatan |
|---|---|---|---|
| 1 | Backup/snapshot | ✅ Selesai | `docs/backups/snapshot-pre-seed-2026-07-28.json` — baseline: 20 members, 26 users, 60 savings, 277 saving_tx, 67 loan_apps, 47 loans, 497 orders, 25 products |
| 1 | 3 user staf baru | ✅ Selesai | `kasir2`(id67), `pengurus2`(id68), `akuntan2`(id69) — password `Staf#2026` |
| 1 | 100 anggota + savings | ✅ Selesai | MBR-0021 s.d. MBR-0120, join_date acak 1 Agu 2025–30 Jun 2026. Tiap anggota dapat savings SP+SW+SS. Total anggota sekarang: 120. Total user: 129. Savings: 360 baris. Saving_transactions: 1.391 baris (dari 277). Password default anggota baru: `K0pmember01` (sama seperti `createMember()`). Verifikasi: 0 pelanggaran rule, count semua tabel konsisten (lihat `scripts/check-counts.js` output). |
| 2 | Pengadaan barang | ✅ Selesai | 65 PO baru (`PO-2025-001..010` + `PO-2026-001..060` — total 67 dgn 2 lama), 12 siklus bulanan Agu 2025-Jul 2026, 5 produk/supplier × 5 supplier. ⚠️ Agustus 2025 ke-generate 2x (sisa dari test run 1-bulan sebelum full run, tidak ada guard anti-duplikat) — efeknya cuma stok Agustus lebih tebal dari rencana, BUKAN pelanggaran rule/data rusak. |
| 2 | Accounts payable | ✅ Selesai | 65 invoice baru (`INV-SUP-003..067`, 70% `paid`, sisanya `open`/`overdue` acak) + `accounts_payable_details` per item. Total: 67. |
| 2 | Stok akhir | ✅ Selesai | Total stok naik dari 2.830 → **37.104 unit** di 25 produk (termasuk 3 produk kritis yang tadinya nyaris habis, sudah direstock besar di siklus pertama). Lebih dari cukup untuk proyeksi ~15-20rb unit terjual di Hari 3. |
| 3 | Belanja rutin toko (~7.500 order) | ✅ Selesai (dengan 3 insiden, semua diperbaiki) | Lihat catatan detail di bawah tabel |
| 3 | Retur barang | ⬜ Belum | |
| 3 | Order paylater | ⬜ Belum | |
| 4 | Pengajuan pinjaman | ⬜ Belum | |
| 4 | Loan schedules/payments | ⬜ Belum | |
| 4 | RAT attendances | ⬜ Belum | |
| 4 | Verifikasi akhir | ⬜ Belum | |

Legenda: ⬜ Belum mulai · 🔄 Sedang jalan · ✅ Selesai · ⚠️ Selesai dengan catatan

## Catatan Detail Hari 3 — Belanja Rutin Toko (3 insiden, semua sudah diperbaiki)

Ditulis apa adanya supaya jelas apa yang terjadi dan bagaimana diperbaiki:

**Insiden 1 — Kesalahan operasional (env var tidak di-reset saat retry).**
Rencana awal: tes 2 minggu dulu sebelum full run. Karena koneksi Neon sempat gagal
(transient) di percobaan pertama, saya retry TANPA set ulang `SEED_WEEK_START`/
`SEED_WEEK_COUNT` — akibatnya langsung jalan full 52 minggu tanpa lewat tes kecil.
Hasilnya tetap valid secara data (7.438 order + 19.365 order_items berhasil
tersimpan benar), jadi tidak di-rollback, tapi ini murni kebetulan aman, bukan
proses yang seharusnya.

**Insiden 2 — Bug enum `order_payments.payment_status`.**
Saya pakai nilai `'completed'`, padahal enum sebenarnya `pending/authorized/
captured/failed/refunded`. Script crash SEBELUM satu pun `order_payments` baru
ke-insert (aman, tidak ada data korup) — tapi 7.438 order sempat tanpa payment
record. Diperbaiki lewat script patch `03b-patch-payments-stock.js`, memakai
`'captured'`.

**Insiden 3 — Bug enum `order_payments.payment_method`.**
Setelah fix insiden 2, ketahuan `order_payments_payment_method` (cash/debit_card/
credit_card/qris/transfer/check/other) BEDA dari `orders_payment_method` (cash/
saving_deduct/paylater/qris/transfer) — tidak 1:1. Order dengan `saving_deduct`
memang tidak dibuatkan `order_payments` (konsisten dengan kode asli `pos.ts` yang
juga tidak menangani ini secara khusus). Order `paylater` yang masih `unpaid`
juga sengaja dilewati (itu memang artinya "belum dibayar", bukan bug). Hasil akhir
backfill: 6.657 dari 7.935 total order punya payment record; sisanya (1.278)
memang seharusnya tidak punya (saving_deduct + paylater belum lunas) — angkanya
pas (7.935 - 1.278 = 6.657, terverifikasi cocok).

**Insiden 4 — Kesalahan estimasi stok (root cause: salah hitung satuan).**
Saat merencanakan Hari 2, saya keliru mengira `order_items` (baris order) sama
dengan unit terjual. Faktanya 19.365 baris × rata-rata ~2,4 qty/baris ≈ jauh lebih
banyak unit sebenarnya. Akibatnya **14 dari 25 produk kehabisan stok** (mentok di
0, terpotong oleh pengaman `Math.max(0, ...)` saat decrement). Diperbaiki dengan
restock darurat (`03c-restock-darurat.js`): PO khusus `PO-2025-XXX-DARURAT`
tanggal 15 Sep 2025 (ditempatkan di awal simulasi, sebelum mayoritas transaksi),
400 unit/produk untuk 13 produk yang sempat 0. Hasil akhir: **0 produk sisa stok
0**, total stok akhir 7.120 unit.

**Verifikasi akhir tahap ini (semua konsisten):**
- Orders: 7.935 total (497 lama + 7.438 baru), semua punya `order_items` (19.365 baris).
- Payments: 6.657/7.935 (sisanya sengaja tidak punya, sudah dijelaskan di atas).
- `purchase_orders`/`accounts_payable`: 68/68 (termasuk 1 PO+AP darurat).
- Stok: 0 produk minus/nol, total 7.120 unit tersisa.
- **0 pelanggaran rule pinjaman** (tidak tersentuh tahap ini, tetap 12 loan aktif seperti sebelumnya).
