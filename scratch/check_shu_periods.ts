import { prisma } from "../src/lib/db/prisma"

async function run() {
  const periods = await prisma.shu_periods.findMany();
  console.log("Database SHU Periods:", JSON.stringify(periods, (key, value) => typeof value === "bigint" ? value.toString() : value, 2));
}

run();
