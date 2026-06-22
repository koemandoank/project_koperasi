import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { parseSchema, ColumnInfo, TableInfo } from './parse-schema';

const prisma = new PrismaClient();

const insertOrder = [
  'units',
  'product_categories',
  'suppliers',
  'saving_types',
  'loan_products',
  'loyalty_programs',
  'app_settings',
  'cache',
  'members',
  'warehouse_locations',
  'cash_registers',
  'products',
  'consignment_items',
  'consignment_payables',
  'users',
  'savings',
  'stock_balances',
  'price_tiers',
  'accounts_payable',
  'accounts_receivable',
  'loyalty_memberships',
  'saving_transactions',
  'loan_applications',
  'stock_movements',
  'orders',
  'cash_register_sessions',
  'consignment_settlements',
  'purchase_orders',
  'monthly_closures',
  'audit_logs',
  'loans',
  'order_items',
  'order_payments',
  'order_returns',
  'accounts_payable_details',
  'accounts_receivable_details',
  'purchase_order_items',
  'good_receipts',
  'loan_schedules',
  'good_receipt_items',
  'loan_payments',
  'stock_reorder_points'
];

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

function formatSqlValue(val: any, col: ColumnInfo): string {
  if (val === null || val === undefined || val === 'NULL') {
    if (!col.isNullable) {
      if (col.type === 'Boolean') return 'false';
      if (col.type === 'Int' || col.type === 'BigInt' || col.type === 'Decimal' || col.type === 'Float') return '0';
      if (col.type === 'DateTime') return "'2026-01-01 00:00:00'";
      return "''";
    }
    return 'NULL';
  }
  
  if (col.type === 'Boolean') {
    return (val === '1' || val === 1 || val === 'true' || val === true) ? 'true' : 'false';
  }
  
  if (col.type === 'DateTime') {
    const strVal = String(val).trim();
    if (strVal.startsWith('0000-') || strVal === '' || strVal === '0000-00-00 00:00:00' || strVal === '0000-00-00') {
      if (!col.isNullable) return "'2026-01-01 00:00:00'";
      return 'NULL';
    }
    const d = new Date(strVal);
    if (isNaN(d.getTime())) {
      if (!col.isNullable) return "'2026-01-01 00:00:00'";
      return 'NULL';
    }
    return `'${d.toISOString().replace('T', ' ').slice(0, 19)}'`;
  }
  
  if (col.type === 'Json') {
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
  }
  
  if (col.type === 'BigInt' || col.type === 'Int' || col.type === 'Decimal' || col.type === 'Float') {
    if (val === '' || isNaN(Number(val))) {
      if (!col.isNullable) return '0';
      return 'NULL';
    }
    return String(val);
  }
  
  const escaped = String(val).replace(/'/g, "''");
  return `'${escaped}'`;
}

async function main() {
  console.log("=== STARTING DATABASE RESTORE ===");
  const parsedSchema = parseSchema();
  
  // Load MySQL column mapping
  const mysqlColumnsPath = path.join(__dirname, 'mysql-columns.json');
  if (!fs.existsSync(mysqlColumnsPath)) {
    console.error("❌ Error: mysql-columns.json not found! Please run dump-mysql-columns first.");
    process.exit(1);
  }
  const mysqlColumns = JSON.parse(fs.readFileSync(mysqlColumnsPath, 'utf8'));
  
  const sqlPath = path.join(__dirname, '../data_koperasi_only.sql');
  console.log(`Reading SQL dump from: ${sqlPath}`);
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const sqlLines = sqlContent.split('\n');
  
  // 1. Truncate tables in REVERSE dependency order
  console.log("\nDeleting existing data in reverse dependency order...");
  const deleteOrder = [...insertOrder].reverse();
  for (const table of deleteOrder) {
    const tableInfo = parsedSchema.find(t => t.tableName === table);
    if (!tableInfo) continue;
    
    const pgTableName = tableInfo.tableName; // Use database table name (e.g. users, members)
    console.log(`Deleting ${pgTableName}...`);
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${pgTableName}" CASCADE;`);
    } catch (e: any) {
      console.log(`  ⚠️ Warning during truncate of ${pgTableName}: ${e.message}`);
    }
  }
  
  // 2. Insert data table by table in dependency order
  console.log("\nImporting data in dependency order...");
  for (const table of insertOrder) {
    const tableInfo = parsedSchema.find(t => t.tableName === table);
    if (!tableInfo) {
      console.log(`  Table ${table} not found in schema.prisma. Skipping.`);
      continue;
    }
    
    const pgTableName = tableInfo.tableName; // Use database table name (e.g. users, members)
    
    const insertLine = sqlLines.find(line => {
      const trimmed = line.trim();
      return trimmed.toLowerCase().includes(`insert into \`${table}\``);
    });
    
    if (!insertLine) {
      console.log(`  No insert statement found in SQL dump for table ${table}. Skipping.`);
      continue;
    }
    
    const parsedRows = parseInsertValues(insertLine);
    console.log(`Importing ${parsedRows.length} rows into ${pgTableName} (${table})...`);
    
    if (parsedRows.length === 0) continue;
    
    // Get original MySQL column mapping for this table
    const manualTableColumns: { [key: string]: string[] } = {
      consignment_items: [
        'id', 'product_id', 'supplier_id', 'consignment_date', 
        'qty_received', 'qty_sold', 'qty_returned', 'status', 
        'created_at', 'updated_at', 'return_date', 'return_reason'
      ]
    };
    
    const mysqlCols = manualTableColumns[table] || mysqlColumns[table];
    if (!mysqlCols) {
      console.error(`❌ Error: Table ${table} not found in mysql-columns.json!`);
      process.exit(1);
    }
    
    // Construct bulk query or execute one-by-one to avoid query length limits
    // Execute in batches of 100 rows to be safe and performant
    const columns = tableInfo.columns.map(c => `"${c.dbName}"`).join(', ');
    const batchSize = 100;
    
    for (let i = 0; i < parsedRows.length; i += batchSize) {
      const batch = parsedRows.slice(i, i + batchSize);
      
      const valuesSql = batch.map(row => {
        const vals = tableInfo.columns.map((col) => {
          // Find index of this col in the original MySQL column list
          const colIdx = mysqlCols.indexOf(col.dbName);
          const rawVal = colIdx !== -1 ? row[colIdx] : null;
          return formatSqlValue(rawVal, col);
        });
        return `(${vals.join(', ')})`;
      }).join(', ');
      
      const query = `INSERT INTO "${pgTableName}" (${columns}) VALUES ${valuesSql};`;
      try {
        await prisma.$executeRawUnsafe(query);
      } catch (e: any) {
        console.error(`❌ Error importing batch for ${pgTableName}:`, e.message);
        console.error("Query snippet:", query.substring(0, 500));
        process.exit(1);
      }
    }
  }
  
  // 3. Reset PostgreSQL sequences
  console.log("\nResetting PostgreSQL sequence counters...");
  for (const table of insertOrder) {
    const tableInfo = parsedSchema.find(t => t.tableName === table);
    if (!tableInfo) continue;
    
    const pgTableName = tableInfo.tableName; // Use database table name (e.g. users, members)
    const hasId = tableInfo.columns.some(c => c.dbName === 'id');
    if (!hasId) continue;
    
    console.log(`Resetting sequence for ${pgTableName}...`);
    
    try {
      await prisma.$executeRawUnsafe(`
        SELECT setval(
          COALESCE(
            pg_get_serial_sequence('"${pgTableName}"', 'id'),
            'public."${pgTableName}_id_seq"'
          ),
          COALESCE((SELECT MAX("id") FROM "${pgTableName}"), 1)
        );
      `);
    } catch (e: any) {
      try {
        await prisma.$executeRawUnsafe(`
          SELECT setval('"${pgTableName.toLowerCase()}_id_seq"', COALESCE((SELECT MAX("id") FROM "${pgTableName}"), 1));
        `);
      } catch (e2: any) {
        console.log(`  ⚠️ Could not reset sequence for ${pgTableName}: ${e.message}`);
      }
    }
  }
  
  console.log("\n=== DATABASE RESTORE COMPLETE ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
