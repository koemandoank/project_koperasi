import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.join(__dirname, '../data_koperasi_only.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find all INSERT INTO statements
  const lines = content.split('\n');
  const tableInserts: { [key: string]: number } = {};
  
  for (const line of lines) {
    const match = line.match(/INSERT INTO `([^`]+)`/i);
    if (match) {
      const tableName = match[1];
      tableInserts[tableName] = (tableInserts[tableName] || 0) + 1;
    }
  }
  
  console.log("=== TABLES FOUND IN SQL DUMP ===");
  for (const [table, count] of Object.entries(tableInserts)) {
    console.log(`${table}: ${count} insert statements`);
  }
}

main().catch(console.error);
