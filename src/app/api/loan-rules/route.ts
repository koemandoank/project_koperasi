import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { type LoanRules, DEFAULT_LOAN_RULES } from "@/lib/types/loan-rules.types";

/**
 * GET /api/loan-rules
 * Baca loan rules dari database. Dipanggil dari client component modal.
 * TIDAK mengimport dari 'use server' file untuk menghindari konflik.
 */
export async function GET() {
  try {
    const settings = await prisma.app_settings.findFirst();
    if (!settings?.loan_rules) {
      return NextResponse.json(DEFAULT_LOAN_RULES);
    }

    const parsed = JSON.parse(settings.loan_rules) as Partial<LoanRules>;

    const merged: LoanRules = {
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

    return NextResponse.json(merged);
  } catch (error) {
    console.error("GET /api/loan-rules error:", error);
    return NextResponse.json(DEFAULT_LOAN_RULES);
  }
}

/**
 * POST /api/loan-rules
 * Simpan loan rules ke database. Dipanggil dari client component modal.
 * TIDAK mengimport dari 'use server' file untuk menghindari konflik.
 * @body LoanRules JSON
 */
export async function POST(request: Request) {
  try {
    const values = (await request.json()) as LoanRules;
    const jsonValue = JSON.stringify(values);

    const settings = await prisma.app_settings.findFirst();
    if (settings) {
      await prisma.app_settings.update({
        where: { id: settings.id },
        data: { loan_rules: jsonValue },
      });
    } else {
      await prisma.app_settings.create({
        data: {
          company_name: "Koperasi Digital",
          loan_rules: jsonValue,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ""
    console.error("POST /api/loan-rules FULL ERROR:", msg)
    console.error("STACK:", stack)
    return NextResponse.json(
      { success: false, error: `Gagal menyimpan: ${msg}` },
      { status: 500 }
    )
  }
}
