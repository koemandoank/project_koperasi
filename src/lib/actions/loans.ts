"use server"

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logAudit } from "@/lib/actions/log-audit";
import { verifySessionAndRole } from "@/lib/auth-helpers";
import { deleteCache } from "@/lib/cache";
import { z } from "zod";
import { calculatePagination, getPaginationMeta } from "@/lib/utils/pagination";
import { loanApplicationSchema } from "@/lib/validations";

/** Check if a loan application violates any of the active loan rules */
export async function checkLoanRuleViolations(
  memberId: bigint,
  productId: bigint,
  amountRequested: number,
  applicationId: bigint
): Promise<string[]> {
  const violations: string[] = [];
  try {
    const { getLoanRules } = await import('./loan-rules');
    const rules = await getLoanRules();
    const productIdNum = Number(productId);

    // 1. Cek Batas Frekuensi Pengajuan / Bulan
    if (rules.max_loans_per_month.enabled && rules.max_loans_per_month.applied_to_products.includes(productIdNum)) {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const applicationsThisMonth = await prisma.loan_applications.count({
        where: {
          member_id: memberId,
          loan_product_id: productId,
          submitted_at: { gte: startOfMonth },
          id: { not: applicationId }
        }
      });
      if (applicationsThisMonth >= rules.max_loans_per_month.value) {
        violations.push(`Melebihi batas frekuensi pengajuan pinjaman per bulan (Maksimal ${rules.max_loans_per_month.value}x/bulan).`);
      }
    }

    // 2. Cek Strict Single Active Loan (Wajib Lunas)
    if (rules.strict_single_active_loan.enabled && rules.strict_single_active_loan.applied_to_products.includes(productIdNum)) {
      const activeProductLoans = await prisma.loans.count({
        where: {
          member_id: memberId,
          status: "active"
        }
      });
      if (activeProductLoans > 0) {
        violations.push("Pinjaman ditolak otomatis, karena masih ada pinjaman yang belum lunas");
      }
    }

    // 3. Cek Syarat Sisa Cicilan Maksimal (Top-Up)
    if (rules.min_remaining_installments_for_topup.enabled && rules.min_remaining_installments_for_topup.applied_to_products.includes(productIdNum)) {
      const activeLoan = await prisma.loans.findFirst({
        where: {
          member_id: memberId,
          status: "active",
          loan_applications: { loan_product_id: productId }
        },
        include: { loan_schedules: true }
      });
      
      if (activeLoan) {
        const remainingSchedules = activeLoan.loan_schedules.filter((s: any) => Number(s.principal_paid) < Number(s.principal_due)).length;
        if (remainingSchedules > rules.min_remaining_installments_for_topup.value) {
          violations.push(`Sisa cicilan pinjaman saat ini masih ${remainingSchedules}x. Batas top-up maksimal menyisakan ${rules.min_remaining_installments_for_topup.value}x cicilan.`);
        }
      }
    }

    // 4. Cek Maksimal Persentase Simpanan
    if (rules.max_loan_percentage_of_savings.enabled && rules.max_loan_percentage_of_savings.applied_to_products.includes(productIdNum)) {
      const totalSavings = await prisma.savings.aggregate({
        where: { member_id: memberId },
        _sum: { balance: true }
      });
      const balance = Number(totalSavings._sum?.balance ?? 0);
      const maxAllowed = balance * (rules.max_loan_percentage_of_savings.value / 100);
      
      if (amountRequested > maxAllowed) {
        violations.push(`Jumlah pengajuan (Rp ${amountRequested.toLocaleString('id-ID')}) melebihi ${rules.max_loan_percentage_of_savings.value}% saldo simpanan (Maksimal Rp ${maxAllowed.toLocaleString('id-ID')}).`);
      }
    }

  } catch (error) {
    console.error("checkLoanRuleViolations error:", error);
  }
  return violations;
}

/**
 * Server action to check loan rules violations in real-time before submission.
 * 
 * @param {number} productId - The selected loan product ID.
 * @param {number} amountRequested - The requested loan amount.
 * @returns {Promise<{ success: boolean; violations: string[] }>} Verification result containing rule violations.
 */
