# Rencana Eksekusi: Seed Data Simulasi Setahun Koperasi Sulfindo

> **STATUS: BELUM DIEKSEKUSI — DAN BELUM 100% LENGKAP.** Lihat §7 "Celah yang
> Masih Perlu Ditambal" di paling bawah untuk daftar yang belum kelar.
> Dokumen ini catatan rencana lengkap supaya bisa dilanjut nanti (siang/sore)
> tanpa ada yang terlewat. Semua angka & asumsi di bawah sudah dicek terhadap
> kondisi database & rule aktif saat ini (28 Juli 2026).

## 0. Konteks & Keputusan yang Sudah Diambil

- **Target database:** Neon Postgres yang sama dengan production
  (`projectkoperasi.vercel.app`) — dikonfirmasi user, masih tahap testing, OK lanjut.
- **Metode eksekusi:** Script TypeScript + Prisma Client (bukan raw SQL injection),
  supaya rule bisnis bisa dicek terprogram sebelum tiap insert.
- **Volume belanja toko:** diturunkan dari literal "1-2x/hari kerja" menjadi
  **1-2x per MINGGU per anggota** (bukan per hari), estimasi ~5.000-6.000 order/tahun.
  → *Alasan: literal per hari kerja (~250 hari × 96 anggota × 1.5x) = 25.000-36.000
  transaksi, tidak realistis untuk koperasi kecil & terlalu berat dieksekusi/diaudit.*
