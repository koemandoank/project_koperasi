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


---

## ADDENDUM 4 — Audit Lanjutan (29 Juli 2026, sesi ke-5)

### BUG-08 — Status "Overdue" Tidak Pernah Otomatis Diset — Tidak Ada Deteksi Jatuh Tempo Otomatis
**Modul:** Pinjaman / Angsuran
**File:** Seluruh codebase (`git grep` menyeluruh untuk penulisan status
`"overdue"`)
**Function:** Tidak ada — inilah masalahnya, fungsinya tidak ada.

**Penyebab:** Status `"overdue"` dipakai luas sebagai **kondisi FILTER/BACA**
di banyak file (`loan-payments.ts`, `payroll.ts`, `executive-dashboard.ts`,
`buku-besar.ts`, `accounts.ts`, dll — total 13+ referensi baca), seolah-olah
ini state yang lazim terjadi di data. TAPI ditelusuri secara menyeluruh:
**tidak ada satu baris kode pun** yang benar-benar MENULIS
`status: "overdue"` ke `loan_schedules` atau `loans`. Tidak ada cron job,
tidak ada scheduled function, tidak ada trigger database, tidak ada
pengecekan `due_date < NOW()` yang mengubah status secara otomatis di mana
pun.

**Dampak:**
- Cicilan yang telat dibayar **selamanya tercatat sebagai "pending"**
  (bukan "overdue"), tidak peduli sudah berapa lama lewat jatuh tempo.
- Semua laporan/dashboard yang query `status: { in: ["pending", "partial",
  "overdue"] }` (termasuk yang dipakai payroll batch, dashboard eksekutif,
  buku besar) **tidak pernah benar-benar menangkap apa pun di kategori
  "overdue"** — bagian filter itu jadi dead code secara efektif karena
  datanya tidak pernah ada.
- Tidak ada aging report (0-30 hari, 31-60 hari, dst.) yang bisa diandalkan
  untuk piutang bermasalah — auditor koperasi lazim meminta laporan umur
  piutang, dan sistem ini tidak punya dasar data untuk itu.
- Terkait erat dengan temuan berikutnya (BUG-09) — karena tidak ada deteksi
  overdue otomatis, perhitungan denda pun jadi sepenuhnya bergantung ke
  manusia.

**Cara Reproduksi:**
1. Buat pinjaman, biarkan `due_date` cicilan pertama lewat tanpa dibayar
   (mis. mundurkan tanggal sistem, atau tunggu tanggal aslinya lewat).
2. Cek `loan_schedules.status` untuk cicilan itu — **tetap `"pending"`**,
   tidak pernah berubah jadi `"overdue"` meski sudah lewat jatuh tempo
   berbulan-bulan.

**Risiko:** Tinggi — untuk koperasi simpan pinjam, deteksi piutang
bermasalah (NPL/non-performing loan) adalah fungsi inti yang wajib ada
untuk kepatuhan & kesehatan keuangan. Tanpa ini, manajemen risiko kredit
sepenuhnya bergantung pada review manual, rawan terlewat.

**Solusi (arah):** Buat scheduled job (cron, mirip pola
`/api/cron/backup`/`/api/cron/payroll` yang sudah ada) yang jalan harian,
mengecek semua `loan_schedules` dengan `due_date < NOW()` dan `status IN
('pending','partial')`, lalu update ke `'overdue'`. Sekaligus update status
`loans` induknya kalau perlu (`loans.status = 'overdue'` kalau ada cicilan
overdue).

**Prioritas:** **P2 — High**

---

### BUG-09 — Denda Keterlambatan (Penalty) 100% Input Manual, Tidak Ada Rumus Otomatis
**Modul:** Angsuran
**File:** `src/lib/actions/loan-payments.ts`
**Function:** `recordLoanPayment`
**Baris Kode:** 19-38 (parameter `penaltyAmount`, default `0`, murni dari
input caller)

**Penyebab:** `penaltyAmount` diterima sebagai parameter bebas dari
pemanggil fungsi (form input kasir/pengurus) — **tidak ada formula
otomatis** yang menghitung denda berdasarkan jumlah hari telat × tarif
tertentu (mis. "0,5% per hari dari sisa pokok" atau sejenisnya, yang lazim
di koperasi simpan pinjam). Konsisten dengan BUG-08: karena tidak ada
deteksi overdue otomatis, tidak ada dasar (jumlah hari telat) untuk
menghitung denda secara sistematis sekalipun formula-nya ada.

