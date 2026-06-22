import { EmployeeRecord } from '../types/hr';
import { parseDateString } from './dateUtils';

// Helper to remove Vietnamese tones/accents for robust header matching
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// Maps standard key to list of lowercase aliases (without accents)
const COLUMN_ALIASES: Record<keyof Omit<EmployeeRecord, 'raw' | 'snapshotDate'>, string[]> = {
  employeeId: [
    'ma nhan vien',
    'manv',
    'employee id',
    'employeeid',
    'id',
    'ma so',
    'ma',
    'mst',
    'id nhan vien',
  ],
  fullName: [
    'ho ten',
    'ho va ten',
    'ten nhan vien',
    'ten',
    'name',
    'full name',
    'fullname',
    'nhan vien',
  ],
  gender: ['gioi tinh', 'gender', 'phai', 'sex'],
  dateOfBirth: [
    'ngay sinh',
    'nam sinh',
    'birth date',
    'dob',
    'date of birth',
    'ngaysinh',
  ],
  department: [
    'khoa/phong',
    'khoa phong',
    'khoaphong',
    'khoa',
    'phong',
    'department',
    'dept',
    'don vi',
    'phong ban',
  ],
  division: [
    'bo phan',
    'to',
    'phan khoa',
    'division',
    'section',
    'group',
    'phong to',
  ],
  jobTitle: [
    'chuc danh',
    'chuc vu',
    'job title',
    'jobtitle',
    'position',
    'vi tri',
    'vi tri cong viec',
  ],
  professionalGroup: [
    'nhom chuc danh',
    'nhom nghe nghiep',
    'professional group',
    'nhom nhan su',
    'nhom',
    'phan loai nhom',
  ],
  qualification: [
    'trinh do chuyen mon',
    'trinh do',
    'qualification',
    'trinh do hoc van',
  ],
  degree: ['bang cap', 'bang', 'hoc vi', 'degree'],
  major: ['chuyen nganh', 'nganh', 'specialization', 'major'],
  licenseNumber: [
    'chung chi hanh nghe',
    'chung chi',
    'so cchn',
    'cchn',
    'license number',
    'licenseno',
    'so chung chi',
    'so cchn/gphn',
  ],
  licenseIssueDate: [
    'ngay cap chung chi hanh nghe',
    'ngay cap cchn',
    'license issue date',
    'ngay cap',
    'ngaycapcchn',
  ],
  licenseExpiryDate: [
    'ngay het han chung chi hanh nghe',
    'ngay het han cchn',
    'ngay het han',
    'license expiry date',
    'expiry date',
    'ngayhethancchn',
    'ngayhethan',
  ],
  startDate: [
    'ngay vao lam',
    'ngay vao',
    'ngay thu viec',
    'ngay tuyen dung',
    'start date',
    'join date',
    'ngay tuyen',
  ],
  employmentStatus: [
    'tinh trang lam viec',
    'trang thai',
    'tinh trang',
    'employment status',
    'status',
    'tinh trang lam viec hien tai',
  ],
  contractType: [
    'loai hop dong',
    'hop dong',
    'contract type',
    'contracttype',
    'loai hd',
  ],
};

/**
 * Automap row from spreadsheet based on headers
 */
