import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.join(__dirname, '../data_koperasi_only.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const tables = ['products', 'loan_products'];
  for (const table of tables) {
    console.log(`Searching for table: ${table}`);
    const foundLines = lines.filter(l => l.toLowerCase().includes(`insert into \`${table}\``));
    console.log(`Found ${foundLines.length} lines`);
    for (const l of foundLines) {
      console.log(`Line length: ${l.length}`);
      console.log(`Line starts with: "${l.substring(0, 100)}..."`);
    }
  }
}

main().catch(console.error);
