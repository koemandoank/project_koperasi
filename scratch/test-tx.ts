import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Testing SET LOCAL session_replication_role in transaction...");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';");
      console.log("Success! Transaction set to replica.");
      
      // Let's try to query something
      const count = await tx.user.count();
      console.log(`Users count: ${count}`);
    });
    console.log("Transaction committed successfully.");
  } catch (e: any) {
    console.error("Transaction failed:", e.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
