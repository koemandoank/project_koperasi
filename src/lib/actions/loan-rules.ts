"use server";

import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { type LoanRules, DEFAULT_LOAN_RULES } from "@/lib/types/loan-rules.types";
import { logAudit } from "@/lib/actions/log-audit";

/**
 * Membaca konfigurasi loan rules dari database.
 * Merge dengan DEFAULT_LOAN_RULES untuk memastikan semua field tersedia.
 */
export async function getLoanRules(): Promise<LoanRules> {
  try {
    const settings = await prisma.app_settings.findFirst();
    if (!settings?.loan_rules) return DEFAULT_LOAN_RULES;

    const parsed = JSON.parse(settings.loan_rules) as Partial<LoanRules>;

    return {
      max_loans_per_month: parsed.max_loans_per_month ?? DEFAULT_LOAN_RULES.max_loans_per_month,
      strict_single_active_loan: parsed.strict_single_active_loan?.enabled !== undefined
        ? parsed.strict_single_active_loan
        : DEFAULT_LOAN_RULES.strict_single_active_loan,
      min_remaining_installments_for_topup: parsed.min_remaining_installments_for_topup?.enabled !== undefined
        ? parsed.min_remaining_installments_for_topup
        : DEFAULT_LOAN_RULES.min_remaining_installments_for_topup,
      require_receipt_for_goods: parsed.require_receipt_for_goods?.enabled !== undefined
        ? parsed.require_receipt_for_goods
        : DEFAULT_LOAN_RULES.require_receipt_for_goods,
      max_paylater_debt: parsed.max_paylater_debt ?? DEFAULT_LOAN_RULES.max_paylater_debt,
      max_loan_percentage_of_savings: parsed.max_loan_percentage_of_savings ?? DEFAULT_LOAN_RULES.max_loan_percentage_of_savings,
    };
  } catch (error) {
    console.error("getLoanRules error:", error);
    return DEFAULT_LOAN_RULES;
  }
}

/**
 * Menyimpan konfigurasi loan rules ke database.
 * Dipanggil dari Server Actions. Untuk API route, gunakan /api/loan-rules.
 */
export async function saveLoanRules(values: LoanRules): Promise<{ success: boolean; error?: string }> {
  try {
    const jsonValue = JSON.stringify(values);

    const settings = await prisma.app_settings.findFirst();
    const oldRules = settings?.loan_rules ? JSON.parse(settings.loan_rules) : null;

    if (settings) {
      await prisma.app_settings.update({
        where: { id: settings.id },
        data: { loan_rules: jsonValue },
      });
    } else {
      await prisma.app_settings.create({
        data: { company_name: "Koperasi Digital", loan_rules: jsonValue },
      });
    }

    await logAudit({
      action: "UPDATE",
      modelType: "loan_rules",
      modelId: settings ? Number(settings.id) : null,
      oldValues: oldRules ?? {},
      newValues: values as unknown as Record<string, unknown>,
    });

    revalidatePath("/pinjaman/produk");
    revalidatePath("/pinjaman");
    return { success: true };
  } catch (error) {
    console.error("saveLoanRules error:", error);
    return { success: false, error: "Gagal menyimpan aturan pinjaman." };
  }
}
