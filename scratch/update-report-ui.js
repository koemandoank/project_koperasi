const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/(dashboard)/laporan/analitik/laporan-analitik-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// ── 1. SEL BARIS POTONGAN GAJI (admPU, bTrsf, admPKhs, admPBrg) ──
const oldRowCells = `                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-blue-700 dark:text-blue-400">{pUang > 0 ? pUang.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600">-</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600">-</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-indigo-700 dark:text-indigo-400">{pKhusus > 0 ? pKhusus.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600">-</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-amber-700 dark:text-amber-400">{pBarang > 0 ? pBarang.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600">-</td>`;

const newRowCells = `                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-blue-700 dark:text-blue-400">{pUang > 0 ? pUang.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{admPU > 0 ? admPU.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{bTrsf > 0 ? bTrsf.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-indigo-700 dark:text-indigo-400">{pKhusus > 0 ? pKhusus.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{admPKhs > 0 ? admPKhs.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-amber-700 dark:text-amber-400">{pBarang > 0 ? pBarang.toLocaleString('id-ID') : '-'}</td>
                                   <td className="px-2 py-1.5 text-right border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-slate-400">{admPBrg > 0 ? admPBrg.toLocaleString('id-ID') : '-'}</td>`;

// Normalized replacement
const normalize = s => s.replace(/\r\n/g, '\n').trim();

const normalizedContent = content.replace(/\r\n/g, '\n');
const searchRowCells = normalize(oldRowCells);
const replaceRowCells = replaceCRLF(newRowCells);

if (normalizedContent.includes(searchRowCells)) {
  console.log('Found Row Cells! Replacing...');
  content = normalizedContent.replace(searchRowCells, replaceRowCells);
} else {
  // Let's try flexible whitespace matching
  const regexSearch = new RegExp(escapeRegExp(searchRowCells).replace(/\s+/g, '\\s+'));
  if (regexSearch.test(normalizedContent)) {
    console.log('Found Row Cells via regex! Replacing...');
    content = normalizedContent.replace(regexSearch, replaceRowCells);
  } else {
    console.error('Row Cells NOT found!');
  }
}

// ── 2. KOLOM TOTAL BAWAH POTONGAN GAJI ──
const oldTotalCells = `                              <td className="px-2 py-2.5 text-right border border-red-950">-</td>
                              <td className="px-2 py-2.5 text-right border border-red-950">-</td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_pinjaman_kilat, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">-</td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_pinjaman_barang, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">-</td>`;

const newTotalCells = `                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + (item.total_pinjaman_uang_interest ?? 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + (item.total_pinjaman_uang_transfer ?? 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_pinjaman_kilat, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + (item.total_pinjaman_kilat_interest ?? 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + item.total_pinjaman_barang, 0).toLocaleString('id-ID')}
                              </td>
                              <td className="px-2 py-2.5 text-right border border-red-950">
                                {filteredDeductions.reduce((s, item) => s + (item.total_pinjaman_barang_interest ?? 0), 0).toLocaleString('id-ID')}
                              </td>`;

const searchTotalCells = normalize(oldTotalCells);
const replaceTotalCells = replaceCRLF(newTotalCells);

if (content.includes(searchTotalCells)) {
  console.log('Found Total Cells! Replacing...');
  content = content.replace(searchTotalCells, replaceTotalCells);
} else {
  const regexSearch = new RegExp(escapeRegExp(searchTotalCells).replace(/\s+/g, '\\s+'));
  if (regexSearch.test(content)) {
    console.log('Found Total Cells via regex! Replacing...');
    content = content.replace(regexSearch, replaceTotalCells);
  } else {
    console.error('Total Cells NOT found!');
  }
}

// ── 3. TOTAL SEL AKHIR ──
const oldFinalTotal = `                                {filteredDeductions.reduce((s, item) => {
                                  const simpPokok = item.details.filter(d => d.reference === 'SP').reduce((sum, d) => sum + d.amount, 0)
                                  const simpWajib = item.details.filter(d => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum, d) => sum + d.amount, 0)
                                  const simpSukarela = item.total_simpanan_salary_cut
                                  const pUang = item.total_pinjaman_uang
                                  const pKhusus = item.total_pinjaman_kilat
                                  const pBarang = item.total_pinjaman_barang
                                  const kreditSbk = item.total_paylater
                                  return s + simpPokok + simpWajib + simpSukarela + pUang + pKhusus + pBarang + kreditSbk
                                }, 0).toLocaleString('id-ID')}`;

const newFinalTotal = `                                {filteredDeductions.reduce((s, item) => {
                                  const simpPokok = item.details.filter(d => d.reference === 'SP').reduce((sum, d) => sum + d.amount, 0)
                                  const simpWajib = item.details.filter(d => d.reference === 'SW' || (d.category === 'simpanan_wajib' && d.reference !== 'SP')).reduce((sum, d) => sum + d.amount, 0)
                                  const simpSukarela = item.total_simpanan_salary_cut
                                  const pUang = item.total_pinjaman_uang
                                  const admPU = item.total_pinjaman_uang_interest ?? 0
                                  const bTrsf = item.total_pinjaman_uang_transfer ?? 0
                                  const pKhusus = item.total_pinjaman_kilat
                                  const admPKhs = item.total_pinjaman_kilat_interest ?? 0
                                  const pBarang = item.total_pinjaman_barang
                                  const admPBrg = item.total_pinjaman_barang_interest ?? 0
                                  const kreditSbk = item.total_paylater
                                  return s + simpPokok + simpWajib + simpSukarela + pUang + admPU + bTrsf + pKhusus + admPKhs + pBarang + admPBrg + kreditSbk
                                }, 0).toLocaleString('id-ID')}`;

const searchFinalTotal = normalize(oldFinalTotal);
const replaceFinalTotal = replaceCRLF(newFinalTotal);

if (content.includes(searchFinalTotal)) {
  console.log('Found Final Total Cell! Replacing...');
  content = content.replace(searchFinalTotal, replaceFinalTotal);
} else {
  const regexSearch = new RegExp(escapeRegExp(searchFinalTotal).replace(/\s+/g, '\\s+'));
  if (regexSearch.test(content)) {
    console.log('Found Final Total via regex! Replacing...');
    content = content.replace(regexSearch, replaceFinalTotal);
  } else {
    console.error('Final Total NOT found!');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update completed successfully!');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceCRLF(val) {
  return val.replace(/\r\n/g, '\n');
}
