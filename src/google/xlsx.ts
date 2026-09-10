import ExcelJS from "exceljs";

/** Local workbook bytes only. No remote spreadsheet client and no network. */
export async function writeLocalXlsx(
  sheets: { name: string; headers: readonly string[]; rows: readonly (readonly string[])[] }[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.addRow([...sheet.headers]);
    for (const row of sheet.rows) {
      ws.addRow([...row]);
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