export async function checkLoanRuleViolationsAction(
  productId: number,
  amountRequested: number
): Promise<{ success: boolean; violations: string[] }> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, violations: ["Tidak terautentikasi"] };

    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { members: true }
    });
    if (!user?.members) return { success: false, violations: ["Data anggota tidak ditemukan"] };

    const violations = await checkLoanRuleViolations(
      user.members.id,
      BigInt(productId),
      amountRequested,
      BigInt(0)
    );

    return { success: true, violations };
  } catch (error) {
    console.error("checkLoanRuleViolationsAction error:", error);
    return { success: false, violations: ["Gagal memverifikasi aturan."] };
  }
}

/** Fetch all loan applications for admin/pengurus approval */
export async function getLoanApplications(statusFilter?: string): Promise<any[]>;
export async function getLoanApplications(
  statusFilter: string | undefined,
  page: number,
  pageSize: number
): Promise<{ data: any[]; pagination: any }>;
export async function getLoanApplications(
  statusFilter?: string,
  page?: number,
  pageSize?: number
): Promise<any> {
  try {
    const isPaginated = page !== undefined && pageSize !== undefined;
    const whereClause: any = {}
    if (statusFilter && statusFilter !== "all") {
      whereClause.status = statusFilter
    }

    if (isPaginated) {
      const { skip, take } = calculatePagination(page, pageSize);

      const [apps, total] = await Promise.all([
        prisma.loan_applications.findMany({
          where: whereClause,
          include: {
            members: true,
            loan_products: true,
          },
          orderBy: { created_at: "desc" },
          skip,
          take,
        }),
        prisma.loan_applications.count({
          where: whereClause,
        }),
      ]);

      const approvedApps = await prisma.loan_applications.findMany({
        where: { status: "approved" },
        orderBy: { approved_at: "asc" },
        select: { id: true }
      });
      const approvedIds = approvedApps.map((a: any) => Number(a.id));

      const data = await Promise.all(
        apps.map(async (a: any) => {
          const violations = a.status === "pending"
            ? await checkLoanRuleViolations(a.member_id, a.loan_product_id, Number(a.amount_requested), a.id)
            : [];

          return {
            id: Number(a.id),
            application_no: a.application_no,
            member_name: a.members?.full_name || "Unknown",
            member_nik: a.members?.nik || "-",
            product_name: a.loan_products?.name || "-",
            amount_requested: Number(a.amount_requested),
            tenor_months: a.tenor_months,
            purpose: a.purpose,
            status: a.status,
            repayment_method: a.repayment_method,
            submitted_at: a.submitted_at?.toISOString() || null,
            created_at: a.created_at?.toISOString() || null,
            rule_violations: violations,
            queue_number: a.status === "approved" ? approvedIds.indexOf(Number(a.id)) + 1 : null,
          };
        })
      );

      return {
        data,
        pagination: getPaginationMeta(total, page, pageSize),
      };
    } else {
      const apps = await prisma.loan_applications.findMany({
        where: whereClause,
        include: {
          members: true,
          loan_products: true,
        },
        orderBy: { created_at: "desc" }
      });

      const approvedApps = await prisma.loan_applications.findMany({
        where: { status: "approved" },
        orderBy: { approved_at: "asc" },
        select: { id: true }
      });
      const approvedIds = approvedApps.map((a: any) => Number(a.id));

      const data = await Promise.all(
        apps.map(async (a: any) => {
          const violations = a.status === "pending"
            ? await checkLoanRuleViolations(a.member_id, a.loan_product_id, Number(a.amount_requested), a.id)
            : [];

          return {
            id: Number(a.id),
            application_no: a.application_no,
            member_name: a.members?.full_name || "Unknown",
            member_nik: a.members?.nik || "-",
            product_name: a.loan_products?.name || "-",
            amount_requested: Number(a.amount_requested),
            tenor_months: a.tenor_months,
            purpose: a.purpose,
            status: a.status,
            repayment_method: a.repayment_method,
            submitted_at: a.submitted_at?.toISOString() || null,
            created_at: a.created_at?.toISOString() || null,
            rule_violations: violations,
            queue_number: a.status === "approved" ? approvedIds.indexOf(Number(a.id)) + 1 : null,
          };
        })
      );

      return data;
    }
  } catch (error) {
    console.error("getLoanApplications error:", error);
    if (page !== undefined && pageSize !== undefined) {
      return {
        data: [],
        pagination: getPaginationMeta(0, page, pageSize),
      };
    }
    return [];
  }
}

/** Count pending applications for notification badge */
export async function getPendingLoanCount() {
  try {
    const count = await prisma.loan_applications.count({
      where: { status: "pending" }
    });
    return count;
  } catch {
    return 0;
  }
}

