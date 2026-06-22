import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const members = ["S0016", "S0018"];
  for (const mCode of members) {
    console.log(`\n=== MEMBER: ${mCode} ===`);
    const m = await prisma.member.findFirst({
      where: { nik: mCode },
      include: {
        loans: {
          include: {
            loan_applications: {
              include: { loan_products: true }
            },
            loan_schedules: true,
            loan_payments: true
          }
        }
      }
    });
    if (!m) {
      console.log(`Member ${mCode} not found.`);
      continue;
    }
    console.log(`Name: ${m.full_name}`);
    for (const l of m.loans) {
      console.log(`\nLoan No: ${l.loan_no}`);
      console.log(`  Status: ${l.status}`);
      console.log(`  Principal: Rp ${Number(l.principal).toLocaleString("id-ID")}`);
      console.log(`  Outstanding Principal: Rp ${Number(l.outstanding_principal).toLocaleString("id-ID")}`);
      console.log(`  Tenor: ${l.tenor_months} months`);
      console.log(`  Monthly Inst: Rp ${Number(l.monthly_installment).toLocaleString("id-ID")}`);
      console.log(`  Disbursed At: ${l.disbursed_at.toISOString().split("T")[0]}`);
      console.log(`  Product Code: ${l.loan_applications?.loan_products?.code} | Name: ${l.loan_applications?.loan_products?.name}`);
      console.log(`  Schedules Count: ${l.loan_schedules.length}`);
      const paidSchedules = l.loan_schedules.filter(s => s.status === 'paid');
      console.log(`  Paid Schedules Count: ${paidSchedules.length}`);
      console.log(`  Payments Count: ${l.loan_payments.length}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
