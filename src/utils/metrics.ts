import { EmployeeRecord, MovementRecord, SnapshotData } from '../types/hr';
import { getDaysDiff } from './dateUtils';
import { removeVietnameseTones } from './columnMapper';

export interface ExecutiveKpiSummary {
  totalHeadcount: number;
  prevHeadcount: number;
  headcountChange: number;
  newHires: number;
  exits: number;
  netChange: number;
  attritionRate: number; // (exits / prevHeadcount) * 100
  newHireRate: number; // (newHires / prevHeadcount) * 100
  departmentCount: number;
  clinicalCount: number;
  nonClinicalCount: number;
  doctorCount: number;
  nurseCount: number;
  technicianCount: number;
  pharmacistCount: number;
  midwifeCount: number;
  adminSupportCount: number;
  otherCount: number;
  pctLicensedClinical: number; // % clinical staff with valid license
  pctMissingQualification: number; // % staff with missing qualification
  pctMissingLicense: number; // % clinical staff with missing license info
}

/**
 * Checks if a professional group represents clinical staff (requires license)
 */
export function isClinicalGroup(group: string): boolean {
  if (!group) return false;
  const clean = removeVietnameseTones(group);
  
  if (
    clean.includes('bac si') ||
    clean.includes('doctor') ||
    clean.includes('dieu duong') ||
    clean.includes('nurse') ||
    clean.includes('ky thuat vien') ||
    clean.includes('technician') ||
    clean.includes('ho sinh') ||
    clean.includes('midwife') ||
    clean.includes('duoc si') ||
    clean.includes('pharmacist')
  ) {
    return true;
  }

  const words = clean.split(/[^a-z0-9]+/);
  return (
    words.includes('bs') ||
    words.includes('dd') ||
    words.includes('ktv') ||
    words.includes('hs') ||
    words.includes('ds')
  );
}

/**
 * Categorize license status for an employee at a given snapshot date
 */
export function getLicenseStatus(
  emp: EmployeeRecord,
  snapshotDate: string
): 'Valid' | 'Expired' | 'Expiring Soon' | 'Missing' | 'Not Applicable' {
  if (!isClinicalGroup(emp.professionalGroup)) {
    return 'Not Applicable';
  }

  if (!emp.licenseNumber || emp.licenseNumber.trim() === '') {
    return 'Missing';
  }

  if (!emp.licenseExpiryDate) {
    // If has license but no expiry, let's treat it as valid but warning, or missing expiry.
    // Let's assume it doesn't expire if no date, or treat it as valid.
    return 'Valid';
  }

  const daysToExpiry = getDaysDiff(emp.licenseExpiryDate, snapshotDate);
  if (daysToExpiry < 0) {
    return 'Expired';
  } else if (daysToExpiry <= 90) {
    return 'Expiring Soon';
  }

  return 'Valid';
}

/**
 * Computes the Executive KPI summary for a selected snapshot
 */
export function calculateExecutiveKpis(
  currentSnapshot: SnapshotData,
  previousSnapshot: SnapshotData | null,
  movements: MovementRecord[]
): ExecutiveKpiSummary {
  const employees = currentSnapshot.employees;
  const totalHeadcount = employees.length;
  const prevHeadcount = previousSnapshot ? previousSnapshot.employees.length : 0;
  const headcountChange = totalHeadcount - prevHeadcount;

  // Hires and exits
  const periodHires = movements.filter((m) => m.movementType === 'New Hire');
  const periodExits = movements.filter((m) => m.movementType === 'Exit');
  const newHires = periodHires.length;
  const exits = periodExits.length;
  const netChange = newHires - exits;

  const attritionRate = prevHeadcount > 0 ? (exits / prevHeadcount) * 100 : 0;
  const newHireRate = prevHeadcount > 0 ? (newHires / prevHeadcount) * 100 : 0;

  // Departments count
  const depts = new Set(employees.map((e) => e.department).filter(Boolean));
  const departmentCount = depts.size;

  // Professional roles
  let clinicalCount = 0;
  let nonClinicalCount = 0;
  let doctorCount = 0;
  let nurseCount = 0;
  let technicianCount = 0;
  let pharmacistCount = 0;
  let midwifeCount = 0;
  let adminSupportCount = 0;
  let otherCount = 0;

  let licensedClinicalCount = 0;
  let missingLicenseCount = 0;
  let missingQualificationCount = 0;

  employees.forEach((emp) => {
    const isClinical = isClinicalGroup(emp.professionalGroup);
    if (isClinical) {
      clinicalCount++;
    } else {
      nonClinicalCount++;
    }

    // Sub-counts
    const group = removeVietnameseTones(emp.professionalGroup);
    const words = group.split(/[^a-z0-9]+/);
    if (group.includes('bac si') || group.includes('doctor') || words.includes('bs')) {
      doctorCount++;
    } else if (group.includes('dieu duong') || group.includes('nurse') || words.includes('dd')) {
      nurseCount++;
    } else if (group.includes('ky thuat vien') || group.includes('technician') || words.includes('ktv')) {
      technicianCount++;
    } else if (group.includes('duoc si') || group.includes('pharmacist') || words.includes('ds')) {
      pharmacistCount++;
    } else if (group.includes('ho sinh') || group.includes('midwife') || words.includes('hs')) {
      midwifeCount++;
    } else if (
      group.includes('hanh chinh') ||
      group.includes('support') ||
      group.includes('admin') ||
      words.includes('hc') ||
      words.includes('vp')
    ) {
      adminSupportCount++;
    } else {
      otherCount++;
    }

    // Qualification check
    if (!emp.qualification || emp.qualification.trim() === '') {
      missingQualificationCount++;
    }

    // License checks (only for clinical staff)
    if (isClinical) {
      const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
      if (status === 'Valid' || status === 'Expiring Soon') {
        licensedClinicalCount++;
      } else if (status === 'Missing') {
        missingLicenseCount++;
      }
    }
  });

  const pctLicensedClinical = clinicalCount > 0 ? (licensedClinicalCount / clinicalCount) * 100 : 0;
  const pctMissingQualification = totalHeadcount > 0 ? (missingQualificationCount / totalHeadcount) * 100 : 0;
  const pctMissingLicense = clinicalCount > 0 ? (missingLicenseCount / clinicalCount) * 100 : 0;

  return {
    totalHeadcount,
    prevHeadcount,
    headcountChange,
    newHires,
    exits,
    netChange,
    attritionRate,
    newHireRate,
    departmentCount,
    clinicalCount,
    nonClinicalCount,
    doctorCount,
    nurseCount,
    technicianCount,
    pharmacistCount,
    midwifeCount,
    adminSupportCount,
    otherCount,
    pctLicensedClinical,
    pctMissingQualification,
    pctMissingLicense,
  };
}
