import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getSQLTableCounts(filePath: string): { [key: string]: number } {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const tableCounts: { [key: string]: number } = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().includes('insert into ')) continue;
    
    // Extract table name
    const match = trimmed.match(/insert into `([^`]+)`/i);
    if (!match) continue;
    
    const tableName = match[1];
    
    // Parse insert values to count rows
    const valIndex = trimmed.toUpperCase().indexOf('VALUES');
    if (valIndex === -1) continue;
    
    let valuesStr = trimmed.substring(valIndex + 6).trim();
    if (valuesStr.endsWith(';')) {
      valuesStr = valuesStr.slice(0, -1);
    }
    
    let rowCount = 0;
    let inString = false;
    let escape = false;
    let parenLevel = 0;
    let quoteChar = '';
    
    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      if (escape) { escape = false; continue; }
      if (char === '\\') { escape = true; continue; }
      if (inString) {
        if (char === quoteChar) inString = false;
        continue;
      }
      if (char === "'" || char === '"') {
        inString = true;
        quoteChar = char;
        continue;
      }
      if (char === '(') {
        parenLevel++;
      }
      if (char === ')') {
        parenLevel--;
        if (parenLevel === 0) {
          rowCount++;
        }
      }
    }
    tableCounts[tableName] = rowCount;
  }
  
  return tableCounts;
}

async function main() {
  const sqlPath = path.join(__dirname, '../data_koperasi_only.sql');
  console.log("Reading SQL dump and counting rows...");
  const sqlCounts = getSQLTableCounts(sqlPath);
  
  console.log("Reading Neon Postgres counts...");
  
  const tablesToCompare = Object.keys(sqlCounts);
  
  console.log("\n| Table Name | SQL Dump Rows | Neon Postgres Rows | Difference | Status |");
  console.log("|------------|---------------|-------------------|------------|--------|");
  
  for (const table of tablesToCompare) {
    let neonCount = -1;
    let status = '';
    
    try {
      // Map MySQL table name to Prisma model name
      let prismaName = table;
      // Handle special mappings or singularizations if needed
      // Most tables are lowercase and map to prisma[tableName] or lowercase
      // Let's try direct lowercase match
      const pKey = Object.keys(prisma).find(k => k.toLowerCase() === table.toLowerCase());
      if (pKey) {
        // @ts-ignore
        neonCount = await prisma[pKey].count();
      } else {
        // Try singular/plural conversions if needed
        status = 'Model not found in Prisma';
      }
    } catch (e: any) {
      status = `Error: ${e.message.substring(0, 40)}`;
    }
    
    const sqlCount = sqlCounts[table];
    const diff = neonCount !== -1 ? neonCount - sqlCount : 'N/A';
    
    if (status === '') {
      if (neonCount === sqlCount) {
        status = '✅ Matches';
      } else if (neonCount === 0 && sqlCount > 0) {
        status = '❌ Completely Empty';
      } else if (neonCount < sqlCount) {
        status = '⚠️ Missing Rows';
      } else {
        status = '➕ Extra Rows';
      }
    }
    
    console.log(`| ${table} | ${sqlCount} | ${neonCount === -1 ? 'N/A' : neonCount} | ${diff} | ${status} |`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
