"use server"

import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import { getLabaRugi } from "@/lib/actions/laporan-keuangan"
import { ShuConfig, DEFAULT_SHU_CONFIG } from "@/lib/types/shu-config.types"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/actions/log-audit"

export interface MemberShuProjection {
  memberId: string;
  memberNo: string;
  memberName: string;
  savingsBalance: number;       // total simpanan yang dihitung
  savingsWeight: number;        // proporsi simpanan dibanding total simpanan seluruh anggota
  jasaModal: number;            // Hak SHU Jasa Modal
  bungaPaid: number;            // Total bunga pinjaman yang dibayar
  belanjaPaid: number;          // Total belanja toko yang paid
  activityWeight: number;       // Bobot partisipasi usaha anggota
  jasaUsaha: number;            // Hak SHU Jasa Usaha
  totalShu: number;             // Total SHU diterima (jasa modal + jasa usaha)
}

export interface ShuProjectionReport {
  year: number;
  totalNetIncome: number;
  jasaAnggotaTotal: number;
  jasaModalTotal: number;
  jasaUsahaTotal: number;
  cadanganTotal: number;
  pengurusTotal: number;
  pegawaiTotal: number;
  pendidikanTotal: number;
  sosialTotal: number;
  totalSimpananSeluruh: number;
  totalBungaSeluruh: number;
  totalBelanjaSeluruh: number;
  members: MemberShuProjection[];
}

/**
 * Helper: Mengambil konfigurasi SHU aktif dari app_settings.
 * 
 * @returns {Promise<ShuConfig>}
 */
async function getShuConfig(): Promise<ShuConfig> {
  try {
    const settings = await prisma.app_settings.findFirst();
    if (!settings?.shu_config) return DEFAULT_SHU_CONFIG;
    return JSON.parse(settings.shu_config) as ShuConfig;
  } catch (error) {
    console.error("Error loading SHU config:", error);
    return DEFAULT_SHU_CONFIG;
  }
}

/**
 * Helper: Menghitung total simpanan anggota untuk komponen yang dihitung dalam jasa modal.
 * 
 * @param {bigint} memberId ID Anggota
 * @param {string[]} komponen Komponen simpanan (pokok, wajib, sukarela_berjangka)
 * @returns {Promise<number>}
 */
async function getMemberSavingsForShu(memberId: bigint, komponen: string[]): Promise<number> {
  const savings = await prisma.savings.findMany({
    where: { member_id: memberId },
    include: { saving_types: true },
  });

  let total = 0;
  for (const s of savings) {
    const code = s.saving_types.code.toLowerCase();
    const name = s.saving_types.name.toLowerCase();

    const isPokok = code.includes("pokok") || name.includes("pokok");
    const isWajib = code.includes("wajib") || name.includes("wajib");
    const isSukarela = code.includes("sukarela") || name.includes("sukarela") || code.includes("berjangka") || name.includes("berjangka");

    if (isPokok && komponen.includes("pokok")) {
      total += Number(s.balance);
    } else if (isWajib && komponen.includes("wajib")) {
      total += Number(s.balance);
    } else if (isSukarela && komponen.includes("sukarela_berjangka")) {
      total += Number(s.balance);
    }
  }
  return total;
}

/**
 * Helper: Menghitung total bunga pinjaman yang dilunasi anggota pada tahun berjalan.
 */
async function getMemberActivityInterestPaid(memberId: bigint, startDate: Date, endDate: Date): Promise<number> {
  const aggregate = await prisma.loan_payments.aggregate({
    where: {
      loans: { member_id: memberId },
      paid_at: { gte: startDate, lte: endDate },
    },
    _sum: { interest_portion: true },
  });
  return Number(aggregate._sum.interest_portion ?? 0);
}

/**
 * Helper: Menghitung total belanja lunas anggota pada tahun berjalan.
 */
async function getMemberActivityStorePaid(memberId: bigint, startDate: Date, endDate: Date): Promise<number> {
  const aggregate = await prisma.orders.aggregate({
    where: {
      member_id: memberId,
      payment_status: "paid",
      paid_at: { gte: startDate, lte: endDate },
    },
    _sum: { grand_total: true },
  });
  return Number(aggregate._sum.grand_total ?? 0);
}

/**
 * Menghitung alokasi makro SHU berdasarkan konfigurasi persentase.
 */
function calculateMacroAllocations(totalShu: number, config: ShuConfig) {
  const p = config.alokasi;
  return {
    jasaAnggotaTotal: (p.jasa_anggota / 100) * totalShu,
    cadanganTotal: (p.cadangan / 100) * totalShu,
    pengurusTotal: (p.pengurus / 100) * totalShu,
    pegawaiTotal: (p.pegawai / 100) * totalShu,
    pendidikanTotal: (p.pendidikan / 100) * totalShu,
    sosialTotal: (p.sosial_pembangunan / 100) * totalShu,
  };
}

