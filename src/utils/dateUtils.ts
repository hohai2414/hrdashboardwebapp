/**
 * Normalizes dynamic date representations from Excel or sheet titles into standard YYYY-MM-DD
 */
export function parseDateString(dateStr: string | number | undefined | null): string {
  if (dateStr === undefined || dateStr === null) return '';
  
  // If Excel serial number (days since 1900-01-01)
  if (typeof dateStr === 'number') {
    return excelSerialToDateString(dateStr);
  }
  
  const cleanStr = String(dateStr).trim();
  if (!cleanStr) return '';
  
  // Check if serial number stored as string
  if (/^\d+(\.\d+)?$/.test(cleanStr)) {
    return excelSerialToDateString(parseFloat(cleanStr));
  }
  
  // Try DD.MM.YYYY
  const dotParts = cleanStr.split('.');
  if (dotParts.length === 3) {
    const day = dotParts[0].padStart(2, '0');
    const month = dotParts[1].padStart(2, '0');
    const year = dotParts[2];
    if (year.length === 4 && parseInt(day) <= 31 && parseInt(month) <= 12) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try DD/MM/YYYY
  const slashParts = cleanStr.split('/');
  if (slashParts.length === 3) {
    const day = slashParts[0].padStart(2, '0');
    const month = slashParts[1].padStart(2, '0');
    const year = slashParts[2];
    if (year.length === 4 && parseInt(day) <= 31 && parseInt(month) <= 12) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try YYYY-MM-DD
  const dashParts = cleanStr.split('-');
  if (dashParts.length === 3) {
    if (dashParts[0].length === 4) {
      return `${dashParts[0]}-${dashParts[1].padStart(2, '0')}-${dashParts[2].padStart(2, '0')}`;
    }
  }

  // Standard JS parser fallback
  try {
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore error and return raw
  }

  return cleanStr;
}

/**
 * Converts Excel Serial Number to standard YYYY-MM-DD string
 */
export function excelSerialToDateString(serial: number): string {
  // Excel leap year bug exists, Excel thinks 1900 was a leap year
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400 * 1000;
  const date_info = new Date(utc_value);
  
  // Compensate for timezone offset
  const tzOffset = date_info.getTimezoneOffset() * 60 * 1000;
  const adjustedDate = new Date(utc_value + tzOffset);
  
  const year = adjustedDate.getFullYear();
  const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getDate()).padStart(2, '0');
  
  if (isNaN(year)) return '';
  return `${year}-${month}-${day}`;
}

/**
 * Format YYYY-MM-DD into DD/MM/YYYY for display
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr || dateStr.length !== 10) return dateStr || 'N/A';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Normalize sheet name e.g. "15.02.2026" or "31.03.2026"
 */
export function parseSheetSnapshotDate(sheetName: string): string | null {
  const cleanName = sheetName.trim();
  const match = cleanName.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try YYYY-MM-DD patterns
  const matchYmd = cleanName.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (matchYmd) {
    const year = matchYmd[1];
    const month = matchYmd[2].padStart(2, '0');
    const day = matchYmd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Last resort parse directly
  const dateStr = parseDateString(cleanName);
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  return null;
}

/**
 * Get difference in days between two date strings (YYYY-MM-DD)
 */
export function getDaysDiff(dateA: string, dateB: string): number {
  const dA = new Date(dateA);
  const dB = new Date(dateB);
  if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return 0;
  const diffTime = dA.getTime() - dB.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Categorize if a snapshot date is mid-month or month-end
 * Usually mid-month is around day 15, month end is 28-31
 */
export function getPeriodType(dateStr: string): 'Mid-month' | 'Month-end' | 'Other' {
  if (!dateStr) return 'Other';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 'Other';
  const day = parseInt(parts[2], 10);
  if (day === 15) return 'Mid-month';
  if (day >= 28 && day <= 31) return 'Month-end';
  return 'Other';
}

/**
 * Get Month name / Label, e.g. "02/2026"
 */
export function getMonthLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  const parts = dateStr.split('-');
  return `${parts[1]}/${parts[0]}`; // MM/YYYY
}
