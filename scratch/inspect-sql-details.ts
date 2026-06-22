import * as fs from 'fs';
import * as path from 'path';

function parseInsertValues(insertLine: string): any[] {
  const valIndex = insertLine.toUpperCase().indexOf('VALUES');
  if (valIndex === -1) return [];
  
  let valuesStr = insertLine.substring(valIndex + 6).trim();
  if (valuesStr.endsWith(';')) {
    valuesStr = valuesStr.slice(0, -1);
  }
  
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
  
  return records.map(rec => {
    const fields: string[] = [];
    let field = '';
    let inStr = false;
    let esc = false;
    let qChar = '';
    
    for (let i = 0; i < rec.length; i++) {
      const c = rec[i];
      if (esc) {
        field += c;
        esc = false;
        continue;
      }
      if (c === '\\') {
        field += c;
        esc = true;
        continue;
      }
      if (inStr) {
        field += c;
        if (c === qChar) {
          inStr = false;
        }
        continue;
      }
      if (c === "'" || c === '"') {
        field += c;
        inStr = true;
        qChar = c;
        continue;
      }
      if (c === ',') {
        fields.push(field.trim());
        field = '';
        continue;
      }
      field += c;
    }
    fields.push(field.trim());
    return fields.map(f => {
      if (f.startsWith("'") && f.endsWith("'")) return f.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (f.startsWith('"') && f.endsWith('"')) return f.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
      if (f.toUpperCase() === 'NULL') return null;
      return f;
    });
  });
}

async function main() {
  const filePath = path.join(__dirname, '../data_koperasi_only.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const targetTables = ['products', 'loan_products', 'saving_types', 'savings', 'saving_transactions'];
  
  for (const table of targetTables) {
    const insertLine = lines.find(line => {
      const trimmed = line.trim();
      return trimmed.toLowerCase().includes(`insert into \`${table}\``);
    });
    if (!insertLine) {
      console.log(`\n=== TABLE: ${table} ===`);
      console.log('No insert statement found.');
      continue;
    }
    
    const parsed = parseInsertValues(insertLine);
    console.log(`\n=== TABLE: ${table} (${parsed.length} rows) ===`);
    parsed.forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, row);
    });
  }
}

main().catch(console.error);
