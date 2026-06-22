#!/usr/bin/env node
/**
 * Strip MySQL-specific type hints from Prisma schema for PostgreSQL deployment
 * 
 * Removes:
 * - @db.UnsignedBigInt
 * - @db.UnsignedInt
 * - @db.UnsignedTinyInt
 * - @db.MediumText
 * - @db.LongText
 * - @db.DateTime(0)
 * - @db.Year
 * - Duplicate constraint map names in @@index
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const backupPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.mysql-backup');

console.log('🔧 Stripping MySQL-specific type hints from Prisma schema...');

// Read schema
let schema = fs.readFileSync(schemaPath, 'utf8');

// Backup original
fs.writeFileSync(backupPath, schema, 'utf8');
console.log(`✅ Backup saved: ${backupPath}`);

// Strip MySQL-specific types
schema = schema.replace(/@db\.UnsignedBigInt/g, '');
schema = schema.replace(/@db\.UnsignedInt/g, '');
schema = schema.replace(/@db\.UnsignedTinyInt/g, '');
schema = schema.replace(/@db\.MediumText/g, '@db.Text');
schema = schema.replace(/@db\.LongText/g, '@db.Text');
schema = schema.replace(/@db\.DateTime\(0\)/g, '@db.Timestamp');
schema = schema.replace(/@db\.Year/g, '');

// Remove duplicate map constraint names from @@index
// Pattern: @@index([...], map: "name")
// Keep only unique map names per model
const models = schema.split(/^model /m);
const processedModels = models.map((modelBlock, idx) => {
  if (idx === 0) return modelBlock; // Skip preamble
  
  const lines = modelBlock.split('\n');
  const indexMapNames = new Set();
  const relationMapNames = new Set();
  
  const processedLines = lines.map(line => {
    // Handle @@index with map
    const indexMatch = line.match(/@@index\(\[.*?\](?:,\s*map:\s*"([^"]+)")?\)/);
    if (indexMatch) {
      const mapName = indexMatch[1];
      if (mapName) {
        if (indexMapNames.has(mapName)) {
          // Remove map parameter if duplicate
          return line.replace(/,\s*map:\s*"[^"]+"/g, '');
        }
        indexMapNames.add(mapName);
      }
    }
    
    // Handle @relation with map
    const relationMatch = line.match(/@relation\(.*?map:\s*"([^"]+)".*?\)/);
    if (relationMatch) {
      const mapName = relationMatch[1];
      if (mapName) {
        if (relationMapNames.has(mapName)) {
          // Remove map parameter if duplicate
          return line.replace(/,\s*map:\s*"[^"]+"/g, '');
        }
        relationMapNames.add(mapName);
      }
    }
    
    return line;
  });
  
  return processedLines.join('\n');
});

schema = processedModels.join('model ');

// Write cleaned schema
fs.writeFileSync(schemaPath, schema, 'utf8');

console.log('✅ MySQL type hints stripped successfully');
console.log('📦 Schema ready for PostgreSQL deployment');
console.log(`💾 Original schema backed up to: prisma/schema.prisma.mysql-backup`);
