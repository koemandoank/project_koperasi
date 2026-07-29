const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'members' AND column_name IN ('bank_account','bank_holder','bank_name')
    ORDER BY ordinal_position;
  `);
  console.log(JSON.stringify(cols, null, 2));
  // Sekalian cek apakah ada kolom LAIN di DB yang tidak ada di schema.prisma members model
  const allCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'members' ORDER BY ordinal_position;
  `);
  console.log('--- semua kolom members di DB ---');
  console.log(JSON.stringify(allCols, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
