const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const sukarelaType = await prisma.saving_types.findFirst({
    where: { OR: [{ code: "SUKARELA" }, { code: "SS" }, { name: { contains: "Sukarela" } }] },
  });
  console.log('Sukarela type found:', sukarelaType?.code, sukarelaType?.name);

  const someMember = await prisma.members.findFirst({ where: { status: 'active' } });
  const saving = await prisma.savings.findUnique({
    where: { member_id_saving_type_id: { member_id: someMember.id, saving_type_id: sukarelaType.id } },
  });
  console.log('Sample member savings lookup works:', !!saving, 'balance:', saving?.balance?.toString());
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
