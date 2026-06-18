# Product Requirements Document (PRD)
## Sistem Manajemen Koperasi Sulfindo Digital

**Versi:** 3.3.5
**Tanggal:** 25 Mei 2026
**Pemilik Produk:** Koperasi Sulfindo
**Status:** Production — Active Development

---

## 1. Executive Summary

Sistem Manajemen Koperasi Sulfindo Digital adalah platform web **full-stack** berbasis Next.js App Router yang mendigitalisasi seluruh operasional Koperasi Karyawan PT. Sulfindo. Platform ini mengintegrasikan empat pilar utama koperasi: **simpan-pinjam**, **retail toko (Waserda)**, **konsinyasi**, dan **akuntansi double-entry** dalam satu sistem terpadu.

Sistem ini menggantikan pencatatan manual berbasis spreadsheet dan mengeliminasi potensi human error pada transaksi keuangan koperasi yang melibatkan ratusan anggota aktif.

---

## 2. Visi & Misi Produk

| | |
|---|---|
| **Visi** | Menjadi sistem manajemen koperasi digital paling lengkap, transparan, dan dapat diaudit untuk koperasi karyawan skala menengah di Indonesia. |
| **Misi** | Memberikan alat operasional real-time kepada pengurus koperasi agar mampu mengelola aset anggota, menutup buku bulanan, dan menyajikan laporan keuangan RAT yang akurat tanpa ketergantungan pada jasa akuntan eksternal. |

---

## 3. Stakeholder & User Roles

| Role | Akses | Tanggung Jawab |
|---|---|---|
| `superadmin` | Full access | Kelola user, pengaturan sistem, akses semua modul |
| `admin` | Full operational | Semua modul kecuali pengaturan sistem sensitif |
| `pengurus` | Full operational | Setara admin, approve pinjaman & SHU |
| `kasir` | Toko & transaksi | POS kasir, input simpanan, catat cicilan |
| `anggota` | Self-service portal | Lihat pinjaman sendiri, ajukan pinjaman, lihat simpanan |
| `pengawas` | Read-only laporan | Audit laporan keuangan & transaksi |

---

## 4. Modul & Fitur Utama

### 4.1 Modul Anggota (`/anggota`)

**Tujuan:** Manajemen data keanggotaan koperasi secara digital.

**Fitur:**
- CRUD profil anggota lengkap (NIK, nama, unit kerja, kontak, alamat)
- Kode anggota unik otomatis (`S0001`, `S0002`, dst.)
- Status keanggotaan: `active`, `inactive`, `resigned`
- Pencarian & filter real-time berdasarkan nama, NIK, kode, dan unit kerja
- Ekspor daftar anggota ke CSV/Excel
- Riwayat simpanan, pinjaman, dan transaksi per anggota

**Alur Data:**
`POST /api/members` → validasi NIK unik → generate `member_code` → simpan ke tabel `members` → buat akun `users` dengan role `anggota`

---

### 4.2 Modul Simpanan (`/simpanan`)

**Tujuan:** Kelola saldo simpanan pokok, wajib, dan sukarela anggota.

**Fitur:**
- 3 jenis simpanan: **Pokok** (sekali seumur hidup), **Wajib** (rutin bulanan), **Sukarela** (fleksibel)
- Mutasi: `deposit` (setor), `withdraw` (tarik), `shu_credit` (distribusi SHU)
- Saldo real-time per anggota per jenis simpanan
- Riwayat mutasi dengan saldo sebelum & sesudah
- Admin dapat setor/tarik massal (batch untuk potongan gaji bulanan)
- Cek saldo minimum sebelum withdraw

**Alur Data:**
`recordSavingTransaction(memberId, type, amount)` → validasi saldo → buat `saving_transactions` → update `savings.balance` → trigger jurnal akuntansi otomatis

---

### 4.3 Modul Pinjaman (`/pinjaman`)

**Tujuan:** Manajemen lifecycle pinjaman anggota dari pengajuan hingga pelunasan.