/**
 * Approve atau reject pengajuan pinjaman oleh pengurus.
 * PENTING: Fungsi ini TIDAK pernah memeriksa loan rules.
 * Loan rules hanya berlaku pada tahap PENGAJUAN (submitLoanApplication).
 * Setelah pengurus approve, status pinjaman tidak bisa dibatalkan oleh rule.
 */
export async function updateLoanStatus(
  applicationId: number,
  action: "approve" | "reject",
  note?: string
) {
  try {
    const session = await verifySessionAndRole(["superadmin", "ketua", "pengurus", "admin"]);
    const userId = session.user.id;

    // Validate enum to prevent constraint errors
    const parsedAction = z.enum(["approve", "reject"]).parse(action);

    const statusMap = { approve: "approved", reject: "rejected" } as const;

    await prisma.$transaction(async (tx: any) => {
      const updatedApp = await tx.loan_applications.update({
        where: { id: BigInt(applicationId) },
        data: {
          status: statusMap[parsedAction],
          approved_by: parsedAction === "approve" ? BigInt(userId) : null,
          approved_at: parsedAction === "approve" ? new Date() : null,
          reviewed_by: BigInt(userId),
          reviewed_at: new Date(),
          rejection_note: note || null,
        },
        include: { loan_products: true }
      });

      // Generate Pinjaman & Jadwal jika Disetujui
      if (action === "approve") {
        const principal = Number(updatedApp.amount_requested);
        const tenor = updatedApp.tenor_months;
        const interestRate = Number(updatedApp.loan_products.interest_rate);
        const adminFeePct = Number(updatedApp.loan_products.admin_fee_pct);
        
        // Calculate admin fee
        const adminFee = principal * (adminFeePct / 100);

        // Flat interest calculation
        const interestPerMonth = principal * (interestRate / 100);
        const principalPerMonth = principal / tenor;
        const monthlyInstallment = principalPerMonth + interestPerMonth;

        const now = new Date();
        const disbursedAt = new Date();
        
        // Set first due date (next month, 25th)
        const firstDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 25);
        const lastDueDate = new Date(now.getFullYear(), now.getMonth() + tenor, 25);

        const count = await tx.loans.count();
        const loanNo = `L-${now.toISOString().slice(0,7).replace('-','')}-${String(count + 1).padStart(4,'0')}`;

        const schedules = [];
        for (let i = 1; i <= tenor; i++) {
          const dueDate = new Date(now.getFullYear(), now.getMonth() + i, 25);
          schedules.push({
            installment_no: i,
            due_date: dueDate,
            principal_due: principalPerMonth,
            interest_due: interestPerMonth,
            total_due: monthlyInstallment,
          });
        }

        await tx.loans.create({
          data: {
            application_id: updatedApp.id,
            member_id: updatedApp.member_id,
            loan_no: loanNo,
            principal: principal,
            interest_rate: interestRate,
            interest_method: updatedApp.loan_products.interest_method,
            admin_fee: adminFee,
            tenor_months: tenor,
            disbursed_at: disbursedAt,
            first_due_date: firstDueDate,
            last_due_date: lastDueDate,
            monthly_installment: monthlyInstallment,
            outstanding_principal: principal,
            total_paid: 0,
            repayment_method: updatedApp.repayment_method,
            status: "active",
            loan_schedules: {
              create: schedules
            }
          }
        });
      }
    });

    revalidatePath("/pinjaman/approval");

    // Ambil data aplikasi untuk audit
    const appData = await prisma.loan_applications.findUnique({
      where: { id: BigInt(applicationId) },
      select: {
        application_no: true,
        amount_requested: true,
        tenor_months: true,
        status: true,
        member_id: true,
        members: { select: { full_name: true, nik: true } },
      },
    });

    await logAudit({
      action: action === "approve" ? "APPROVE" : "REJECT",
      modelType: "loan_applications",
      modelId: applicationId,
      oldValues: { status: "pending" },
      newValues: {
        status: statusMap[action],
        application_no: appData?.application_no,
        member_name: appData?.members?.full_name,
        member_nik: appData?.members?.nik,
        amount_requested: appData ? Number(appData.amount_requested) : null,
        tenor_months: appData?.tenor_months,
        rejection_note: note || null,
      },
    });

    await deleteCache(["stats:admin", "stats:kredit", "stats:koperasi"]);
    return { success: true };
  } catch (error) {
    console.error("updateLoanStatus error:", error);
    if (error instanceof z.ZodError) return { success: false, error: "Tindakan tidak valid." };
    if (error instanceof Error && error.message.includes("Forbidden")) return { success: false, error: error.message };
    return { success: false, error: "Gagal memperbarui status pengajuan." };
  }
}

