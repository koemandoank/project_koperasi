import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import { KOPERASI_LOGO_BASE64 } from "./report-logo"

export const KOPERASI_NAME = "KOEMAN-PROJECT"
export const KOPERASI_TAGLINE = "Project Koperasi Sulfindo Goes To Digital"
export const KOPERASI_ADDRESS = "Jl. Raya Serang Km. 80, Cilegon, Banten"

export function generatePdfHeader(doc: jsPDF, title: string, period?: string) {
  // Add Logo
  doc.addImage(KOPERASI_LOGO_BASE64, "JPEG", 14, 15, 20, 20)

  // Add Company Info
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(KOPERASI_NAME, 38, 21)
  
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(KOPERASI_TAGLINE, 38, 26)
  doc.text(KOPERASI_ADDRESS, 38, 31)

  // Add Line separator
  doc.setLineWidth(0.5)
  doc.line(14, 38, 196, 38)

  // Add Report Title
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(title, 105, 47, { align: "center" })

  if (period) {
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text(`Periode: ${period}`, 105, 53, { align: "center" })
    return 60 // return startY for table
  }
  
  return 55
}

export function generateExcelHeader(worksheet: ExcelJS.Worksheet, title: string, period?: string, totalCols: number = 5) {
  const lastColLetter = String.fromCharCode(64 + totalCols) // Assuming totalCols <= 26

  // Strip data URI prefix — ExcelJS addImage needs raw base64 only
  const rawBase64 = KOPERASI_LOGO_BASE64.replace(/^data:image\/\w+;base64,/, "")

  // Try adding image if possible in ExcelJS
  const imageId = worksheet.workbook.addImage({
    base64: rawBase64,
    extension: 'jpeg',
  });

  // We place image over A1:B3
  worksheet.addImage(imageId, {
    tl: { col: 0, row: 0 },
    ext: { width: 60, height: 60 }
  });

  // Adjust row heights to accommodate image
  worksheet.getRow(1).height = 15
  worksheet.getRow(2).height = 15
  worksheet.getRow(3).height = 15
  worksheet.getRow(4).height = 5 // spacing

  // Title: KOPERASI NAME
  worksheet.mergeCells(`C1:${lastColLetter}1`)
  worksheet.getCell('C1').value = KOPERASI_NAME
  worksheet.getCell('C1').font = { size: 16, bold: true }
  worksheet.getCell('C1').alignment = { vertical: 'middle' }

  // Title: Tagline
  worksheet.mergeCells(`C2:${lastColLetter}2`)
  worksheet.getCell('C2').value = KOPERASI_TAGLINE
  worksheet.getCell('C2').font = { size: 11 }
  worksheet.getCell('C2').alignment = { vertical: 'middle' }

  // Title: Address
  worksheet.mergeCells(`C3:${lastColLetter}3`)
  worksheet.getCell('C3').value = KOPERASI_ADDRESS
  worksheet.getCell('C3').font = { size: 10, italic: true }
  worksheet.getCell('C3').alignment = { vertical: 'top' }

  // Report Title
  worksheet.mergeCells(`A5:${lastColLetter}5`)
  worksheet.getCell('A5').value = title
  worksheet.getCell('A5').font = { size: 14, bold: true }
  worksheet.getCell('A5').alignment = { horizontal: 'center' }

  let startRow = 6;

  if (period) {
    worksheet.mergeCells(`A6:${lastColLetter}6`)
    worksheet.getCell('A6').value = `Periode: ${period}`
    worksheet.getCell('A6').font = { size: 11, italic: true }
    worksheet.getCell('A6').alignment = { horizontal: 'center' }
    startRow = 7;
  }

  // Spacing before table
  startRow++;
  
  return startRow;
}
