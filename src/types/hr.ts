export interface EmployeeRecord {
  employeeId: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  department: string;
  division: string;
  jobTitle: string;
  professionalGroup: string; // Doctor, Nurse, Technician, Pharmacist, Midwife, Admin/Support, Other
  qualification: string; // e.g. PhD, Master, Bachelor, College, Intermediate, etc.
  degree: string;
  major: string;
  licenseNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  startDate: string;
  employmentStatus: string; // Active, Suspended, Resigned, etc.
  contractType: string;
  snapshotDate: string; // YYYY-MM-DD
  raw: Record<string, any>;
}

export interface SnapshotData {
  snapshotDate: string; // YYYY-MM-DD
  sheetName: string; // original sheet name
  employees: EmployeeRecord[];
  headerMap?: Record<string, string>;
}

export interface MovementRecord {
  employeeId: string;
  fullName: string;
  previousSnapshot: string | null;
  currentSnapshot: string;
  previousDepartment: string | null;
  currentDepartment: string | null;
  previousJobTitle: string | null;
  currentJobTitle: string | null;
  movementType: 'New Hire' | 'Exit' | 'Transfer' | 'Role Change' | 'Existing';
}

export interface DepartmentMetrics {
  headcount: number;
  pctOfHospital: number;
  doctorCount: number;
  nurseCount: number;
  technicianCount: number;
  pharmacistCount: number;
  midwifeCount: number;
  adminSupportCount: number;
  newHires: number;
  exits: number;
  netChange: number;
  licenseComplianceRate: number;
  qualificationCompletenessRate: number;
}

export interface DepartmentNode {
  id: string;
  name: string;
  block: 'Clinical' | 'Para-clinical' | 'Pharmacy' | 'Nursing' | 'Administrative / Support' | 'Other / Unclassified';
  headcount: number;
  metrics: DepartmentMetrics;
}

export interface ComplianceRule {
  hospitalBedCount: number;
  hospitalClass: 'Special' | 'Class 1' | 'Class 2' | 'Class 3' | 'Unclassed';
  departmentBeds: Record<string, number>;
  requiredDoctorRatio: number; // e.g., doctors per bed
  requiredNurseRatio: number; // e.g., nurses per bed or per doctor
  requiredPharmacistRatio: number;
  requiredTechnicianRatio: number;
  requiredLicenseRoles: string[]; // list of job titles/groups requiring license
}

export interface ComplianceResult {
  department: string;
  professionalGroup: string;
  actualHeadcount: number;
  requiredHeadcount: number;
  gap: number;
  complianceStatus: 'Meets' | 'At Risk' | 'Not Met' | 'Need Configuration' | 'Data not available';
  evidence: string;
  recommendedAction: string;
}

export interface FilterState {
  snapshotDate: string;
  month: string;
  periodType: 'All' | 'Mid-month' | 'Month-end';
  department: string;
  professionalGroup: string;
  jobTitle: string;
  gender: string;
  employmentStatus: string;
  qualificationLevel: string;
}
