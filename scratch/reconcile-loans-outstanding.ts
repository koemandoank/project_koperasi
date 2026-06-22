import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=======================================================================")
  console.log("=== RECONCILING LOANS OUTSTANDING PRINCIPAL ===")
  console.log("=======================================================================\n")

  const loans = await prisma.loans.findMany({
    where: { status: { in: ["active", "overdue"] } },
    include: {
      loan_payments: true
    }
  })

  let updatedCount = 0

  for (const loan of loans) {
    const principal = Number(loan.principal)
    
    // Sum all paid principal portions
    const totalPrincipalPaid = loan.loan_payments.reduce(
      (sum, p) => sum + Number(p.principal_portion),
      0
    )

    // Sum all total payments paid
    const totalAmountPaid = loan.loan_payments.reduce(
      (sum, p) => sum + Number(p.amount_paid),
      0
    )

    const expectedOutstanding = Math.max(0, principal - totalPrincipalPaid)
    const currentOutstanding = Number(loan.outstanding_principal)

    const diff = Math.abs(expectedOutstanding - currentOutstanding)

    if (diff > 0.01) {
      console.log(`Reconciling Loan ${loan.loan_no}:`)
      console.log(`  * Current Outstanding : Rp ${currentOutstanding.toLocaleString('id-ID')}`)
      console.log(`  * Expected Outstanding: Rp ${expectedOutstanding.toLocaleString('id-ID')} (diff: Rp ${diff.toLocaleString('id-ID')})`)
      console.log(`  * Total Paid          : Rp ${totalAmountPaid.toLocaleString('id-ID')}`)

      await prisma.loans.update({
        where: { id: loan.id },
        data: {
          outstanding_principal: expectedOutstanding,
          total_paid: totalAmountPaid,
          status: expectedOutstanding <= 0.01 ? 'paid_off' : loan.status,
          updated_at: new Date()
        }
      })
      updatedCount++
    }
  }

  console.log(`\nReconciliation completed! Updated ${updatedCount} loans outstanding principal balances.`)

  // Evict cache
  await prisma.cache.deleteMany({
    where: {
      key: { in: ["members:all", "stats:admin", "stats:koperasi", "members:stats"] }
    }
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