/**
 * Anggota mengajukan pinjaman baru.
 * PENTING: Loan rules diperiksa di sini (sebelum data masuk DB).
 * Jika rule aktif dan dilanggar → pengajuan DITOLAK dengan pesan notifikasi.
 * Jika rule tidak aktif → pengajuan diproses normal tanpa validasi rule.
 * Pinjaman yang sudah di-approve pengurus TIDAK dipengaruhi oleh fungsi ini.
 */
export async function submitLoanApplication(data: any) {
  try {
    const validated = loanApplicationSchema.parse(data);

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Tidak terautentikasi" };

    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { members: true }
    });
    if (!user?.members) return { success: false, error: "Data anggota tidak ditemukan" };

    const memberId = user.members.id;
    const productIdNum = validated.loan_product_id;

    // FETCH LOAN RULES
    const { getLoanRules } = await import('./loan-rules');
    const rules = await getLoanRules();

    let ruleViolationError: string | null = null;

    // 1. Cek Batas Frekuensi Pengajuan / Bulan
    if (rules.max_loans_per_month.enabled && rules.max_loans_per_month.applied_to_products.includes(productIdNum)) {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const applicationsThisMonth = await prisma.loan_applications.count({
        where: {
          member_id: memberId,
          loan_product_id: BigInt(productIdNum),
          submitted_at: { gte: startOfMonth }
        }
      });
      if (applicationsThisMonth >= rules.max_loans_per_month.value) {
        ruleViolationError = `Batas maksimal pengajuan (${rules.max_loans_per_month.value}x/bulan) telah tercapai.`;
      }
    }

    // 2. Cek Strict Single Active Loan (Wajib Lunas)
    if (!ruleViolationError && rules.strict_single_active_loan.enabled && rules.strict_single_active_loan.applied_to_products.includes(productIdNum)) {
      const activeProductLoans = await prisma.loans.count({
        where: {
          member_id: memberId,
          status: "active"
        }
      });
      if (activeProductLoans > 0) {
        ruleViolationError = "Pinjaman ditolak otomatis, karena masih ada pinjaman yang belum lunas";
      }
    }

    // 3. Cek Syarat Sisa Cicilan Maksimal (Top-Up)
    if (!ruleViolationError && rules.min_remaining_installments_for_topup.enabled && rules.min_remaining_installments_for_topup.applied_to_products.includes(productIdNum)) {
      const activeLoan = await prisma.loans.findFirst({
        where: {
          member_id: memberId,
          status: "active",
          loan_applications: { loan_product_id: BigInt(productIdNum) }
        },
        include: { loan_schedules: true }
      });
      
      if (activeLoan) {
        const remainingSchedules = activeLoan.loan_schedules.filter((s: any) => Number(s.principal_paid) < Number(s.principal_due)).length;
        if (remainingSchedules > rules.min_remaining_installments_for_topup.value) {
          ruleViolationError = `Ditolak (Top-up): Sisa cicilan Anda masih ${remainingSchedules}x. Syarat batas top-up maksimal menyisakan ${rules.min_remaining_installments_for_topup.value}x cicilan.`;
        }
      }
    }

    // 4. Cek Maksimal Persentase Simpanan
    if (!ruleViolationError && rules.max_loan_percentage_of_savings.enabled && rules.max_loan_percentage_of_savings.applied_to_products.includes(productIdNum)) {
      const totalSavings = await prisma.savings.aggregate({
        where: { member_id: memberId },
        _sum: { balance: true }
      });
      const balance = Number(totalSavings._sum?.balance ?? 0);
      const maxAllowed = balance * (rules.max_loan_percentage_of_savings.value / 100);
      
      if (validated.amount_requested > maxAllowed) {
        ruleViolationError = `Limit ditolak: Pengajuan melebihi ${rules.max_loan_percentage_of_savings.value}% saldo simpanan (Maks Rp ${maxAllowed.toLocaleString('id-ID')}).`;
      }
    }

    const count = await prisma.loan_applications.count();
    const appNo = `LN-${new Date().toISOString().slice(0,7).replace('-','')}-${String(count + 1).padStart(4,'0')}`;

    if (ruleViolationError) {
      await prisma.loan_applications.create({
        data: {
          member_id: memberId,
          loan_product_id: BigInt(productIdNum),
          application_no: appNo,
          amount_requested: validated.amount_requested,
          tenor_months: validated.tenor_months,
          repayment_method: validated.repayment_method as any,
          purpose: validated.purpose,
          status: "rejected",
          submitted_at: new Date(),
          rejection_note: ruleViolationError,
          guarantor_name: validated.guarantor_name || null,
          guarantor_phone: validated.guarantor_phone || null,
        }
      });

      revalidatePath("/pinjaman");

      await logAudit({
        action: "CREATE",
        modelType: "loan_applications",
        modelId: null,
        newValues: {
          application_no: appNo,
          loan_product_id: validated.loan_product_id,
          amount_requested: validated.amount_requested,
          tenor_months: validated.tenor_months,
          repayment_method: validated.repayment_method,
          purpose: validated.purpose,
          status: "rejected",
          rejection_note: ruleViolationError,
        },
      });

      await deleteCache(["stats:admin", "stats:kredit"]);
      return { success: false, error: ruleViolationError };
    }

    await prisma.loan_applications.create({
      data: {
        member_id: memberId,
        loan_product_id: BigInt(productIdNum),
        application_no: appNo,
        amount_requested: validated.amount_requested,
        tenor_months: validated.tenor_months,
        repayment_method: validated.repayment_method as any,
        purpose: validated.purpose,
        status: "pending",
        submitted_at: new Date(),
        guarantor_name: validated.guarantor_name || null,
        guarantor_phone: validated.guarantor_phone || null,
      }
    });

    revalidatePath("/pinjaman");

    await logAudit({
      action: "CREATE",
      modelType: "loan_applications",
      modelId: null,
      newValues: {
        application_no: appNo,
        loan_product_id: validated.loan_product_id,
        amount_requested: validated.amount_requested,
        tenor_months: validated.tenor_months,
        repayment_method: validated.repayment_method,
        purpose: validated.purpose,
        status: "pending",
      },
    });

    await deleteCache(["stats:admin", "stats:kredit"]);
    return { success: true };
  } catch (error: any) {
    console.error("submitLoanApplication error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: "Gagal mengajukan pinjaman." };
  }
}

