# Laporan Audit Keamanan (Security Assessment Report) Koperasi Digital v3.1

Berdasarkan arsitektur Koperasi Digital v3.1 (Next.js 16.2.6, Prisma, Capacitor), berikut adalah potensi kerentanan, skenario serangan, *test cases*, dan mitigasi taktis.

---

### 1. BROKEN OBJECT LEVEL AUTHORIZATION (BOLA / IDOR) & BIGINT SERIALIZATION

**A. Deskripsi Celah Keamanan (Vulnerability Description)**
Penggunaan tipe `BigInt` untuk ID yang bersifat sekuensial sangat rentan ditebak (enumerasi). Jika Server Actions (misal: mengambil detail pinjaman atau simpanan) menerima input `id` dari client dan langsung mengeksekusi *query* Prisma tanpa memverifikasi apakah objek tersebut benar-benar milik pengguna yang sedang *login* (berdasarkan `session.user.id`), celah IDOR (Insecure Direct Object Reference) terjadi.

**B. Skenario Serangan (Attack Scenario)**
Anggota A login dan mengakses riwayat pinjamannya di `/pinjaman/transaksi/1005`. Penyerang (Anggota A) mencegat (*intercept*) *request* tersebut dan mengganti *payload/parameter* ID menjadi `1006` (milik Anggota B). Sistem merespons dengan menampilkan data finansial sensitif Anggota B.

**C. Contoh Kode/Arsitektur yang Rentan (Conceptual Vulnerable Code)**
```typescript
// lib/actions/loans.ts
export async function getLoanDetails(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  
  // 🚨 RENTAN: Hanya mencari berdasarkan ID. Tidak ada filter kepemilikan.
  const loan = await prisma.loans.findUnique({
    where: { id: BigInt(id) } 
  });
  return { ...loan, id: Number(loan.id) }; 
}
```

**D. Security Test Case**
- **Prasyarat:** Punya 2 akun (Anggota A dan B). Anggota B memiliki transaksi pinjaman ber-ID `5000`.
- **Langkah:** Login sebagai Anggota A. Buka Burp Suite / Network tab. Ubah ID pemanggilan Server Action detail pinjaman menjadi `5000`. Kirim request.
- **Hasil Lolos Audit:** Aplikasi mengembalikan status `403 Forbidden` atau `404 Not Found` (Data tidak ditemukan/akses ditolak). Data Anggota B tidak bocor.

**E. Remediasi / Best Practice**
Selalu terapkan validasi relasional (kepemilikan) untuk role di bawah level *admin*.
```typescript
const whereClause: any = { id: BigInt(id) };

// ✅ FIX: Wajibkan filter berdasarkan user_id (atau member_id) untuk anggota biasa
if (session.user.role === 'anggota') {
  whereClause.user_id = session.user.id; 
}

const loan = await prisma.loans.findUnique({ where: whereClause });
if (!loan) throw new Error("Not Found or Unauthorized");
```

---

### 2. PRIVILEGE ESCALATION VIA SERVER ACTIONS & RBAC BYPASS

**A. Deskripsi Celah Keamanan**
`auth.config.ts` dan Middleware hanya memproteksi rute halaman (URL). Server Actions (`use server`) pada dasarnya adalah *hidden POST endpoints*. Jika sebuah fungsi mutasi data tingkat tinggi (seperti `updateAppSettings` atau sinkronisasi `shu_config`) dipanggil, dan fungsi tersebut tidak memvalidasi ulang `role` dari sesi JWT saat itu, maka pencegahan URL menjadi percuma.

**B. Skenario Serangan**
Penyerang masuk sebagai `anggota`. Penyerang melihat di *source code* klien adanya Action ID untuk `updateAppSettings` (milik superadmin). Menggunakan `cURL` atau Postman, penyerang mengirim HTTP POST ke *endpoint* Server Action dengan menyematkan *cookie session* miliknya, lalu berhasil mengubah konfigurasi sistem.

**C. Contoh Kode/Arsitektur yang Rentan**
```typescript
// lib/actions/settings.ts
"use server"
export async function updateAppSettings(data: any) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized"); // Hanya ngecek "apakah login?"
  
  // 🚨 RENTAN: Tidak mengecek apalah user ini superadmin/ketua
  await prisma.app_settings.update({ data });
}
```

**D. Security Test Case**
- **Prasyarat:** Login menggunakan akun `anggota`.
- **Langkah:** Ekstrak JWT/Cookie Session. Intercept *request* ke Server Action fungsi admin (contoh: persetujuan pinjaman atau setelan SHU). Replay *request* tersebut.
- **Hasil Lolos Audit:** Server menolak *request* dengan *Exception* "Insufficient Privileges".

**E. Remediasi / Best Practice**
Terapkan *Inline Role-Checking* (Enkapsulasi RBAC) di dalam setiap Server Action yang bersifat mutasi/sensitif.
```typescript
export async function updateAppSettings(data: any) {
  const session = await auth();
  // ✅ FIX: Validasi peran di level eksekusi fungsi
  if (!session || !["superadmin", "ketua"].includes(session.user.role)) {
    throw new Error("Forbidden: Insufficient privileges");
  }
  // ... eksekusi query
}
```

