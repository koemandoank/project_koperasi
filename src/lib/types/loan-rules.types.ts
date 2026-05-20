/**
 * Shared type definitions untuk Loan Rules.
 * File ini tidak memiliki "use server" sehingga bisa diimport
 * dari client components, API routes, maupun server actions.
 */

import { z } from "zod";

const BaseRuleSchema = z.object({
  enabled: z.boolean(),
  applied_to_products: z.array(z.number()),
});

export const LoanRulesSchema = z.object({
  max_loans_per_month: BaseRuleSchema.extend({ value: z.number().positive() }),
  strict_single_active_loan: BaseRuleSchema.extend({ value: z.boolean() }),
  min_remaining_installments_for_topup: BaseRuleSchema.extend({ value: z.number().nonnegative() }),
  require_receipt_for_goods: BaseRuleSchema.extend({ value: z.boolean() }),
  max_paylater_debt: BaseRuleSchema.extend({ value: z.number().nonnegative() }),
  max_loan_percentage_of_savings: BaseRuleSchema.extend({ value: z.number().min(0).max(100) }),
}).strict();

export type RuleConfig<T = number | boolean> = {
  enabled: boolean;
  value: T;
  /** Array of loan_product IDs yang menggunakan rule ini. Kosong = tidak berlaku. */
  applied_to_products: number[];
};

export type LoanRules = z.infer<typeof LoanRulesSchema>;

export const DEFAULT_LOAN_RULES: LoanRules = {
  max_loans_per_month: { enabled: true, value: 1, applied_to_products: [] },
  strict_single_active_loan: { enabled: true, value: true, applied_to_products: [] },
  min_remaining_installments_for_topup: { enabled: true, value: 3, applied_to_products: [] },
  require_receipt_for_goods: { enabled: true, value: true, applied_to_products: [] },
  max_paylater_debt: { enabled: true, value: 1000000, applied_to_products: [] },
  max_loan_percentage_of_savings: { enabled: true, value: 80, applied_to_products: [] },
};
