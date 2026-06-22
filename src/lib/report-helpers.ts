import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import { KOPERASI_LOGO_BASE64 } from "./report-logo"

export const KOPERASI_NAME = "KOEMAN-PROJECT"
export const KOPERASI_TAGLINE = "Project Koperasi Sulfindo Goes To Digital"
export const KOPERASI_ADDRESS = "Jl. Raya Serang Km. 80, Cilegon, Banten"

/**
 * Menggambar header Kop Surat resmi koperasi secara dinamis pada lembar kerja PDF.
 * 
 * @param {jsPDF} doc - Dokumen jsPDF yang sedang dimodifikasi
 * @param {string} title - Judul laporan yang dicetak
 * @param {string} [period] - Periode laporan opsional
 * @param {any} [templateConfig] - Konfigurasi dinamis Kop & TTD laporan dari database
 * @returns {number} Posisi sumbu Y awal untuk meletakkan tabel setelah header
 */
export function generatePdfHeader(doc: jsPDF, title: string, period?: string, templateConfig?: any): number {
  const name = templateConfig?.company_name || KOPERASI_NAME
  const tagline = templateConfig?.company_tagline || KOPERASI_TAGLINE
  const address = templateConfig?.company_address || KOPERASI_ADDRESS
  const logo = templateConfig?.logo_base64 || KOPERASI_LOGO_BASE64

  // Dapatkan tipe ekstensi gambar secara dinamis untuk melestarikan transparansi PNG
  const mimeMatch = logo.match(/^data:image\/(\w+);base64,/)
  const imgFormat = (mimeMatch ? mimeMatch[1] : "jpeg").toUpperCase() === "PNG" ? "PNG" : "JPEG"

  // Menggambar Logo Koperasi
  doc.addImage(logo, imgFormat, 14, 15, 20, 20)

  // Informasi Resmi Koperasi
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(name, 38, 21)
  
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(tagline, 38, 26)
  doc.text(address, 38, 31)

  // Garis Pembatas Kop Surat
  doc.setLineWidth(0.5)
  doc.line(14, 38, 196, 38)

  // Judul Laporan Utama
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(title, 105, 47, { align: "center" })

  if (period) {
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text(`Periode: ${period}`, 105, 53, { align: "center" })
    return 60
  }
  
  return 55
}

/**
 * Menggambar footer tanda tangan ganda dan tanggal dinamis untuk dokumen PDF (jsPDF).
 * 
 * @param {jsPDF} doc - Dokumen jsPDF yang sedang dimodifikasi
 * @param {number} startY - Posisi sumbu Y awal untuk menggambar footer
 * @param {any} [templateConfig] - Konfigurasi template Kop & TTD laporan
 * @returns {number} Posisi Y akhir setelah footer digambar
 */
export function generatePdfFooter(doc: jsPDF, startY: number, templateConfig?: any): number {
  const pageHeight = doc.internal.pageSize.height
  const footerHeight = 45
  
  let currentY = startY
  if (currentY + footerHeight > pageHeight - 15) {
    doc.addPage()
    currentY = 20
  } else {
    currentY += 10
  }

  const loc = templateConfig?.footer_location || "Serang"
  let dateStr = ""
  
  if (templateConfig?.footer_date_type === "custom") {
    dateStr = templateConfig?.footer_custom_date || ""
  } else {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    dateStr = new Date().toLocaleDateString('id-ID', options)
  }

  const fullDate = dateStr ? `${loc}, ${dateStr}` : loc

  // Tanggal pengesahan di sisi kanan
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(fullDate, 145, currentY)

  currentY += 8

  // Jabatan TTD Kiri & Kanan
  const leftTitle = templateConfig?.footer_left_title || "Bendahara"
  const rightTitle = templateConfig?.footer_right_title || "Ketua Koperasi"
  
  doc.text(leftTitle, 35, currentY, { align: "center" })
  doc.text(rightTitle, 160, currentY, { align: "center" })

  currentY += 22

  // Nama Pejabat TTD Kiri & Kanan
  const leftName = templateConfig?.footer_left_name || "......................"
  const rightName = templateConfig?.footer_right_name || "......................"

  doc.setFont("helvetica", "bold")
  doc.text(leftName, 35, currentY, { align: "center" })
  doc.text(rightName, 160, currentY, { align: "center" })

  return currentY
}