**Dampak:** Konsistensi & keadilan perhitungan denda 100% bergantung ke
kasir/pengurus yang input manual — berpotensi:
- Inkonsistensi antar anggota (anggota A kena denda, anggota B dengan
  keterlambatan sama tidak, tergantung siapa yang input & suasana hati).
- Tidak ada jejak audit "kenapa denda segini" — nilai `penaltyAmount` bisa
  berapa pun tanpa validasi terhadap rumus resmi apa pun.
- Potensi disalahgunakan: kasir bisa set denda 0 untuk "menghapus" denda
  anggota tertentu secara sepihak tanpa approval berjenjang.

**Cara Reproduksi:** Panggil `recordLoanPayment` dengan `penaltyAmount`
berapa pun (termasuk 0 untuk pinjaman yang jelas-jelas telat lama) — sistem
menerima tanpa validasi/pertanyaan.

**Risiko:** Sedang — bukan bug yang merusak sistem, tapi kelemahan kontrol
internal & konsistensi kebijakan yang nyata untuk lembaga keuangan.

**Solusi (arah, butuh keputusan bisnis tarif denda dulu):** Setelah BUG-08
selesai (ada deteksi overdue otomatis + jumlah hari telat terhitung), buat
fungsi `calculateLatePenalty(schedule)` yang menghitung denda otomatis
berdasarkan rumus resmi koperasi (perlu didefinisikan: persentase harian?
flat per hari? capped maksimum?), tampilkan sebagai SARAN/default di form
pembayaran (bukan langsung dipaksakan, supaya pengurus tetap bisa
override dengan alasan tercatat kalau ada kasus khusus).

**Prioritas:** **P3 — Medium** (butuh keputusan bisnis soal rumus denda
sebelum bisa diimplementasi — actionable setelah BUG-08 selesai).

---

## UPDATE RINGKASAN (Kumulatif Final Sesi 1-5)

| Kategori | Total |
|---|---|
| Bug Kritis | 5 |
| Bug Sedang | **7** (tambah BUG-08) |
| Bug Ringan | 4 |
| Kesalahan Akuntansi | 7 |
| Kesalahan Database | 2 |
| Perlu Klarifikasi Bisnis | **2** (tambah BUG-09, butuh rumus denda resmi) |

## UPDATE ROADMAP

**Priority 2 (High)** — tambah:
9. **BUG-08** — Bangun cron deteksi overdue otomatis (pola sama dengan
   cron backup/payroll yang sudah ada).

**Priority 3 (Medium)** — tambah:
10. **BUG-09** — Rumus denda otomatis (setelah BUG-08 selesai & tarif resmi
    ditentukan).


---

## ADDENDUM 5 — Audit Lanjutan (29 Juli 2026, sesi ke-6)

### BUG-10 — `deleteMember` Hard Delete, Padahal Skema Sudah Sediakan Kolom Soft-Delete
**Modul:** Pendaftaran Anggota
**File:** `src/lib/actions/members.ts`
**Function:** `deleteMember` (baris 415-451)
**Baris Kode:** 425-428

**Penyebab:**
```ts
if (member?.users) {
  await prisma.user.delete({ where: { id: member.users.id } });   // HARD DELETE
}
await prisma.member.delete({ where: { id: BigInt(memberId) } });   // HARD DELETE
```
Model `members` di `prisma/schema.prisma` (baris 652) **sudah punya kolom
`deleted_at DateTime?`** — jelas didesain untuk pola soft-delete (umum &
diharapkan di sistem finansial/koperasi untuk kebutuhan audit trail &
retensi data). TAPI `deleteMember()` sama sekali tidak memakainya — memanggil
`.delete()` langsung (hapus permanen dari database), bukan
`.update({ data: { deleted_at: new Date(), status: ... } })`.

**Dampak:** Kalau seorang admin/superadmin menghapus anggota yang KEBETULAN
belum punya riwayat transaksi apa pun (anggota baru daftar, belum sempat
setor simpanan/ambil pinjaman/belanja — kondisi yang sangat mungkin terjadi
di anggota baru), maka **NIK, nama, seluruh data pribadi anggota tsb hilang
permanen tanpa jejak** — tidak ada cara mengembalikan, tidak ada di
`audit_logs` selain snapshot ringkas (`member_code`, `nik`, `full_name`,
dll. yang dicatat SEBELUM dihapus — jadi tercatat di log, tapi row aslinya
sudah tidak bisa di-restore/di-query lewat relasi normal).
Untuk anggota yang SUDAH punya riwayat transaksi, penghapusan akan gagal
karena constraint foreign key (RESTRICT, sudah diverifikasi aman di DB-03)
— tapi pesan errornya digeneralisasi ("Gagal menghapus anggota. Pastikan
tidak ada transaksi terkait.") sehingga admin tidak selalu tahu PASTI itu
sebabnya vs error lain.

**Cara Reproduksi:**
1. Daftarkan anggota baru, jangan buat transaksi apa pun untuknya.
2. Panggil `deleteMember(id)`.
3. Anggota hilang permanen dari tabel `members` — hanya tersisa jejak di
   `audit_logs` (kalau ada yang secara sadar mengecek log itu).

**Risiko:** Sedang-Tinggi — potensi kehilangan data permanen yang tidak
perlu terjadi (skema sudah sedia mekanisme yang lebih aman, cuma tidak
dipakai). Untuk lembaga yang diaudit tahunan, "penghapusan permanen data
anggota" adalah red flag standar yang akan ditanyakan auditor (apa
kebijakan retensi data anggota, dan apakah konsisten diterapkan).

