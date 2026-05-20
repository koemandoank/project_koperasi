# Panduan Build Aplikasi Android (APK) - Koperasi Sulfindo

Dokumen ini berisi instruksi teknis *step-by-step* untuk mem-build aplikasi web Next.js Koperasi Sulfindo menjadi aplikasi Android (APK) yang siap rilis menggunakan kerangka kerja **Capacitor**.

---

## 1. Persiapan Lingkungan Dasar
Sebelum memulai, pastikan perangkat komputer/server yang digunakan untuk *build* telah terpasang:
- **Node.js** (Minimal versi 18.x)
- **Android Studio** beserta Android SDK (Minimal API 22 / Android 5.1).
- **Java Development Kit (JDK)** (Minimal versi 17).

---

## 2. Konfigurasi Server URL (Sangat Penting)
Karena sistem ini berbasis Next.js Server-Side (membutuhkan Node.js untuk fitur seperti Server Actions, Prisma DB, dan Auth.js), APK bertindak sebagai pembungkus (*wrapper*) *WebView* yang mengarah ke server produksi Koperasi.

1. Buka file `capacitor.config.ts` di *root* folder proyek.
2. Ubah atribut `url` pada blok `server` agar mengarah ke domain aplikasi yang sudah di-hosting (contoh: `https://koperasi-sulfindo.id`).

```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.koperasi.sulfindo',
  appName: 'KOEMAN-PROJECT',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://[DOMAIN_ATAU_IP_PRODUCTION_ANDA]', // <- UBAH BAGIAN INI
    cleartext: true // Izinkan HTTP biasa jika belum menggunakan HTTPS
  }
};
export default config;
```

---

## 3. Generate App Icon & Splash Screen
Pastikan Anda memiliki gambar `icon.jpg` atau `icon.png` di direktori utama. Proses ini akan mengoptimalkan resolusi logo ke seluruh ukuran layar perangkat Android.

1. Buka terminal di direktori proyek (`koperasi-sulfindo`).
2. Install alat bantu pembuat aset:
   ```bash
   npm install -g @capacitor/assets
   ```
3. Generate aset untuk Android:
   ```bash
   npx capacitor-assets generate --android
   ```

---

## 4. Sinkronisasi Modul Android
Agar konfigurasi Capacitor versi terbaru diterapkan ke dalam folder proyek native Android (`android/`), jalankan perintah:

```bash
npx cap sync android
```

---

## 5. Pembuatan Signing Key (Keystore)
Langkah ini diwajibkan agar Android mengenali pembuat aplikasi (menghindari blokir keras dari *Google Play Protect*). Anda hanya perlu membuat *Keystore* ini **satu kali**.

Jalankan perintah ini di terminal:
```bash
keytool -genkey -v -keystore koperasi-release.keystore -alias koperasi_alias -keyalg RSA -keysize 2048 -validity 10000
```
*Catatan: Masukkan password baru (harus diingat) dan isi data organisasi/koperasi saat diminta. Setelah selesai, pindahkan file `koperasi-release.keystore` ke dalam direktori `android/app/`.*

---

## 6. Konfigurasi Keystore untuk Proses Build Rilis
Buka file konfigurasi utama Android di `android/app/build.gradle`. 
Tambahkan blok kredensial tepat di bawah atribut `android { ... }` sebagai berikut:

```groovy
android {
    // ... konfigurasi lain

    // TAMBAHKAN BLOK INI:
    signingConfigs {
        release {
            storeFile file("koperasi-release.keystore")
            storePassword "MASUKAN_PASSWORD_ANDA"
            keyAlias "koperasi_alias"
            keyPassword "MASUKAN_PASSWORD_ANDA"
        }
    }

    buildTypes {
        release {
            // AKTIFKAN SIGNING RELEASE
            signingConfig signingConfigs.release 
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 7. Eksekusi Build APK
Semua konfigurasi telah siap. Sekarang saatnya meng-compile (merakit) kode sumber menjadi *installer* APK.

1. Masuk ke direktori Android:
   ```bash
   cd android
   ```
2. Jalankan perintah *Assemble Release*:
   
   **Di Windows (Powershell/CMD):**
   ```bash
   .\gradlew assembleRelease
   ```
   **Di MacOS/Linux:**
   ```bash
   ./gradlew assembleRelease
   ```

*Tunggu hingga terminal menampilkan log: **"BUILD SUCCESSFUL in ...s"**.*

---

## 8. Lokasi File Output
Setelah berhasil di-build, *installer* Android (*.apk*) Anda yang siap untuk didistribusikan kepada Anggota Koperasi berada di jalur folder berikut:

```
koperasi-sulfindo/android/app/build/outputs/apk/release/app-release.apk
```

**STATUS**: SIAP DIDISTRIBUSIKAN / READY FOR PRODUCTION.
