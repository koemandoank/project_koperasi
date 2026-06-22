#!/usr/bin/env node
/**
 * Fix Prisma schema for PostgreSQL deployment
 * - Strip MySQL-specific type hints
 * - Remove duplicate constraint map names
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const backupPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.mysql-backup');

console.log('🔧 Fixing Prisma schema for PostgreSQL...');

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

// Remove ALL map parameters from @@index to avoid conflicts
schema = schema.replace(/(@@index\([^)]+),\s*map:\s*"[^"]+"/g, '$1');

// Track and rename duplicate relation map names
const relationMapNames = new Map(); // map name -> count
let modelCounter = 0;

schema = schema.replace(/^model\s+(\w+)\s*\{[^}]+\}/gms, (modelBlock) => {
  modelCounter++;
  const localMaps = new Set();
  
  return modelBlock.replace(/@relation\(([^)]+)\)/g, (match, params) => {
    const mapMatch = params.match(/map:\s*"([^"]+)"/);
    if (!mapMatch) return match;
    
    const originalMap = mapMatch[1];
    
    // Check if this map name was used in this model already
    if (localMaps.has(originalMap)) {
      // Remove map parameter if duplicate within same model
      const newParams = params.replace(/,\s*map:\s*"[^"]+"/g, '');
      return `@relation(${newParams})`;
    }
    
    localMaps.add(originalMap);
    
    // Check if this map name was used globally
    if (relationMapNames.has(originalMap)) {
      const count = relationMapNames.get(originalMap);
      relationMapNames.set(originalMap, count + 1);
      // Rename to make unique
      const newMap = `${originalMap}_${count + 1}`;
      const newParams = params.replace(/map:\s*"[^"]+"/, `map: "${newMap}"`);
      return `@relation(${newParams})`;
    }
    
    relationMapNames.set(originalMap, 1);
    return match;
  });
});

// Write cleaned schema
fs.writeFileSync(schemaPath, schema, 'utf8');

console.log('✅ MySQL type hints stripped');
console.log('✅ Duplicate constraint names fixed');
console.log(`✅ Processed ${modelCounter} models`);
console.log('📦 Schema ready for PostgreSQL deployment');