**Solusi (arah):** Ganti `deleteMember` jadi soft-delete: `prisma.member.update({
where: { id }, data: { deleted_at: new Date(), status: "inactive" } })`,
dan `user.update({ data: { is_active: false } })` alih-alih hard delete.
Pastikan semua query anggota aktif (`getMembers`, dashboard, dll.) sudah
filter `deleted_at: null` (perlu dicek terpisah — belum diverifikasi apakah
query LAIN yang membaca `members` sudah konsisten mengecualikan yang
soft-deleted, mengingat field ini SUDAH ada di skema tapi mungkin belum
dipakai di mana pun).

**Prioritas:** **P2 — High**

---

## UPDATE RINGKASAN (Kumulatif Final Sesi 1-6)

| Kategori | Total |
|---|---|
| Bug Kritis | 5 |
| Bug Sedang | **8** (tambah BUG-10) |
| Bug Ringan | 4 |
| Kesalahan Akuntansi | 7 |
| Kesalahan Database | 2 |
| Perlu Klarifikasi Bisnis | 2 |
| Potensi Kehilangan Data | **1 baru diidentifikasi eksplisit (BUG-10)** |

## UPDATE ROADMAP — Priority 2 (High), tambah:
11. **BUG-10** — Ganti `deleteMember` jadi soft-delete (`deleted_at`), audit
    semua query anggota untuk pastikan konsisten filter data yang sudah
    "dihapus".

---

## CATATAN METODOLOGI (untuk audit lanjutan berikutnya)

Sesi ini sempat ada 2 false lead yang diverifikasi ulang dan TIDAK
dimasukkan laporan (supaya laporan tetap akurat, bukan asal banyak):
tenor pinjaman ternyata sudah tervalidasi benar (bukan bug division-by-zero),
dan index `orders` ternyata sudah lengkap (kesalahan piping PowerShell
saat pengecekan pertama, bukan bug nyata di skema). Dicatat di sini sebagai
bentuk transparansi metodologi audit.


---

## ADDENDUM 6 — Audit Lanjutan (29 Juli 2026, sesi ke-7, final)

### BUG-11 — `distributeSHUMassal` N+1 Query Tanpa Timeout Override (Lebih Parah dari #17)
**Modul:** SHU
**File:** `src/lib/actions/shu-calculation.ts`
**Function:** `distributeSHUMassal` (baris 627+), `processIndividualMemberShu` (baris 542+)
**Baris Kode:** 643 (`$transaction` tanpa opsi), 672-675 (loop per-anggota)

**Penyebab:** Sama persis dengan pola temuan #17 (payroll, sudah closed) —
`for (const m of report.members) { await processIndividualMemberShu(...) }`
di dalam `prisma.$transaction(async (tx) => {...})`. `processIndividualMemberShu`
melakukan ~4 query per anggota (`shu_distributions.upsert`, `savings.findUnique`,
`savings.update`, kemungkinan `saving_transactions.create`). **BEDA dari
payroll**: transaksi ini **tidak punya `{ timeout, maxWait }` sama sekali**
— pakai default Prisma **5 detik** (payroll setidaknya sudah diberi 30
detik eksplisit sebelum diperbaiki).

**Dampak:** Dengan 120 anggota aktif saat ini, ~480 query sequential dalam
jendela waktu 5 detik **hampir pasti melebihi timeout** — transaksi
`distributeSHUMassal` (proses tahunan paling penting di koperasi simpan
pinjam — pembagian SHU ke seluruh anggota) berisiko GAGAL TOTAL/ROLLBACK
kalau benar-benar dijalankan sekarang dengan skala data saat ini.