**Sub-modul:**

#### 4.3.1 Produk Pinjaman (`/pinjaman/produk`)
- Konfigurasi produk: nama, jenis bunga (flat/anuitas/efektif), rate bunga (%/bulan), tenor maksimal, plafon maksimal
- Aktivasi/nonaktifasi produk

#### 4.3.2 Aturan Pinjaman (`/pinjaman/rules`)
- Rule berbasis kondisi: DTI (Debt-to-Income), maksimal plafon, status simpanan minimum
- Validasi otomatis saat pengajuan

#### 4.3.3 Kelola Pinjaman (`/pinjaman`)
- Tabel semua pinjaman dengan filter status: Aktif, Menunggak, Lunas
- **Select-all & bulk payment**: pilih beberapa pinjaman sekaligus untuk catat pembayaran massal (payroll/potong gaji)
- Catat pembayaran per pinjaman dengan pilihan jadwal angsuran
- Dialog bayar: pilih cicilan bulan berapa, nominal, metode, referensi, denda
- Progress bar real-time saat bulk payment diproses

#### 4.3.4 Approval Pinjaman (`/pinjaman/approval`)
- Anggota ajukan pinjaman → masuk queue approval
- Pengurus/admin review & approve/reject dengan catatan
- Notifikasi ke anggota

#### 4.3.5 Jadwal Angsuran (`/pinjaman/transaksi/:id`)
- Detail amortisasi per bulan (pokok + bunga)
- Status tiap cicilan: `pending`, `paid`, `overdue`
- Riwayat pembayaran dengan timestamp

**Alur Data:**
```
Anggota ajukan → loan_applications (pending)
→ Approve pengurus → loans (active) + generate loan_schedules
→ Kasir catat bayar → loan_payments + update loan_schedules.status = paid
→ Jika outstanding = 0 → loans.status = paid_off
```

---

### 4.4 Modul Toko Waserda — POS (`/toko`)

**Tujuan:** Operasional kasir retail toko koperasi secara digital.

**Fitur:**
- Katalog produk dengan stok real-time
- Kasir POS: tambah item ke keranjang, hitung total, proses pembayaran
- Metode bayar: tunai, potong simpanan sukarela, paylater (hutang)
- Struk digital per transaksi
- Manajemen promosi/diskon
- Cek harga & ketersediaan produk

**Alur Data:**
`Kasir scan/pilih produk → orders (pending) → proses bayar → orders (paid) + kurangi products.stock + catat journal_entries`

---

### 4.5 Modul Konsinyasi (`/konsinyasi`)

**Tujuan:** Kelola produk titipan supplier dengan sistem bagi hasil.

**Fitur:**
- Penerimaan barang konsinyasi dari supplier
- Tracking status penerimaan: `draft`, `received`, `sold`, `returned`
- Rekonsiliasi penjualan vs stok konsinyasi
- Laporan hutang dagang ke supplier
- Proteksi zero-date & enum crash

---

### 4.6 Modul Pembelian (`/pembelian`)

**Tujuan:** Manajemen pengadaan barang dari supplier untuk stok toko.

**Fitur:**
- Purchase Order (PO) ke supplier
- Penerimaan barang & update stok otomatis
- Retur barang ke supplier
- Manajemen hutang dagang (Accounts Payable)
- Stock opname & rekonsiliasi selisih stok

---

### 4.7 Modul Akuntansi (`/akuntansi`)

**Tujuan:** Sistem akuntansi double-entry terintegrasi untuk koperasi.

#### 4.7.1 Chart of Accounts (`/akuntansi/transaksi`)
- Master akun: Aset, Kewajiban, Ekuitas, Pendapatan, Beban
- Input jurnal manual (debit-kredit berpasangan)
- Posting jurnal dari Draft ke Posted

