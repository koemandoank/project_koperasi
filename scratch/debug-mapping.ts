import * as fs from 'fs';
import * as path from 'path';
import { parseSchema } from './parse-schema';

async function main() {
  const mysqlColumns = JSON.parse(fs.readFileSync(path.join(__dirname, 'mysql-columns.json'), 'utf8'));
  console.log("=== MYSQL DUMP COLUMNS FOR consignment_items ===");
  console.log(mysqlColumns['consignment_items']);
  
  const parsedSchema = parseSchema();
  const tableInfo = parsedSchema.find(t => t.tableName === 'consignment_items');
  console.log("\n=== PRISMA SCHEMA COLUMNS FOR consignment_items ===");
  console.log(tableInfo?.columns.map(c => `${c.dbName} (${c.type})`));
  
  const sqlPath = path.join(__dirname, '../data_koperasi_only.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const sqlLines = sqlContent.split('\n');
  const line = sqlLines.find(l => l.toLowerCase().includes('insert into `consignment_items`'));
  
  console.log("\n=== SQL DUMP INSERT LINE ===");
  console.log(line?.substring(0, 300));
}

main().catch(console.error);
