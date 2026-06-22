import { prisma } from "../src/lib/db/prisma";
import { checkLoanRuleViolations } from "../src/lib/actions/loans";

async function main() {
  const pendingApps = await prisma.loan_applications.findMany({
    where: { status: "pending" },
    include: { members: true, loan_products: true }
  });

  console.log("=== RUNNING checkLoanRuleViolations ON PENDING APPLICATIONS ===");
  for (const a of pendingApps) {
    const violations = await checkLoanRuleViolations(
      a.member_id,
      a.loan_product_id,
      Number(a.amount_requested),
      a.id
    );
    console.log(`Application: ${a.application_no}`);
    console.log(`Member: ${a.members?.full_name} (ID: ${a.member_id})`);
    console.log(`Product: ${a.loan_products?.name} (ID: ${a.loan_product_id})`);
    console.log(`Violations:`, violations);
  }
}

main().catch(console.error);
