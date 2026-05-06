import ExcelJS from 'exceljs';

function downloadBufferAsFile(buffer: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportJsonToExcel(rows: Array<Record<string, any>>, sheetName: string, filename: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (rows.length === 0) {
    worksheet.addRow(['ไม่มีข้อมูล']);
  } else {
    const headers = Object.keys(rows[0]);
    worksheet.columns = headers.map((header) => ({ header, key: header, width: 20 }));
    rows.forEach((row) => worksheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBufferAsFile(
    buffer as ArrayBuffer,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export async function exportAoaToExcel(
  sheets: Array<{ name: string; rows: any[][] }>,
  filename: string
) {
  const workbook = new ExcelJS.Workbook();

  sheets.forEach((sheet) => {
    const ws = workbook.addWorksheet(sheet.name);
    sheet.rows.forEach((row) => ws.addRow(row));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBufferAsFile(
    buffer as ArrayBuffer,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export async function importFirstSheetToJson(file: File): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const firstRow = worksheet.getRow(1);
  const headers = (firstRow.values as any[])
    .slice(1)
    .map((h) => (h == null ? '' : String(h).trim()));

  if (headers.length === 0 || headers.every((h) => h === '')) return [];

  const result: Record<string, any>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as any[]).slice(1);

    const obj: Record<string, any> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = values[index];
      if (value !== null && value !== undefined && value !== '') hasValue = true;
      obj[header] = value;
    });

    if (hasValue) result.push(obj);
  });

  return result;
}