---

### 3. MASS ASSIGNMENT & DATA INTEGRITY IN SHU / LOAN RULES JSON

**A. Deskripsi Celah Keamanan**
Input yang menerima JSON kompleks (`shu_config` v3.1 dan `loan_rules`) rentan terhadap *Mass Assignment*. Tanpa *strict validation*, penyerang bisa menyisipkan *key* (properti) ilegal ke dalam *payload* JSON. Jika DB Prisma menyimpannya secara mentah, *business logic engine* yang berjalan di belakangnya bisa terganggu.

**B. Skenario Serangan**
Dalam *form* edit SHU (sebagai `ketua`), *hacker* memanipulasi *payload request* dengan menyisipkan parameter di luar skema, contoh: `{"dana_pengurus": 15, "is_locked": false, "bypass_tax": true}`. Aplikasi menyimpan `bypass_tax` ke DB. Saat *engine* tutup buku berjalan, *engine* mendeteksi `bypass_tax` dan mengeksekusi logika yang menguntungkan penyerang.

**C. Contoh Kode/Arsitektur yang Rentan**
```typescript
// app/api/shu-config/route.ts
export async function POST(req: Request) {
  const body = await req.json(); // Object mentah dari user
  
  // 🚨 RENTAN: Disimpan "as-is" ke kolom JSON di MySQL
  await prisma.app_settings.update({
    where: { key: 'shu_config' },
    data: { value: body }
  });
}
```

**D. Security Test Case**
- **Prasyarat:** Akun dengan hak akses API (Ketua/Superadmin).
- **Langkah:** Kirim *request* POST dengan *payload* JSON valid, ditambah `{"malicious_param": "hacked", "total_persentase": 150}`.
- **Hasil Lolos Audit:** API melempar *HTTP 400 Bad Request* atau 422 Unprocessable Entity berisi `Validation Error: Unrecognized key(s)`.

**E. Remediasi / Best Practice**
Gunakan skema **Zod** dengan `.strict()` untuk menolak atribut asing dan memvalidasi batas nilai secara matematis.
```typescript
import { z } from 'zod';

const ShuConfigSchema = z.object({
  dana_cadangan: z.number().min(0).max(100),
  // ... field lain
}).strict(); // ✅ FIX: Membuang/menolak key yang tidak terdaftar

export async function POST(req: Request) {
  const body = await req.json();
  const safeData = ShuConfigSchema.parse(body); // Melempar exception jika invalid
  // ... simpan safeData
}
```

---

### 4. CAPACITOR ANDROID APK & NETWORK SECURITY (MITM)

**A. Deskripsi Celah Keamanan**
Penggunaan mode *Remote Server* di Capacitor (`http://192.168.20.17:3000`) pada *environment production* sangat berisiko. Jika konfigurasi Android manifest mengizinkan *Cleartext Traffic* (`usesCleartextTraffic="true"`), koneksi terjadi tanpa enkripsi SSL/TLS, membuka peluang Man-In-The-Middle (MITM) Attack.

**B. Skenario Serangan**
Seorang kasir/anggota menggunakan APK versi produksi di jaringan WiFi publik/kantor. Penyerang di LAN yang sama melakukan *ARP Spoofing* dan menjalankan Wireshark. Karena koneksi tidak dienkripsi via HTTPS, penyerang dapat membaca JWT Auth Session, *password* (saat form *login* disubmit), dan riwayat finansial dalam bentuk *plaintext*. Penyerang lalu mengambil alih (hijack) sesi korban.

**C. Contoh Kode/Arsitektur yang Rentan**
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
    android:allowBackup="true"
    android:usesCleartextTraffic="true" <!-- 🚨 RENTAN JIKA MASUK PRODUKSI -->
