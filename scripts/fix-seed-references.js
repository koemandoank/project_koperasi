#!/usr/bin/env node
/**
 * Fix seed-dummy.ts: rename incorrect model references to actual model names
 */
const fs = require('fs');
const path = require('path');
const seedPath = path.join(__dirname, '..', 'prisma', 'seed-dummy.ts');

let content = fs.readFileSync(seedPath, 'utf8');
const replacements = {
  'prisma.unit.': 'prisma.units.',
  'prisma.user.': 'prisma.users.',
  'prisma.member.': 'prisma.members.',
};
for (const [from, to] of Object.entries(replacements)) {
  content = content.split(from).join(to);
}
fs.writeFileSync(seedPath, content);
console.log('✅ Fixed seed-dummy.ts model references');
