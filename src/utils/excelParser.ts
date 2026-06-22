import * as XLSX from 'xlsx';
import { SnapshotData, EmployeeRecord } from '../types/hr';
import { parseSheetSnapshotDate } from './dateUtils';
import { buildHeaderMap, mapRowToEmployee } from './columnMapper';

/**
 * Parses an Excel file (ArrayBuffer) into a sorted array of SnapshotData.
 */
export function parseExcelWorkbook(arrayBuffer: ArrayBuffer): SnapshotData[] {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  
  const snapshots: SnapshotData[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    
    // Parse sheet to JSON array
    // raw: false, defval: '' to ensure empty cells return empty string
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      raw: true,
    });
    
    if (rawRows.length === 0) return;

    // Detect sheet date
    const snapshotDate = parseSheetSnapshotDate(sheetName);
    const resolvedDate = snapshotDate || '9999-12-31'; // Fallback for invalid sheets

    // Extract headers (keys of first non-empty object or from sheet range)
    // To be perfectly robust, let's grab the actual headers from the sheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const headers: string[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      if (cell && cell.v) {
        headers.push(String(cell.v).trim());
      }
    }

    // Fallback headers if range parsing failed
    const finalHeaders = headers.length > 0 ? headers : Object.keys(rawRows[0] || {});
    
    // Build mapper map
    const headerMap = buildHeaderMap(finalHeaders);

    // Map each raw row to an EmployeeRecord
    const employees: EmployeeRecord[] = rawRows
      .map((row) => mapRowToEmployee(row, headerMap, resolvedDate))
      // Filter out purely empty rows
      .filter((emp) => emp.fullName.trim() !== '' || emp.employeeId.trim() !== '');

    snapshots.push({
      snapshotDate: resolvedDate,
      sheetName,
      employees,
    });
  });

  // Sort snapshots chronologically
  return snapshots.sort((a, b) => {
    if (a.snapshotDate === '9999-12-31') return 1;
    if (b.snapshotDate === '9999-12-31') return -1;
    return a.snapshotDate.localeCompare(b.snapshotDate);
  });
}