#### 4.7.2 Buku Besar (`/akuntansi/buku-besar`)
- Tampilan semua journal entries dengan expand per baris untuk lihat detail lines
- Filter berdasarkan tanggal & pencarian
- **Notifikasi aksi cerdas** (dismissible):
  - 🔴 Kritis: tutup buku bulan lalu belum dilakukan
  - 🟡 Peringatan: jurnal Draft belum diposting, simpanan tanpa jurnal, penyusutan aset belum diinput
  - 🔵 Info: angsuran pinjaman dibayar hari ini, transaksi toko menunggu tutup buku
- Badge counter "X Kritis / X Peringatan" di header panel notifikasi

#### 4.7.3 Tutup Buku Bulanan (`/akuntansi/tutup-buku`)
- Pilih periode bulan & tahun
- **Pre-check 5 item otomatis** sebelum proses:
  1. ✅ Periode belum pernah ditutup (anti-duplikasi)
  2. ✅/⚠️ Bulan sebelumnya sudah ditutup (urutan sekuensial)
  3. ✅/❌ Tidak ada jurnal Draft di periode ini
  4. ✅/⚠️ Terdapat transaksi di periode (tidak menutup bulan kosong)
  5. ✅/⚠️ Semua pinjaman aktif punya jadwal angsuran
- Tombol "Tutup Buku" **ter-disabled** jika ada item status `error`
- Setelah tutup: kalkulasi pendapatan (omzet toko + bunga pinjaman + denda + jurnal revenue) dan beban (HPP + jurnal expense)
- Riwayat tutup buku: periode, pendapatan, pengeluaran, SHU sementara

#### 4.7.4 Anggaran (`/akuntansi/anggaran`)
- Input target anggaran per akun per periode
- Perbandingan realisasi vs anggaran

#### 4.7.5 Aset Tetap (`/akuntansi/aset-tetap`)
- Katalog aset tetap dengan nilai perolehan & nilai sisa
- Kalkulasi penyusutan via jurnal manual (source: `manual`)
- Kategori aset: kendaraan, elektronik, furnitur, gedung

#### 4.7.6 RAT — Pembagian SHU (`/akuntansi/pembagian-shu`)
- Hitung SHU bersih tahun buku berakhir
- Alokasi makro: Anggota 55%, Cadangan 20%, Pengurus 5%, Pegawai 5%, Pendidikan 5%, Sosial 10%
- Distribusi per anggota: bobot simpanan (40%) + bobot partisipasi usaha (60%)
- Eksekusi massal dalam 1 database transaction ke simpanan sukarela
- Log audit `shu_credit` per anggota

---

### 4.8 Modul Laporan (`/laporan`)

**Tujuan:** Laporan keuangan standar untuk RAT & kebutuhan audit.

| Laporan | Path | Keterangan |
|---|---|---|
| Neraca (Balance Sheet) | `/laporan/neraca` | Aset = Kewajiban + Ekuitas, real-time |
| PHU (Laba Rugi) | `/laporan/phu` | Pendapatan - Beban = SHU |
| Arus Kas | `/laporan/arus-kas` | Operasi, Investasi, Pendanaan |
| Perubahan Ekuitas | `/laporan/perubahan-ekuitas` | Modal awal + SHU - distribusi |
| Analitik | `/laporan/analitik` | Grafik penjualan, monitoring stok nilai rupiah |
| Stok | `/laporan/stok` | Kartu mutasi stok per produk |
| Harian & Mingguan | `/laporan/harian` | Ringkasan penjualan kasir |
| Transaksi Kasir | `/laporan/transaksi-kasir` | Detail per sesi kasir |
| RAT Buku Pembantu | `/akuntansi/rat-absensi` | Partisipasi anggota, ekspor CSV |

---

### 4.9 Modul Pengaturan (`/pengaturan`)

- Profil koperasi (nama, logo, alamat, NPWP)
- Pengaturan tahun buku
- Manajemen user & role
- Konfigurasi COA awal

---

### 4.10 Portal Anggota (Self-Service)

**Akses:** Anggota login → redirect ke `/pinjaman` (view terbatas)