export function mapRowToEmployee(
  rawRow: Record<string, any>,
  headerMap: Record<string, string>,
  snapshotDate: string
): EmployeeRecord {
  const result: Partial<EmployeeRecord> = {
    snapshotDate,
    raw: rawRow,
  };

  // Pre-fill all fields as empty strings (Data not available)
  const fields = Object.keys(COLUMN_ALIASES) as Array<keyof typeof COLUMN_ALIASES>;
  fields.forEach((field) => {
    result[field] = '';
  });

  // Assign mapped fields
  Object.entries(rawRow).forEach(([key, val]) => {
    const standardizedKey = headerMap[key];
    if (standardizedKey) {
      const field = standardizedKey as keyof typeof COLUMN_ALIASES;
      
      let cleanVal = '';
      // Clean dates
      if (
        [
          'dateOfBirth',
          'licenseIssueDate',
          'licenseExpiryDate',
          'startDate',
        ].includes(field)
      ) {
        cleanVal = parseDateString(val);
      } else {
        cleanVal = val !== undefined && val !== null ? String(val).trim() : '';
      }

      // Safe mapping: never overwrite a valid value with an empty string
      if (cleanVal !== '') {
        const existing = result[field];
        if (existing && existing !== '') {
          // If we already have a value, handle clashing columns by merging or prioritizing
          if (field === 'department') {
            if (existing !== cleanVal && !existing.includes(cleanVal)) {
              result[field] = `${existing} / ${cleanVal}`;
            }
          } else if (field === 'division') {
            if (existing !== cleanVal && !existing.includes(cleanVal)) {
              result[field] = `${existing} / ${cleanVal}`;
            }
          } else if (field === 'professionalGroup') {
            if (existing !== cleanVal && !existing.includes(cleanVal)) {
              result[field] = `${existing} / ${cleanVal}`;
            }
          } else {
            // Keep the first non-empty value encountered
          }
        } else {
          result[field] = cleanVal;
        }
      }
    }
  });

  // Simple cleanups
  if (result.gender) {
    const cleanGender = result.gender.toLowerCase();
    if (cleanGender.startsWith('n') && cleanGender !== 'nam') {
      result.gender = 'Nữ';
    } else if (cleanGender.startsWith('n') && cleanGender === 'nam') {
      result.gender = 'Nam';
    } else if (cleanGender.startsWith('f') || cleanGender.includes('nu')) {
      result.gender = 'Nữ';
    } else if (cleanGender.startsWith('m')) {
      result.gender = 'Nam';
    }
  }

  // Derive professional group if empty based on job title
  if (!result.professionalGroup && result.jobTitle) {
    result.professionalGroup = guessProfessionalGroup(result.jobTitle);
  }

  return result as EmployeeRecord;
}

/**
 * Build a map of Excel headers to normalized EmployeeRecord keys
 */
export function buildHeaderMap(headers: string[]): Record<string, string> {
  const headerMap: Record<string, string> = {};
  
  headers.forEach((header) => {
    const normalized = removeVietnameseTones(header);
    
    // Find matching field
    let matchedField: string | null = null;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      // Direct exact match
      if (aliases.includes(normalized)) {
        matchedField = field;
        break;
      }
    }

    // Fallback: substring matching if no exact alias matches
    if (!matchedField) {
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        const hasSubstring = aliases.some(
          (alias) => normalized.includes(alias) || alias.includes(normalized)
        );
        if (hasSubstring && normalized.length > 2) {
          matchedField = field;
          break;
        }
      }
    }

    if (matchedField) {
      headerMap[header] = matchedField;
    }
  });

  return headerMap;
}

/**
 * Guess professional group based on job title
 */
export function guessProfessionalGroup(jobTitle: string): string {
  const title = removeVietnameseTones(jobTitle);
  if (title.includes('bac si') || title.includes('bs')) return 'Bác sĩ';
  if (title.includes('dieu duong') || title.includes('dd') || title.includes('y ta')) return 'Điều dưỡng';
  if (title.includes('ky thuat vien') || title.includes('ktv')) return 'Kỹ thuật viên';
  if (title.includes('duoc si') || title.includes('ds') || title.includes('duoc')) return 'Dược sĩ';
  if (title.includes('ho sinh') || title.includes('nu ho sinh') || title.includes('hs')) return 'Hộ sinh';
  if (
    title.includes('truong phong') ||
    title.includes('pho phong') ||
    title.includes('chuyen vien') ||
    title.includes('ke toan') ||
    title.includes('hanh chinh') ||
    title.includes('thu ky') ||
    title.includes('cong nghe thong tin') ||
    title.includes('it')
  ) {
    return 'Hành chính / Support';
  }
  return 'Khác';
}
