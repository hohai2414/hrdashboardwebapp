import { EmployeeRecord, ComplianceRule, ComplianceResult } from '../types/hr';
import { isClinicalGroup, getLicenseStatus } from './metrics';

/**
 * Evaluates compliance for each department and professional group based on configured rules
 */
export function evaluateCompliance(
  employees: EmployeeRecord[],
  rules: ComplianceRule | null,
  snapshotDate: string
): ComplianceResult[] {
  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
  const results: ComplianceResult[] = [];

  if (!rules || !rules.hospitalBedCount) {
    // If no configuration is provided, output a row for each department indicating configuration is needed.
    departments.forEach((dept) => {
      ['Bác sĩ', 'Điều dưỡng', 'Kỹ thuật viên', 'Dược sĩ', 'Hộ sinh'].forEach((group) => {
        results.push({
          department: dept,
          professionalGroup: group,
          actualHeadcount: countActual(employees, dept, group),
          requiredHeadcount: 0,
          gap: 0,
          complianceStatus: 'Need Configuration',
          evidence: 'Cấu hình định mức chưa được thiết lập.',
          recommendedAction: 'Vui lòng nhập số giường bệnh và định mức nhân sự tại trang cấu hình.',
        });
      });
    });
    return results;
  }

  departments.forEach((dept) => {
    // Get bed count for department (default to 0 if not configured)
    const beds = rules.departmentBeds[dept] || 0;

    // Check compliance for Bác sĩ (Doctor)
    const doctorsActual = countActual(employees, dept, 'Bác sĩ');
    // Doctor requirement = beds * requiredDoctorRatio (rounded up)
    const doctorsRequired = Math.ceil(beds * rules.requiredDoctorRatio);
    const doctorGap = doctorsActual - doctorsRequired;
    
    // Evaluate Doctor compliance
    const doctorCompliance = evaluateStaffCompliance(
      employees, 
      dept, 
      'Bác sĩ', 
      doctorsActual, 
      doctorsRequired, 
      doctorGap, 
      beds > 0, 
      snapshotDate
    );
    results.push(doctorCompliance);

    // Check compliance for Điều dưỡng (Nurse)
    const nursesActual = countActual(employees, dept, 'Điều dưỡng');
    const nursesRequired = Math.ceil(beds * rules.requiredNurseRatio);
    const nurseGap = nursesActual - nursesRequired;
    
    const nurseCompliance = evaluateStaffCompliance(
      employees, 
      dept, 
      'Điều dưỡng', 
      nursesActual, 
      nursesRequired, 
      nurseGap, 
      beds > 0, 
      snapshotDate
    );
    results.push(nurseCompliance);

    // Check compliance for Kỹ thuật viên (Technician)
    const techActual = countActual(employees, dept, 'Kỹ thuật viên');
    const techRequired = Math.ceil(beds * rules.requiredTechnicianRatio);
    const techGap = techActual - techRequired;
    
    const techCompliance = evaluateStaffCompliance(
      employees, 
      dept, 
      'Kỹ thuật viên', 
      techActual, 
      techRequired, 
      techGap, 
      beds > 0, 
      snapshotDate
    );
    results.push(techCompliance);

    // Check compliance for Dược sĩ (Pharmacist)
    const pharmActual = countActual(employees, dept, 'Dược sĩ');
    const pharmRequired = Math.ceil(beds * rules.requiredPharmacistRatio);
    const pharmGap = pharmActual - pharmRequired;
    
    const pharmCompliance = evaluateStaffCompliance(
      employees, 
      dept, 
      'Dược sĩ', 
      pharmActual, 
      pharmRequired, 
      pharmGap, 
      beds > 0, 
      snapshotDate
    );
    results.push(pharmCompliance);

    // Check compliance for Hộ sinh (Midwife) - only for Obstetric departments
    const isObstetric = dept.toLowerCase().includes('san') || dept.toLowerCase().includes('phu san');
    if (isObstetric) {
      const midwifeActual = countActual(employees, dept, 'Hộ sinh');
      const midwifeRequired = Math.ceil(beds * rules.requiredNurseRatio * 0.5); // Example standard
      const midwifeGap = midwifeActual - midwifeRequired;

      const midwifeCompliance = evaluateStaffCompliance(
        employees,
        dept,
        'Hộ sinh',
        midwifeActual,
        midwifeRequired,
        midwifeGap,
        beds > 0,
        snapshotDate
      );
      results.push(midwifeCompliance);
    }
  });

  return results;
}