/** Fetch all loans for admin/pengurus management */
export async function getAllLoans(params?: { search?: string; status?: string }): Promise<any[]>;
export async function getAllLoans(
  params: { search?: string; status?: string } | undefined,
  page: number,
  pageSize: number
): Promise<{ data: any[]; pagination: any }>;
export async function getAllLoans(
  params?: { search?: string; status?: string },
  page?: number,
  pageSize?: number
): Promise<any> {
  try {
    const isPaginated = page !== undefined && pageSize !== undefined;
    const whereClause: any = {}
    
    if (params?.status && params.status !== "all") {
      whereClause.status = params.status
    }
    
    if (params?.search) {
      whereClause.OR = [
        { loan_no: { contains: params.search } },
        { members: { full_name: { contains: params.search } } },
        { members: { nik: { contains: params.search } } },
      ]
    }

    if (isPaginated) {
      const { skip, take } = calculatePagination(page, pageSize);

      const [loans, total] = await Promise.all([
        prisma.loans.findMany({
          where: whereClause,
          include: {
            members: {
              select: {
                full_name: true,
                nik: true,
                member_code: true,
              }
            },
            loan_applications: {
              include: {
                loan_products: true
              }
            },
            loan_schedules: {
              orderBy: { installment_no: "asc" }
            }
          },
          orderBy: { disbursed_at: "desc" },
          skip,
          take,
        }),
        prisma.loans.count({
          where: whereClause,
        }),
      ]);

      const data = loans.map((l: any) => ({
        id: Number(l.id),
        loan_no: l.loan_no,
        member_name: l.members?.full_name || "Unknown",
        member_nik: l.members?.nik || "-",
        member_code: l.members?.member_code || "-",
        product_name: l.loan_applications?.loan_products?.name || "Pinjaman Uang",
        principal: Number(l.principal),
        outstanding: Number(l.outstanding_principal),
        total_paid: Number(l.total_paid),
        monthly_installment: Number(l.monthly_installment),
        tenor_months: l.tenor_months,
        status: l.status,
        repayment_method: l.repayment_method,
        disbursed_at: l.disbursed_at?.toISOString() || null,
        schedules: l.loan_schedules.map((s: any) => ({
          id: Number(s.id),
          installment_no: s.installment_no,
          due_date: s.due_date.toISOString().split("T")[0],
          principal_due: Number(s.principal_due),
          interest_due: Number(s.interest_due),
          total_due: Number(s.total_due),
          status: s.status,
          principal_paid: Number(s.principal_paid),
          interest_paid: Number(s.interest_paid),
          penalty_paid: Number(s.penalty_paid || 0),
        }))
      }));

      return {
        data,
        pagination: getPaginationMeta(total, page, pageSize),
      };
    } else {
      const loans = await prisma.loans.findMany({
        where: whereClause,
        include: {
          members: {
            select: {
              full_name: true,
              nik: true,
              member_code: true,
            }
          },
          loan_applications: {
            include: {
              loan_products: true
            }
          },
          loan_schedules: {
            orderBy: { installment_no: "asc" }
          }
        },
        orderBy: { disbursed_at: "desc" }
      });

      return loans.map((l: any) => ({
        id: Number(l.id),
        loan_no: l.loan_no,
        member_name: l.members?.full_name || "Unknown",
        member_nik: l.members?.nik || "-",
        member_code: l.members?.member_code || "-",
        product_name: l.loan_applications?.loan_products?.name || "Pinjaman Uang",
        principal: Number(l.principal),
        outstanding: Number(l.outstanding_principal),
        total_paid: Number(l.total_paid),
        monthly_installment: Number(l.monthly_installment),
        tenor_months: l.tenor_months,
        status: l.status,
        repayment_method: l.repayment_method,
        disbursed_at: l.disbursed_at?.toISOString() || null,
        schedules: l.loan_schedules.map((s: any) => ({
          id: Number(s.id),
          installment_no: s.installment_no,
          due_date: s.due_date.toISOString().split("T")[0],
          principal_due: Number(s.principal_due),
          interest_due: Number(s.interest_due),
          total_due: Number(s.total_due),
          status: s.status,
          principal_paid: Number(s.principal_paid),
          interest_paid: Number(s.interest_paid),
          penalty_paid: Number(s.penalty_paid || 0),
        }))
      }));
    }
  } catch (error) {
    console.error("getAllLoans error:", error);
    if (page !== undefined && pageSize !== undefined) {
      return {
        data: [],
        pagination: getPaginationMeta(0, page, pageSize),
      };
    }
    return [];
  }
}

