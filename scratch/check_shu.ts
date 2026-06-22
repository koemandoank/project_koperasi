import { getSHUProjection } from "../src/lib/actions/shu-calculation"

async function run() {
  try {
    const res = await getSHUProjection(2026);
    console.log("SHU 2026 Projection Result:");
    console.log("Total Net Income (labaRugi.netShu):", res.totalNetIncome);
    console.log("Jasa Anggota Total:", res.jasaAnggotaTotal);
    console.log("Cadangan Total:", res.cadanganTotal);
    console.log("Pengurus Total:", res.pengurusTotal);
    console.log("Ketua Total:", res.ketuaTotal);
    console.log("Pegawai Total:", res.pegawaiTotal);
    console.log("zakatTotal:", res.zakatTotal);
    console.log("csrTotal:", res.csrTotal);
    console.log("Config alokasi:", JSON.stringify(res.config?.alokasi, null, 2));
  } catch (err) {
    console.error("Error running check:", err);
  }
}

run();
