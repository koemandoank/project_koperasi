const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const members = await prisma.members.findMany({
    include: { loans: { where: { status: 'active' } } }
  });
  const dupes = members.filter(m => m.loans.length > 1);
  console.log('Members with >1 active loan:', dupes.length);
  for (const m of dupes) {
    console.log(m.full_name, m.id.toString(), m.loans.map(l => l.loan_no));
  }
  const totalActive = await prisma.loans.count({ where: { status: 'active' } });
  console.log('Total active loans:', totalActive);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
