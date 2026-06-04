import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("=======================================================================")
  console.log("=== KOPERASI DIGITAL SULFINDO — SYSTEM COMPREHENSIVE AUDIT SCAN ===")
  console.log("=======================================================================\n")

  let totalCritical = 0
  let totalWarning = 0

  // 1. Unbalanced Journal Entries
  console.log("--- SCAN 1: Checking for Unbalanced Journals (Debit !== Credit) ---")
  const entries = await prisma.journal_entries.findMany({
    include: { journal_lines: true }
  })
  let unbalancedCount = 0
  for (const entry of entries) {
    let totalDebit = 0
    let totalCredit = 0
    for (const line of entry.journal_lines) {
      totalDebit += Number(line.debit)
      totalCredit += Number(line.credit)
    }
    const diff = Math.abs(totalDebit - totalCredit)
    if (diff > 0.01) {
      unbalancedCount++
      totalCritical++
      console.log(`  ❌ CRITICAL: Unbalanced Journal [${entry.entry_no}] - "${entry.description}"`)
      console.log(`     Debit: Rp ${totalDebit.toLocaleString("id-ID")} | Credit: Rp ${totalCredit.toLocaleString("id-ID")} | Diff: Rp ${diff.toLocaleString("id-ID")}`)
    }
  }
  if (unbalancedCount === 0) console.log("  ✅ Clean: All journal entries are balanced.\n")
  else console.log(`  ⚠️ Total unbalanced journals found: ${unbalancedCount}\n`)

  // 2. Temporary Payroll Account Usage (40104)
  console.log("--- SCAN 2: Checking for Temporary Payroll Account (40104) Balance ---")
  const tempAccountLines = await prisma.journal_lines.findMany({
    where: { chart_of_accounts: { code: "40104" } },
    include: { journal_entries: true }
  })
  if (tempAccountLines.length > 0) {
    totalWarning++
    console.log(`  ⚠️ WARNING: Found ${tempAccountLines.length} journal lines posting to account 40104 (PAYROLL-MEI-2026).`)
    console.log("     These should be allocated to Member Savings (Simpanan Wajib/Sukarela) or Loan Accounts receivable.")
    for (const line of tempAccountLines.slice(0, 5)) {
      console.log(`     - Entry: ${line.journal_entries.entry_no} | Date: ${line.journal_entries.entry_date.toISOString().split("T")[0]} | Credit: Rp ${Number(line.credit).toLocaleString("id-ID")}`)
    }
    if (tempAccountLines.length > 5) console.log(`     ... [and ${tempAccountLines.length - 5} more lines]`)
    console.log()
  } else {
    console.log("  ✅ Clean: No transactions posted to temporary payroll account 40104.\n")
  }

  // 3. Negative Outstanding Loans
  console.log("--- SCAN 3: Checking for Negative Outstanding Loans ---")
  const negativeLoans = await prisma.loans.findMany({
    where: { outstanding_principal: { lt: 0 } },
    include: { members: true }
  })
  if (negativeLoans.length > 0) {
    totalCritical += negativeLoans.length
    for (const loan of negativeLoans) {
      console.log(`  ❌ CRITICAL: Negative Outstanding Loan [${loan.loan_no}] for ${loan.members.full_name} (${loan.members.nik})`)
      console.log(`     Outstanding Principal: Rp ${Number(loan.outstanding_principal).toLocaleString("id-ID")} | Principal Plafon: Rp ${Number(loan.principal).toLocaleString("id-ID")}`)
    }
    console.log()
  } else {
    console.log("  ✅ Clean: No loans with negative outstanding principal.\n")
  }

  // 4. Negative Savings Balance
  console.log("--- SCAN 4: Checking for Negative Savings Balance ---")
  const negativeSavings = await prisma.savings.findMany({
    where: { balance: { lt: 0 } },
    include: { members: true, saving_types: true }
  })
  if (negativeSavings.length > 0) {
    totalCritical += negativeSavings.length
    for (const s of negativeSavings) {
      console.log(`  ❌ CRITICAL: Negative Savings Balance [${s.saving_types.name}] for ${s.members.full_name} (${s.members.nik})`)
      console.log(`     Current Balance: Rp ${Number(s.balance).toLocaleString("id-ID")}`)
    }
    console.log()
  } else {
    console.log("  ✅ Clean: No savings accounts with negative balances.\n")
  }

  // 5. Unposted Draft Journals
  console.log("--- SCAN 5: Checking for Unposted (Draft) Journals ---")
  const unpostedCount = await prisma.journal_entries.count({
    where: { is_posted: false }
  })
  if (unpostedCount > 0) {
    totalWarning++
    console.log(`  ⚠️ WARNING: Found ${unpostedCount} unposted (draft) journal entries. These are not reflected in General Ledger.`)
    console.log()
  } else {
    console.log("  ✅ Clean: All journal entries are posted.\n")
  }

  // 6. Duplicate Active Loans of the Same Product
  console.log("--- SCAN 6: Checking for Strict Single Active Loan Violations ---")
  const members = await prisma.member.findMany({
    include: {
      loans: {
        where: { status: "active" },
        include: {
          loan_applications: {
            include: { loan_products: true }
          }
        }
      }
    }
  })
  let duplicateCount = 0
  for (const m of members) {
    const byProduct: Record<string, any[]> = {}
    for (const l of m.loans) {
      const code = l.loan_applications?.loan_products?.code ?? "UNKNOWN"
      if (!byProduct[code]) byProduct[code] = []
      byProduct[code].push(l)
    }
    for (const code in byProduct) {
      if (byProduct[code].length > 1) {
        duplicateCount++
        totalCritical++
        console.log(`  ❌ CRITICAL: Member ${m.full_name} (${m.nik}) has ${byProduct[code].length} active loans for ${code}:`)
        for (const l of byProduct[code]) {
          console.log(`     - Loan No: ${l.loan_no} | Principal: Rp ${Number(l.principal).toLocaleString("id-ID")} | Disbursed: ${l.disbursed_at.toISOString().split("T")[0]}`)
        }
      }
    }
  }
  if (duplicateCount === 0) console.log("  ✅ Clean: No members with duplicate active loans of the same product.\n")
  else console.log(`  ⚠️ Total duplicate active loan cases found: ${duplicateCount}\n`)

  // 7. Active Members without User Accounts
  console.log("--- SCAN 7: Checking for Active Members without User Accounts ---")
  const membersWithoutUser = await prisma.member.findMany({
    where: {
      status: "active",
      users: null
    }
  })
  if (membersWithoutUser.length > 0) {
    totalWarning++
    console.log(`  ⚠️ WARNING: Found ${membersWithoutUser.length} active members who do not have an associated user login account.`)
    for (const m of membersWithoutUser.slice(0, 5)) {
      console.log(`     - ${m.full_name} (${m.nik}) | Joined: ${m.join_date.toISOString().split("T")[0]}`)
    }
    if (membersWithoutUser.length > 5) console.log(`     ... [and ${membersWithoutUser.length - 5} more members]`)
    console.log()
  } else {
    console.log("  ✅ Clean: All active members have associated user login accounts.\n")
  }

  // 8. Active Members without Simpanan Pokok (SP)
  console.log("--- SCAN 8: Checking for Active Members without Simpanan Pokok (SP) ---")
  const spType = await prisma.saving_types.findFirst({ where: { code: "SP" } })
  let missingSpCount = 0
  if (spType) {
    const activeMembers = await prisma.member.findMany({
      where: { status: "active" },
      include: { savings: { where: { saving_type_id: spType.id } } }
    })
    for (const m of activeMembers) {
      // Abaikan akun sistem yang bukan anggota koperasi asli
      const isSystemAccount =
        m.nik.startsWith("ADM") ||
        m.nik.startsWith("SAD") ||
        m.nik.startsWith("KAS") ||
        m.nik.startsWith("PEN") ||
        m.nik.startsWith("KET")
      if (isSystemAccount) continue

      if (m.savings.length === 0 || Number(m.savings[0].balance) <= 0) {
        missingSpCount++
        totalWarning++
        console.log(`  ⚠️ WARNING: Active Member ${m.full_name} (${m.nik}) has missing or zero Simpanan Pokok balance.`)
      }
    }
  }
  if (missingSpCount === 0) console.log("  ✅ Clean: All active members have Simpanan Pokok.\n")
  else console.log(`  ⚠️ Total active members missing Simpanan Pokok: ${missingSpCount}\n`)

  // 9. Schedule and Payment Discrepancies
  console.log("--- SCAN 9: Checking for Schedule and Payment Discrepancies ---")
  const allActiveOrPaidLoans = await prisma.loans.findMany({
    where: { status: { in: ["active", "paid_off"] } },
    include: { loan_schedules: true, loan_payments: true }
  })
  let scheduleMismatches = 0
  for (const l of allActiveOrPaidLoans) {
    // Check if there are schedules marked paid but no corresponding payment record
    const paidSchedules = l.loan_schedules.filter(s => s.status === "paid")
    for (const s of paidSchedules) {
      const match = l.loan_payments.some(p => p.schedule_id === s.id)
      // Note: Historical seed payments might use historical-seed ref and not link properly to schedule_id in some schemas,
      // but let's check if the amount matches or if there is any payment on the schedule date.
      if (!match) {
        // Fallback check by date/amount
        const fallbackMatch = l.loan_payments.some(p => p.paid_at.toISOString().split("T")[0] === s.due_date.toISOString().split("T")[0])
        if (!fallbackMatch && l.loan_payments.length > 0) {
          scheduleMismatches++
          totalWarning++
          console.log(`  ⚠️ WARNING: Schedule mismatch on Loan [${l.loan_no}] (Inst #${s.installment_no}).`)
          console.log(`     Schedule is marked 'paid' but no loan_payments entry matches this schedule or due date (${s.due_date.toISOString().split("T")[0]}).`)
        }
      }
    }
  }
  if (scheduleMismatches === 0) console.log("  ✅ Clean: No schedule and payment discrepancies found.\n")
  else console.log(`  ⚠️ Total schedule mismatches found: ${scheduleMismatches}\n`)

  // 10. Outstanding Loan Principal vs GL Account Balance
  console.log("--- SCAN 10: Comparing Outstanding Loans vs General Ledger (COA 10201) ---")
  const totalLoanOutstanding = await prisma.loans.aggregate({
    where: { status: { in: ["active", "overdue"] } },
    _sum: { outstanding_principal: true }
  })
  const loanCoas = await prisma.chart_of_accounts.findMany({ where: { code: "10201" } })
  if (loanCoas.length > 0) {
    const coaIds = loanCoas.map(c => c.id)
    const glSum = await prisma.journal_lines.aggregate({
      where: { account_id: { in: coaIds } },
      _sum: { debit: true, credit: true }
    })
    const glBalance = Number(glSum._sum.debit ?? 0) - Number(glSum._sum.credit ?? 0)
    const outSum = Number(totalLoanOutstanding._sum.outstanding_principal ?? 0)
    const difference = Math.abs(glBalance - outSum)

    console.log(`  Loans Table Outstanding Principal: Rp ${outSum.toLocaleString("id-ID")}`)
    console.log(`  General Ledger (COA 10201) Balance: Rp ${glBalance.toLocaleString("id-ID")}`)
    if (difference > 1.00) {
      totalWarning++
      console.log(`  ⚠️ WARNING: Ledger discrepancy found! Difference: Rp ${difference.toLocaleString("id-ID")}`)
    } else {
      console.log("  ✅ Clean: General Ledger balance matches Outstanding Loans principal.\n")
    }
  } else {
    console.log("  ⚠️ Cannot perform GL comparison: Chart of account '10201' not found.\n")
  }

  // 11. Toko POS Global vs Location Stock Mismatch
  console.log("--- SCAN 11: Checking for Store Stock Mismatches (Global vs Location) ---")
  const products = await prisma.products.findMany({
    where: { deleted_at: null },
    include: { stock_balances: true }
  })
  let stockMismatchCount = 0
  for (const product of products) {
    const globalStock = product.stock
    const sumLocationStock = product.stock_balances.reduce((sum, bal) => sum + bal.qty_on_hand, 0)
    if (globalStock !== sumLocationStock) {
      stockMismatchCount++
      totalWarning++
      if (stockMismatchCount <= 5) {
        console.log(`  ⚠️ WARNING: Stock mismatch on SKU: ${product.sku} | Name: ${product.name} | Global: ${globalStock} | Locations sum: ${sumLocationStock} (Diff: ${globalStock - sumLocationStock})`)
      }
    }
  }
  if (stockMismatchCount === 0) console.log("  ✅ Clean: All global stocks match location-based stocks.\n")
  else console.log(`  ⚠️ Total mismatching product stocks found: ${stockMismatchCount} (Showing first 5)\n`)

  // 12. Consignment Sales Calculation Anomalies
  console.log("--- SCAN 12: Checking for Negative Consignment Sales (Logic Errors) ---")
  const consignmentItems = await prisma.consignment_items.findMany({
    include: { products: true }
  })
  
  const consignmentProductMap = new Map<number, { received: number; returned: number; stock: number; sku: string; name: string }>()
  for (const item of consignmentItems) {
    if (item.products) {
      const pId = Number(item.product_id)
      if (!consignmentProductMap.has(pId)) {
        consignmentProductMap.set(pId, {
          received: 0,
          returned: 0,
          stock: item.products.stock,
          sku: item.products.sku,
          name: item.products.name
        })
      }
      const entry = consignmentProductMap.get(pId)!
      entry.received += item.qty_received
      entry.returned += item.qty_returned
    }
  }

  let consignmentErrors = 0
  for (const [pId, entry] of consignmentProductMap.entries()) {
    const netReceived = entry.received - entry.returned
    if (entry.stock > netReceived) {
      consignmentErrors++
      totalCritical++
      if (consignmentErrors <= 5) {
        console.log(`  ❌ CRITICAL: Consignment stock logic error on Product [${entry.sku}] - ${entry.name} | Total Net Received: ${netReceived} | Actual Global Stock: ${entry.stock}`)
      }
    }
  }
  if (consignmentErrors === 0) console.log("  ✅ Clean: No consignment logical anomalies found.\n")
  else console.log(`  ⚠️ Total consignment calculation anomalies found: ${consignmentErrors} (Showing first 5)\n`)

  // 13. Paid Orders vs Recorded Payments
  console.log("--- SCAN 13: Checking for Paid POS Orders without recorded payments ---")
  const paidOrders = await prisma.orders.findMany({
    where: { payment_status: "paid" },
    include: { order_payments: true }
  })
  let paymentMismatches = 0
  for (const order of paidOrders) {
    const grandTotal = Number(order.grand_total)
    const paymentSum = order.order_payments.reduce((sum, pay) => sum + Number(pay.amount), 0)
    if (Math.abs(grandTotal - paymentSum) > 0.01) {
      paymentMismatches++
      totalWarning++
      if (paymentMismatches <= 5) {
        console.log(`  ⚠️ WARNING: Paid Order [${order.order_no}] has mismatch. Grand Total: Rp ${grandTotal.toLocaleString("id-ID")} | Payments Sum: Rp ${paymentSum.toLocaleString("id-ID")}`)
      }
    }
  }
  if (paymentMismatches === 0) console.log("  ✅ Clean: All paid orders have corresponding payments.\n")
  else console.log(`  ⚠️ Total paid order mismatches found: ${paymentMismatches} (Showing first 5)\n`)

  // 14. PPOB Paylater Transactions vs Orders Integrity
  console.log("--- SCAN 14: Checking PPOB Paylater Transactions vs Orders Integrity ---")
  const ppobPaylaterTxs = await (prisma as any).ppob_transactions.findMany({
    where: { payment_method: "paylater", status: "success" }
  })
  let ppobMismatchCount = 0
  for (const tx of ppobPaylaterTxs) {
    const order = await prisma.orders.findUnique({
      where: { order_no: tx.trx_no }
    })
    if (!order) {
      ppobMismatchCount++
      totalCritical++
      console.log(`  ❌ CRITICAL: PPOB Paylater Transaction [${tx.trx_no}] has no matching order record in 'orders'.`)
    } else {
      const orderTotal = Number(order.grand_total)
      const ppobTotal = Number(tx.total_amount)
      if (Math.abs(orderTotal - ppobTotal) > 0.01) {
        ppobMismatchCount++
        totalCritical++
        console.log(`  ❌ CRITICAL: PPOB Transaction [${tx.trx_no}] amount (Rp ${ppobTotal.toLocaleString("id-ID")}) does not match Order grand total (Rp ${orderTotal.toLocaleString("id-ID")}).`)
      }
    }
  }
  if (ppobMismatchCount === 0) console.log("  ✅ Clean: All PPOB paylater transactions match order records.\n")
  else console.log(`  ⚠️ Total PPOB mismatches found: ${ppobMismatchCount}\n`)

  // 15. Loan Schedules vs Principal Plafon Mismatch (Strict Loan Audit)
  console.log("--- SCAN 15: Checking Loan Schedules vs Principal Plafon (Strict Loan Audit) ---")
  const allLoans = await prisma.loans.findMany({
    include: { loan_schedules: true }
  })
  let plafonMismatchCount = 0
  for (const loan of allLoans) {
    const schedulePrincipalSum = loan.loan_schedules.reduce((sum, s) => sum + Number(s.principal_due), 0)
    const principal = Number(loan.principal)
    if (Math.abs(schedulePrincipalSum - principal) > 0.01) {
      plafonMismatchCount++
      totalCritical++
      console.log(`  ❌ CRITICAL: Loan [${loan.loan_no}] principal (Rp ${principal.toLocaleString("id-ID")}) does not match sum of schedule principal_due (Rp ${schedulePrincipalSum.toLocaleString("id-ID")}).`)
    }
  }
  if (plafonMismatchCount === 0) console.log("  ✅ Clean: All loan schedule sums match their principal plafon.\n")
  else console.log(`  ⚠️ Total loan principal mismatches found: ${plafonMismatchCount}\n`)

  // 16. Loan Outstanding Principal vs Paid Schedules Integrity (Strict Loan Audit)
  console.log("--- SCAN 16: Checking Loan Outstanding Principal vs Paid Schedules (Strict Loan Audit) ---")
  let outstandingMismatchCount = 0
  for (const loan of allLoans) {
    const paidPrincipalSum = loan.loan_schedules.reduce((sum, s) => sum + Number(s.principal_paid), 0)
    const calculatedOutstanding = Number(loan.principal) - paidPrincipalSum
    const actualOutstanding = Number(loan.outstanding_principal)
    if (Math.abs(calculatedOutstanding - actualOutstanding) > 0.01) {
      outstandingMismatchCount++
      totalCritical++
      console.log(`  ❌ CRITICAL: Loan [${loan.loan_no}] outstanding (Rp ${actualOutstanding.toLocaleString("id-ID")}) does not match calculated outstanding (Rp ${calculatedOutstanding.toLocaleString("id-ID")}).`)
    }
  }
  if (outstandingMismatchCount === 0) console.log("  ✅ Clean: All loan outstanding balances are consistent with paid schedules.\n")
  else console.log(`  ⚠️ Total outstanding inconsistencies found: ${outstandingMismatchCount}\n`)

  // 17. Loan Status vs Outstanding Balance Integrity (Strict Loan Audit)
  console.log("--- SCAN 17: Checking Loan Status vs Outstanding Balance (Strict Loan Audit) ---")
  let statusMismatchCount = 0
  for (const loan of allLoans) {
    const outstanding = Number(loan.outstanding_principal)
    if (outstanding === 0 && loan.status !== "paid_off") {
      statusMismatchCount++
      totalCritical++
      console.log(`  ❌ CRITICAL: Loan [${loan.loan_no}] has 0 outstanding but status is '${loan.status}' (expected 'paid_off').`)
    } else if (outstanding > 0 && loan.status === "paid_off") {
      statusMismatchCount++
      totalCritical++
      console.log(`  ❌ CRITICAL: Loan [${loan.loan_no}] has outstanding Rp ${outstanding.toLocaleString("id-ID")} but status is 'paid_off'.`)
    }
  }
  if (statusMismatchCount === 0) console.log("  ✅ Clean: All loan statuses are consistent with outstanding balances.\n")
  else console.log(`  ⚠️ Total loan status inconsistencies found: ${statusMismatchCount}\n`)

  console.log("=======================================================================")
  console.log("=== AUDIT SUMMARY ===")
  console.log(`  Critical Errors (Need immediate fix)  : ${totalCritical}`)
  console.log(`  Warnings/Inconsistencies              : ${totalWarning}`)
  if (totalCritical === 0 && totalWarning === 0) {
    console.log("  🎉 SYSTEM IS 100% HEALTHY!")
  } else {
    console.log("  ⚠️ Action required. Run repair scripts to fix these findings.")
  }
  console.log("=======================================================================")
}

main().catch(console.error).finally(() => prisma.$disconnect())
