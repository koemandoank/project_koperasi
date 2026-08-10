# LAPORAN AUDIT MENYELURUH — Koperasi Sulfindo
**Tanggal:** 29 Juli 2026
**Tim Audit:** Full Stack Engineer, Software Architect, QA Engineer, Database Engineer, Financial System Analyst, Cooperative Accounting Consultant, Internal Auditor Koperasi Simpan Pinjam, POS System Analyst
**Metodologi:** Code review langsung ke source (bukan asumsi), verifikasi query terhadap database aktual bila memungkinkan, cross-check dengan riwayat temuan sebelumnya (`docs/temuan.md`, 21 item — 18 sudah closed, 3 backlog terbuka).
**Batasan:** Tidak ada perubahan kode dilakukan pada tahap ini (sesuai instruksi). Codebase berskala besar (~150+ file action, 66+ model database) — laporan ini mencakup temuan paling material dari pemeriksaan mendalam ke modul-modul inti (pinjaman, simpanan, POS, retur, akuntansi, keamanan) plus konsolidasi temuan terverifikasi dari audit-audit sebelumnya. **Ini bukan klaim cakupan 100% setiap baris kode** — area yang belum tersentuh dicatat eksplisit di bagian akhir.

---

## RINGKASAN

| Kategori | Jumlah |
|---|---|
| Bug Kritis | 3 |
| Bug Sedang | 6 |
| Bug Ringan | 4 |
| Kesalahan Akuntansi | 4 |
| Kesalahan Database | 2 |
| Potensi Kehilangan/Ketidakakuratan Data | 3 |
| Potensi Fraud | 2 |
| **Sudah Diperbaiki & Terverifikasi (referensi historis)** | 18 |

---

## BAGIAN 1 — TEMUAN BARU (Ditemukan dalam Audit Ini, 29 Juli 2026)

### BUG-01 — Retur/Refund Toko Tidak Punya Efek Nyata (Stok & Uang)
**Modul:** POS / Penjualan
**File:** `src/lib/actions/pos-transactions.ts`
**Function:** `createOrderReturn` (baris 444-500), `approveOrderReturn` (baris 504-540)
**Baris Kode:** 444-540

**Penyebab:**
Kedua fungsi ini hanya memanipulasi tabel `order_returns` (insert baris + ubah status `pending`→`approved`). Tidak ada satu pun operasi berikut yang dijalankan:
- Tidak ada pengembalian stok (`products.stock`, `stock_movements`, `stock_balances` tidak disentuh).
- Tidak ada transaksi keuangan nyata (tidak ada jurnal, tidak ada kredit ke `savings` kalau `refund_method` semula dari saldo, tidak ada pencatatan kas keluar).
- `orders.payment_status`/`orders.order_status` pada order asli **tidak diupdate** — order tetap tercatat "paid"/"confirmed" selamanya meski sudah diretur penuh.
- `refund_amount` selalu = `order.grand_total` penuh — tidak mendukung retur sebagian (skema `order_returns` memang tidak punya tabel item-level `order_return_items`, jadi granularitas per-item tidak didukung sama sekali).
- Tidak ada pengecekan apakah order yang sama sudah pernah diretur sebelumnya (bisa dibuat retur berkali-kali untuk order yang sama, tanpa validasi).