- **Bug antrian pencairan (#6):** **BELUM diputuskan** user apakah mau sekalian
  diperbaiki (approve/disburse dipisah jadi 2 tahap) atau dibiarkan seperti sekarang
  (approve = langsung cair). **→ Perlu konfirmasi ulang sebelum eksekusi.**
  Default sementara jika tidak dikonfirmasi: **biarkan seperti sekarang** (opsi
  paling aman/rendah-risiko, tidak mengubah alur kerja pengurus yang sudah berjalan),
  cukup pastikan data yang di-generate konsisten dengan cara kerja ini.

## 1. Kondisi Database Saat Ini (baseline, dicek 28 Juli 2026)

| Tabel | Jumlah saat ini |
|---|---|
| members | 20 |
| users | 26 |
| savings | 60 |
| saving_transactions | 277 |
| loan_products | 3 (aktif semua) |
| loan_applications | 67 |
| loans | 47 |
| orders | 497 |
| products (toko) | 25 |
| purchase_orders | 2 |
| accounts_payable | 2 |

**Referensi ID yang akan dipakai:**
- `units`: id 1 (Kantor Pusat/U-001), id 2 & 3 (CAP Plant/U-002, U-003)
- `loan_products`: id 1 = LP-001 Pinjaman Barang (bunga 1.5%, tenor≤36bln, Rp1jt-50jt, admin fee 1%), id 2 = LP-002 Pinjaman Uang (bunga 1.5%, tenor≤24bln, Rp500rb-50jt, admin fee 1%), id 5 = LP-003 Pinjaman Kilat (bunga 0.5%, tenor 1bln, Rp100rb-1jt, tanpa admin fee)
- `saving_types`: id 1 = SS Simpanan Sukarela (bunga 3.5%/th, bisa tarik), id 2 = SW Simpanan Wajib (wajib, Rp50rb/bln, tidak bisa tarik), id 3 = SP Simpanan Pokok (wajib, Rp100rb sekali, tidak bisa tarik)

## 2. Rule Bisnis Aktif (dari `app_settings.loan_rules`, HARUS dipatuhi persis ini, bukan default kode)

```json
{
  "max_loans_per_month":    { "enabled": true, "applied_to_products": [5],     "value": 1 },
  "strict_single_active_loan": { "enabled": true, "applied_to_products": [5,2,1], "value": true },
  "min_remaining_installments_for_topup": { "enabled": true, "applied_to_products": [2,1], "value": 3 },
  "require_receipt_for_goods": { "enabled": true, "applied_to_products": [1], "value": true },
  "max_paylater_debt":      { "enabled": true, "applied_to_products": [],    "value": 1000000 },
  "max_loan_percentage_of_savings": { "enabled": true, "applied_to_products": [5,2,1], "value": 80 }
}
```

**Implikasi konkret untuk data yang di-generate:**
1. **`strict_single_active_loan` berlaku untuk KETIGA produk** → satu anggota
   **maksimal 1 pinjaman berstatus `active` di tabel `loans` pada satu waktu**,
   lintas jenis Barang/Uang/Kilat. Anggota yang mau punya 2 siklus pinjaman dalam
   setahun HARUS: ajukan → disetujui → cicilan lunas (`loans.status` → `paid_off`)
   → baru boleh ajukan lagi.
2. **`max_loans_per_month`** hanya berlaku utk Kilat (produk id 5): maks 1
   pengajuan/bulan/anggota untuk produk itu (redundant dgn rule #1 tapi tetap dicek).
3. **`max_loan_percentage_of_savings`** (80%, semua produk): `amount_requested`
   yang di-generate harus ≤ 80% dari total saldo `savings` anggota tsb PADA SAAT
   pengajuan (bukan saldo akhir tahun).
4. **`max_paylater_debt`** (Rp1.000.000, scope kosong = general POS/paylater):
   total `orders` dengan `payment_method=paylater` & `payment_status=unpaid` milik
   satu anggota tidak boleh melebihi Rp1.000.000 pada satu waktu.
5. `min_remaining_installments_for_topup` & `require_receipt_for_goods`: tidak
   memblokir insert data (bukan top-up scenario yang direncanakan), cukup dicatat
   sebagai konteks, tidak perlu logic khusus kecuali kita generate skenario top-up.

## 3. Rencana Detail per Poin Permintaan

### 3.1 — 100 Anggota Baru (poin #2 bagian pendaftaran)
- `member_code`: lanjutkan sequence dari existing (cek `MAX` code saat ini dulu
  sebelum generate, jangan hardcode `MBR-0021` tanpa verifikasi).
- Sebar `join_date` acak sepanjang tahun simulasi (misal Jan-Des 2025 atau
  sesuai tahun berjalan yg disepakati — **perlu ditentukan: tahun simulasi berapa?**
  Data existing loan_products dibuat 22 Juni 2026, jadi tahun simulasi wajar = 2025
  penuh, atau Agu 2025-Jul 2026. **→ konfirmasi saat eksekusi.**)
- `nik` unique 16 digit format Indonesia, `full_name` random nama Indonesia
  (list nama depan+belakang umum, campur laki-laki/perempuan sesuai `gender`),
  `unit_id` acak dari 3 unit existing, `status='active'`.
- Tiap anggota baru → 1 baris `users` (role `anggota`, password default
  `K0pmember01` di-hash bcrypt — **konsisten dengan `createMember()` yang sudah ada**),
  username = prefix email.
- Tiap anggota baru → buat 3 baris `savings` (SP, SW, SS) + `saving_transactions`
  setoran awal (Simpanan Pokok Rp100rb sekali di awal, Simpanan Wajib Rp50rb/bulan
  terhitung sejak `join_date` s.d. akhir simulasi, Simpanan Sukarela beberapa kali
  setor acak) — ini PENTING supaya saldo simpanan cukup realistis untuk jadi basis
  perhitungan rule #3 (maks 80% saldo) saat generate pinjaman.
- Estimasi baris: 100 members + 100 users + 300 savings + ~1.500-2.000 saving_transactions
  (tergantung berapa bulan rata-rata keanggotaan sebelum akhir simulasi).

### 3.2 — Pengajuan Pinjaman: Barang, Uang, Kilat (poin #2 bagian pinjaman)
- Ambil sampel ~40-50 anggota (dari 120 total: 20 lama + 100 baru) untuk siklus
  pinjaman sepanjang tahun, **tidak semua anggota** (realistis — tidak semua
  anggota koperasi ambil pinjaman tiap tahun).
- Sebar jenis produk: proporsi realistis ± 40% Uang, 35% Barang, 25% Kilat.
- Tiap siklus pinjaman: `submitted_at` → `reviewed_by`+`reviewed_at` (role
  pengurus/admin berbeda-beda, lihat §3.6) → `approved_by`+`approved_at` ATAU
  `rejected` dengan `rejection_note` (perlu porsi kecil pinjaman DITOLAK untuk
  realisme — misal 10-15% dari total pengajuan).
- Untuk yang approved: buat `loans` + `loan_schedules` (pola perhitungan flat
  interest SAMA PERSIS dengan `updateLoanStatus()` di `loans.ts` — replikasi
  rumus, jangan improvisasi rumus baru) + `loan_payments` untuk cicilan yang
  "sudah lewat tanggal" sesuai timeline simulasi (sebagian lunas penuh
  `paid_off`, sebagian masih `active` berjalan, sebagian sengaja telat →
  `loan_schedules.status='overdue'` untuk uji laporan tunggakan).
- **Cek keras sebelum tiap insert pengajuan baru:** query `loans` anggota tsb,
  pastikan tidak ada `status='active'` lain sebelum bikin pengajuan baru
  (simulasikan urutan waktu kronologis per anggota, bukan random tanpa urutan).
- Estimasi: ~55-65 pengajuan baru (beberapa anggota dapat 2 siklus berurutan).

### 3.3 — "Pengajuan Pembelian di Toko" (poin #2 bagian ini — perlu klarifikasi saat eksekusi)
- Interpretasi kerja saat ini: transaksi `orders` dengan `payment_method='paylater'`
  (beli dulu, bayar belakangan, dipotong gaji/simpanan bulan depan) — bukan
  pengadaan barang (itu poin #4). **Perlu konfirmasi apakah interpretasi ini benar**
  atau yang dimaksud adalah sesuatu yang lain (misal member request barang belum
  tersedia di toko).
- Kalau interpretasi ini disetujui: generate untuk sebagian anggota (~15-20 orang),
  1-3 transaksi paylater/tahun, jaga total `unpaid` per anggota ≤ Rp1.000.000
  (rule #4 di atas). Sebagian dilunaskan (payment_status → paid) di bulan berikutnya
  untuk simulasi siklus normal.

### 3.4 — Belanja Rutin 80% Anggota (poin #3)
- 80% dari 120 anggota = **96 anggota** ikut belanja rutin.
- **1-2x per MINGGU** (bukan per hari kerja — sudah dikonfirmasi user) → per
  anggota per minggu random 1 atau 2 transaksi, hari acak dalam hari kerja
  (Senin-Jumat saja, sesuai instruksi awal soal "hari kerja").
- Rentang: 52 minggu × 96 anggota × rata-rata 1.5x ≈ **~7.500 order** (revisi
  estimasi dari 5-6rb sebelumnya karena 52 minggu penuh setahun — akan
  dikonfirmasi/disesuaikan saat eksekusi, bisa dikurangi coverage minggu kalau
  perlu, misal skip beberapa minggu libur/cuti).
- Tiap order: 1-4 `order_items` acak dari 25 produk existing, `channel='pos'`,
  `cashier_id` dari user role `kasir` (lihat §3.6), `payment_method` campur
  cash/qris/saving_deduct/paylater (mayoritas cash & qris), `payment_status='paid'`
  untuk yang bukan paylater.
- Update `products.stock` (decrement) tiap order — **pakai pola atomic yang sama
  dengan `pos.ts`** (guard `stock >= qty`) supaya tidak stok minus. Kalau stok
  produk existing (25 produk) tidak cukup untuk volume ini, perlu restock dulu
  lewat jalur pengadaan (§3.5) sebelum/di sela-sela generate order.

### 3.5 — Transaksi Toko Lain: Retur, Pengadaan Barang (poin #4)
- **Retur barang** (`order_returns`): ambil sampel ~2-3% dari total order yang
  di-generate di §3.4, buat retur sebagian/seluruh item, status tersebar
  (pending/approved/rejected/completed), `refund_method` campur.
- **Pengadaan barang** (`purchase_orders` → `good_receipts` → `accounts_payable`):
  generate PO ke supplier existing beberapa kali sepanjang tahun (buat stok
  cukup untuk memenuhi volume penjualan §3.4), lengkap dengan `purchase_order_items`,
  `good_receipt_items` (barang diterima, update `stock` bertambah), dan
  `accounts_payable`/`accounts_payable_details` (utang ke supplier, sebagian
  `paid`, sebagian masih `open`/`overdue` untuk realisme laporan hutang).
- **Konsinyasi** (`consignment_items`, `consignment_payables`,
  `consignment_settlements`) — model sudah ada di schema tapi belum disinggung
  di permintaan, **diusulkan ditambahkan** kalau mau cakupan lebih lengkap
  (opsional, tunggu konfirmasi).
- **Stock opname & stock movements** — opsional juga, bisa ditambah 1-2 kejadian
  supaya modul itu tidak kosong total (usulan tambahan, bukan wajib).

### 3.6 — Andil Semua Role (poin #7)
Perlu ada user aktif per role yang benar-benar "melakukan" aksi (bukan cuma
existing seed), supaya `created_by`/`approved_by`/`processed_by`/`cashier_id`
dll. tersebar wajar:
- **anggota** — pemohon pinjaman, pembeli/pelanggan toko (§3.2, §3.4).
- **kasir** — `cashier_id` di semua `orders` POS (§3.4), buka/tutup
  `cash_register_sessions` per shift/hari (opsional tapi bagus untuk realisme).
- **pengurus** — `reviewed_by`/`approved_by` pengajuan pinjaman (§3.2), approve
  `purchase_orders` (§3.5).
- **petugas_akuntan** — proses `accounts_payable` (tandai lunas), input
  `journal_entries`/`journal_lines` kalau mau cakupan akuntansi (opsional,
  tunggu konfirmasi — bisa jadi scope tambahan besar).
- **pengawas** — belum ada aksi tulis yang jelas di kode existing (role ini
  kemungkinan besar read-only/oversight). Diusulkan: isi `rat_attendances`
  (presensi RAT) sebagai andil pengawas + beberapa anggota, karena model ini
  sudah ada tapi masih kosong.
- Cek dulu di tabel `users` existing siapa saja yang sudah punya role-role ini
  (jangan generate user baru kalau sudah cukup) — **perlu query referensi
  sebelum eksekusi.**

## 4. Perbaikan Kode yang Masih Menggantung Keputusan

- **#6 — Bug antrian pencairan**: lihat §0, keputusan user masih diperlukan.
  Kalau dipilih "perbaiki": perlu tambah action baru `disburseLoan()`, ubah
  `updateLoanStatus()` approve supaya TIDAK langsung create `loans`, update
  UI approval (`approval-client.tsx`) tambah tombol "Cairkan", update
  `getLoanApplications`/`getMyPinjaman` queue logic. Ini scope tersendiri,
  disarankan dikerjakan **terpisah** dari seeding data (supaya tidak campur
  aduk perubahan kode dengan perubahan data), tapi dua-duanya perlu selesai
  sebelum queue dianggap "sudah dipastikan berjalan benar".

## 5. Urutan Eksekusi yang Diusulkan (saat lanjut nanti)

1. Konfirmasi ulang: tahun simulasi, keputusan #6, interpretasi §3.3, dan
   apakah opsional di §3.5/§3.6 (konsinyasi, jurnal akuntansi, stock opname)
   ikut dikerjakan atau cukup yang wajib.
2. Query referensi terbaru (member_code terakhir, user per role, stok produk
   existing) — jangan asumsi angka dari dokumen ini basi kalau ada perubahan
   di sela waktu.
3. Tulis script secara modular per bagian (bisa dijalankan & diverifikasi
   satu-satu, bukan satu script raksasa sekali jalan): (a) 100 anggota+savings,
   (b) pengadaan barang dulu (supaya stok cukup), (c) belanja rutin toko,
   (d) retur, (e) pengajuan+pencairan pinjaman, (f) paylater.
4. Tiap bagian: dry-run hitung dulu (console.log rencana insert tanpa commit)
   sebelum benar-benar `prisma.create`, terutama untuk bagian pinjaman yang
   rule-nya ketat.
5. Setelah selesai semua: jalankan ulang query hitung baris (`scripts/check-counts.js`
   sudah dibuat) + spot-check manual beberapa anggota by rule violation checker
   yang sudah ada di `scratch/check-loan-violations.ts` untuk pastikan tidak ada
   pelanggaran `strict_single_active_loan`.
6. Verifikasi visual: cek halaman `/simpanan`, `/pinjaman`, `/toko/kasir`,
   `/pinjaman/approval` di browser/live site untuk pastikan data tampil benar.

## 6. Pertanyaan Terbuka untuk Dikonfirmasi Sebelum Eksekusi

1. Keputusan #6 (perbaiki alur disburse atau biarkan)?
2. Tahun/rentang tanggal simulasi persis (2025 penuh? Agu 2025-Jul 2026?)?
3. Interpretasi §3.3 "pengajuan pembelian di toko" — paylater seperti diusulkan,
   atau maksud lain?
4. Cakupan opsional: konsinyasi, jurnal akuntansi (`journal_entries`), stock
   opname — ikut dikerjakan atau skip dulu?
5. Estimasi ~7.500 order toko (§3.4) — OK segini, atau mau dikurangi/ditambah?

## 7. Celah yang Masih Perlu Ditambal (ditemukan saat review kelengkapan, 28 Juli 2026)

### 7.1 Temuan verifikasi tambahan (baru, mengubah beberapa asumsi di atas)
- ✅ **Baseline data BERSIH** — dicek langsung: 0 anggota dengan >1 pinjaman
  `active` bersamaan (dari 12 pinjaman aktif saat ini). Folder `scratch/` di
  root project berisi ~150 script riwayat audit/perbaikan data lama (termasuk
  `find-duplicate-loans.ts`, `fix-duplicate-loans-execute.ts`,
  `generate_dummy_transactions.ts`, `seed-active-history.ts` dari sesi kerja
  sebelumnya) — pernah ada masalah serupa di masa lalu dan sudah dibereskan,
  jadi kita mulai dari kondisi yang valid.
- ⚠️ **Stok toko jauh lebih tipis dari dugaan**: total cuma **2.830 unit** di 25
  produk, 3 produk nyaris habis (Sabun Mandi: 3, Sampo Sachet: 2, Baterai AAA: 0).
  Kalau §3.4 menghasilkan ~7.500 order × 1-4 item, itu **15.000-20.000 unit
  terjual** — jauh melebihi stok saat ini. **Pengadaan barang (§3.5) BUKAN
  opsional pemanis, tapi WAJIB dan harus dijalankan berulang kali sepanjang
  tahun** (bukan "beberapa kali"), idealnya di-generate SEBELUM/di-interleave
  dengan generate penjualan, bukan di akhir.
- ⚠️ **Timeline data existing sudah sampai Juli 2026** — order terakhir
  `ONL-20260715-0497` bertanggal 15 Juli 2026. Ini mengoreksi asumsi "tahun
  simulasi 2025" di §3.1 — kemungkinan besar yang lebih tepat adalah **rentang
  Agustus 2025 – Juli 2026** (setahun ke belakang dari kondisi data terkini),
  BUKAN kalender 2025 penuh yang terputus dari histori yang ada. Perlu
  dikonfirmasi tapi ini jadi kandidat kuat jawaban pertanyaan #2 di §6.
- ⚠️ **Pola penomoran order ternyata `ONL-YYYYMMDD-####`** (prefix "ONL", bukan
  "POS" seperti diasumsikan) — perlu dicek dulu apakah ada pola nomor terpisah
  khusus untuk channel POS sebelum generate, jangan asal format sendiri.
- ⚠️ **User per role sangat tipis**: hanya **1 kasir, 1 pengurus, 1
  petugas_akuntan, 1 pengawas** (+2 superadmin, 20 anggota) yang ada saat ini.
  Untuk poin #7 (andil semua role) secara teknis tetap bisa jalan dengan 1
  user per role (semua approval/kasir akan tercatat atas nama user itu-itu
  saja), tapi kalau mau lebih realistis (approval oleh orang berbeda-beda,
  shift kasir bergantian), **perlu ditambah beberapa user staf baru** —
  ini keputusan tambahan yang belum ditanyakan ke user.

### 7.2 Detail teknis yang belum dirancang (perlu diisi sebelum nulis script)
- **Cara hitung saldo simpanan HISTORIS** (bukan saldo hari ini) untuk cek rule
  80% (`max_loan_percentage_of_savings`) saat pengajuan pinjaman di masa lalu —
  perlu SUM `saving_transactions` sampai tanggal pengajuan, bukan pakai kolom
  `savings.balance` (itu saldo terkini/akhir). Belum ada rumus/pseudocode di
  dokumen ini.
- **Strategi performa & batching**: 7.500+ order + item + savings transactions
  + loan schedules kalau di-insert satu-satu (sequential `await prisma.create`)
  ke Neon (koneksi pooled, ada latency jaringan) bisa memakan waktu SANGAT lama
  (bisa >1 jam) dan boros compute. Perlu strategi `createMany` per batch di
  mana relasinya memungkinkan, dan estimasi waktu jalan yang realistis.
- **Resumability**: kalau script gagal di tengah jalan (network error ke Neon,
  timeout, dll.), belum ada mekanisme checkpoint/resume — berisiko insert
  dobel atau data setengah jadi kalau di-run ulang begitu saja. Perlu idempotency
  key atau progress log per tahap.
- **Backup/snapshot sebelum eksekusi**: belum ada langkah expor/backup kondisi
  DB sebelum mulai insert massal, padahal ini DB yang sama dengan production.
  Disarankan tambah langkah `pg_dump` (atau lewat fitur backup yang sudah ada
  di aplikasi, `/pengaturan/backup`) sebagai langkah 0 sebelum eksekusi apa pun.
- **audit_logs**: aksi nyata di aplikasi (`createMember`, dll.) selalu menulis
  ke tabel `audit_logs`. Belum diputuskan apakah data simulasi ini juga perlu
  menulis audit_logs (supaya konsisten & tidak mencurigakan saat diperiksa),
  atau dilewati saja karena ini bukan aksi user sungguhan.
- **Penomoran unik**: belum diverifikasi format pasti untuk `reference_no`
  (saving_transactions), `invoice_no` (accounts_payable), `loan_no` sudah jelas
  (`L-YYYYMM-####` dari `loans.ts`) tapi yang lain belum dicek ke kode/data existing.

### 7.3 Belum ditanyakan ke user (kandidat scope tambahan)
- Payroll/potongan gaji (`payroll.ts` sudah ada di codebase) dan SHU
  (`shu_periods`/`shu_distributions`) — tidak diminta eksplisit, tapi kalau mau
  simulasi "setahun operasional koperasi" yang utuh, dua modul ini besar dan
  kosong. Diusulkan sebagai scope tambahan opsional (user bisa tolak).
- Perlu ditambah user staf baru untuk keragaman role (lihat §7.1) — ya/tidak?

**Kesimpulan:** kerangka besar (rule, entitas, urutan, estimasi volume) sudah
matang, tapi bagian **teknis-implementasi** (§7.2) dan **koreksi asumsi**
(§7.1) belum masuk ke rencana sebelum ini, dan §6 masih 5 pertanyaan terbuka.
Belum layak dieksekusi langsung — perlu satu putaran konfirmasi lagi.
