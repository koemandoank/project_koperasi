import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const sqlPath = path.join(__dirname, '../data_koperasi_only.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const lines = sqlContent.split('\n');
  
  console.log("=== ALL INSERT STATEMENTS IN SQL DUMP ===");
  for (const line of lines) {
    if (line.trim().toLowerCase().startsWith('insert into')) {
      // Print first 100 characters of the line
      console.log(line.trim().substring(0, 120));
    }
  }
}

main().catch(console.error);