/**
 * Mengambil proyeksi perhitungan SHU massal per anggota secara real-time.
 * 
 * @param {number} year Tahun RAT
 * @returns {Promise<ShuProjectionReport>} Laporan proyeksi SHU
 */
export async function getSHUProjection(year: number): Promise<ShuProjectionReport> {
  try {
    const config = await getShuConfig();
    const labaRugi = await getLabaRugi(year);
    const totalShu = labaRugi.netShu;

    // Alokasi Makro
    const macros = calculateMacroAllocations(totalShu, config);
    const jasaAnggotaTotal = macros.jasaAnggotaTotal;
    
    // Jasa Modal & Usaha
    const jasaModalTotal = (config.jasa_anggota_bobot.modal / 100) * jasaAnggotaTotal;
    const jasaUsahaTotal = (config.jasa_anggota_bobot.usaha / 100) * jasaAnggotaTotal;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // Ambil semua anggota aktif
    const activeMembers = await prisma.member.findMany({
      where: { status: "active" },
      orderBy: { member_code: "asc" },
    });

    const tempMembersData = [];
    let totalSimpananSeluruh = 0;
    let totalBungaSeluruh = 0;
    let totalBelanjaSeluruh = 0;

    // Fetch data individual
    for (const member of activeMembers) {
      const savingsBalance = await getMemberSavingsForShu(member.id, config.formula_jasa_modal.komponen_simpanan);
      const bungaPaid = await getMemberActivityInterestPaid(member.id, startDate, endDate);
      const belanjaPaid = await getMemberActivityStorePaid(member.id, startDate, endDate);

      totalSimpananSeluruh += savingsBalance;
      totalBungaSeluruh += bungaPaid;
      totalBelanjaSeluruh += belanjaPaid;

      tempMembersData.push({
        memberId: member.id.toString(),
        memberNo: member.member_code,
        memberName: member.full_name,
        savingsBalance,
        bungaPaid,
        belanjaPaid,
      });
    }

    // Kalkulasi bobot & nilai SHU individu
    const members: MemberShuProjection[] = tempMembersData.map((m) => {
      const savingsWeight = totalSimpananSeluruh > 0 ? (m.savingsBalance / totalSimpananSeluruh) : 0;
      const jasaModal = savingsWeight * jasaModalTotal;

      // Bobot Aktivitas Usaha Lintas Unit (Seksi C)
      const bobotSp = config.bobot_unit.simpan_pinjam / 100;
      const bobotToko = config.bobot_unit.toko / 100;

      const spWeight = totalBungaSeluruh > 0 ? (m.bungaPaid / totalBungaSeluruh) : 0;
      const tokoWeight = totalBelanjaSeluruh > 0 ? (m.belanjaPaid / totalBelanjaSeluruh) : 0;

      const activityWeight = (spWeight * bobotSp) + (tokoWeight * bobotToko);
      const jasaUsaha = activityWeight * jasaUsahaTotal;

      return {
        ...m,
        savingsWeight,
        jasaModal: Number(jasaModal.toFixed(2)),
        activityWeight,
        jasaUsaha: Number(jasaUsaha.toFixed(2)),
        totalShu: Number((jasaModal + jasaUsaha).toFixed(2)),
      };
    });

    return {
      year,
      totalNetIncome: totalShu,
      jasaAnggotaTotal,
      jasaModalTotal,
      jasaUsahaTotal,
      cadanganTotal: macros.cadanganTotal,
      pengurusTotal: macros.pengurusTotal,
      pegawaiTotal: macros.pegawaiTotal,
      pendidikanTotal: macros.pendidikanTotal,
      sosialTotal: macros.sosialTotal,
      totalSimpananSeluruh,
      totalBungaSeluruh,
      totalBelanjaSeluruh,
      members,
    };
  } catch (error) {
    console.error("Error in getSHUProjection:", error);
    throw error;
  }
}