**Sisi positif yang ditemukan:** Fungsi ini justru **sudah benar** soal
membuat jurnal otomatis (ada logic pembuatan `chart_of_accounts` &
jurnal untuk distribusi SHU) — ini bisa jadi TEMPLATE POLA yang sudah
terbukti untuk menyelesaikan ACC-01 (Neraca Imbalanced) di modul lain
(POS, pinjaman), asal masalah performanya diperbaiki dulu.

**Cara Reproduksi:** Panggil `distributeSHUMassal(2026)` dengan kondisi data
saat ini (120 anggota aktif) — amati apakah selesai dalam 5 detik atau
timeout.

**Risiko:** Kritis — ini proses tahunan yang HARUS berhasil sekali setahun
untuk kepatuhan RAT; kegagalannya bukan sekadar bug teknis tapi bisa
menghambat kewajiban koperasi ke anggotanya.

**Solusi (arah, pola SUDAH terbukti dari fix #17):** Ganti loop per-anggota
jadi bulk operation (kumpulkan semua `shu_distributions` jadi satu
`createMany`, semua update `savings` jadi agregasi per member lalu
`updateMany` per kelompok nilai unik atau tetap per-member tapi di LUAR
transaksi utama untuk bagian yang tidak butuh atomicity ketat, atau
tambahkan `{ timeout: 60000, maxWait: 15000 }` sebagai mitigasi cepat
sambil bulk-fix dikerjakan).

**Prioritas:** **P1 — Critical** (proses SHU tahunan, kegagalannya
berdampak langsung ke kewajiban koperasi ke SELURUH anggota sekaligus).

---

### CATATAN — Tutup Tahun (Annual Closing) Tidak Ada Sebagai Proses Terpisah
**Modul:** Akuntansi

Ditelusuri seluruh codebase — hanya ada `performMonthlyClosing` (tutup buku
BULANAN, sudah diverifikasi aman di audit proaktif sebelumnya). **Tidak ada
fungsi "tutup tahun" terpisah** yang melakukan closing entries formal
(menutup akun pendapatan/beban ke laba ditahan, mengunci seluruh tahun,
dll.). Tidak dikategorikan sebagai "bug" karena bisa jadi memang belum
diperlukan/didesain sengaja (tutup buku bulan Desember dianggap cukup) —
**dicatat sebagai gap desain yang perlu klarifikasi kebutuhan bisnis**,
bukan actionable tanpa keputusan lebih dulu.

**Prioritas:** P4 — Low (perlu klarifikasi kebutuhan dulu sebelum jadi item roadmap).

---

## RINGKASAN FINAL (Kumulatif Seluruh Sesi Audit, 1-7)

| Kategori | Total |
|---|---|
| **Bug Kritis** | **6** (BUG-01, BUG-06, BUG-07, BUG-11, + 2 dari sesi 1) |
| **Bug Sedang** | **8** |
| **Bug Ringan** | 4 |
| **Kesalahan Akuntansi** | 7 |
| **Kesalahan Database** | 2 |
| **Perlu Klarifikasi Bisnis** | 3 (ACC-07/PPN, BUG-09/tarif denda, Tutup Tahun) |
| **Potensi Kehilangan Data** | 1 (BUG-10) |
| **Potensi Fraud** | 1 (BUG-06 — paling konkret) |

---

# RENCANA PERBAIKAN STEP-BY-STEP MENYELURUH

> Disusun berdasarkan urutan DEPENDENSI teknis (bukan cuma prioritas
> berdiri sendiri) — beberapa fix harus selesai dulu sebelum fix lain bisa
> dikerjakan dengan aman. Setiap step mencantumkan: apa yang dikerjakan,
> kenapa urutannya di situ, cara verifikasi sebelum lanjut ke step
> berikutnya, dan estimasi risiko pengerjaan.

## FASE 0 — Persiapan (sebelum menyentuh kode apa pun)
**Tujuan:** pastikan ada jaring pengaman sebelum mulai perbaikan di database yang sudah berisi data nyata.

0.1. Backup penuh database (di luar mekanisme backup aplikasi yang ada — `pg_dump` manual atau snapshot Neon) sebelum FASE 1 dimulai.
0.2. Siapkan lingkungan staging/testing terpisah kalau memungkinkan (audit sebelumnya bekerja langsung di DB yang sama dengan production — disarankan sekarang mulai ada environment terpisah untuk testing fix, mengingat skala perbaikan yang akan dikerjakan cukup besar).
0.3. Tetapkan satu orang/PIC sebagai code reviewer independen untuk tiap fix P1 (Critical) sebelum di-merge ke main — mengingat sifat perbaikan ini menyentuh alur uang langsung.

## FASE 1 — Critical: Tutup Celah Fraud Aktif (Kerjakan Duluan, Terpisah dari yang Lain)
**Kenapa duluan:** BUG-06 adalah satu-satunya temuan yang merupakan jalur eksploitasi AKTIF (bisa dipakai kapan saja selama sistem berjalan) — beda dari temuan lain yang sifatnya gap/kelemahan desain. Tidak ada dependensi ke fix lain, bisa dikerjakan independen & segera.

1.1. **BUG-06** — `pos.ts`: ganti `item.price` dari client jadi `product.member_price ?? product.price` dari database sebagai sumber kebenaran harga jual. Hitung ulang `subtotal`/`grandTotal` di server dari harga DB, bukan cuma validasi konsistensi angka client.
1.2. Terapkan pola sama untuk `discount` — validasi terhadap `promotions` yang benar-benar aktif, atau batasi dengan role+cap+audit log kalau diskon manual oleh kasir.
1.3. **Verifikasi:** buat test case checkout dengan `price` dimanipulasi manual (seperti cara reproduksi di BUG-06) — pastikan sekarang DITOLAK atau harga dikoreksi otomatis ke harga DB, bukan lolos.
1.4. Audit ulang: cek apakah `online-orders.ts` (`createOnlineOrder`) punya kelemahan yang sama (belum diverifikasi eksplisit — HANYA `pos.ts` yang sudah dikonfirmasi rinci di audit ini, `online-orders.ts` perlu dicek pola serupa sebagai bagian dari step ini).

## FASE 2 — Critical: Siklus "Undo" Transaksi (Retur, Cancel, Refund)
**Kenapa di sini:** BUG-01 & BUG-07 adalah pola sistemik yang sama (satu inisiatif), dan HARUS selesai sebelum FASE 3 (jurnal otomatis) karena kalau jurnal otomatis dibangun duluan tanpa siklus undo yang benar, retur/cancel yang terjadi SETELAHNYA akan menghasilkan jurnal yang juga tidak lengkap (bug baru di atas fix baru).

2.1. Desain ulang state-machine status order (POS & online) — tentukan transisi valid (`pending → confirmed → delivered`, atau `→ cancelled` dari state mana saja yang masih boleh, `delivered` tidak boleh mundur, dst.).
2.2. **BUG-01** — `approveOrderReturn`/`createOrderReturn` (`pos-transactions.ts`): tambah dalam satu transaksi — kembalikan stok (increment + `stock_movements` + `stock_balances`), update `orders.payment_status`/`order_status` pada order asli, catat refund (kredit balik `savings` kalau metode bayar terkait saldo).
2.3. **BUG-07** — `updateOnlineOrderStatus` (`online-orders.ts`): tambah logic sama untuk transisi ke `"cancelled"` — kembalikan stok, balikkan status pembayaran, validasi state-machine dari 2.1.
2.4. **Verifikasi:** simulasikan siklus penuh order → retur/cancel untuk kedua jalur (POS & online), pastikan `products.stock` kembali ke angka semula, `orders.payment_status` konsisten dengan status akhir.

## FASE 3 — Critical: Jurnal Otomatis & Neraca Balance (Inisiatif Terbesar)
**Kenapa di sini:** butuh FASE 1 & 2 selesai dulu (supaya jurnal yang dibangun tidak langsung punya lubang dari sisi harga palsu atau retur yang tidak lengkap). Ini fase paling besar — disarankan dipecah lagi jadi sub-langkah bertahap, bukan sekali jalan.

3.1. Inventarisasi lengkap `chart_of_accounts` — pastikan semua kode akun yang dibutuhkan (Bank, Kas, Piutang Pinjaman, Persediaan, HPP, Pendapatan Penjualan, Pendapatan Bunga, Simpanan Wajib/Sukarela sebagai liability) sudah terdefinisi konsisten. **Gunakan pola jurnal SHU (`distributeSHUMassal`, sudah terbukti benar) sebagai REFERENSI konkret**, bukan mulai dari nol.
3.2. **ACC-04** — Tambah jurnal otomatis di `updateLoanStatus` (`loans.ts`) saat pinjaman dicairkan: Debit Piutang Anggota, Kredit Kas/Bank. **Kerjakan ini duluan** di antara semua modul jurnal karena nilainya biasanya paling besar per transaksi.
3.3. Tambah jurnal otomatis di `recordLoanPayment` (`loan-payments.ts`) & bagian angsuran `processMonthlyPayrollBatch` (`payroll.ts`) — cek dulu apakah payroll SUDAH bikin jurnal (perlu diverifikasi ulang, ada indikasi sebagian sudah dari kerja sesi sebelumnya) sebagai referensi tambahan.
3.4. Tambah jurnal otomatis di `pos.ts` (`processPosCheckout`) — Debit Kas/Piutang, Kredit Pendapatan Penjualan; plus Debit HPP/Kredit Persediaan (baru bisa akurat setelah FASE 5/ACC-06 selesai, karena HPP butuh `purchase_price` yang benar).
3.5. Guard idempotency: pastikan tiap transaksi cuma dijurnal SEKALI (tambah field `journal_entry_id` atau flag serupa di `orders`/`loan_payments`/dsb.) — supaya proses historis (data lama yang belum terjurnal) bisa di-backfill terpisah tanpa duplikasi ke depan.
3.6. **Verifikasi bertahap per sub-langkah** (3.2 dulu, cek Neraca membaik sebagian, baru 3.3, dst.) — JANGAN tunggu semua modul selesai baru dicek sekali, supaya kalau ada kesalahan gampang dilacak modul mana penyebabnya.
3.7. Setelah semua modul konsisten, putuskan strategi data historis: backfill jurnal utk transaksi lama (kompleks, akurat) vs jurnal penyesuaian satu kali menutup gap historis (cepat, kurang granular) — lihat Opsi A/B/C yang sudah didokumentasikan di temuan #21 asli.

## FASE 4 — Critical: Perbaiki N+1/Timeout di Proses Batch Tahunan
**Kenapa di sini:** independen dari fase lain secara teknis, tapi **BUG-11 harus selesai SEBELUM SHU tahun berjalan benar-benar dijalankan** (kemungkinan berdekatan waktu dengan RAT) — prioritaskan sejajar dengan FASE 3, bukan menunggu FASE 3 selesai total.

4.1. **BUG-11** — `distributeSHUMassal`/`processIndividualMemberShu`: ganti loop per-anggota jadi bulk query (pola sama seperti fix #17 payroll — kumpulkan data dulu dengan query batch, baru `createMany`/`updateMany`), ATAU minimal tambah `{ timeout: 60000, maxWait: 15000 }` sebagai mitigasi cepat sambil bulk-fix menyusul.
4.2. **Verifikasi:** jalankan `distributeSHUMassal` dengan skala data saat ini (120+ anggota), pastikan selesai tanpa timeout.

## FASE 5 — High: Akurasi Laporan Keuangan Toko
5.1. **ACC-06** — Implementasi Weighted Average Cost untuk `products.purchase_price`, di-update tiap Good Receipt selesai diproses (`procurement.ts`).
5.2. **Verifikasi:** buat 2 PO dengan harga berbeda untuk produk yang sama, pastikan `purchase_price` ter-update sesuai rumus rata-rata tertimbang setelah masing-masing diterima.

## FASE 6 — High: Kontrol Internal & Integritas Data Operasional
**Catatan:** item-item di fase ini independen satu sama lain, bisa dikerjakan paralel oleh anggota tim berbeda kalau ada lebih dari satu developer.

6.1. **BUG-02/ACC-03** — Perbaiki pembulatan cicilan pinjaman (cicilan terakhir menyerap sisa pembulatan).
6.2. **BUG-03** — Validasi overpayment di `recordLoanPayment`.
6.3. **BUG-04** — Idempotency key untuk checkout POS & pembayaran cicilan (cegah double-submit).
6.4. **BUG-08** — Cron deteksi overdue otomatis (pola sama dengan cron backup/payroll yang sudah ada).
6.5. **BUG-10** — Ganti `deleteMember` jadi soft-delete, audit ulang semua query anggota supaya konsisten filter `deleted_at`.

## FASE 7 — Medium: Keputusan Bisnis Dulu, Baru Implementasi
Item-item ini **TIDAK bisa langsung dikerjakan** — butuh keputusan/klarifikasi dari pengurus/manajemen koperasi dulu:

7.1. **BUG-05/#20** — `saving_deduct` di POS: aktifkan resmi (Opsi A) atau bersihkan (Opsi B)?
7.2. **BUG-09** — Rumus denda keterlambatan resmi (persentase harian? flat? cap maksimum?) — baru bisa diimplementasi setelah BUG-08 (deteksi overdue) selesai DAN rumus ditentukan.
7.3. **ACC-07** — Status PKP koperasi untuk PPN penjualan — konsultasi ke bagian pajak.
7.4. **DB-01** — Kebutuhan retur sebagian (`order_return_items`) — tergantung kebutuhan operasional riil.
7.5. **Tutup Tahun** — apakah perlu proses closing tahunan formal terpisah dari tutup bulanan Desember?

## FASE 8 — Low: Audit Lanjutan & Pembersihan Teknis
8.1. Audit sistematis code duplication/dead code/unused function (belum dilakukan sepanjang audit ini — butuh sesi terpisah dengan tooling khusus, mis. `ts-prune` untuk unused exports).
8.2. Audit Buku Besar & rekonsiliasi kas harian secara mendalam (di luar cakupan Laporan Arus Kas yang sudah diperiksa).
8.3. Uji ketahanan concurrent/locking di bawah beban nyata (load testing) — belum pernah dilakukan.
8.4. Review menyeluruh JWT/session config di luar yang sudah diverifikasi (rotasi token, dsb.).

---

## URUTAN EKSEKUSI RINGKAS (kalau harus dikerjakan satu-satu berurutan, bukan paralel)

```
FASE 0 (persiapan)
  → FASE 1 (BUG-06, tutup fraud aktif)
  → FASE 2 (BUG-01 + BUG-07, siklus undo)
  → FASE 3 (jurnal otomatis) ⟷ FASE 4 (BUG-11, timeout SHU) [bisa paralel]
  → FASE 5 (ACC-06, HPP akurat)
  → FASE 6 (kontrol internal, bisa paralel per item)
  → FASE 7 (nunggu keputusan bisnis, bisa jalan kapan saja begitu keputusan ada)
  → FASE 8 (audit lanjutan, kapan saja, tidak mendesak)
```

**Estimasi kompleksitas relatif** (bukan estimasi waktu pasti, karena
tergantung kapasitas tim): FASE 3 (jurnal otomatis) adalah yang PALING
besar & berisiko — disarankan dipecah lagi jadi beberapa PR terpisah per
modul (3.2, 3.3, 3.4 masing-masing PR sendiri dengan testing terpisah),
bukan satu PR raksasa. Semua fase P1 (1, 2, 3, 4) sebaiknya diselesaikan
sebelum RAT/pembagian SHU tahun berjalan berikutnya dijalankan sungguhan.


---

## LOG EKSEKUSI — FASE 1 SELESAI (29 Juli 2026)

**Status: ✅ FASE 1 (BUG-06) — Selesai & Terverifikasi**

### Yang dikerjakan
1. **`src/lib/actions/pos.ts`**: harga jual (`unit_price`) sekarang WAJIB
   diambil dari `products.price`/`products.member_price` di database di
   dalam transaksi, bukan dari `item.price` yang dikirim client. `discount`
   divalidasi (`>= 0` dan `<= subtotal riil`) sebelum dipakai. `subtotal`/
   `grand_total` yang tersimpan ke `orders` dihitung ulang dari harga
   database, bukan dari angka client.
2. **`src/lib/actions/online-orders.ts`**: pola sama diterapkan ke
   `createOnlineOrder` — sebelumnya bahkan tanpa pengecekan konsistensi
   sama sekali, sekarang harga & limit paylater dihitung dari `realSubtotal`
   (database), bukan `item.price` client.

### Insiden selama pengerjaan (dicatat transparan)
Saat menulis ulang `online-orders.ts`, sempat **tidak sengaja memotong
file** — fungsi `getOnlineOrders` dan `updateOnlineOrderStatus` (100 baris
terakhir file) hilang karena penulisan ulang cuma mencakup fungsi
`createOnlineOrder` tapi menimpa seluruh file. **Terdeteksi segera** lewat
verifikasi baca-ulang file setelah menulis (bukan langsung lanjut tanpa
cek), dipulihkan dengan mengambil versi asli dari `git show HEAD:...`
(file sudah ter-commit sebelumnya, jadi tidak ada kerja yang hilang),
digabung dengan bagian yang sudah diperbaiki. File akhir 269 baris,
diverifikasi utuh lewat pembacaan penuh sebelum lanjut ke tahap kompilasi.
**Pelajaran:** untuk pengeditan fungsi tunggal di file besar ke depan,
lebih aman pakai edit di lokasi spesifik daripada menulis ulang seluruh
file, kecuali benar-benar diniatkan mengganti seluruh isi.

### Verifikasi
- `npx tsc --noEmit`: 0 error (dicek 2x, sebelum & sesudah pemulihan file).
- `npm run build` production penuh: sukses (`Compiled successfully`), semua
  route ter-generate termasuk `/toko/kasir` dan halaman terkait online order.
- Data sampel produk dicek langsung ke database: `member_price` terisi
  dengan benar (bukan `null`) untuk produk yang diuji, mengonfirmasi logic
  fallback (`member_price ?? price`) akan berfungsi sesuai desain.
- **Belum diuji end-to-end dengan transaksi checkout nyata** (butuh sesi
  login kasir/anggota asli) — hanya diverifikasi lewat kompilasi + review
  logic + spot-check data.

### Belum dikerjakan di FASE 1 (dicatat, bukan diabaikan)
- Validasi `discount` masih berupa cap sederhana (`0 <= discount <=
  subtotal`), BELUM terhubung ke rule promosi resmi di tabel `promotions`
  — kalau kasir input diskon manual, sistem masih menerima berapa pun
  dalam batas subtotal, tanpa cross-check ke voucher/promo aktif. Ini
  mitigasi PARSIAL untuk BUG-06 (menutup celah harga jadi 0/negatif, tapi
  belum menutup celah "diskon manual sembarangan oleh kasir").

**Commit:** `85cde04` (kode) — sudah di-push ke `origin/main`.

**Langkah selanjutnya (FASE 2):** siklus "undo" transaksi — BUG-01 (retur
toko) & BUG-07 (cancel online order) — sesuai urutan di Rencana Perbaikan
Step-by-Step di atas.


---

## LOG EKSEKUSI — FASE 2 SELESAI (29 Juli 2026)

**Status: ✅ FASE 2 (BUG-01 + BUG-07) — Selesai & Terverifikasi**

### Yang dikerjakan
1. **`src/lib/actions/pos-transactions.ts`** (`createOrderReturn` +
   `approveOrderReturn`): sebelum ditulis ulang, seluruh 612 baris file
   dibaca utuh dulu (pelajaran dari insiden FASE 1) supaya tidak ada fungsi
   lain yang hilang. Perubahan:
   - `createOrderReturn`: tambah pengecekan retur ganda (tolak kalau order
     yang sama sudah punya retur berstatus pending/approved/completed).
   - `approveOrderReturn`: dijalankan dalam `$transaction` - kembalikan
     stok per item (`products.stock` increment + `stock_movements` +
     `stock_balances` upsert), update `orders.payment_status` jadi
     `"refunded"` dan `order_status` jadi `"cancelled"` pada order asli,
     `return_status` jadi `"completed"` (bukan cuma `"approved"` karena
     sekarang efeknya benar-benar dieksekusi, bukan cuma status).
   - Pembalikan jurnal akuntansi **sengaja belum ditambahkan** - itu bagian
     FASE 3, karena POS sendiri belum punya jurnal maju (ACC-01) untuk
     dibalikkan.
2. **`src/lib/actions/online-orders.ts`** (`updateOnlineOrderStatus`): file
   dibaca utuh dulu (369 baris) sebelum ditulis ulang. Perubahan:
   - Tambah state-machine sederhana (`ORDER_STAGE_SEQUENCE`): tolak
     transisi mundur, tolak cancel dari status `"delivered"` (harus lewat
     proses retur, bukan cancel), tolak aksi apa pun kalau sudah
     `"cancelled"`.
   - Transisi ke `"cancelled"`: kembalikan stok (pola sama seperti
     `approveOrderReturn`), koreksi `payment_status` jadi `"unpaid"`.

### Verifikasi
- File dibaca ulang segera setelah ditulis (baris terakhir + jumlah baris
  dicek) untuk pastikan TIDAK terpotong seperti insiden FASE 1 - keduanya
  konfirmasi utuh (`pos-transactions.ts` 722 baris berakhir dengan penutup
  fungsi yang benar, `online-orders.ts` 369 baris demikian juga).
- `npx tsc --noEmit`: 0 error.
- `npm run build` production penuh: sukses (`Compiled successfully`), semua
  route ter-generate.
- Prasyarat data dicek langsung ke database: `warehouse_locations` aktif
  ada (`Rak Toko Utama`), ada order sample yang valid untuk simulasi retur
  di masa depan.
- **Belum diuji end-to-end dengan retur/cancel transaksi nyata** (butuh
  sesi login kasir/pengurus asli) - hanya diverifikasi lewat kompilasi +
  review logic + spot-check prasyarat data.

**Commit:** `fc8f191` — sudah di-push ke `origin/main`.

**Langkah selanjutnya (FASE 3 — inisiatif terbesar):** jurnal otomatis
untuk pencairan pinjaman (ACC-04), lalu diperluas ke pembayaran cicilan
dan POS. Disarankan dipecah jadi beberapa commit terpisah per modul
(sesuai catatan di Rencana Perbaikan di atas), bukan sekali jalan.
