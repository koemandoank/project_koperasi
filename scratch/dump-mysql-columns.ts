import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const mysqlUri = process.env.MYSQL_URI || "mysql://avnadmin:PASSWORD@mysql-36f27656-cilegonservice-9d6d.a.aivencloud.com:14368/defaultdb?ssl-mode=REQUIRED&zeroDateTimeBehavior=convertToNull&connection_limit=5";
  console.log("Connecting to Aiven MySQL database...");
  
  const connection = await mysql.createConnection(mysqlUri);
  console.log("Connected successfully!");
  
  console.log("Querying column metadata...");
  const [rows] = await connection.execute(`
    SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'defaultdb'
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
}

main().catch(console.error);
