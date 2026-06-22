import * as XLSX from 'xlsx';
import { SnapshotData, EmployeeRecord } from '../types/hr';
import { parseSheetSnapshotDate } from './dateUtils';
import { buildHeaderMap, mapRowToEmployee, COLUMN_ALIASES, removeVietnameseTones } from './columnMapper';

/**
 * Scans the first 15 rows of a worksheet to find the row that contains the most matched headers.
 * Returns the 0-indexed row number.
 */
function findHeaderRowIndex(worksheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  let bestRow = range.s.r;
  let maxMatches = 0;

  // Scan up to 15 rows
  const maxRowsToScan = Math.min(range.e.r, range.s.r + 15);
  
  for (let R = range.s.r; R <= maxRowsToScan; ++R) {
    let matches = 0;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (cell && cell.v !== undefined && cell.v !== null) {
        const cellVal = removeVietnameseTones(String(cell.v));
        // Check if this matches any alias in COLUMN_ALIASES
        const isAlias = Object.values(COLUMN_ALIASES).some((aliases) =>
          aliases.includes(cellVal)
        );
        if (isAlias) {
          matches++;
        }
      }
    }
    
    if (matches > maxMatches) {
      maxMatches = matches;
      bestRow = R;
    }
  }

  // We only trust the detected header row if it has at least 2 matches
  return maxMatches >= 2 ? bestRow : range.s.r;
}

/**
 * Parses an Excel file (ArrayBuffer) into a sorted array of SnapshotData.
 */
export function parseExcelWorkbook(arrayBuffer: ArrayBuffer): SnapshotData[] {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  
  const snapshots: SnapshotData[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    
    // Auto-detect header row and adjust worksheet range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const headerRowIdx = findHeaderRowIndex(worksheet);
    if (headerRowIdx > range.s.r) {
      range.s.r = headerRowIdx;
      worksheet['!ref'] = XLSX.utils.encode_range(range);
    }

    // Parse sheet to JSON array
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      raw: true,
    });
    
    if (rawRows.length === 0) return;

    // Detect sheet date
    const snapshotDate = parseSheetSnapshotDate(sheetName);
    const resolvedDate = snapshotDate || '9999-12-31'; // Fallback for invalid sheets

    // Extract headers from the newly adjusted range
    const adjustedRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const headers: string[] = [];
    for (let C = adjustedRange.s.c; C <= adjustedRange.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: adjustedRange.s.r, c: C })];
      if (cell && cell.v !== undefined && cell.v !== null) {
        headers.push(String(cell.v).trim());
      }
    }

    // Fallback headers if range parsing failed
    const rawKeys = rawRows.length > 0 ? Object.keys(rawRows[0] || {}) : [];
    const combinedHeaders = Array.from(new Set([...headers, ...rawKeys]));
    
    // Build mapper map
    const headerMap = buildHeaderMap(combinedHeaders);

    // Map each raw row to an EmployeeRecord
    const employees: EmployeeRecord[] = rawRows
      .map((row) => mapRowToEmployee(row, headerMap, resolvedDate))
      // Filter out purely empty rows
      .filter((emp) => emp.fullName.trim() !== '' || emp.employeeId.trim() !== '');

    snapshots.push({
      snapshotDate: resolvedDate,
      sheetName,
      employees,
      headerMap,
    });
  });

  // Sort snapshots chronologically
  return snapshots.sort((a, b) => {
    if (a.snapshotDate === '9999-12-31') return 1;
    if (b.snapshotDate === '9999-12-31') return -1;
    return a.snapshotDate.localeCompare(b.snapshotDate);
  });
}
