STRUKTUR FITUR DASHBOARD KOPERASI (RBAC)
=========================================

1. ROLE: ADMINISTRATOR / PENGURUS
---------------------------------
Fokus: Strategi, Laba/Rugi, dan Keamanan Sistem.

- Financial Overview: Grafik Laba/Rugi konsolidasi (Simpan Pinjam + Toko).
- Asset Liquidity: Total saldo kas dan bank secara real-time.
- Member Statistics: Total anggota aktif dan pertumbuhan bulanan.
- SHU Projection: Estimasi Sisa Hasil Usaha berjalan.
- Audit Trail: Log aktivitas user (tracking perubahan data sensitive).
- Approval Center: Notifikasi persetujuan pinjaman besar atau adjusment stok.

2. ROLE: ADMIN KREDIT (SIMPAN PINJAM)
--------------------------------------
Fokus: Pengelolaan dana pinjaman dan penagihan.

- Loan Outstanding: Total dana yang sedang dipinjamkan ke anggota.
- NPL (Non-Performing Loan): Monitoring kredit macet (Lancar, Diragukan, Macet).
- Today's Collection: Daftar cicilan jatuh tempo hari ini (Target Penagihan).
- Pending Applications: Pengajuan pinjaman baru yang menunggu verifikasi.
- Savings Growth: Rekapitulasi simpanan masuk (Pokok, Wajib, Sukarela).

3. ROLE: KASIR / ADMIN TOKO (POS)
---------------------------------
Fokus: Operasional penjualan harian dan stok barang.

- Daily Sales Summary: Total omset dan jumlah transaksi hari ini.
- Inventory Alert: Notifikasi barang yang mencapai batas stok minimum.
- Top 5 Products: Daftar barang paling laku (Fast Moving).
- Cashier Balance: Pencatatan modal awal vs uang fisik di laci.
- Void/Refund Logs: Ringkasan pembatalan transaksi (Fraud prevention).

4. ROLE: ANGGOTA (SELF-SERVICE)
-------------------------------
Fokus: Transparansi data saldo dan riwayat pribadi.

- My Balance: Total simpanan (Pokok, Wajib, Sukarela).
- Loan Status: Sisa pinjaman dan sisa tenor cicilan.
- Purchase History: Riwayat belanja di unit toko.
- Loyalty Points: Jumlah poin reward dari transaksi POS.
- Download Center: Unduh slip simpanan atau rincian pinjaman.