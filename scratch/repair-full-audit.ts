import mysql from 'mysql2/promise'

const DB = { host: '127.0.0.1', port: 3306, user: 'root', database: 'koperasi_digital' }

async function main() {
  const conn = await mysql.createConnection(DB)
  console.log("=== REPAIR SCRIPT ===")
  console.log()

  // === REPAIR 1: Fix rounding on last installment of 6-tenor loans ===
  console.log("--- REPAIR 1: Fix schedule principal rounding (recurring 1/6 cent issues) ---")
  const [loans] = await conn.execute(`
    SELECT l.id, l.loan_no, l.principal, l.tenor_months,
           COALESCE(SUM(ls.principal_due), 0) as sched_sum
    FROM loans l
    JOIN loan_schedules ls ON ls.loan_id = l.id
    WHERE l.tenor_months = 6
    GROUP BY l.id
    HAVING ABS(principal - sched_sum) > 0.001 AND ABS(principal - sched_sum) < 1
  `)
  const loanRows = loans as any[]
  let roundingFixed = 0

  for (const loan of loanRows) {
    const diff = Number(loan.principal) - Number(loan.sched_sum)
    // Fix last installment
    const [schedules] = await conn.execute(`
      SELECT id, installment_no, principal_due FROM loan_schedules
      WHERE loan_id = ? ORDER BY installment_no DESC LIMIT 1
    `, [loan.id])
    const lastSched = (schedules as any[])[0]
    if (!lastSched) continue

    const newPrincipalDue = (Number(lastSched.principal_due) + diff).toFixed(2)
    await conn.execute(
      `UPDATE loan_schedules SET principal_due = ? WHERE id = ?`,
      [newPrincipalDue, lastSched.id]
    )
    console.log(`  Fixed rounding on ${loan.loan_no}: last installment ${lastSched.installment_no} adjusted by ${diff.toFixed(2)}`)
    roundingFixed++
  }

  if (roundingFixed === 0) {
    console.log("  No rounding fixes needed\n")
  } else {
    console.log(`  Total rounding fixes: ${roundingFixed}\n`)
  }

  // === REPAIR 2: Backfill loan_payments from paid schedules for salary_cut loans ===
  console.log("--- REPAIR 2: Backfill loan_payments from paid schedules ---")
  const [paidSchedules] = await conn.execute(`
    SELECT ls.id as schedule_id, ls.loan_id, l.loan_no, l.member_id,
           ls.installment_no, ls.due_date,
           (ls.principal_paid + ls.interest_paid + COALESCE(ls.penalty_paid, 0)) as amount_paid,
           ls.principal_paid, ls.interest_paid, COALESCE(ls.penalty_paid, 0) as penalty_paid
    FROM loan_schedules ls
    JOIN loans l ON l.id = ls.loan_id
    WHERE ls.status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM loan_payments lp WHERE lp.schedule_id = ls.id)
  `)
  const schedRows = paidSchedules as any[]
  let paymentsCreated = 0

  for (const s of schedRows) {
    const paymentNo = `PMT-${s.loan_no}-I${String(s.installment_no).padStart(2, '0')}`
    await conn.execute(`
      INSERT INTO loan_payments (loan_id, schedule_id, payment_no, amount_paid,
        principal_portion, interest_portion, penalty_amount, payment_method, paid_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'salary_cut', ?, NOW(), NOW())
    `, [
      s.loan_id, s.schedule_id, paymentNo,
      Number(s.amount_paid).toFixed(2),
      Number(s.principal_paid).toFixed(2),
      Number(s.interest_paid).toFixed(2),
      Number(s.penalty_paid).toFixed(2),
      new Date(s.due_date)
    ])
    paymentsCreated++
  }

  if (paymentsCreated === 0) {
    console.log("  No loan payments to backfill\n")
  } else {
    console.log(`  Created ${paymentsCreated} loan_payments records\n`)
  }

  // === REPAIR 3: Backfill order_payments for paid orders ===
  console.log("--- REPAIR 3: Backfill order_payments for paid cash orders ---")
  const [paidOrders] = await conn.execute(`
    SELECT o.id as order_id, o.order_no, o.grand_total, o.payment_method, o.paid_at
    FROM orders o
    WHERE o.payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM order_payments op WHERE op.order_id = o.id)
  `)
  const orderRows = paidOrders as any[]
  let orderPaymentsCreated = 0

  for (const o of orderRows) {
    let pm = String(o.payment_method).toLowerCase()
    // Map order payment_method to order_payments payment_method enum
    const payMethod = pm === 'cash' ? 'cash'
      : pm === 'saving_deduct' ? 'other'
      : pm === 'paylater' ? 'other'
      : pm === 'qris' ? 'qris'
      : pm === 'transfer' ? 'transfer'
      : 'cash'

    await conn.execute(`
      INSERT INTO order_payments (order_id, payment_method, amount, payment_status, paid_at, created_at, updated_at)
      VALUES (?, ?, ?, 'captured', ?, NOW(), NOW())
    `, [o.order_id, payMethod, Number(o.grand_total).toFixed(2), o.paid_at || new Date()])
    orderPaymentsCreated++
  }

  if (orderPaymentsCreated === 0) {
    console.log("  No order payments to backfill\n")
  } else {
    console.log(`  Created ${orderPaymentsCreated} order_payments records\n`)
  }

  console.log("=== REPAIR COMPLETE ===")
  await conn.end()
}

main().catch(console.error)