/**
 * Counts actual employees in a department and professional group
 */
function countActual(employees: EmployeeRecord[], dept: string, group: string): number {
  return employees.filter(
    (e) => e.department === dept && e.professionalGroup.trim().toLowerCase().includes(group.toLowerCase().replace(/á|ạ|ả|ã|à|ă|ắ|ặ|ẳ|ẵ|ằ|â|ấ|ậ|ẩ|ẫ|ầ/g, 'a'))
  ).length;
}

/**
 * Evaluates compliance state based on headcount gap and credentials
 */
function evaluateStaffCompliance(
  employees: EmployeeRecord[],
  dept: string,
  group: string,
  actual: number,
  required: number,
  gap: number,
  hasBedConfig: boolean,
  snapshotDate: string
): ComplianceResult {
  const deptStaff = employees.filter(
    (e) => e.department === dept && e.professionalGroup.trim().toLowerCase().includes(group.toLowerCase().replace(/á/g, 'a'))
  );

  // 1. Check for license compliance (clinical group)
  let missingLicenseCount = 0;
  let expiredLicenseCount = 0;
  let expiringSoonCount = 0;
  let missingQualCount = 0;

  deptStaff.forEach((emp) => {
    if (!emp.qualification) missingQualCount++;
    
    const licStatus = getLicenseStatus(emp, snapshotDate);
    if (licStatus === 'Missing') {
      missingLicenseCount++;
    } else if (licStatus === 'Expired') {
      expiredLicenseCount++;
    } else if (licStatus === 'Expiring Soon') {
      expiringSoonCount++;
    }
  });

  // 2. Formulate status, evidence & action
  let status: ComplianceResult['complianceStatus'] = 'Meets';
  let evidence = '';
  let recommendedAction = 'Duy trì tình trạng nhân sự hiện tại.';

  if (!hasBedConfig) {
    status = 'Need Configuration';
    evidence = 'Chưa cấu hình số giường cho khoa này.';
    recommendedAction = 'Nhập số giường bệnh của khoa để tính toán định mức chuẩn.';
  } else if (gap < 0) {
    status = 'Not Met';
    evidence = `Thiếu ${Math.abs(gap)} nhân sự so với định mức (Thực tế: ${actual}, Yêu cầu: ${required}).`;
    recommendedAction = `Tuyển dụng thêm ít nhất ${Math.abs(gap)} ${group} cho khoa ${dept}.`;
  } else if (expiredLicenseCount > 0 || missingLicenseCount > 0) {
    status = 'Not Met';
    evidence = `Định mức đủ nhưng có ${expiredLicenseCount} CCHN hết hạn, ${missingLicenseCount} thiếu CCHN.`;
    recommendedAction = `Yêu cầu làm mới/cập nhật thông tin CCHN cho nhân sự vi phạm tại khoa ${dept}.`;
  } else if (expiringSoonCount > 0) {
    status = 'At Risk';
    evidence = `Có ${expiringSoonCount} nhân sự sắp hết hạn CCHN trong 90 ngày.`;
    recommendedAction = `Thông báo cho nhân viên tại khoa ${dept} chuẩn bị hồ sơ gia hạn CCHN.`;
  } else if (missingQualCount > 0) {
    status = 'At Risk';
    evidence = `Có ${missingQualCount} nhân sự thiếu dữ liệu trình độ chuyên môn.`;
    recommendedAction = `Bổ sung hồ sơ trình độ chuyên môn cho nhân sự khoa ${dept}.`;
  } else {
    evidence = `Đạt định mức nhân sự (Thực tế: ${actual}/${required}) và 100% CCHN hợp lệ.`;
  }

  return {
    department: dept,
    professionalGroup: group,
    actualHeadcount: actual,
    requiredHeadcount: required,
    gap,
    complianceStatus: status,
    evidence,
    recommendedAction,
  };
}
export function getHospitalComplianceScore(results: ComplianceResult[]): number {
  if (results.length === 0) return 0;
  const configured = results.filter(r => r.complianceStatus !== 'Need Configuration');
  if (configured.length === 0) return 0;
  const meets = configured.filter(r => r.complianceStatus === 'Meets' || r.complianceStatus === 'At Risk').length;
  return Math.round((meets / configured.length) * 100);
}
