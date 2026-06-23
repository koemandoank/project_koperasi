import mysql from 'mysql2/promise'

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  database: 'koperasi_digital',
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG)
  console.log("=".repeat(75))
  console.log("=== KOPERASI DIGITAL SULFINDO — SYSTEM COMPREHENSIVE AUDIT SCAN ===")
  console.log("=".repeat(75) + "\n")

  let totalCritical = 0
  let totalWarning = 0

  // === SCAN 1: Unbalanced Journal Entries ===
  console.log("--- SCAN 1: Checking for Unbalanced Journals (Debit !== Credit) ---")
  const [entries] = await conn.execute(`
    SELECT je.id, je.entry_no, je.description, je.entry_date,
           ROUND(SUM(jl.debit), 2) as total_debit,
           ROUND(SUM(jl.credit), 2) as total_credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_id = je.id
    GROUP BY je.id
    HAVING ABS(total_debit - total_credit) > 0.01
  `)
  const unbalanced = entries as any[]
  if (unbalanced.length === 0) {
    console.log("  ✅ Clean: All journal entries are balanced.\n")
  } else {
    totalCritical += unbalanced.length
    for (const e of unbalanced) {
      console.log(`  ❌ CRITICAL: Unbalanced Journal [${e.entry_no}] - "${e.description}"`)
      console.log(`     Debit: Rp ${Number(e.total_debit).toLocaleString('id-ID')} | Credit: Rp ${Number(e.total_credit).toLocaleString('id-ID')} | Diff: Rp ${Math.abs(Number(e.total_debit) - Number(e.total_credit)).toLocaleString('id-ID')}`)
    }
    console.log(`  ⚠️ Total unbalanced journals found: ${unbalanced.length}\n`)
  }

  // === SCAN 2: Temporary Payroll Account 40104 ===
  console.log("--- SCAN 2: Checking for Temporary Payroll Account (40104) Balance ---")
  const [payrollLines] = await conn.execute(`
    SELECT jl.id, je.entry_no, je.entry_date, jl.credit, jl.debit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '40104'
    LIMIT 10
  `)
  const tempLines = payrollLines as any[]
  if (tempLines.length === 0) {
    console.log("  ✅ Clean: No transactions posted to temporary payroll account 40104.\n")
  } else {
    totalWarning++
    console.log(`  ⚠️ WARNING: Found ${tempLines.length} journal lines posting to account 40104 (PAYROLL-MEI-2026).`)
    for (const l of tempLines) {
      const amt = Number(l.credit) > 0 ? Number(l.credit) : Number(l.debit)
      console.log(`     - Entry: ${l.entry_no} | Date: ${l.entry_date.toISOString?.()?.split?.('T')[0] ?? l.entry_date} | Amount: Rp ${amt.toLocaleString('id-ID')}`)
    }
    console.log()
  }

  // === SCAN 3: Negative Outstanding Loans ===
  console.log("--- SCAN 3: Checking for Negative Outstanding Loans ---")
  const [negLoans] = await conn.execute(`
    SELECT l.id, l.loan_no, l.outstanding_principal, l.principal, m.full_name, m.nik
    FROM loans l
    JOIN members m ON m.id = l.member_id
    WHERE l.outstanding_principal < 0
  `)
  const negL = negLoans as any[]
  if (negL.length === 0) {
    console.log("  ✅ Clean: No loans with negative outstanding principal.\n")
  } else {
    totalCritical += negL.length
    for (const l of negL) {
      console.log(`  ❌ CRITICAL: Negative Outstanding Loan [${l.loan_no}] for ${l.full_name} (${l.nik})`)
      console.log(`     Outstanding: Rp ${Number(l.outstanding_principal).toLocaleString('id-ID')} | Plafon: Rp ${Number(l.principal).toLocaleString('id-ID')}`)
    }
    console.log()
  }

  // === SCAN 4: Negative Savings Balance ===
  console.log("--- SCAN 4: Checking for Negative Savings Balance ---")
  const [negSavings] = await conn.execute(`
    SELECT s.id, s.balance, st.name as saving_type_name, m.full_name, m.nik
    FROM savings s
    JOIN members m ON m.id = s.member_id
    JOIN saving_types st ON st.id = s.saving_type_id
    WHERE s.balance < 0
  `)
  const negS = negSavings as any[]
  if (negS.length === 0) {
    console.log("  ✅ Clean: No savings accounts with negative balances.\n")
  } else {
    totalCritical += negS.length
    for (const s of negS) {
      console.log(`  ❌ CRITICAL: Negative Savings Balance [${s.saving_type_name}] for ${s.full_name} (${s.nik})`)
      console.log(`     Balance: Rp ${Number(s.balance).toLocaleString('id-ID')}`)
    }
    console.log()
  }

  // === SCAN 5: Unposted Draft Journals ===
  console.log("--- SCAN 5: Checking for Unposted (Draft) Journals ---")
  const [unposted] = await conn.execute(`
    SELECT COUNT(*) as cnt FROM journal_entries WHERE is_posted = 0
  `)
  const unpostedCount = Number((unposted as any[])[0].cnt)
  if (unpostedCount === 0) {
    console.log("  ✅ Clean: All journal entries are posted.\n")
  } else {
    totalWarning++
    console.log(`  ⚠️ WARNING: Found ${unpostedCount} unposted (draft) journal entries.\n`)
  }

  // === SCAN 6: Duplicate Active Loans Same Product ===
  console.log("--- SCAN 6: Checking for Duplicate Active Loans of Same Product ---")
  const [dupLoans] = await conn.execute(`
    SELECT m.full_name, m.nik, lp.code as product_code, lp.name as product_name,
           COUNT(*) as cnt,
           GROUP_CONCAT(l.loan_no SEPARATOR ', ') as loan_nos,
           GROUP_CONCAT(l.principal SEPARATOR ', ') as principals,
           GROUP_CONCAT(l.disbursed_at SEPARATOR ', ') as disbursed_dates
    FROM loans l
    JOIN members m ON m.id = l.member_id
    JOIN loan_applications la ON la.id = l.application_id
    JOIN loan_products lp ON lp.id = la.loan_product_id
    WHERE l.status = 'active'
    GROUP BY m.id, lp.id
    HAVING cnt > 1
  `)
  const dupL = dupLoans as any[]
  if (dupL.length === 0) {
    console.log("  ✅ Clean: No members with duplicate active loans of same product.\n")
  } else {
    totalCritical += dupL.length
    for (const d of dupL) {
      console.log(`  ❌ CRITICAL: Member ${d.full_name} (${d.nik}) has ${d.cnt} active loans for ${d.product_code}:`)
      console.log(`     Loans: ${d.loan_nos}`)
    }
    console.log()
  }

  // === SCAN 7: Active Members without User Accounts ===
  console.log("--- SCAN 7: Checking for Active Members without User Accounts ---")
  const [noUserMembers] = await conn.execute(`
    SELECT m.full_name, m.nik, m.join_date
    FROM members m
    LEFT JOIN users u ON u.member_id = m.id
    WHERE m.status = 'active' AND u.id IS NULL
    LIMIT 10
  `)
  const noUser = noUserMembers as any[]
  if (noUser.length === 0) {
    console.log("  ✅ Clean: All active members have associated user login accounts.\n")
  } else {
    totalWarning++
    console.log(`  ⚠️ WARNING: Found ${noUser.length}+ active members without user login accounts.`)
    for (const m of noUser) {
      console.log(`     - ${m.full_name} (${m.nik}) | Joined: ${m.join_date.toISOString?.()?.split?.('T')[0] ?? m.join_date}`)
    }
    console.log()
  }

  // === SCAN 8: Active Members without Simpanan Pokok ===
  console.log("--- SCAN 8: Checking for Active Members without Simpanan Pokok (SP) ---")
  const [spRows] = await conn.execute(`SELECT id FROM saving_types WHERE code = 'SP' LIMIT 1`)
  const spRowsA = spRows as any[]
  if (spRowsA.length > 0) {
    const spId = spRowsA[0].id
    const [missingSp] = await conn.execute(`
      SELECT m.full_name, m.nik
      FROM members m
      LEFT JOIN savings s ON s.member_id = m.id AND s.saving_type_id = ?
      WHERE m.status = 'active'
        AND m.nik NOT LIKE 'ADM%'
        AND m.nik NOT LIKE 'SAD%'
        AND m.nik NOT LIKE 'KAS%'
        AND m.nik NOT LIKE 'PEN%'
        AND m.nik NOT LIKE 'KET%'
        AND (s.id IS NULL OR s.balance <= 0)
      LIMIT 15
    `, [spId])
    const missingSpRows = missingSp as any[]
    if (missingSpRows.length === 0) {
      console.log("  ✅ Clean: All active members have Simpanan Pokok.\n")
    } else {
      totalWarning += missingSpRows.length
      for (const m of missingSpRows) {
        console.log(`  ⚠️ WARNING: Active Member ${m.full_name} (${m.nik}) missing or zero Simpanan Pokok.`)
      }
      console.log()
    }
  } else {
    console.log("  ⚠️ SKIP: Saving type 'SP' not found.\n")
  }

  // === SCAN 9: Schedule & Payment Discrepancies ===
  console.log("--- SCAN 9: Checking for Schedule and Payment Discrepancies ---")
  const [scheduleIssues] = await conn.execute(`
    SELECT ls.id, ls.loan_id, l.loan_no, ls.installment_no, ls.due_date, ls.principal_due, ls.interest_due
    FROM loan_schedules ls
    JOIN loans l ON l.id = ls.loan_id
    WHERE ls.status = 'paid'
      AND ls.id NOT IN (SELECT lp.schedule_id FROM loan_payments lp WHERE lp.schedule_id IS NOT NULL AND lp.schedule_id = ls.id)
      AND NOT EXISTS (
        SELECT 1 FROM loan_payments lp2
        WHERE lp2.loan_id = ls.loan_id AND DATE(lp2.paid_at) = ls.due_date
      )
    LIMIT 10
  `)
  const schedIssues = scheduleIssues as any[]
  if (schedIssues.length === 0) {
    console.log("  ✅ Clean: No schedule and payment discrepancies found.\n")
  } else {
    totalWarning += schedIssues.length
    for (const s of schedIssues) {
      console.log(`  ⚠️ WARNING: Schedule mismatch on Loan [${s.loan_no}] (Inst #${s.installment_no}) — marked paid but no payment record.`)
    }
    console.log()
  }

  // === SCAN 10: Outstanding Loans vs GL 10201 ===
  console.log("--- SCAN 10: Comparing Outstanding Loans vs General Ledger (COA 10201) ---")
  const [loanOutSum] = await conn.execute(`
    SELECT COALESCE(SUM(outstanding_principal), 0) as total_outstanding
    FROM loans WHERE status IN ('active', 'overdue')
  `)
  const totalOut = Number((loanOutSum as any[])[0].total_outstanding)
  const [glRows] = await conn.execute(`
    SELECT COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
    FROM journal_lines jl
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE coa.code = '10201'
  `)
  const glRow = (glRows as any[])[0]
  const glBalance = Number(glRow.total_debit) - Number(glRow.total_credit)
  const diff = Math.abs(glBalance - totalOut)
  console.log(`  Loans Table Outstanding Principal: Rp ${totalOut.toLocaleString('id-ID')}`)
  console.log(`  General Ledger (COA 10201) Balance: Rp ${glBalance.toLocaleString('id-ID')}`)
  if (diff > 1.0) {
    totalWarning++
    console.log(`  ⚠️ WARNING: Ledger discrepancy found! Difference: Rp ${diff.toLocaleString('id-ID')}\n`)
  } else {
    console.log("  ✅ Clean: General Ledger balance matches Outstanding Loans principal.\n")
  }

  // === SCAN 11: Stock Global vs Location Mismatch ===
  console.log("--- SCAN 11: Checking for Store Stock Mismatches ---")
  const [stockIssues] = await conn.execute(`
    SELECT p.id, p.sku, p.name, p.stock as global_stock,
           COALESCE(SUM(sb.qty_on_hand), 0) as location_sum
    FROM products p
    LEFT JOIN stock_balances sb ON sb.product_id = p.id
    WHERE p.deleted_at IS NULL
    GROUP BY p.id
    HAVING global_stock != location_sum
    LIMIT 10
  `)
  const stockIss = stockIssues as any[]
  if (stockIss.length === 0) {
    console.log("  ✅ Clean: All global stocks match location-based stocks.\n")
  } else {
    totalWarning += stockIss.length
    for (const s of stockIss) {
      console.log(`  ⚠️ WARNING: Stock mismatch SKU:${s.sku} | ${s.name} | Global:${s.global_stock} | Locations:${s.location_sum} (Diff:${s.global_stock - s.location_sum})`)
    }
    console.log(`  ⚠️ Total stock mismatches: ${stockIss.length} (showing first 10)\n`)
  }

  // === SCAN 12: Consignment Anomalies ===
  console.log("--- SCAN 12: Checking for Consignment Stock Logic Errors ---")
  const [consignmentData] = await conn.execute(`
    SELECT ci.product_id, p.sku, p.name, p.stock,
           COALESCE(SUM(ci.qty_received), 0) as total_received,
           COALESCE(SUM(ci.qty_returned), 0) as total_returned
    FROM consignment_items ci
    JOIN products p ON p.id = ci.product_id
    GROUP BY ci.product_id
    HAVING p.stock > (total_received - total_returned)
    LIMIT 10
  `)
  const consign = consignmentData as any[]
  if (consign.length === 0) {
    console.log("  ✅ Clean: No consignment logical anomalies found.\n")
  } else {
    totalCritical += consign.length
    for (const c of consign) {
      const netReceived = Number(c.total_received) - Number(c.total_returned)
      console.log(`  ❌ CRITICAL: Consignment stock error SKU:${c.sku} | ${c.name} | Net Received:${netReceived} | Global Stock:${c.stock}`)
    }
    console.log()
  }

  // === SCAN 13: Paid Orders vs Payment Records ===
  console.log("--- SCAN 13: Checking for Paid Orders without matching payments ---")
  const [paidOrderIssues] = await conn.execute(`
    SELECT o.id, o.order_no, o.grand_total,
           COALESCE(SUM(op.amount), 0) as payment_sum
    FROM orders o
    LEFT JOIN order_payments op ON op.order_id = o.id
    WHERE o.payment_status = 'paid'
    GROUP BY o.id
    HAVING ABS(grand_total - payment_sum) > 0.01
    LIMIT 10
  `)
  const paidIss = paidOrderIssues as any[]
  if (paidIss.length === 0) {
    console.log("  ✅ Clean: All paid orders have corresponding payments.\n")
  } else {
    totalWarning += paidIss.length
    for (const o of paidIss) {
      console.log(`  ⚠️ WARNING: Paid Order [${o.order_no}] Grand Total: Rp ${Number(o.grand_total).toLocaleString('id-ID')} | Payments: Rp ${Number(o.payment_sum).toLocaleString('id-ID')}`)
    }
    console.log()
  }

  // === SCAN 14: Loan Schedules vs Principal Plafon ===
  console.log("--- SCAN 14: Checking Loan Schedules vs Principal Plafon ---")
  const [plafonIssues] = await conn.execute(`
    SELECT l.id, l.loan_no, l.principal,
           COALESCE(SUM(ls.principal_due), 0) as sched_sum
    FROM loans l
    JOIN loan_schedules ls ON ls.loan_id = l.id
    GROUP BY l.id
    HAVING ABS(principal - sched_sum) > 0.01
    LIMIT 10
  `)
  const plafonIss = plafonIssues as any[]
  if (plafonIss.length === 0) {
    console.log("  ✅ Clean: All loan schedule sums match their principal plafon.\n")
  } else {
    totalCritical += plafonIss.length
    for (const l of plafonIss) {
      console.log(`  ❌ CRITICAL: Loan [${l.loan_no}] principal (Rp ${Number(l.principal).toLocaleString('id-ID')}) != sum schedules (Rp ${Number(l.sched_sum).toLocaleString('id-ID')})`)
    }
    console.log()
  }

  // === SCAN 15: Outstanding vs Payment-Based Calculation ===
  console.log("--- SCAN 15: Checking Loan Outstanding vs Payments (Strict) ---")
  const [outstandingIssues] = await conn.execute(`
    SELECT l.id, l.loan_no, l.principal, l.outstanding_principal,
           COALESCE((SELECT SUM(lp2.principal_portion) FROM loan_payments lp2 WHERE lp2.loan_id = l.id), 0) as total_paid_principal
    FROM loans l
    HAVING ABS(outstanding_principal - GREATEST(0, principal - total_paid_principal)) > 0.05
    LIMIT 10
  `)
  const outstIss = outstandingIssues as any[]
  if (outstIss.length === 0) {
    console.log("  ✅ Clean: All loan outstanding balances are consistent with payment records.\n")
  } else {
    totalCritical += outstIss.length
    for (const l of outstIss) {
      const calcOut = Math.max(0, Number(l.principal) - Number(l.total_paid_principal))
      console.log(`  ❌ CRITICAL: Loan [${l.loan_no}] outstanding (Rp ${Number(l.outstanding_principal).toLocaleString('id-ID')}) != calc (Rp ${calcOut.toLocaleString('id-ID')})`)
    }
    console.log()
  }

  // === SCAN 16: Loan Status vs Outstanding ===
  console.log("--- SCAN 16: Checking Loan Status vs Outstanding Balance ---")
  const [statusIssues] = await conn.execute(`
    SELECT l.loan_no, l.outstanding_principal, l.status
    FROM loans l
    WHERE (l.outstanding_principal = 0 AND l.status != 'paid_off')
       OR (l.outstanding_principal > 0 AND l.status = 'paid_off')
    LIMIT 10
  `)
  const statIss = statusIssues as any[]
  if (statIss.length === 0) {
    console.log("  ✅ Clean: All loan statuses are consistent with outstanding balances.\n")
  } else {
    totalCritical += statIss.length
    for (const l of statIss) {
      console.log(`  ❌ CRITICAL: Loan [${l.loan_no}] outstanding Rp ${Number(l.outstanding_principal).toLocaleString('id-ID')} but status '${l.status}'`)
    }
    console.log()
  }

  // === SCAN 17: PPOB Paylater vs Orders ===
  console.log("--- SCAN 17: Checking PPOB Paylater vs Orders ---")
  const [ppobIssues] = await conn.execute(`
    SELECT pt.trx_no, pt.total_amount,
           o.grand_total, o.order_no
    FROM ppob_transactions pt
    LEFT JOIN orders o ON o.order_no = pt.trx_no
    WHERE pt.payment_method = 'paylater' AND pt.status = 'success'
      AND (o.id IS NULL OR ABS(pt.total_amount - o.grand_total) > 0.01)
    LIMIT 10
  `)
  const ppobIss = ppobIssues as any[]
  if (ppobIss.length === 0) {
    console.log("  ✅ Clean: All PPOB paylater transactions match order records.\n")
  } else {
    totalCritical += ppobIss.length
    for (const p of ppobIss) {
      if (!p.order_no) {
        console.log(`  ❌ CRITICAL: PPOB Paylater ${p.trx_no} has no matching order record.`)
      } else {
        console.log(`  ❌ CRITICAL: PPOB ${p.trx_no} amount (Rp ${Number(p.total_amount).toLocaleString('id-ID')}) != Order (Rp ${Number(p.grand_total).toLocaleString('id-ID')})`)
      }
    }
    console.log()
  }

  // === SUMMARY ===
  console.log("=".repeat(75))
  console.log("=== AUDIT SUMMARY ===")
  console.log(`  Critical Errors (Need immediate fix)  : ${totalCritical}`)
  console.log(`  Warnings/Inconsistencies              : ${totalWarning}`)
  if (totalCritical === 0 && totalWarning === 0) {
    console.log("  🎉 SYSTEM IS 100% HEALTHY!")
  } else {
    console.log("  ⚠️ Action required. Run repair scripts to fix these findings.")
  }
  console.log("=".repeat(75))

  await conn.end()
}

main().catch(console.error)
