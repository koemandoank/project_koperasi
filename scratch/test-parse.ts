import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.join(__dirname, '../data_koperasi_only.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const line = lines.find(l => l.toLowerCase().includes('insert into `loan_products`'));
  if (!line) {
    console.log("Line not found");
    return;
  }
  
  console.log("Line length:", line.length);
  const valIndex = line.toUpperCase().indexOf('VALUES');
  if (valIndex === -1) {
    console.log("No VALUES keyword found");
    return;
  }
  
  let valuesStr = line.substring(valIndex + 6).trim();
  if (valuesStr.endsWith(';')) {
    valuesStr = valuesStr.slice(0, -1);
  }
  
  console.log("valuesStr length:", valuesStr.length);
  console.log("valuesStr starts with:", valuesStr.substring(0, 100));
  
  const records: string[] = [];
  let current = '';
  let inString = false;
  let escape = false;
  let parenLevel = 0;
  let quoteChar = '';
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      current += char;
      escape = true;
      continue;
    }
    
    if (inString) {
      current += char;
      if (char === quoteChar) {
        inString = false;
      }
      continue;
    }
    
    if (char === "'" || char === '"') {
      current += char;
      inString = true;
      quoteChar = char;
      continue;
    }
    
    if (char === '(') {
      parenLevel++;
      if (parenLevel === 1) {
        current = '';
        continue;
      }
    }
    
    if (char === ')') {
      parenLevel--;
      if (parenLevel === 0) {
        records.push(current);
        continue;
      }
    }
    
    if (parenLevel > 0) {
      current += char;
    }
  }
  
  console.log(`Parsed ${records.length} records`);
  if (records.length > 0) {
    console.log("First record:", records[0]);
  }
}

main().catch(console.error);
