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
  savingsBalance: number;
  savingsWeight: number;
  jasaModal: number;
  bungaPaid: number;
  belanjaPaid: number;
  activityWeight: number;
  jasaUsaha: number;
  totalShu: number;
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
  zakatTotal?: number;
  csrTotal?: number;
  totalSimpananSeluruh: number;
  totalBungaSeluruh: number;
  totalBelanjaSeluruh: number;
  members: MemberShuProjection[];
}

/**
 * Helper: Mengambil konfigurasi SHU aktif dari app_settings.
 * 
 * @returns {Promise<ShuConfig>} Konfigurasi SHU
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
 * @returns {Promise<number>} Total simpanan anggota
 */
async function getMemberSavingsForShu(memberId: bigint, komponen: string[]): Promise<number> {
  try {
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
  } catch (error) {
    console.error(`Error in getMemberSavingsForShu for member ${memberId}:`, error);
    throw error;
  }
}

/**
 * Helper: Menghitung total bunga pinjaman yang dilunasi anggota pada tahun berjalan.
 * 
 * @param {bigint} memberId ID Anggota
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>} Total bunga dibayar
 * @throws {Error} Mengembalikan error jika terjadi kesalahan query database
 */
async function getMemberActivityInterestPaid(memberId: bigint, startDate: Date, endDate: Date): Promise<number> {
  try {
    const aggregate = await prisma.loan_schedules.aggregate({
      where: {
        loans: { member_id: memberId },
        status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { interest_paid: true },
    });
    return Number(aggregate._sum.interest_paid ?? 0);
  } catch (error) {
    console.error(`Error in getMemberActivityInterestPaid for member ${memberId}:`, error);
    throw error;
  }
}

/**
 * Helper: Menghitung total belanja lunas anggota pada tahun berjalan.
 * 
 * @param {bigint} memberId ID Anggota
 * @param {Date} startDate Tanggal awal
 * @param {Date} endDate Tanggal akhir
 * @returns {Promise<number>} Total belanja paid
 */
async function getMemberActivityStorePaid(memberId: bigint, startDate: Date, endDate: Date): Promise<number> {
  try {
    const aggregate = await prisma.orders.aggregate({
      where: {
        member_id: memberId,
        payment_status: "paid",
        paid_at: { gte: startDate, lte: endDate },
      },
      _sum: { grand_total: true },
    });
    return Number(aggregate._sum.grand_total ?? 0);
  } catch (error) {
    console.error(`Error in getMemberActivityStorePaid for member ${memberId}:`, error);
    throw error;
  }
}

/**
 * Menghitung alokasi makro SHU berdasarkan konfigurasi persentase.
 * 
 * @param {number} totalShu Total SHU Bersih
 * @param {ShuConfig} config Konfigurasi persentase alokasi
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
 * Helper: Menghitung proyeksi SHU satu anggota aktif.
 * 
 * @param {any} member Objek anggota dari DB
 * @param {ShuConfig} config Konfigurasi SHU
 * @param {Date} startDate Awal tahun buku
 * @param {Date} endDate Akhir tahun buku
 */
async function calculateIndividualMemberProjection(
  member: any,
  config: ShuConfig,
  startDate: Date,
  endDate: Date
) {
  const savingsBalance = await getMemberSavingsForShu(member.id, config.formula_jasa_modal.komponen_simpanan);
  const bungaPaid = await getMemberActivityInterestPaid(member.id, startDate, endDate);
  const belanjaPaid = await getMemberActivityStorePaid(member.id, startDate, endDate);

  return {
    memberId: member.id.toString(),
    memberNo: member.member_code,
    memberName: member.full_name,
    savingsBalance,
    bungaPaid,
    belanjaPaid,
  };
}

/**
 * Helper: Menghitung bobot & nilai SHU akhir dari data sementara anggota.
 * 
 * @param {any[]} tempMembersData Data individual sementara anggota
 * @param {number} totalSimpananSeluruh Total simpanan seluruh anggota
 * @param {number} totalBungaSeluruh Total bunga pinjaman dibayar seluruh anggota
 * @param {number} totalBelanjaSeluruh Total belanja lunas seluruh anggota
 * @param {number} jasaModalTotal Total alokasi jasa modal makro
 * @param {number} jasaUsahaTotal Total alokasi jasa usaha makro
 * @param {ShuConfig} config Konfigurasi SHU aktif
 */
function mapMembersToShuProjection(
  tempMembersData: any[],
  totalSimpananSeluruh: number,
  totalBungaSeluruh: number,
  totalBelanjaSeluruh: number,
  jasaModalTotal: number,
  jasaUsahaTotal: number,
  config: ShuConfig
): MemberShuProjection[] {
  return tempMembersData.map((m) => {
    const savingsWeight = totalSimpananSeluruh > 0 ? (m.savingsBalance / totalSimpananSeluruh) : 0;
    const jasaModal = savingsWeight * jasaModalTotal;

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

    const zakatRate = config.zakat_rate ?? 0;
    const csrRate = config.csr_rate ?? 0;
    const zakatTotal = Number(((zakatRate / 100) * totalShu).toFixed(2));
    const csrTotal = Number(((csrRate / 100) * totalShu).toFixed(2));

    const netShuToDistribute = Math.max(0, totalShu - zakatTotal - csrTotal);

    const macros = calculateMacroAllocations(netShuToDistribute, config);
    const jasaModalTotal = (config.jasa_anggota_bobot.modal / 100) * macros.jasaAnggotaTotal;
    const jasaUsahaTotal = (config.jasa_anggota_bobot.usaha / 100) * macros.jasaAnggotaTotal;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const activeMembers = await prisma.member.findMany({
      where: { status: "active" },
      orderBy: { member_code: "asc" },
    });

    const tempMembersData = [];
    let totalSimpananSeluruh = 0, totalBungaSeluruh = 0, totalBelanjaSeluruh = 0;

    for (const member of activeMembers) {
      const p = await calculateIndividualMemberProjection(member, config, startDate, endDate);
      totalSimpananSeluruh += p.savingsBalance;
      totalBungaSeluruh += p.bungaPaid;
      totalBelanjaSeluruh += p.belanjaPaid;
      tempMembersData.push(p);
    }

    const members = mapMembersToShuProjection(
      tempMembersData, totalSimpananSeluruh, totalBungaSeluruh, totalBelanjaSeluruh,
      jasaModalTotal, jasaUsahaTotal, config
    );

    return {
      year,
      totalNetIncome: totalShu,
      jasaAnggotaTotal: macros.jasaAnggotaTotal,
      jasaModalTotal,
      jasaUsahaTotal,
      cadanganTotal: macros.cadanganTotal,
      pengurusTotal: macros.pengurusTotal,
      pegawaiTotal: macros.pegawaiTotal,
      pendidikanTotal: macros.pendidikanTotal,
      sosialTotal: macros.sosialTotal,
      zakatTotal,
      csrTotal,
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
 * Helper: Validasi apakah periode tahun buku SHU sudah pernah dibagikan.
 * 
 * @param {any} tx Prisma transaction client
 * @param {bigint} unitId ID Unit Koperasi
 * @param {number} year Tahun RAT
 */
async function validateDistributionPeriod(tx: any, unitId: bigint, year: number): Promise<void> {
  const existingPeriod = await tx.shu_periods.findUnique({
    where: { unit_id_period_year: { unit_id: unitId, period_year: year } },
  });
  if (existingPeriod && existingPeriod.status === "distributed") {
    throw new Error("SHU tahun ini sudah pernah didistribusikan.");
  }
}

/**
 * Helper: Mencari Jenis Simpanan Sukarela dari database.
 * 
 * @param {any} tx Prisma transaction client
 */
async function getSukarelaSavingType(tx: any) {
  const sukarelaType = await tx.saving_types.findFirst({
    where: {
      OR: [
        { code: "SUKARELA" },
        { name: { contains: "Sukarela" } }
      ]
    }
  });
  if (!sukarelaType) {
    throw new Error("Jenis simpanan Sukarela tidak ditemukan. Silakan konfigurasi simpanan sukarela terlebih dahulu.");
  }
  return sukarelaType;
}

/**
 * Helper: Memproses alokasi simpanan sukarela & pencatatan transaksi untuk satu anggota secara aman.
 * 
 * @param {any} tx Prisma transaction client
 * @param {any} m Data proyeksi SHU anggota
 * @param {bigint} periodId ID Periode SHU terdaftar
 * @param {bigint} sukarelaTypeId ID Jenis Simpanan Sukarela
 * @param {number} year Tahun Buku RAT
 * @param {bigint} userId ID Pengguna/Eksekutor Audit
 */
async function processIndividualMemberShu(
  tx: any, 
  m: any, 
  periodId: bigint, 
  sukarelaTypeId: bigint, 
  year: number, 
  userId: bigint
): Promise<void> {
  const memberId = BigInt(m.memberId);

  await tx.shu_distributions.upsert({
    where: { shu_period_id_member_id: { shu_period_id: periodId, member_id: memberId } },
    create: {
      shu_period_id: periodId,
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

  const memberSaving = await tx.savings.findUnique({
    where: { member_id_saving_type_id: { member_id: memberId, saving_type_id: sukarelaTypeId } },
  });

  const balanceBefore = Number(memberSaving?.balance ?? 0);
  const balanceAfter = balanceBefore + m.totalShu;

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
        saving_type_id: sukarelaTypeId,
        balance: balanceAfter,
        total_deposit: m.totalShu,
        total_withdraw: 0,
      },
    });
  }

  const activeSaving = memberSaving || await tx.savings.findUnique({
    where: { member_id_saving_type_id: { member_id: memberId, saving_type_id: sukarelaTypeId } },
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
        processed_by: userId,
        transaction_at: new Date(),
      },
    });
  }
}

/**
 * Mengeksekusi distribusi SHU massal aman ke simpanan sukarela masing-masing anggota.
 * 
 * @param {number} year Tahun RAT / SHU yang dibagikan
 * @returns {Promise<{ success: boolean; error?: string }>} Hasil eksekusi
 */
export async function distributeSHUMassal(year: number): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Tidak terautentikasi." };

    const firstUnit = await prisma.unit.findFirst();
    const unitId = firstUnit ? firstUnit.id : BigInt(1);

    const report = await getSHUProjection(year);
    if (report.totalNetIncome <= 0) {
      return { success: false, error: "Total SHU Bersih tahun berjalan bernilai nol atau negatif, tidak bisa dibagikan." };
    }

    const labaRugi = await getLabaRugi(year);

    await prisma.$transaction(async (tx) => {
      await validateDistributionPeriod(tx, unitId, year);
      const sukarelaType = await getSukarelaSavingType(tx);

      const period = await tx.shu_periods.upsert({
        where: { unit_id_period_year: { unit_id: unitId, period_year: year } },
        create: {
          unit_id: unitId,
          period_year: year,
          total_revenue: labaRugi.revenue.totalRevenue,
          total_expense: labaRugi.expenses.totalExpenses,
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

      for (const m of report.members) {
        if (m.totalShu <= 0) continue;
        await processIndividualMemberShu(tx, m, period.id, sukarelaType.id, year, BigInt(userId));
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
  } catch (error: any) {
    console.error("Error in distributeSHUMassal:", error);
    return { success: false, error: error.message || "Gagal memproses pembagian massal SHU." };
  }
}
