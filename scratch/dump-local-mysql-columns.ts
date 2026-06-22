import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const localUri = "mysql://root:@127.0.0.1:3306/koperasi_digital";
  console.log("Connecting to local MySQL database...");
  
  try {
    const connection = await mysql.createConnection(localUri);
    console.log("Connected successfully!");
    
    console.log("Querying local column metadata...");
    const [rows] = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'koperasi_digital'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    
    const columnsMap: { [tableName: string]: string[] } = {};
    for (const row of rows as any[]) {
      const table = row.TABLE_NAME;
      const col = row.COLUMN_NAME;
      if (!columnsMap[table]) {
        columnsMap[table] = [];
      }
      columnsMap[table].push(col);
    }
    
    const outputPath = path.join(__dirname, 'mysql-columns.json');
    fs.writeFileSync(outputPath, JSON.stringify(columnsMap, null, 2), 'utf8');
    console.log(`Saved column mapping to: ${outputPath}`);
    
    await connection.end();
  } catch (e: any) {
    console.error("Failed to connect to local MySQL database:", e.message);
  }
}

main().catch(console.error);
