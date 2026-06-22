import { getRatQuorumStatus, getRatMembersAttendanceList, RatMemberAttendance } from "@/lib/actions/rat-absensi"
import { getReportTemplateConfig } from "@/lib/actions/settings"
import { RatAbsensiClient } from "./rat-absensi-client"

/**
 * Server page untuk Manajemen Absensi & Hak Suara RAT.
 * Mengambil data status kuorum, daftar kehadiran anggota, dan konfigurasi laporan.
 *
 * @returns {Promise<JSX.Element>} Halaman manajemen absensi RAT
 */
export default async function RatAbsensiPage() {
  const currentYear = new Date().getFullYear()

  let initialQuorum = null
  let initialAttendance: RatMemberAttendance[] = []
  let templateConfig = null

  try {
    const [quorumRes, attendanceRes, configRes] = await Promise.all([
      getRatQuorumStatus(currentYear),
      getRatMembersAttendanceList(currentYear),
      getReportTemplateConfig(),
    ])

    if (quorumRes.success && quorumRes.status) {
      initialQuorum = quorumRes.status
    }
    initialAttendance = attendanceRes
    templateConfig = configRes
  } catch (error) {
    console.error("Error loading RAT Absensi page:", error)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Absensi & Hak Suara RAT</h1>
        <p className="text-muted-foreground">
          Pencatatan kehadiran anggota RAT secara real-time, pemantauan pencapaian kuorum, serta pengelolaan status hak suara pemilihan.
        </p>
      </div>

      <RatAbsensiClient
        initialQuorum={initialQuorum}
        initialAttendance={initialAttendance}
        initialYear={currentYear}
        templateConfig={templateConfig}
      />
    </div>
  )
}