/**
 * Mengeksekusi distribusi SHU massal aman ke simpanan sukarela masing-masing anggota.
 * 
 * @param {number} year Tahun RAT / SHU yang dibagikan
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export async function distributeSHUMassal(year: number): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Tidak terautentikasi." };

    const firstUnit = await prisma.unit.findFirst();
    const unitId = firstUnit ? firstUnit.id : BigInt(1);

    // Cek apakah tahun ini sudah terdistribusi
    const existingPeriod = await prisma.shu_periods.findUnique({
      where: { unit_id_period_year: { unit_id: unitId, period_year: year } },
    });
    if (existingPeriod && existingPeriod.status === "distributed") {
      return { success: false, error: "SHU tahun ini sudah pernah didistribusikan." };
    }

    // Ambil kalkulasi real-time
    const report = await getSHUProjection(year);
    if (report.totalNetIncome <= 0) {
      return { success: false, error: "Total SHU Bersih tahun berjalan bernilai nol atau negatif, tidak bisa dibagikan." };
    }

    // Cari Simpanan Sukarela Type
    const sukarelaType = await prisma.saving_types.findFirst({
      where: {
        OR: [
          { code: "SUKARELA" },
          { name: { contains: "Sukarela" } }
        ]
      }
    });
    if (!sukarelaType) {
      return { success: false, error: "Jenis simpanan Sukarela tidak ditemukan. Silakan konfigurasi simpanan sukarela terlebih dahulu." };
    }

    // Eksekusi Mass Transaction
    await prisma.$transaction(async (tx) => {
      // 1. Buat / Update Periode SHU
      const period = await tx.shu_periods.upsert({
        where: { unit_id_period_year: { unit_id: unitId, period_year: year } },
        create: {
          unit_id: unitId,
          period_year: year,
          total_revenue: report.totalNetIncome + report.cadanganTotal, // proxy omzet
          total_expense: report.cadanganTotal + report.pengurusTotal + report.pegawaiTotal,
          total_shu: report.totalNetIncome,
          shu_for_member: report.jasaAnggotaTotal,
          shu_for_reserve: report.cadanganTotal,
          shu_for_pengurus: report.pengurusTotal,
          shu_for_education: report.pendidikanTotal,
          status: "distributed",
          calculated_at: new Date(),
          distributed_at: new Date(),
        },
        update: {
          total_shu: report.totalNetIncome,
          shu_for_member: report.jasaAnggotaTotal,
          shu_for_reserve: report.cadanganTotal,
          status: "distributed",
          distributed_at: new Date(),
        },
      });

      // 2. Loop dan salurkan ke setiap anggota
      for (const m of report.members) {
        if (m.totalShu <= 0) continue;

        const memberId = BigInt(m.memberId);

        // a. Catat di shu_distributions
        await tx.shu_distributions.upsert({
          where: { shu_period_id_member_id: { shu_period_id: period.id, member_id: memberId } },
          create: {
            shu_period_id: period.id,
            member_id: memberId,
            savings_weight: m.savingsWeight,
            activity_weight: m.activityWeight,
            shu_amount: m.totalShu,
            status: "disbursed",
            disbursement_method: "saving_credit",
            disbursed_at: new Date(),
          },
          update: {
            shu_amount: m.totalShu,
            status: "disbursed",
            disbursed_at: new Date(),
          },
        });

        // b. Ambil Saldo Sukarela Sebelumnya
        const memberSaving = await tx.savings.findUnique({
          where: { member_id_saving_type_id: { member_id: memberId, saving_type_id: sukarelaType.id } },
        });

        const balanceBefore = Number(memberSaving?.balance ?? 0);
        const balanceAfter = balanceBefore + m.totalShu;

        // c. Update Saldo Simpanan Sukarela Anggota
        if (memberSaving) {
          await tx.savings.update({
            where: { id: memberSaving.id },
            data: {
              balance: balanceAfter,
              total_deposit: { increment: m.totalShu },
              updated_at: new Date(),
            },
          });
        } else {
          await tx.savings.create({
            data: {
              member_id: memberId,
              saving_type_id: sukarelaType.id,
              balance: balanceAfter,
              total_deposit: m.totalShu,
              total_withdraw: 0,
            },
          });
        }

        // d. Tulis log transaksi tabungan
        const activeSaving = memberSaving || await tx.savings.findUnique({
          where: { member_id_saving_type_id: { member_id: memberId, saving_type_id: sukarelaType.id } },
        });

        if (activeSaving) {
          await tx.saving_transactions.create({
            data: {
              savings_id: activeSaving.id,
              member_id: memberId,
              type: "shu_credit",
              amount: m.totalShu,
              balance_before: balanceBefore,
              balance_after: balanceAfter,
              reference_no: `SHU-${year}-${m.memberNo}-${Date.now().toString().slice(-4)}`,
              note: `Penyaluran SHU Tahun Buku ${year} (Jasa Modal & Jasa Usaha)`,
              processed_by: BigInt(userId),
              transaction_at: new Date(),
            },
          });
        }
      }
    });

    revalidatePath("/akuntansi/pembagian-shu");
    revalidatePath("/laporan/partisipasi-anggota");

    await logAudit({
      action: "UPDATE",
      modelType: "shu_periods",
      modelId: null,
      newValues: {
        year,
        total_shu: report.totalNetIncome,
        shu_for_member: report.jasaAnggotaTotal,
        status: "distributed",
        note: `Distribusi massal SHU tahun buku ${year} sukses diposting ke simpanan sukarela anggota`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error in distributeSHUMassal:", error);
    return { success: false, error: "Gagal memproses pembagian massal SHU." };
  }
}