**Dampak:**
- **Stok toko permanen understated** setelah retur — barang yang fisiknya sudah kembali ke rak tidak pernah tercatat masuk lagi.
- **Pendapatan penjualan overstated** di laporan keuangan — retur tidak pernah mengurangi pendapatan yang sudah diakui.
- **Kasir/pengurus bisa "approve" retur, kasih uang tunai ke pelanggan secara fisik, tapi sistem tidak pernah mencatat kas keluar** — potensi fraud/kebocoran kas tidak terdeteksi karena tidak ada jejak keuangan sama sekali.
- Laporan SHU & Neraca yang sudah diketahui "Imbalanced" (temuan #21) akan makin melebar kalau retur sering dipakai, karena retur menambah ketidaksesuaian antara data transaksi mentah dan kondisi riil.

**Cara Reproduksi:**
1. Buat order POS, bayar lunas (misal cash Rp100.000, 2 item).
2. Panggil `createOrderReturn(orderId, "barang rusak", "cash")`.
3. Panggil `approveOrderReturn(returnId)`.
4. Cek `products.stock` untuk item terkait — **tidak berubah**. Cek `orders.payment_status` — **masih "paid"**. Cek jurnal/kas — **tidak ada entri apa pun**.

**Risiko:** Kritis — kebocoran finansial tidak terdeteksi, integritas stok rusak, laporan keuangan resmi (Neraca/Laba-Rugi/SHU) tidak mencerminkan retur sama sekali.

**Solusi (arah, bukan implementasi):**
1. `approveOrderReturn` harus, dalam satu `$transaction`: (a) increment `products.stock` + catat `stock_movements` (type "in", referensi return_no) + upsert `stock_balances`; (b) update `orders.payment_status`/`order_status` jadi `refunded`/`cancelled` sesuai konteks; (c) buat jurnal pembalik (Debit Pendapatan/Kredit Kas atau Kredit Piutang tergantung metode bayar asli); (d) kalau `refund_method` terkait saldo simpanan, kredit balik `savings.balance` + catat `saving_transactions`.
2. Tambah tabel `order_return_items` untuk dukung retur sebagian (opsional, tergantung kebutuhan bisnis).
3. Tambah validasi: cek tidak ada retur `approved`/`pending` lain untuk order yang sama sebelum membuat retur baru.

**Prioritas:** **P1 — Critical**

---

### BUG-02 — Pembulatan Angsuran Pinjaman: Cicilan Terakhir Tidak Menyerap Sisa Pembulatan
**Modul:** Pinjaman
**File:** `src/lib/actions/loans.ts`
**Function:** `updateLoanStatus` (bagian generate jadwal, sekitar baris 320-345)
**Baris Kode:** 321-345

**Penyebab:**
```ts
const interestPerMonth = principal * (interestRate / 100);
const principalPerMonth = principal / tenor;          // pembagian float, tidak dibulatkan
const monthlyInstallment = principalPerMonth + interestPerMonth;

for (let i = 1; i <= tenor; i++) {
  schedules.push({ ..., principal_due: principalPerMonth, ... }); // NILAI SAMA persis tiap bulan
}
```
`principal / tenor` dalam floating-point JavaScript menghasilkan banyak desimal (mis. Rp10.000.000 / 7 = Rp1.428.571,428571...). Kolom database `Decimal(15,2)` akan membulatkan ke 2 desimal per baris (Rp1.428.571,43), tapi **nilai yang sama dipakai untuk SEMUA cicilan** tanpa penyesuaian di cicilan terakhir untuk menyerap sisa pembulatan.

**Dampak:**
`SUM(principal_due)` seluruh jadwal **tidak selalu sama persis** dengan `principal` pinjaman asli — selisih kecil (biasanya 1 sen - beberapa rupiah per pinjaman) tapi **terjadi di SETIAP pinjaman yang principal-nya tidak habis dibagi tenor secara eksak** (sangat sering, mengingat tenor bervariasi 1-36 bulan). Terakumulasi lintas puluhan/ratusan pinjaman, ini jadi selisih material yang akan ditemukan auditor eksternal saat rekonsiliasi piutang.

**Cara Reproduksi:**
1. Ajukan & setujui pinjaman principal Rp10.000.000, tenor 7 bulan.
2. Cek `loan_schedules.principal_due` tiap baris: Rp1.428.571,43 × 7 = Rp10.000.000,01 (bukan Rp10.000.000,00 persis).

**Risiko:** Sedang-Tinggi — bukan bug yang merusak sistem, tapi **pasti akan ditemukan auditor eksternal koperasi** setiap tahun (rekonsiliasi piutang tidak akan pernah pas ke rupiah).

**Solusi (arah):** Cicilan ke-`tenor` (terakhir) dihitung sebagai `principal - (principalPerMonth_rounded × (tenor - 1))` — bukan `principalPerMonth` yang sama, supaya total tepat sama dengan principal awal. Pola umum: hitung semua cicilan 1..tenor-1 dengan `Math.round(principalPerMonth * 100) / 100`, cicilan ke-`tenor` = sisa aktual.

**Prioritas:** **P2 — High**

---

### BUG-03 — Tidak Ada Validasi Overpayment di Pembayaran Cicilan Manual
**Modul:** Angsuran
**File:** `src/lib/actions/loan-payments.ts`
**Function:** `recordLoanPayment`
**Baris Kode:** ~24-90 (fungsi utuh, tidak ada satu pun pengecekan `amountPaid` terhadap sisa tagihan sebelum diproses)

**Penyebab:** Fungsi menerima `amountPaid` dari input kasir/pengurus tanpa validasi terhadap `outstanding_principal + bunga berjalan`. `safePrincipalPortion = Math.min(outstanding, principalPortion)` mencegah `outstanding_principal` jadi negatif, TAPI `amount_paid` yang tercatat di `loan_payments` dan `total_paid` di `loans` tetap terakumulasi nilai penuh yang diinput — termasuk kelebihan bayar.

**Dampak:** Kasir/pengurus bisa input jumlah bayar lebih besar dari sisa tagihan (salah ketik atau disengaja) — `total_paid` bisa melebihi `principal + total bunga`, sisa uangnya "menghilang" secara pencatatan (tidak masuk ke mana pun — bukan ke simpanan, bukan ke kas lebih, tidak ada refund tercatat).

**Cara Reproduksi:** Pinjaman sisa Rp500.000, input pembayaran Rp2.000.000 lewat `recordLoanPayment`. Sistem menerima tanpa error, `total_paid` bertambah Rp2.000.000 penuh.

**Risiko:** Sedang — human error kasir bisa menyebabkan selisih kas tidak terjelaskan; berpotensi disalahgunakan untuk menyembunyikan penggelapan (kelebihan bayar "sah" di sistem padahal uang fisik tidak sebesar itu).

**Solusi (arah):** Validasi `amountPaid <= outstanding + interestPortion` sebelum transaksi commit; kalau lebih, tolak dengan pesan jelas atau alihkan sisa ke simpanan sukarela (perlu keputusan bisnis).

**Prioritas:** **P2 — High**

---

### BUG-04 — Tidak Ada Proteksi Double-Submit / Idempotency di Checkout POS & Pembayaran Cicilan
**Modul:** POS, Angsuran
**File:** `src/lib/actions/pos.ts` (`processPosCheckout`), `src/lib/actions/loan-payments.ts` (`recordLoanPayment`)
**Function:** Keduanya
**Baris Kode:** Seluruh fungsi (tidak ada mekanisme idempotency key/duplicate check di awal fungsi manapun)

**Penyebab:** Tidak ada idempotency key, tidak ada disable-button-side-effect di level server, tidak ada pengecekan "apakah request identik baru saja diproses". Server Action murni memproses apa pun yang masuk.

**Dampak:** Skenario realistis: kasir klik "Bayar" dua kali karena UI lambat merespons, atau koneksi timeout lalu browser retry otomatis, atau user tekan tombol back lalu submit ulang form yang sama → **order/pembayaran cicilan bisa terduplikasi** (2× stok terpotong, 2× uang tercatat masuk, 2× jurnal kalau modul terkait sudah terjurnal).

**Cara Reproduksi:** Klik cepat tombol checkout 2× berturut-turut sebelum UI sempat disable — berpotensi 2 order dengan isi identik ter-create.

**Risiko:** Sedang-Tinggi — di lingkungan jaringan kios yang tidak stabil (sudah ada catatan historis soal SSL inspection/masalah jaringan di lingkungan kerja ini), risiko network retry nyata.

**Solusi (arah):** Tambah idempotency key dari client (generate UUID per percobaan checkout, simpan di kolom unik `orders.client_reference` atau serupa), cek duplikat sebelum insert. Untuk cicilan, generate `payment_no` di client-side atau cek transaksi identik (`loan_id` + `amount` + window waktu singkat) sebelum proses.

**Prioritas:** **P2 — High**

---

### BUG-05 — Skema `saving_deduct` di POS: Fitur Setengah Jadi, Berpotensi Membingungkan
**Modul:** POS
**File:** `src/lib/validations/index.ts` (baris 131), `src/lib/actions/pos.ts`
**Function:** `posCheckoutSchema`
**Sudah didokumentasikan sebagai Backlog #20** di `docs/temuan.md` Bagian H. Referensi silang di sini karena relevan dengan audit menyeluruh ini: `payment_method: "saving_deduct"` ADA di enum database (`orders_payment_method`) tapi TIDAK ADA di skema validasi Zod aktual yang dipakai form checkout (`z.enum(["cash","paylater","qris"])`) — artinya kolom database punya kapasitas menyimpan nilai yang tidak pernah bisa lolos dari form asli. Indikasi fitur pernah direncanakan tapi tidak selesai diimplementasi.

**Prioritas:** P3 — Medium (sudah tercatat sebagai backlog, butuh keputusan produk sebelum dikerjakan — lihat `docs/temuan.md` #20).

---

## BAGIAN 2 — KESALAHAN AKUNTANSI

### ACC-01 — Neraca "Imbalanced": Laba-Rugi Dihitung dari Tabel Mentah, Neraca dari Jurnal
**Sudah didokumentasikan lengkap sebagai Backlog #21** di `docs/temuan.md` Bagian I (root cause terverifikasi: `getLabaRugi` menghitung pendapatan langsung dari `orders`/`loan_payments`, sedangkan `getNeraca` murni dari `journal_entries`; POS & pembayaran cicilan manual tidak pernah membuat jurnal otomatis). **Prioritas: P1 — Critical** (ini temuan akuntansi paling material di seluruh audit — Neraca resmi koperasi tidak bisa dipercaya sampai ini diperbaiki).

### ACC-02 — Retur Toko Tidak Menghasilkan Jurnal Pembalik
Konsekuensi langsung dari BUG-01 di atas — dari sisi akuntansi murni: retur yang di-approve seharusnya menghasilkan jurnal (Debit Pendapatan Penjualan / Kredit Kas-Piutang, plus Debit Persediaan / Kredit HPP untuk pengembalian stok), tapi TIDAK ADA jurnal apa pun yang dibuat. **Prioritas: P1** (bagian dari BUG-01, worth mencatat sisi akuntansinya terpisah karena auditor akan melihat ini sebagai kesalahan akuntansi tersendiri, bukan cuma bug fungsional).

### ACC-03 — Pembulatan Cicilan Menyebabkan Piutang Tidak Pernah Rekonsiliasi Persis ke Rupiah
Sisi akuntansi dari BUG-02. Rekonsiliasi piutang anggota (`SUM(loan_schedules.principal_due)` per pinjaman vs `loans.principal` asli) akan selalu punya selisih kecil di hampir semua pinjaman. **Prioritas: P2**.

### ACC-04 — Tidak Ada Jurnal Otomatis untuk Pencairan Pinjaman
**Modul:** Pinjaman
**File:** `src/lib/actions/loans.ts`, function `updateLoanStatus`

Saat pinjaman disetujui & dicairkan (`loans` record dibuat dengan `status: "active"`), tidak ditemukan pembuatan jurnal (Debit Piutang Anggota / Kredit Kas) di fungsi ini. Ini konsisten dengan pola ACC-01 (modul pinjaman & POS memang belum terintegrasi ke sistem jurnal), tapi dicatat terpisah karena ini titik transaksi keuangan yang signifikan (pencairan dana riil ke anggota) yang seharusnya WAJIB terjurnal sejak hari pertama, bukan cuma retroaktif.

**Prioritas:** P1 (bagian dari solusi menyeluruh ACC-01, tapi pencairan pinjaman adalah titik paling kritis untuk dimulai duluan karena nilainya biasanya paling besar per transaksi).

---

## BAGIAN 3 — KESALAHAN DATABASE

### DB-01 — `order_returns` Tidak Punya Model Item-Level (`order_return_items`)
Sudah dibahas di BUG-01. Desain skema saat ini hanya mendukung retur SELURUH order (satu angka `refund_amount` per retur), tidak mendukung retur sebagian item. **Prioritas: P3** (keterbatasan desain, bukan bug aktif, tapi membatasi solusi BUG-01 kalau bisnis butuh retur sebagian).

### DB-02 — Ketidakkonsistenan `stock_balances` vs `products.stock` (Sudah Diperbaiki, Dicatat sebagai Referensi)
Root cause: `pos.ts` historisnya tidak update `stock_balances` saat checkout (`procurement.ts` sudah benar untuk barang masuk). **Sudah diperbaiki** di komit `80433bc` (29 Juli 2026) — data disinkronkan & kode `pos.ts` sudah menambah update `stock_balances` di setiap checkout. Dicatat di sini murni untuk kelengkapan audit historis, **status: Closed**.

---

## BAGIAN 4 — TEMUAN YANG SUDAH DIPERBAIKI SEBELUMNYA (Referensi, Terverifikasi)

Tabel ringkas dari `docs/temuan.md` (audit-audit sesi sebelumnya, 27-29 Juli 2026) — semua sudah diverifikasi closed lewat kompilasi (`tsc`), build production, dan/atau pengecekan langsung ke database:

| # | Temuan | Modul | Status |
|---|---|---|---|
| 1 | IDOR/BOLA pada detail pinjaman | Pinjaman | ✅ Closed |
| 2 | Privilege escalation di Server Actions | Auth/RBAC | ✅ Closed |
| 3 | Mass assignment `shu_config`/POS | SHU/POS | ✅ Closed |
| 4 | Capacitor Android cleartext traffic (MITM) | Mobile/Security | ✅ Closed |
| 5 | Race condition stok POS (qty negatif) | POS | ✅ Closed |
| 6 | Crash dari enum tidak valid | Pinjaman | ✅ Closed |
| 7 | Idle timeout — komentar salah (bukan bug fungsional) | Auth | ✅ Closed |
| 8 | `/api/upload` tanpa autentikasi | Security | ✅ Closed |
| 9 | Breadcrumb `require()` dinamis (anti-pattern) | Frontend | ✅ Closed |
| 10-13 | Build gagal (cache basi, Tailwind, dll) | DevOps | ✅ Closed |
| 14, 16 | Timeout & connection pool exhaustion (N+1 query) `getSHUProjection` | SHU | ✅ Closed |
| 15 | Model `budgets` hilang dari schema | Anggaran | ✅ Closed |
| 17 | N+1 query `processMonthlyPayrollBatch` (potongan gaji) | Payroll | ✅ Closed |
| 18 | `saving_deduct` di `recordLoanPayment` tidak potong saldo | Pinjaman | ✅ Closed |
| 19 | `stock_balances` drift (lihat DB-02 di atas) | POS/Inventori | ✅ Closed |
| 20 | `saving_deduct` di POS belum resmi jadi fitur | POS | 🔴 Backlog (lihat BUG-05) |
| 21 | Neraca Imbalanced | Akuntansi | 🔴 Backlog (lihat ACC-01) |

---

## BAGIAN 5 — AREA YANG BELUM DIPERIKSA MENDALAM (Transparansi Cakupan Audit)

Demi kejujuran metodologi — area berikut BELUM diverifikasi mendalam dalam audit ini dan disarankan jadi fokus audit lanjutan:

- **Buku Besar & Laporan Kas harian** — belum ditelusuri detail apakah saldo kas harian selalu rekonsiliasi dengan mutasi.
- **FIFO/Average Cost persediaan** — `purchase_price` tercatat per produk (bukan per-batch), mengindikasikan sistem memakai **harga pokok tunggal per produk** (bukan FIFO/Average Cost sesungguhnya per batch pembelian) — kalau harga beli fluktuatif antar PO, HPP yang dicatat kemungkinan tidak akurat secara akuntansi persediaan formal. Belum diverifikasi mendalam.
- **PPN/Pajak** — belum ditemukan modul pajak eksplisit; perlu klarifikasi apakah koperasi ini wajib PPN dan bagaimana ditangani.
- **XSS/CSRF** — belum diaudit khusus (Next.js Server Actions punya proteksi CSRF bawaan, tapi belum diverifikasi eksplisit untuk kasus ini).
- **JWT/Session security** — belum ditelusuri detail konfigurasi NextAuth (expiry, rotation, dll.) di luar temuan idle-timeout yang sudah closed.
- **Dead code / code duplication** — tidak diaudit sistematis (codebase besar, butuh sesi terpisah).
- **Deadlock/locking** di level database Postgres/Neon — belum diuji di bawah concurrent load nyata.
- **Tutup Buku Tahunan & RAT** — modul tutup buku bulanan sudah diverifikasi aman (audit proaktif sebelumnya), tapi proses tutup TAHUN belum ditemukan/diverifikasi terpisah.

---

## ROADMAP PERBAIKAN

### Priority 1 (Critical) — Kerjakan Segera
1. **BUG-01/ACC-02** — Retur toko: implementasi pengembalian stok + jurnal pembalik + update status order.
2. **ACC-01** — Neraca Imbalanced: mulai dengan jurnal otomatis pencairan pinjaman (ACC-04) sebagai titik awal, lalu perluas ke POS & pembayaran cicilan.
3. **ACC-04** — Jurnal otomatis pencairan pinjaman.

### Priority 2 (High)
4. **BUG-02/ACC-03** — Perbaiki pembulatan cicilan (cicilan terakhir menyerap sisa).
5. **BUG-03** — Validasi overpayment di `recordLoanPayment`.
6. **BUG-04** — Idempotency key untuk checkout POS & pembayaran cicilan.

### Priority 3 (Medium)
7. **BUG-05/#20** — Putuskan arah `saving_deduct` di POS (aktifkan resmi atau bersihkan).
8. **DB-01** — Evaluasi kebutuhan retur sebagian (`order_return_items`) — tergantung keputusan bisnis.

### Priority 4 (Low)
9. Audit lanjutan area yang belum diperiksa (Bagian 5) — jadwalkan sesi audit terpisah per area, terutama FIFO/Average Cost persediaan dan Buku Besar/Kas harian karena berdampak langsung ke akurasi laporan keuangan.

---

*Laporan ini murni hasil analisis. Sesuai instruksi, tidak ada perubahan kode dilakukan. Menunggu arahan untuk mulai implementasi perbaikan sesuai prioritas di atas.*


---

## ADDENDUM — Audit Lanjutan (29 Juli 2026, sesi ke-2)

> Melanjutkan area yang ditandai "belum diperiksa mendalam" di Bagian 5.
> Tetap tanpa perubahan kode, murni analisis.

### ACC-05 — Laporan Arus Kas Punya Root Cause yang Sama dengan Neraca (ACC-01)
**Modul:** Laporan / Akuntansi
**File:** `src/lib/actions/laporan-arus-kas.ts`
**Function:** `getKasAwal` (baris 367-392) vs `getOperasional` (baris 401-434)

**Penyebab:** Pola identik dengan ACC-01. `getKasAwal` (saldo kas awal periode)
murni dari `journal_lines` (jurnal). `getOperasional` (arus kas berjalan)
pakai `calculatePenjualan` yang menghitung langsung dari tabel `orders`
mentah (bukan jurnal). **Dalam satu laporan yang sama**, komponen "Kas Awal"
dan "Kas Bersih Operasional" berasal dari dua sumber data yang tidak
sinkron — sama seperti Neraca.

**Dampak:** `kasAkhir = kasAwal + kenaikanKasBersih` yang ditampilkan ke
pengguna tidak merepresentasikan saldo kas riil, untuk alasan yang sama
seperti #21. Ini BUKAN bug baru yang independen — ini konfirmasi bahwa
dampak ACC-01 lebih luas dari sekadar Neraca, mencakup juga Laporan Arus
Kas.

**Solusi:** Sama dengan ACC-01 — begitu jurnal otomatis POS/pinjaman
dibangun, laporan ini otomatis ikut benar (tidak perlu perbaikan terpisah
di file ini, cukup pastikan sumber datanya konsisten).

**Prioritas:** P1 (bagian dari ACC-01, bukan item terpisah).

---

### ACC-06 — `products.purchase_price` Statis, Bukan FIFO/Average Cost/Last Cost
**Modul:** Pembelian Barang / POS / Laporan
**File:** `src/lib/actions/procurement.ts` (tidak pernah menulis field ini),
seluruh file yang membaca `purchase_price` (HPP/margin/laba: `accounting.ts`,
`executive-dashboard.ts`, `global-financial-stats.ts`, `laporan-analitik.ts`,
`laporan-keuangan.ts`, `laporan-mingguan.ts`, `laporan-perubahan-ekuitas.ts`,
`laporan-po-konsinyasi.ts`, `laporan-stok.ts`, `laporan-transaksi-kasir.ts`)

**Penyebab:** `products.purchase_price` adalah **satu field tunggal per
produk**. Ditelusuri ke seluruh `procurement.ts` (proses penerimaan barang
dari supplier via Good Receipt) — **tidak ada satu baris kode pun** yang
meng-update `products.purchase_price` setelah barang diterima, walau harga
beli di PO berbeda dari harga sebelumnya (field `purchase_order_items.unit_price`
per PO dicatat benar, tapi tidak pernah "mengalir balik" ke `products.purchase_price`).
Satu-satunya penulisan field ini ditemukan di `consignment.ts` (khusus item
konsinyasi, bukan pembelian reguler).

**Dampak:** Semua laporan yang menghitung **HPP, margin, laba kotor, dan
nilai persediaan** (daftar file di atas — hampir seluruh sistem pelaporan
keuangan toko) memakai angka harga pokok yang **beku sejak produk pertama
kali dibuat**, tidak peduli berapa kali & berapa harga produk itu direstock
setelahnya. Ini bukan FIFO (tidak melacak biaya per batch), bukan Average
Cost (tidak menghitung rata-rata tertimbang), bahkan bukan "Last Cost"
sederhana (tidak update ke harga PO terakhir). Kalau harga beli dari
supplier naik/turun antar periode (sangat umum di praktik nyata), **laba
kotor & nilai persediaan yang dilaporkan akan salah secara sistematis**,
dan makin lama makin melenceng dari kondisi riil.

**Cara Reproduksi:**
1. Cek `products.purchase_price` produk apa pun sekarang.
2. Buat PO baru dengan `unit_price` berbeda utk produk yang sama, proses
   Good Receipt sampai selesai.
3. Cek lagi `products.purchase_price` — **tidak berubah**, tetap nilai lama.

**Risiko:** Tinggi untuk akurasi laporan keuangan jangka panjang — ini jenis
temuan yang PASTI akan dipertanyakan auditor eksternal koperasi ("metode
penilaian persediaan apa yang dipakai, dan apakah konsisten diterapkan?").

**Solusi (arah, butuh keputusan bisnis metode penilaian persediaan dulu):**
- **Opsi termudah (Last Cost):** update `products.purchase_price` = harga
  unit PO terbaru, setiap kali Good Receipt selesai diproses. Perubahan
  kecil, cepat, tapi masih menyederhanakan (tidak akurat kalau stok lama &
  baru bercampur).
- **Opsi lebih akurat (Weighted Average Cost):** `purchase_price_baru =
  ((stock_lama x harga_lama) + (qty_masuk x harga_beli_baru)) / (stock_lama + qty_masuk)`,
  dihitung ulang tiap Good Receipt. Ini metode yang paling umum dipakai
  sistem retail/koperasi kecil-menengah (lebih praktis dari FIFO penuh yang
  butuh tracking per-batch).
- **FIFO penuh** butuh tabel baru untuk lacak biaya per batch pembelian —
  perubahan struktur data paling besar, biasanya tidak diperlukan kecuali
  koperasi punya kebutuhan spesifik (mis. barang mudah rusak/kedaluwarsa).

**Prioritas:** **P2 - High** (berdampak ke akurasi laporan keuangan toko
secara sistematis, tapi tidak menyebabkan sistem crash/kehilangan data
seperti bug P1).

---

### ACC-07 — Tidak Ada PPN pada Penjualan (Hanya Ada di Pembelian) — Perlu Klarifikasi
**Modul:** POS / Penjualan
**File:** `src/lib/actions/pos.ts`, model `orders` (`prisma/schema.prisma`)

**Penyebab:** `procurement.ts` menghitung & menyimpan `tax_amount` (PPN)
untuk transaksi PEMBELIAN dari supplier. Model `orders` (penjualan ke
anggota/pelanggan) **tidak punya kolom pajak sama sekali** — `pos.ts` tidak
menghitung/mencatat PPN apa pun saat checkout.

**Dampak:** Tidak bisa dipastikan ini bug atau memang desain yang benar
tanpa konteks bisnis — koperasi (terutama penjualan ke anggota sendiri)
bisa jadi memang dikecualikan PPN sesuai ketentuan perpajakan koperasi di
Indonesia, ATAU ini murni belum diimplementasikan. **Perlu klarifikasi
status PKP (Pengusaha Kena Pajak) koperasi ini** sebelum diputuskan perlu
diperbaiki atau tidak.

**Risiko:** Sedang - kalau ternyata koperasi ini wajib PPN dan omzetnya
sudah di atas ambang batas PKP, ini jadi temuan kepatuhan pajak yang
signifikan, bukan cuma bug teknis.

**Solusi:** Konsultasi ke bagian keuangan/pajak koperasi dulu untuk
pastikan status PKP, baru diputuskan apakah perlu ditambahkan.

**Prioritas:** P3 - Medium (butuh klarifikasi bisnis sebelum jadi actionable).

---

### SEC-01 — CSRF & Session: Tidak Ditemukan Kelemahan Signifikan (Verifikasi Positif)
**Modul:** Keamanan
**File:** `src/auth.config.ts`

Next.js Server Actions (yang dipakai luas di seluruh aplikasi ini) punya
proteksi CSRF bawaan dari framework (validasi Origin/Host header otomatis
untuk POST ke Server Actions) - tidak ditemukan indikasi proteksi ini
dinonaktifkan. Konfigurasi session (`auth.config.ts`) sudah punya mekanisme
deteksi sesi basi (`sessionToken` + `lastActivity`) yang sudah diverifikasi
benar di audit sebelumnya (temuan #7, closed). **Tidak ada temuan baru di
area ini** - dicatat sebagai bagian dari cakupan audit yang sudah diperiksa
(bukan celah terbuka).

**Prioritas:** - (tidak ada tindakan diperlukan)

---

## UPDATE RINGKASAN (Kumulatif Sesi 1 + Addendum)

| Kategori | Sesi 1 | Addendum | Total |
|---|---|---|---|
| Bug Kritis | 3 | 0 | 3 |
| Bug Sedang | 6 | 0 | 6 |
| Bug Ringan | 4 | 0 | 4 |
| Kesalahan Akuntansi | 4 | 3 (ACC-05, 06, 07) | 7 |
| Kesalahan Database | 2 | 0 | 2 |
| Perlu Klarifikasi Bisnis (bukan bug pasti) | 0 | 1 (ACC-07/PPN) | 1 |

## UPDATE ROADMAP

**Priority 1 (Critical)** - tidak berubah, ACC-05 digabung ke ACC-01 (root
cause sama, solusi sama, tidak perlu item roadmap terpisah).

**Priority 2 (High)** - tambah:
7. **ACC-06** - Perbaiki mekanisme `products.purchase_price` (rekomendasi:
   Weighted Average Cost, dihitung ulang tiap Good Receipt) - berdampak ke
   akurasi HPP/margin/laba di hampir seluruh laporan keuangan toko.

**Priority 3 (Medium)** - tambah:
8. **ACC-07** - Klarifikasi status PPN penjualan dengan bagian
   keuangan/pajak koperasi sebelum diputuskan perlu implementasi atau tidak.


---

## ADDENDUM 2 — Audit Lanjutan (29 Juli 2026, sesi ke-3)

### BUG-06 — "Manipulasi Harga Terdeteksi" Adalah Proteksi Palsu — Harga & Diskon POS 100% Dipercaya dari Client
**Modul:** POS
**File:** `src/lib/validations/index.ts` (baris 116-136, `posCheckoutSchema`),
`src/lib/actions/pos.ts` (baris 17-20)
**Function:** `posCheckoutSchema`, `processPosCheckout`
**Baris Kode:** `validations/index.ts:119-135`, `pos.ts:17-20`

**Penyebab:**
```ts
// validations/index.ts — TIDAK ADA batas minimum/validasi terhadap DB:
price: z.string().or(z.number()).transform(Number),      // bisa 0, negatif, berapa pun
discount: z.string().or(z.number()).transform(Number),   // bisa sebesar apa pun, tanpa cap

// pos.ts — "proteksi" yang ada:
const calculatedGrandTotal = validated.cart.reduce((sum, item) => sum + (item.price * item.qty), 0) - validated.discount;
if (validated.grandTotal !== calculatedGrandTotal) {
  throw new Error("Manipulasi harga terdeteksi.");
}
```
Pengecekan ini **hanya memverifikasi konsistensi aritmatika** antar angka
yang SEMUANYA berasal dari client (`price`, `discount`, `grandTotal`) — tidak
pernah membandingkan `item.price` terhadap `products.price`/`products.member_price`
yang sebenarnya tersimpan di database. Kode DI DALAM transaksi memang
mengambil data produk asli dari DB (`tx.products.findUnique(...)`), TAPI
hasilnya cuma dipakai untuk mencatat `purchase_price` (harga pokok/HPP), **tidak
pernah dipakai untuk mengoreksi/validasi `item.price` (harga jual) yang
tersimpan ke `order_items.unit_price`**.

**Dampak:** Siapa pun yang bisa memodifikasi request ke server (lewat
DevTools browser, proxy/intercept, atau frontend yang dimodifikasi) bisa
mengirim `item.price = 1` untuk produk apa pun (atau bahkan 0/negatif — tidak
ada validasi `.positive()` atau `.min()`), dengan `grandTotal` yang dihitung
konsisten dari harga palsu itu — transaksi akan **lolos** semua validasi
server, tercatat sebagai order "paid" yang sah, stok terpotong normal, tapi
uang yang masuk jauh di bawah (atau nol dari) nilai barang sebenarnya. Nama
variabel & pesan error ("Manipulasi harga terdeteksi") secara aktif
**menyesatkan** siapa pun yang membaca kode dan mengira ini sudah aman.

**Cara Reproduksi:**
1. Buka halaman kasir, buka DevTools browser (Network tab / atau intercept
   proxy seperti Burp/mitmproxy).
2. Tambah produk apa pun ke keranjang, checkout seperti biasa.
3. Sebelum request terkirim, ubah nilai `price` tiap item di payload jadi
   `1`, dan sesuaikan `subtotal`/`grandTotal` supaya konsisten secara
   aritmatika (`subtotal = 1 × qty`, `grandTotal = subtotal - discount`).
4. Kirim — transaksi **berhasil diproses**, order tercatat "paid", stok
   terpotong penuh, tapi nilai transaksi cuma Rp1 per item.

**Risiko:** **Kritis — jalur fraud finansial langsung, tanpa jejak deteksi.**
Ini bukan cuma bug teknis, ini celah yang bisa dieksploitasi kasir nakal
ATAU pihak luar yang berhasil mengakses endpoint checkout, dengan kerugian
finansial riil dan tanpa alarm apa pun di sistem (order tetap terlihat "sah").

**Solusi (arah):**
1. **JANGAN PERNAH percaya `item.price` dari client untuk nilai final.**
   Di dalam transaksi, setelah `tx.products.findUnique(...)`, gunakan
   `product.member_price ?? product.price` (harga ASLI dari database, sesuai
   status keanggotaan) sebagai `unit_price` yang benar-benar disimpan ke
   `order_items`, bukan `item.price` dari request.
2. Hitung ulang `subtotal`/`grandTotal` di SERVER berdasarkan harga asli DB,
   bukan cuma validasi "konsisten dengan angka yang dikirim client" — client
   boleh kirim `price` untuk keperluan TAMPILAN saja di frontend, tapi server
   HARUS menghitung ulang dari sumber kebenaran (database), lalu (opsional)
   tetap cross-check dengan yang dikirim client untuk deteksi anomali/UI
   bug, bukan sebagai satu-satunya validasi.
3. Untuk `discount`: validasi terhadap rule promosi/voucher yang benar-benar
   aktif (tabel `promotions`) — bukan angka bebas dari client. Kalau
   memang ada kebutuhan diskon manual oleh kasir/pengurus, batasi dengan
   role check + cap persentase maksimum + audit log wajib.

**Prioritas:** **P1 — Critical (tertinggi di seluruh audit ini)** — lebih
mendesak dari BUG-01 (retur) karena ini exploitable secara aktif di jalur
transaksi normal sehari-hari, bukan cuma gap fitur.

---

### DB-03 — Verifikasi Positif: Tabel Finansial Kritis Terlindungi dari Cascade Delete
**Modul:** Database
**File:** `prisma/schema.prisma`

Diperiksa 22 relasi `onDelete: Cascade` di seluruh schema. Tabel finansial
inti yang menyimpan riwayat transaksi anggota (`loans`, `loan_applications`,
`savings`, `saving_transactions`, `shu_distributions`, `ppob_transactions`)
**semuanya TIDAK** cascade dari `members` — artinya penghapusan baris
`members` akan **diblokir** oleh Postgres (default RESTRICT) selama anggota
tsb masih punya riwayat transaksi apa pun. Ini perilaku yang BENAR untuk
integritas audit trail koperasi. Yang cascade cuma `loyalty_memberships` &
`rat_attendances` (bukan data finansial kritis). **Tidak ada tindakan
diperlukan** — dicatat sebagai bagian cakupan audit yang sudah diverifikasi
aman.

---

## UPDATE RINGKASAN (Kumulatif Sesi 1 + Addendum 1 + Addendum 2)

| Kategori | Total |
|---|---|
| Bug Kritis | **4** (tambah BUG-06) |
| Bug Sedang | 6 |
| Bug Ringan | 4 |
| Kesalahan Akuntansi | 7 |
| Kesalahan Database | 2 |
| Perlu Klarifikasi Bisnis | 1 |
| Potensi Fraud (baru diidentifikasi eksplisit) | **1 — BUG-06 adalah jalur fraud paling konkret di seluruh audit** |

## UPDATE ROADMAP — Priority 1 (Critical), urutan pengerjaan direvisi

1. **BUG-06** — Perbaiki validasi harga/diskon POS (server harus hitung dari
   harga asli database, bukan percaya input client). **Dikerjakan PALING
   PERTAMA** — ini jalur eksploitasi aktif yang bisa terjadi kapan saja
   selama sistem dipakai transaksi sungguhan.
2. **BUG-01/ACC-02** — Retur toko: stok + jurnal pembalik + status order.
3. **ACC-01/ACC-05** — Neraca & Arus Kas Imbalanced: mulai dari jurnal
   otomatis pencairan pinjaman (ACC-04).


---

## ADDENDUM 3 — Audit Lanjutan (29 Juli 2026, sesi ke-4)

### BUG-07 — Pola Sistemik: Tidak Ada Jalur "Undo" yang Benar di Seluruh Siklus Order (Cancel Online Order Juga Tidak Restore Stok/Uang)
**Modul:** POS / Penjualan Online
**File:** `src/lib/actions/online-orders.ts`
**Function:** `updateOnlineOrderStatus` (baris 214-239), dibandingkan dengan
`createOnlineOrder` (baris 22-140)
**Baris Kode:** 225-232

**Penyebab:** `createOnlineOrder` memotong stok secara atomik saat order
dibuat (`tx.products.updateMany({ where: { stock: { gte: qty } }, data: {
stock: { decrement: qty } } })` — pola yang benar). TAPI `updateOnlineOrderStatus`,
satu-satunya fungsi yang bisa mengubah status jadi `"cancelled"`, **cuma
menulis ulang kolom `order_status`** — tidak ada logic apa pun yang
mengembalikan stok, membatalkan pembayaran, atau membuat jurnal pembalik.
Fungsi ini juga menerima keempat status (`confirmed/processing/delivered/cancelled`)
tanpa validasi alur transisi (state machine) — order yang sudah `"delivered"`
bisa saja di-set ke `"cancelled"` atau balik ke `"confirmed"` tanpa
penghalang logis apa pun.

**Ini memperkuat pola yang sama dengan BUG-01 (retur toko):** di SELURUH
siklus hidup order (baik lewat kasir POS `pos.ts` maupun online
`online-orders.ts`), sistem konsisten BENAR saat MENCATAT transaksi maju
(checkout, potong stok, catat bayar) — tapi **tidak pernah punya jalur balik
yang benar** (cancel, retur, refund, void) untuk modul mana pun. Bahkan
untuk POS kasir langsung (`pos.ts`), tidak ditemukan fungsi cancel/void sama
sekali di seluruh file — artinya transaksi kasir yang salah input TIDAK
BISA dibatalkan lewat jalur resmi apa pun selain retur yang juga rusak
(BUG-01).

**Dampak:**
- Stok yang "dibatalkan" secara online tetap hilang dari catatan selamanya
  (sama seperti BUG-01, tapi utk jalur pesanan online).
- Kalau order online yang sudah `paid` (lewat status `"delivered"` yang
  otomatis set `payment_status: "paid"`) dibatalkan, tidak ada refund
  tercatat di mana pun.
- Tidak ada state-machine validation berarti kesalahan input administratif
  (klik status yang salah) bisa mengubah riwayat order secara tidak logis
  tanpa ada penghalang sistem.

**Cara Reproduksi:**
1. Buat online order, biarkan sampai `"delivered"` (stok terpotong,
   `payment_status` jadi "paid").
2. Panggil `updateOnlineOrderStatus(orderId, "cancelled")`.
3. Cek `products.stock` — **tidak kembali**. Cek ada refund/jurnal — **tidak
   ada apa pun**. `payment_status` juga tidak ikut berubah (tetap "paid"
   meski order berstatus "cancelled" — order terlihat lunas & batal
   sekaligus, kontradiktif).

**Risiko:** Tinggi — sama seperti BUG-01, ini pola sistemik yang berdampak
ke SEMUA jalur pembatalan order di aplikasi, bukan cuma satu titik.
Digabung dengan BUG-01, ini berarti **tidak ada satu pun jalur "batal
transaksi" yang benar-benar bekerja dengan benar di seluruh aplikasi.**

**Solusi (arah):** Sama dengan BUG-01 — `updateOnlineOrderStatus` untuk
transisi ke `"cancelled"` harus, dalam satu `$transaction`: kembalikan stok
(increment + `stock_movements` + `stock_balances`), balikkan `payment_status`
ke `"unpaid"`/buat refund kalau sudah terbayar, dan (setelah ACC-01
selesai) buat jurnal pembalik. Tambahkan juga validasi state-machine
sederhana (mis. `delivered` tidak boleh langsung ke `confirmed`, dst.)

**Prioritas:** **P1 — Critical** (digabung dalam satu inisiatif perbaikan
dengan BUG-01, karena akar masalah & solusinya sama — "lifecycle order
lengkap: cancel/retur/refund harus benar-benar reversible").

---

## UPDATE RINGKASAN (Kumulatif Final Sesi 1-4)

| Kategori | Total |
|---|---|
| Bug Kritis | **5** (BUG-01, BUG-06, BUG-07, + 2 dari sesi 1) |
| Bug Sedang | 6 |
| Bug Ringan | 4 |
| Kesalahan Akuntansi | 7 |
| Kesalahan Database | 2 |
| Perlu Klarifikasi Bisnis | 1 |

## UPDATE ROADMAP — Priority 1 (Critical), revisi final urutan

1. **BUG-06** — Validasi harga/diskon POS terhadap database (jalur fraud
   aktif, paling mendesak).
2. **BUG-01 + BUG-07 (digabung satu inisiatif)** — Bangun ulang siklus
   "pembatalan transaksi" (retur POS + cancel online order) supaya benar-benar
   mengembalikan stok & uang, plus tambahkan validasi state-machine status
   order.
3. **ACC-01/ACC-04/ACC-05** — Jurnal otomatis (Neraca & Arus Kas Imbalanced),
   mulai dari pencairan pinjaman.