>
```

**D. Security Test Case**
- **Prasyarat:** Build APK *Release*. Berada di jaringan yang sama dengan target.
- **Langkah:** Gunakan *packet sniffer* (Wireshark) dan tangkap paket HTTP yang menuju IP server aplikasi.
- **Hasil Lolos Audit:** Tidak ada paket *plaintext* yang terbaca. Jika aplikasi dipaksa mengakses *http://*, Android WebView langsung memblokirnya dan memicu halaman *Offline Error Page*.

**E. Remediasi / Best Practice**
1. Ubah konfigurasi untuk produksi menjadi **HTTPS wajib**.
2. Modifikasi `capacitor.config.ts`: `url: 'https://api.koperasisulfindo.id'`.
3. Di `AndroidManifest.xml`, hapus `usesCleartextTraffic="true"` atau set ke `"false"`.
4. Di NextAuth, pastikan `useSecureCookies: true` di lingkungan `production`.

---

### 5. BUSINESS LOGIC FLAW IN POS & ONLINE ORDERS

**A. Deskripsi Celah Keamanan**
Celah pada manajemen *State* dan *Concurrency*. Tanpa transaksi basis data yang *atomic* (Pessimistic/Optimistic Locking) dan validasi nilai absolut, aplikasi rentan terhadap dua serangan logika:
1. **Race Condition / Double Spending:** Melebihi limit *Paylater* atau Stok Barang.
2. **Negative Value/Quantity Injection:** Memasukkan nilai minus pada kuantitas *cart*.

**B. Skenario Serangan**
- **Race Condition:** Kasir melakukan *checkout* POS produk seharga Rp 50.000 dengan metode Paylater (Limit sisa Rp 50.000). Penyerang menggunakan Burp Suite *Intruder* untuk mengirim 10 *request checkout* secara instan. Karena Prisma mengecek saldo di *memori* sebelum *update*, 10 transaksi lolos bersamaan, limit Paylater jebol jadi **minus Rp 450.000**.
- **Negative Value:** Penyerang mengubah kuantitas barang `Beras` di *cart* menjadi `-10`. Total pembayaran menjadi negatif (-Rp 1.500.000). Sistem membacanya sebagai "Sistem Koperasi Berhutang ke Penyerang", menambah *balance* penyerang alih-alih memotongnya.

**C. Contoh Kode/Arsitektur yang Rentan**
```typescript
// lib/actions/pos.ts
// 🚨 RENTAN: Kalkulasi qty negatif
const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0); 

// 🚨 RENTAN: Check-then-act pattern (Race Condition)
const user = await prisma.users.findUnique(userId);
if(user.paylater_limit >= total) {
  await prisma.users.update({ data: { paylater_limit: user.paylater_limit - total } });
}
```

**D. Security Test Case**
- **Langkah (Race):** Tembak endpoint `createOnlineOrder` dengan *method* Paylater sebanyak 15 kali dalam 1 detik (*concurrently*).
- **Hasil (Lolos):** Hanya 1 order yang terproses, sisanya merespons dengan *error* limit.
- **Langkah (Negative):** Kirim payload `items: [{ po_id: 1, qty: -5 }]`.
- **Hasil (Lolos):** *Error validation* "Quantity must be greater than 0" atau "Data keranjang tidak valid".

**E. Remediasi / Best Practice**
Terapkan *Atomic Update* di Prisma dan Validasi Ketat Zod.
```typescript
// 1. Zod Validation (Tolak Angka Negatif)
const CartItemSchema = z.object({ qty: z.number().int().positive() });

// 2. Atomic Decrement (Pencegah Race Condition Level Database)
await prisma.users.update({
  where: { id: userId },
  data: { 
    paylater_limit: { decrement: totalCost } // ✅ FIX: DB langsung memotong, hindari memori check
  }
});
```

---

### 6. DATABASE CONSTRAINT & ENUM HANDLING (PREVENTING CRASH/DOS)

**A. Deskripsi Celah Keamanan**
Sistem menggunakan Enum di Prisma (`pending`, BUKAN `submitted`). Jika input pengguna tidak divalidasi dan langsung dilempar ke operasi Prisma, *string* invalid akan memicu `PrismaClientValidationError` (Unhandled Promise Rejection) yang bisa membuat Server Actions macet atau Next.js Server mengalami *crash* (DoS level aplikasi).

**B. Skenario Serangan**
Penyerang membuat skrip perulangan (*loop*) yang mengeksploitasi fungsi `createLoanApplication` dengan mengirimkan *payload* `{"status": "DI_HACK"}`. Karena validasi diserahkan murni pada form UI, ketika *request* lolos via API, server Next.js secara masif melempar *exception internal*, menghabiskan *resource* komputasi (CPU/Memory Log), lalu berakhir dengan HTTP 502/503.

**C. Contoh Kode/Arsitektur yang Rentan**
```typescript
export async function submitLoan(data: any) {
  // 🚨 RENTAN: Tidak ada blok Try-Catch dan validasi Enum Enum
  await prisma.loan_applications.create({
    data: {
      amount: data.amount,
      status: data.status // Penyerang kirim "submitted" atau "hack"
    }
  });
}
```

**D. Security Test Case**
- **Langkah:** Eksekusi HTTP POST langsung ke Server Action terkait pinjaman, masukan `status: "INVALID_STATUS"`.
- **Hasil Lolos Audit:** Aplikasi tidak *crash*. API mengembalikan respons JSON/Object yang rapi dan elegan, contoh: `{ success: false, message: "Invalid application status" }`.

**E. Remediasi / Best Practice**
Bungkus semua operasi database dengan `try-catch` standar operasi, dan validasi Enum sebelum interaksi ORM.
```typescript
const validStatus = z.enum(["pending", "approved", "rejected"]);

export async function submitLoan(data: any) {
  try {
    const status = validStatus.parse(data.status); // Gagal di Zod sebelum menyentuh Prisma
    
    await prisma.loan_applications.create({
      data: { ...data, status }
    });
  } catch (error) {
    // ✅ FIX: Graceful fail
    console.error("[LOAN_ERROR]", error);
    return { success: false, error: "Input atau status tidak valid" };
  }
}
```