/**
 * Membuat header Kop Surat resmi koperasi secara dinamis pada lembar kerja Excel (ExcelJS).
 * 
 * @param {ExcelJS.Worksheet} worksheet - Lembar kerja ExcelJS
 * @param {string} title - Judul laporan yang dicetak
 * @param {string} [period] - Periode laporan opsional
 * @param {number} [totalCols=5] - Total kolom pada lembar kerja
 * @param {any} [templateConfig] - Konfigurasi dinamis Kop & TTD laporan dari database
 * @returns {number} Baris awal penulisan tabel setelah header selesai digambar
 */
export function generateExcelHeader(
  worksheet: ExcelJS.Worksheet,
  title: string,
  period?: string,
  totalCols: number = 5,
  templateConfig?: any
): number {
  const name = templateConfig?.company_name || KOPERASI_NAME
  const tagline = templateConfig?.company_tagline || KOPERASI_TAGLINE
  const address = templateConfig?.company_address || KOPERASI_ADDRESS
  const logo = templateConfig?.logo_base64 || KOPERASI_LOGO_BASE64

  const lastColLetter = String.fromCharCode(64 + Math.min(26, Math.max(3, totalCols)))

  // Menentukan tinggi baris Kop Surat agar logo dan teks proporsional
  worksheet.getRow(1).height = 18
  worksheet.getRow(2).height = 18
  worksheet.getRow(3).height = 18
  worksheet.getRow(4).height = 6

  // Dapatkan tipe ekstensi gambar secara dinamis (png atau jpeg) untuk melestarikan transparansi
  const mimeMatch = logo.match(/^data:image\/(\w+);base64,/)
  const imgExtension = (mimeMatch ? mimeMatch[1] : "jpeg") === "png" ? "png" : "jpeg"

  // Menghilangkan prefix URI untuk mematuhi format buffer ExcelJS
  const rawBase64 = logo.replace(/^data:image\/\w+;base64,/, "")

  try {
    const imageId = worksheet.workbook.addImage({
      base64: rawBase64,
      extension: imgExtension,
    });

    const colAWidthVal = worksheet.getColumn(1).width;
    const colAWidth = typeof colAWidthVal === 'number' ? colAWidthVal : 10;
    const colAWidthPx = colAWidth * 8; // Perkiraan piksel (1 char lebar default ~8px)

    let logoColOff = 10;
    if (colAWidth >= 12) {
      // Jika kolom A lebar (misalnya Neraca/PHU), posisikan logo merapat ke sisi kanan kolom A
      // agar berjarak rapi (10px) dari teks di kolom B yang dimulai di B1
      logoColOff = Math.max(10, colAWidthPx - 60);
    }

    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0, colOff: logoColOff, rowOff: 2 } as any,
      ext: { width: 50, height: 50 },
      editAs: 'oneCell'
    });
  } catch (e) {
    console.error("Gagal menambahkan logo ke Excel:", e)
  }

  // Render Nama Koperasi
  worksheet.mergeCells(`B1:${lastColLetter}1`)
  worksheet.getCell('B1').value = name
  worksheet.getCell('B1').font = { size: 15, bold: true, name: 'Arial' }
  worksheet.getCell('B1').alignment = { vertical: 'middle' }

  // Render Tagline Koperasi
  worksheet.mergeCells(`B2:${lastColLetter}2`)
  worksheet.getCell('B2').value = tagline
  worksheet.getCell('B2').font = { size: 10, name: 'Arial', color: { argb: 'FF555555' } }
  worksheet.getCell('B2').alignment = { vertical: 'middle' }

  // Render Alamat Koperasi
  worksheet.mergeCells(`B3:${lastColLetter}3`)
  worksheet.getCell('B3').value = address
  worksheet.getCell('B3').font = { size: 9, italic: true, name: 'Arial', color: { argb: 'FF777777' } }
  worksheet.getCell('B3').alignment = { vertical: 'top' }

  // Solid horizontal divider line on Row 3 bottom
  const colsCount = Math.min(26, Math.max(3, totalCols));
  for (let col = 1; col <= colsCount; col++) {
    const cell = worksheet.getRow(3).getCell(col);
    cell.border = {
      ...cell.border,
      bottom: { style: 'medium', color: { argb: 'FF000000' } }
    };
  }

  // Render Judul Laporan Utama
  worksheet.mergeCells(`A5:${lastColLetter}5`)
  worksheet.getCell('A5').value = title
  worksheet.getCell('A5').font = { size: 14, bold: true, name: 'Arial' }
  worksheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' }

  let startRow = 6;

  if (period) {
    worksheet.mergeCells(`A6:${lastColLetter}6`)
    worksheet.getCell('A6').value = `Periode: ${period}`
    worksheet.getCell('A6').font = { size: 11, italic: true, name: 'Arial' }
    worksheet.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' }
    startRow = 7;
  }

  startRow++;
  
  return startRow;
}

