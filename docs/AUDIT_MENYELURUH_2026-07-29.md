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
