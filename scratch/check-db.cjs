const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tableCount = await prisma.$queryRawUnsafe("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  console.log('tables:', tableCount[0].cnt);
  const userCount = await prisma.$queryRawUnsafe("SELECT COUNT(*) as cnt FROM users");
  console.log('users:', userCount[0].cnt);
  const memberCount = await prisma.$queryRawUnsafe("SELECT COUNT(*) as cnt FROM members");
  console.log('members:', memberCount[0].cnt);
  const appSettingsCount = await prisma.$queryRawUnsafe("SELECT COUNT(*) as cnt FROM app_settings");
  console.log('app_settings:', appSettingsCount[0].cnt);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
