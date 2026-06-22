import { SnapshotData, EmployeeRecord } from '../types/hr';
import { isClinicalGroup } from './metrics';

export interface QualityIssue {
  issueType: string;
  severity: 'Critical' | 'Warning' | 'Info';
  snapshotDate: string;
  employeeId: string;
  employeeName: string;
  field: string;
  currentValue: string;
  recommendedFix: string;
}

export interface DataQualityReport {
  qualityScore: number;
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  missingFieldRate: number;
  duplicateCount: number;
  invalidDateCount: number;
  issuesList: QualityIssue[];
}

/**
 * Validates date string format YYYY-MM-DD
 */
export function isValidDateStr(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
}

/**
 * Computes a detailed Data Quality Report across all snapshots
 */
export function analyzeDataQuality(snapshots: SnapshotData[]): DataQualityReport {
  const issuesList: QualityIssue[] = [];
  let totalCheckedFields = 0;
  let totalMissingFields = 0;
  let duplicateCount = 0;
  let invalidDateCount = 0;

  // Track name consistency across snapshots: employeeId -> Set of names
  const nameRegistry = new Map<string, Set<string>>();

  snapshots.forEach((snap) => {
    const snapDate = snap.snapshotDate;
    const employees = snap.employees;
    
    // Check for unrecognized sheet name
    if (snapDate === '9999-12-31') {
      issuesList.push({
        issueType: 'Unrecognized Snapshot Name',
        severity: 'Warning',
        snapshotDate: snap.sheetName,
        employeeId: 'N/A',
        employeeName: 'N/A',
        field: 'Sheet Name',
        currentValue: snap.sheetName,
        recommendedFix: 'Thay đổi tên sheet theo định dạng ngày DD.MM.YYYY.',
      });
    }

    const seenIds = new Set<string>();
    const duplicateIds = new Set<string>();

    employees.forEach((emp) => {
      const id = emp.employeeId.trim();
      const name = emp.fullName.trim();

      // 1. Missing Employee ID
      if (!id) {
        totalMissingFields++;
        issuesList.push({
          issueType: 'Missing Employee ID',
          severity: 'Critical',
          snapshotDate: snapDate,
          employeeId: 'MISSING',
          employeeName: name || 'Không rõ',
          field: 'employeeId',
          currentValue: '',
          recommendedFix: 'Bổ sung Mã nhân viên vào hệ thống.',
        });
      } else {
        // 2. Duplicate Employee ID in same snapshot
        if (seenIds.has(id)) {
          duplicateCount++;
          duplicateIds.add(id);
        } else {
          seenIds.add(id);
        }

        // Register name for consistency checks
        if (name) {
          if (!nameRegistry.has(id)) {
            nameRegistry.set(id, new Set());
          }
          nameRegistry.get(id)!.add(name);
        }
      }

      // Check key fields
      const checkCompleteness = (field: keyof EmployeeRecord, label: string) => {
        totalCheckedFields++;
        const val = emp[field];
        if (val === undefined || val === null || String(val).trim() === '') {
          totalMissingFields++;
          issuesList.push({
            issueType: `Missing ${label}`,
            severity: 'Warning',
            snapshotDate: snapDate,
            employeeId: id || 'MISSING',
            employeeName: name || 'Không rõ',
            field: String(field),
            currentValue: '',
            recommendedFix: `Bổ sung thông tin ${label} cho nhân sự.`,
          });
        }
      };

      checkCompleteness('fullName', 'Họ tên');
      checkCompleteness('department', 'Khoa/ phòng cụ thể');
      checkCompleteness('jobTitle', 'Chức danh');
      checkCompleteness('professionalGroup', 'Nhóm Chức danh nghề nghiệp');

      // Date checks
      const checkDateValidity = (field: keyof EmployeeRecord, label: string, isRequired: boolean) => {
        const val = String(emp[field]).trim();
        if (!val) {
          if (isRequired) {
            totalMissingFields++;
          }
          return;
        }

        if (!isValidDateStr(val)) {
          invalidDateCount++;
          issuesList.push({
            issueType: `Invalid Date Format`,
            severity: 'Warning',
            snapshotDate: snapDate,
            employeeId: id || 'MISSING',
            employeeName: name || 'Không rõ',
            field: String(field),
            currentValue: val,
            recommendedFix: `Chuyển đổi trường ${label} sang định dạng ngày chuẩn DD.MM.YYYY hoặc YYYY-MM-DD.`,
          });
        }
      };

      checkDateValidity('dateOfBirth', 'Ngày sinh', true);
      checkDateValidity('startDate', 'Ngày vào làm', false);

      // 3. Missing license for clinical staff
      if (isClinicalGroup(emp.professionalGroup)) {
        totalCheckedFields++;
        if (!emp.licenseNumber || emp.licenseNumber.trim() === '') {
          totalMissingFields++;
          issuesList.push({
            issueType: 'Missing License Number',
            severity: 'Warning',
            snapshotDate: snapDate,
            employeeId: id || 'MISSING',
            employeeName: name || 'Không rõ',
            field: 'licenseNumber',
            currentValue: '',
            recommendedFix: 'Bổ sung số chứng chỉ hành nghề bắt buộc đối với nhân sự lâm sàng.',
          });
        }
      }
    });

    // Add duplicate issues
    duplicateIds.forEach((dupId) => {
      issuesList.push({
        issueType: 'Duplicate Employee ID',
        severity: 'Critical',
        snapshotDate: snapDate,
        employeeId: dupId,
        employeeName: employees.find((e) => e.employeeId === dupId)?.fullName || 'Không rõ',
        field: 'employeeId',
        currentValue: dupId,
        recommendedFix: 'Mã nhân viên trùng lặp trong cùng một thời điểm. Kiểm tra dữ liệu bị lặp dòng.',
      });
    });
  });

  // 4. Inconsistent names across snapshots
  nameRegistry.forEach((names, id) => {
    if (names.size > 1) {
      issuesList.push({
        issueType: 'Inconsistent Employee Name',
        severity: 'Warning',
        snapshotDate: 'Tất cả',
        employeeId: id,
        employeeName: Array.from(names).join(' | '),
        field: 'fullName',
        currentValue: Array.from(names).join(', '),
        recommendedFix: 'Họ tên nhân viên bị đổi tên hoặc gõ sai giữa các snapshot. Đồng bộ tên chính xác.',
      });
    }
  });

  // Calculate scores
  const totalIssues = issuesList.length;
  const criticalIssues = issuesList.filter((i) => i.severity === 'Critical').length;
  const warningIssues = issuesList.filter((i) => i.severity === 'Warning').length;

  const missingFieldRate = totalCheckedFields > 0 ? (totalMissingFields / totalCheckedFields) * 100 : 0;
  
  // Quality Score Calculation
  // Deduct points based on critical and warning issues
  let baseScore = 100;
  baseScore -= criticalIssues * 5;  // -5% for each duplicate or missing ID
  baseScore -= warningIssues * 1;   // -1% for each missing field or invalid date
  baseScore -= duplicateCount * 2;
  baseScore -= invalidDateCount * 1.5;

  const qualityScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  return {
    qualityScore,
    totalIssues,
    criticalIssues,
    warningIssues,
    missingFieldRate,
    duplicateCount,
    invalidDateCount,
    issuesList,
  };
}
