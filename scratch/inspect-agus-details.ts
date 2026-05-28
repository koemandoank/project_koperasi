import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== DETAILED INSPECTION FOR AGUS SETIAWAN (MEMBER ID 17) ===")

  // 1. Get member info
  const member = await prisma.member.findUnique({
    where: { id: 17 }
  })
  console.log("Member Info:", member)

  // 2. Get all loans
  const loans = await prisma.loans.findMany({
    where: { member_id: 17 },
    include: {
      loan_applications: {
        include: { loan_products: true }
      }
    }
  })

  console.log(`\nFound ${loans.length} loans:`)
  for (const loan of loans) {
    console.log(`\n--------------------------------------------------`)
    console.log(`Loan ID: ${loan.id}`)
    console.log(`Loan No: ${loan.loan_no}`)
    console.log(`Status: ${loan.status}`)
    console.log(`Principal: Rp ${Number(loan.principal).toLocaleString("id-ID")}`)
    console.log(`Interest Rate: ${loan.interest_rate}%`)
    console.log(`Term (Months): ${(loan as any).tenor_months ?? "-"}`)
    console.log(`Disbursed At: ${loan.disbursed_at ? new Date(loan.disbursed_at).toISOString() : "-"}`)
    console.log(`Created At: ${loan.created_at ? new Date(loan.created_at).toISOString() : "-"}`)
    console.log(`Repayment Method: ${loan.repayment_method}`)
    console.log(`Product Name: ${loan.loan_applications?.loan_products?.name} | Code: ${loan.loan_applications?.loan_products?.code}`)

    // Get schedules
    const schedules = await prisma.loan_schedules.findMany({
      where: { loan_id: loan.id },
      orderBy: { installment_no: "asc" }
    })
    console.log(`Schedules (${schedules.length}):`)
    for (const s of schedules) {
      console.log(`  Inst #${s.installment_no} | Due: ${s.due_date.toISOString().split("T")[0]} | Principal Due: ${Number(s.principal_due).toLocaleString("id-ID")} | Interest Due: ${Number(s.interest_due).toLocaleString("id-ID")} | Paid At: ${s.paid_at ? s.paid_at.toISOString() : "-"} | Status: ${s.status}`)
    }

    // Get payments
    const payments = await prisma.loan_payments.findMany({
      where: { loan_id: loan.id },
      orderBy: { paid_at: "asc" }
    })
    console.log(`Payments (${payments.length}):`)
    for (const p of payments) {
      console.log(`  Pay ID: ${p.id} | Pay No: ${p.payment_no} | Paid At: ${p.paid_at.toISOString()} | Amount Paid: ${Number(p.amount_paid).toLocaleString("id-ID")} | Principal Portion: ${Number(p.principal_portion).toLocaleString("id-ID")} | Interest Portion: ${Number(p.interest_portion).toLocaleString("id-ID")} | Ref: ${p.reference}`)
    }
  }

  // 3. Get transactions for savings or other tables if relevant
  console.log(`\n=== SAVINGS TRANSACTIONS FOR AGUS (MEMBER ID 17) ===`)
  const savingsTrxs = await prisma.saving_transactions.findMany({
    where: { member_id: 17 },
    include: {
      savings: {
        include: { saving_types: true }
      }
    },
    orderBy: { transaction_at: "desc" }
  })
  for (const st of savingsTrxs) {
    console.log(`Trx ID: ${st.id} | Date: ${st.transaction_at.toISOString().split("T")[0]} | Type: ${st.type} | Amount: ${Number(st.amount).toLocaleString("id-ID")} | Saving Type: ${st.savings.saving_types.name}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
