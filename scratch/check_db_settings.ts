import { prisma } from "../src/lib/db/prisma"

async function run() {
  const settings = await prisma.app_settings.findFirst();
  console.log("Database App Settings:", JSON.stringify(settings, (key, value) => typeof value === "bigint" ? value.toString() : value, 2));
}

run();
