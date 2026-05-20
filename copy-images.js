const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\IT-Merak\\.gemini\\antigravity\\brain\\75ed4d6e-c4cd-44cc-8c3f-f8eb40e982db';
const destDir = 'D:\\laragon\\www\\koperasi-sulfindo\\public\\images\\products';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
for (let i = 1; i <= 7; i++) {
  const prefix = `p00${i}_`;
  const file = files.find(f => f.startsWith(prefix) && f.endsWith('.png'));
  if (file) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, `p00${i}.png`));
    console.log(`Copied ${file} to p00${i}.png`);
  }
}