**Fitur:**
- Lihat daftar pinjaman pribadi dengan detail outstanding & jadwal
- Ajukan pinjaman baru (form produk aktif)
- Lihat riwayat pengajuan dengan status & catatan penolakan
- Lihat tagihan paylater toko

---

## 5. Arsitektur Teknis

### 5.1 Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14 App Router, React 18, TypeScript |
| Styling | TailwindCSS, Shadcn UI, Lucide React |
| Backend | Next.js Server Actions (colocated API) |
| ORM | Prisma Client JS |
| Database | MySQL 8.0 (Aiven Cloud, SSL) |
| Auth | NextAuth.js v5 (Credentials + JWT) |
| Toast | Sonner |
| Mobile | Capacitor.js (Android APK build) |

### 5.2 Layer Separation

```
Request
  └─ Next.js Page (Server Component) — fetch data
       └─ Client Component — interaksi UI
            └─ Server Action — business logic + DB
                 └─ Prisma — data access layer (MySQL)
                      └─ Response
```

### 5.3 Database Schema (Utama)

```
users ──────────── members
                     ├── savings ── saving_transactions
                     ├── loans ──── loan_schedules
                     │              loan_payments
                     └── shu_distributions

journal_entries ─── journal_lines ── chart_of_accounts
monthly_closures
shu_periods

orders ── order_items ── products ── stock_balances
       └─ (paylater debt)

fixed_assets
```

---

## 6. Alur Bisnis Kritis

### 6.1 Alur Pembayaran Cicilan Pinjaman

```
1. Admin/Kasir buka /pinjaman
2. Pilih pinjaman anggota (atau select-all untuk bulk)
3. Klik "Bayar" → Dialog terbuka
4. Pilih cicilan bulan ke-N (jadwal) atau bebas
5. Input nominal, metode, referensi
6. recordLoanPayment() → Server Action
7. Update loan_schedules.status = 'paid'
8. Update loans.outstanding
9. Jika outstanding = 0 → loans.status = 'paid_off'
10. Toast sukses + refresh data
```

### 6.2 Alur Tutup Buku Bulanan

```
1. Admin buka /akuntansi/tutup-buku
2. Pilih bulan & tahun
3. Klik "Cek Kesiapan" → 5 pre-check otomatis
4. Review hasil cek: OK / Peringatan / Error
5. Jika ada Error → perbaiki dulu (link langsung ke halaman terkait)
6. Semua cek OK/Warning → tombol "Tutup Buku" aktif
7. Konfirmasi modal
8. performMonthlyClosing() → hitung revenue + expense + net income
9. Simpan ke monthly_closures
10. Revalidate halaman + tampil di riwayat
```

### 6.3 Alur Distribusi SHU

```
1. Tutup tahun buku (semua bulan sudah ditutup)
2. Admin buka /akuntansi/pembagian-shu
3. Hitung total SHU bersih (PHU akhir tahun)
4. Tentukan persentase alokasi makro
5. Hitung hak per anggota:
   - 40% dari bobot total simpanan anggota
   - 60% dari bobot partisipasi usaha (belanja + pinjaman)
6. Preview distribusi per anggota
7. Eksekusi massal (prisma.$transaction)
8. Kredit simpanan sukarela per anggota
9. Log shu_distributions + audit log
```

---

## 7. Non-Functional Requirements

| Aspek | Requirement |
|---|---|
| **Performance** | Halaman utama < 2 detik (server-side rendered), tabel paginasi 30 baris/halaman |
| **Security** | Role-based access control (RBAC), JWT session, bcrypt password hash |
| **Availability** | Uptime 99% (Aiven Cloud MySQL HA, Vercel Edge CDN) |
| **Audit Trail** | Semua aksi sensitif dicatat ke `audit_logs` (siapa, kapan, nilai lama vs baru) |
| **Data Integrity** | Double-entry: total debit = total kredit pada setiap journal_entry |
| **Mobile** | Responsive mobile-first UI + Android APK via Capacitor |
| **Error Handling** | Try-catch wajib di semua server actions, toast notifikasi, tidak ada silent fail |
| **SOLID/DRY** | Fungsi max 20-30 baris, satu tanggung jawab per fungsi |

