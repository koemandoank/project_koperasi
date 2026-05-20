import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.koperasi.sulfindo',
  appName: 'KOEMAN-PROJECT',
  webDir: 'public', // Placeholder, we are using remote server mode
  server: {
    // Ganti URL di bawah ini dengan domain production koperasi setelah di-hosting
    url: 'https://api.koperasisulfindo.id',
    cleartext: false
  }
};

export default config;
