const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
console.log('Membaca file skema dari:', schemaPath);

if (!fs.existsSync(schemaPath)) {
  console.error('File schema.prisma tidak ditemukan.');
  process.exit(1);
}

let content = fs.readFileSync(schemaPath, 'utf8');

// 1. Ganti provider database
content = content.replace(/provider\s*=\s*"mysql"/g, 'provider = "postgresql"');

// 2. Buang anotasi tipe data spesifik MySQL
const replacements = [
  { pattern: /\s*@db\.UnsignedBigInt/g, replacement: '' },
  { pattern: /\s*@db\.UnsignedInt/g, replacement: '' },
  { pattern: /\s*@db\.UnsignedTinyInt/g, replacement: '' },
  { pattern: /\s*@db\.LongText/g, replacement: '' },
  { pattern: /\s*@db\.MediumText/g, replacement: '' },
  { pattern: /\s*@db\.Year/g, replacement: '' },
  { pattern: /\s*@db\.TinyInt/g, replacement: '' }
];

let replacedCount = 0;
replacements.forEach(({ pattern, replacement }) => {
  const matchCount = (content.match(pattern) || []).length;
  replacedCount += matchCount;
  content = content.replace(pattern, replacement);
});

console.log(`Berhasil mengganti ${replacedCount} tipe data MySQL spesifik.`);

// 3. Rename index mappings ending in _foreign to avoid PostgreSQL constraint name conflicts
const indexMatches = (content.match(/@@index\(([^)]+),\s*map:\s*"([^"]+)_foreign"\)/g) || []).length;
content = content.replace(/@@index\(([^)]+),\s*map:\s*"([^"]+)_foreign"\)/g, '@@index($1, map: "idx_$2_foreign")');
console.log(`Berhasil mengganti nama ${indexMatches} indeks yang berkonflik.`);

fs.writeFileSync(schemaPath, content, 'utf8');
console.log('schema.prisma berhasil diperbarui untuk PostgreSQL!');
