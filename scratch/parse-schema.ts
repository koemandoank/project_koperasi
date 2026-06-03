import * as fs from 'fs';
import * as path from 'path';

export interface ColumnInfo {
  name: string; // prisma field name
  dbName: string; // db column name
  type: string;
  isNullable: boolean;
}

export interface TableInfo {
  modelName: string;
  tableName: string;
  columns: ColumnInfo[];
}

export function parseSchema(): TableInfo[] {
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const content = fs.readFileSync(schemaPath, 'utf8');
  
  // First pass: find all model names
  const modelNames = new Set<string>();
  const modelNameRegex = /model\s+(\w+)\s+{/g;
  let m;
  while ((m = modelNameRegex.exec(content)) !== null) {
    modelNames.add(m[1]);
  }
  
  const tables: TableInfo[] = [];
  const modelRegex = /model\s+(\w+)\s+{([\s\S]*?)}/g;
  let match;
  
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    
    // Find table name map: @@map("name")
    let tableName = modelName;
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    if (mapMatch) {
      tableName = mapMatch[1];
    }
    
    const columns: ColumnInfo[] = [];
    const lines = body.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('@@') || trimmed.startsWith('//')) continue;
      
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      
      const fieldName = parts[0];
      let typeStr = parts[1];
      
      const isNullable = typeStr.endsWith('?');
      const baseType = typeStr.replace('?', '');
      
      // Check if this is a relation
      if (typeStr.endsWith('[]') || modelNames.has(baseType)) {
        continue;
      }
      
      // Check db column name map if any, e.g. @map("db_column_name")
      let dbName = fieldName;
      const colMapMatch = trimmed.match(/@map\("([^"]+)"\)/);
      if (colMapMatch) {
        dbName = colMapMatch[1];
      }
      
      columns.push({
        name: fieldName,
        dbName,
        type: baseType,
        isNullable
      });
    }
    
    tables.push({
      modelName,
      tableName,
      columns
    });
  }
  
  return tables;
}

if (require.main === module) {
  const parsed = parseSchema();
  console.log(`Parsed ${parsed.length} tables from schema.prisma.`);
  // Print some info
  const testTable = parsed.find(t => t.tableName === 'products');
  if (testTable) {
    console.log("Columns for 'products' table:");
    console.log(testTable.columns.map(c => `${c.dbName} (${c.type}${c.isNullable ? '?' : ''})`).join(', '));
  }
}
