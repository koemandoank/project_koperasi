import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
const prisma = new PrismaClient();

async function main() {
  const s16 = await prisma.member.findFirst({ where: { nik: "S0016" } });
  const s18 = await prisma.member.findFirst({ where: { nik: "S0018" } });

  console.log("Rian Nuriana (S0016) ID:", s16?.id);
  console.log("Christine Veronika (S0018) ID:", s18?.id);

  const sqlPath = path.join(__dirname, "../data_koperasi_only.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf8");
  const lines = sqlContent.split("\n");

  const findAndPrintTable = (tableName: string, filterId: string) => {
    const insertLine = lines.find((line) =>
      line.trim().toLowerCase().includes(`insert into \`${tableName}\``)
    );
    if (!insertLine) {
      console.log(`No insert for ${tableName}`);
      return;
    }
    console.log(`\n=== SQL Insert for ${tableName} (Filtering for Member ID: ${filterId}) ===`);
    // Parse values manually to filter
    const valIndex = insertLine.toUpperCase().indexOf("VALUES");
    if (valIndex === -1) return;
    let valuesStr = insertLine.substring(valIndex + 6).trim();
    if (valuesStr.endsWith(";")) {
      valuesStr = valuesStr.slice(0, -1);
    }
    // simple split by '),(' to get rows
    const rows = valuesStr.split(/\),\s*\(/);
    for (let r of rows) {
      // clean first and last parentheses
      r = r.replace(/^\(/, "").replace(/\)$/, "");
      const cols = r.split(",");
      // Check if member_id matches (we need to know which column index is member_id)
      // Usually, in loans: id, member_id, application_id, ...
      // Let's print rows that contain the filterId as one of the columns
      const trimmedCols = cols.map(c => c.trim().replace(/^'|'$/g, ""));
      if (trimmedCols.includes(filterId)) {
        console.log("Row:", trimmedCols);
      }
    }
  };

  if (s16) {
    findAndPrintTable("loans", String(s16.id));
    findAndPrintTable("loan_applications", String(s16.id));
  }
  if (s18) {
    findAndPrintTable("loans", String(s18.id));
    findAndPrintTable("loan_applications", String(s18.id));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