/**
 * Menulis footer tanda tangan ganda dan tanggal ke dalam Worksheet Excel (ExcelJS).
 * 
 * @param {ExcelJS.Worksheet} worksheet - Lembar kerja ExcelJS yang sedang dimodifikasi
 * @param {number} startRow - Baris awal penulisan footer
 * @param {number} [totalCols=5] - Total kolom pada lembar kerja untuk penempatan presisi
 * @param {any} [templateConfig] - Konfigurasi template Kop & TTD laporan
 * @returns {number} Baris akhir setelah footer ditulis
 */
export function generateExcelFooter(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  totalCols: number = 5,
  templateConfig?: any
): number {
  let currentRow = startRow + 2

  const loc = templateConfig?.footer_location || "Serang"
  let dateStr = ""
  
  if (templateConfig?.footer_date_type === "custom") {
    dateStr = templateConfig?.footer_custom_date || ""
  } else {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    dateStr = new Date().toLocaleDateString('id-ID', options)
  }

  const fullDate = dateStr ? `${loc}, ${dateStr}` : loc

  // Lokasi kolom tanda tangan kiri dan kanan (menyesuaikan total kolom)
  const leftCol = totalCols >= 4 ? "B" : "A"
  const rightCol = String.fromCharCode(64 + Math.max(3, totalCols - 1))

  // Menulis tanggal pengesahan
  worksheet.getCell(`${rightCol}${currentRow}`).value = fullDate
  worksheet.getCell(`${rightCol}${currentRow}`).font = { size: 11 }
  worksheet.getCell(`${rightCol}${currentRow}`).alignment = { horizontal: 'center' }

  currentRow++

  // Menulis jabatan penanda tangan
  const leftTitle = templateConfig?.footer_left_title || "Bendahara"
  const rightTitle = templateConfig?.footer_right_title || "Ketua Koperasi"

  worksheet.getCell(`${leftCol}${currentRow}`).value = leftTitle
  worksheet.getCell(`${leftCol}${currentRow}`).font = { size: 11 }
  worksheet.getCell(`${leftCol}${currentRow}`).alignment = { horizontal: 'center' }

  worksheet.getCell(`${rightCol}${currentRow}`).value = rightTitle
  worksheet.getCell(`${rightCol}${currentRow}`).font = { size: 11 }
  worksheet.getCell(`${rightCol}${currentRow}`).alignment = { horizontal: 'center' }

  currentRow += 4

  // Menulis nama penanda tangan dengan garis bawah
  const leftName = templateConfig?.footer_left_name || "......................"
  const rightName = templateConfig?.footer_right_name || "......................"

  worksheet.getCell(`${leftCol}${currentRow}`).value = leftName
  worksheet.getCell(`${leftCol}${currentRow}`).font = { size: 11, bold: true, underline: true }
  worksheet.getCell(`${leftCol}${currentRow}`).alignment = { horizontal: 'center' }

  worksheet.getCell(`${rightCol}${currentRow}`).value = rightName
  worksheet.getCell(`${rightCol}${currentRow}`).font = { size: 11, bold: true, underline: true }
  worksheet.getCell(`${rightCol}${currentRow}`).alignment = { horizontal: 'center' }

  return currentRow
}