export async function getLoanTransaction(id: number) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { members: true }
    })

    const isAdmin = ["superadmin", "admin", "pengurus"].includes(session.user.role || "")

    let loan;
    if (isAdmin) {
      loan = await prisma.loans.findFirst({
        where: {
          id: BigInt(id),
        },
        include: {
          loan_schedules: { orderBy: { due_date: "asc" } },
          loan_applications: { include: { loan_products: true } }
        }
      })
    } else {
      if (!user?.members) {
        return { error: "Member not found" }
      }

      loan = await prisma.loans.findFirst({
        where: {
          id: BigInt(id),
          member_id: user.members.id
        },
        include: {
          loan_schedules: { orderBy: { due_date: "asc" } },
          loan_applications: { include: { loan_products: true } }
        }
      })
    }

    if (!loan) {
      return { error: "Loan not found" }
    }

    return {
      success: true,
      data: {
        id: Number(loan.id),
        loan_no: loan.loan_no,
        principal: Number(loan.principal),
        outstanding: Number(loan.outstanding_principal),
        monthly_installment: Number(loan.monthly_installment),
        tenor_months: loan.tenor_months,
        disbursed_at: loan.disbursed_at?.toISOString().split("T")[0],
        last_due_date: loan.last_due_date?.toISOString().split("T")[0],
        status: loan.status,
        repayment_method: loan.repayment_method,
        product: loan.loan_applications?.loan_products ? {
          name: loan.loan_applications.loan_products.name,
          code: loan.loan_applications.loan_products.code,
          interest_rate: Number(loan.loan_applications.loan_products.interest_rate),
          max_tenor: loan.loan_applications.loan_products.max_tenor,
        } : null,
        loan_schedules: loan.loan_schedules.map((s: any) => ({
          id: Number(s.id),
          due_date: s.due_date,
          principal_payment: Number(s.principal_due),
          interest_payment: Number(s.interest_due),
          total_payment: Number(s.total_due),
          status: s.status,
        })),
      }
    }
  } catch (error) {
    console.error("Error fetching loan transaction:", error)
    return { error: "Internal server error" }
  }
}
