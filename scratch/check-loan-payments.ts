import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.loan_schedules.count();
  console.log("Total loan_schedules count:", count);

  const paidCount = await prisma.loan_schedules.count({
    where: {
      status: "paid"
    }
  });
  console.log("Paid loan_schedules count:", paidCount);

  const interestPaidSum = await prisma.loan_schedules.aggregate({
    _sum: {
      interest_paid: true
    }
  });
  console.log("Sum of interest_paid in loan_schedules:", Number(interestPaidSum._sum.interest_paid ?? 0));

  if (paidCount > 0) {
    const paidSchedules = await prisma.loan_schedules.findMany({
      where: {
        OR: [
          { status: "paid" },
          { interest_paid: { gt: 0 } }
        ]
      },
      take: 10,
      include: {
        loans: {
          select: {
            member_id: true,
            loan_no: true,
          }
        }
      }
    });

    console.log("Sample paid schedules:");
    paidSchedules.forEach(s => {
      console.log({
        id: s.id.toString(),
        loan_id: s.loan_id.toString(),
        member_id: s.loans?.member_id?.toString(),
        installment_no: s.installment_no,
        interest_paid: Number(s.interest_paid),
        principal_paid: Number(s.principal_paid),
        paid_at: s.paid_at,
        status: s.status,
      });
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