---

## 8. User Interface Principles

1. **Premium dark-light mode** dengan TailwindCSS class `dark:` variants
2. **Micro-animations**: `animate-in`, `slide-in-from-top`, `fade-in` pada notifikasi dan modal
3. **Color semantics konsisten**:
   - Emerald/Green = Aktif, Sukses, Bayar
   - Rose/Red = Error, Menunggak, Sisa Hutang
   - Amber/Yellow = Peringatan, Pending
   - Blue = Informasi, Link, Navigasi
   - Slate = Netral, Label, Metadata
4. **Responsive**: Tabel desktop → Card feed mobile
5. **Aksesibilitas**: `aria-label` pada elemen interaktif, keyboard navigable

---

## 9. Integrasi & Ketergantungan

| Ketergantungan | Keterangan |
|---|---|
| **Aiven MySQL** | Database cloud dengan SSL mandatory, koneksi via `DATABASE_URL` env |
| **Prisma ORM** | Schema di `prisma/schema.prisma`, migrasi via `prisma db push` |
| **NextAuth.js** | Auth konfigurasi di `src/auth.ts` & `src/auth.config.ts` |
| **Capacitor** | Build Android APK dari Next.js app (`capacitor.config.ts`) |
| **Sonner** | Toast notification system |
| **Shadcn UI** | Component library (`components.json`) |

---

## 10. Roadmap & Backlog

### Selesai (v3.3.5)
- ✅ Full akuntansi double-entry + buku besar
- ✅ Distribusi SHU massal otomatis
- ✅ Tutup buku bulanan dengan kalkulasi HPP & bunga
- ✅ POS kasir terintegrasi
- ✅ Konsinyasi supplier
- ✅ Laporan keuangan lengkap (Neraca, PHU, Arus Kas)
- ✅ Stock opname & kartu mutasi stok
- ✅ Select-all + bulk payment pinjaman
- ✅ Pre-check otomatis tutup buku (5 item validasi)
- ✅ Notifikasi aksi buku besar yang diperkaya (6 cek, dismissible)
- ✅ Mobile responsive + Android APK

### In Progress / Backlog
- 🔄 Notifikasi push (angsuran jatuh tempo mendekati H-3)
- 🔄 Import data anggota dari Excel
- 🔄 Multi-unit support (per cabang)
- 🔄 Integrasi PPOB (tagihan listrik, BPJS, dll.)
- 🔄 Rekonsiliasi bank otomatis (statement import)
- 🔄 E-signature pengurus untuk dokumen digital

---

## 11. Glossary

| Istilah | Definisi |
|---|---|
| **SHU** | Sisa Hasil Usaha — profit/surplus koperasi yang didistribusikan ke anggota |
| **RAT** | Rapat Anggota Tahunan — forum pertanggungjawaban tahunan koperasi |
| **PHU** | Perhitungan Hasil Usaha — laporan laba rugi versi koperasi |
| **COA** | Chart of Accounts — daftar rekening akuntansi |
| **HPP** | Harga Pokok Penjualan — COGS (Cost of Goods Sold) |
| **Waserda** | Warung Serba Ada — nama toko retail koperasi |
| **Plafon** | Jumlah maksimal pinjaman yang disetujui |
| **Outstanding** | Sisa pokok pinjaman yang belum terbayar |
| **Tenor** | Jangka waktu pinjaman dalam bulan |
| **DTI** | Debt-to-Income Ratio — rasio cicilan terhadap penghasilan |
| **Angsuran** | Cicilan pembayaran pinjaman per bulan |

---

*Dokumen ini dibuat dan dikelola oleh tim pengembang sistem Koperasi Sulfindo Digital.*
*Terakhir diperbarui: 25 Mei 2026*
