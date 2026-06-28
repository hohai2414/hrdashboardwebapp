import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Clipboard,
  Download,
  AlertTriangle,
  RefreshCw,
  Key,
  ShieldCheck,
  Building2,
  Users
} from 'lucide-react';
import { SnapshotData, ComplianceRule, FilterState, MovementRecord, EmployeeRecord } from '../types/hr';
import { calculateExecutiveKpis, isClinicalGroup } from '../utils/metrics';
import { analyzeMovement } from '../utils/movementAnalyzer';
import { evaluateCompliance, getHospitalComplianceScore } from '../utils/complianceEngine';
import { analyzeDataQuality } from '../utils/dataQuality';
import { generateGeminiReport, getSavedApiKey } from '../services/geminiService';
import GeminiSettings from '../components/GeminiSettings';
import { removeVietnameseTones } from '../utils/columnMapper';

const CORE_LOAI_NV_NORMALIZED = ["bien che", "hop dong", "hop dong bsbm", "nd111"];

const CODE_TIER: Record<string, string> = {
  'BS':'DH', 'BS YHDP':'DH', 'BSCKI':'CKI', 'BSCKII':'CKII', 'THSBS':'THS', 'TSBS':'TS',
  'CN KTV':'DH', 'KTV CD':'CD', 'CKI KTV':'SAUDH', 'THS KTV':'SAUDH', 'CNSH':'DH', 'CNXN':'DH',
  'CN YTCC':'DH', 'THS YTCC':'THS',
  'CNĐD':'DH', 'DCD':'CD', 'DTC':'TC', 'DCKI':'SAUDH', 'THS ĐD':'SAUDH', 'ThS ĐD':'SAUDH',
  'DS':'DH', 'DSCĐ':'CD', 'DSTC':'TC', 'DSCKI':'CKI', 'DSCKII':'CKII', 'THS Duoc':'THS', 'TS Duoc':'TS',
  'Ho ly':'KHAC', 'Nhan vien':'KHAC', 'Van thu vien':'TC',
  'Ke toan vien':'DH', 'CV':'DH', 'KS':'DH', 'CN CNTT':'DH',
  'KS CD':'CD', 'Ke toan CD':'CD', 'Ke toan TC':'TC',
  'THS ke toan':'SAUDH', 'THS KS':'SAUDH', 'THS QLBV':'SAUDH', 'THS':'SAUDH', 'ThS QLBV':'SAUDH', 'ThS':'SAUDH',
  'Y si':'DH'
};

const PHANLOAI_BUCKET: Record<string, string> = {
  "bac si": "bacsi", "bac sy": "bacsi", "doctor": "bacsi", "bs": "bacsi",
  "y si": "ysi", "ytcc": "ytcc",
  "dieu duong": "dieuduong", "y ta": "dieuduong", "ktv": "ktv", "ky thuat vien": "ktv",
  "ds": "duoc", "duoc si": "duoc", "duoc sy": "duoc", "duoc": "duoc",
  "ho ly": "khac", "nhan vien": "khac", "khac": "khac"
};

function getEmpVal(emp: EmployeeRecord, columnIdx: number, defaultField?: keyof EmployeeRecord): any {
  if (defaultField && emp[defaultField]) {
    return emp[defaultField];
  }
  const rawKeys = Object.keys(emp.raw || {});
  const colNames: Record<number, string[]> = {
    6: ['ho ten', 'ho va ten', 'ten', 'fullname', 'name'],
    10: ['phai', 'gioi tinh', 'gender', 'sex'],
    13: ['tuoi', 'age'],
    14: ['dan toc', 'dantoc', 'ethnic'],
    16: ['ngay vao', 'ngay tuyen', 'ngay vao bv', 'startdate', 'join date'],
    20: ['phan loai', 'phan loai (nhom nghe)', 'nhom nghe', 'professional group'],
    22: ['trinh do chung', 'tdc', 'qualification', 'degree'],
    32: ['loai nhan vien', 'loai nv', 'loainv', 'contract type', 'employment status'],
    113: ['nghi viec', 'nghi viec/huu', 'nghiviec'],
    114: ['ngay nghi', 'ngaynghi']
  };
  const targets = colNames[columnIdx] || [];
  for (const key of rawKeys) {
    const normKey = removeVietnameseTones(key).toLowerCase().trim();
    if (targets.some(t => normKey.includes(t) || t.includes(normKey))) {
      return emp.raw[key];
    }
  }
  return '';
}

function getPhanloaiBucket(phanloai: string): string {
  const norm = removeVietnameseTones(phanloai || '').toLowerCase().trim();
  for (const [key, val] of Object.entries(PHANLOAI_BUCKET)) {
    if (norm === key || norm.includes(key)) {
      return val;
    }
  }
  return "khac";
}

function getTier(tdcVal: string): string {
  const norm = removeVietnameseTones(tdcVal || '').trim();
  const exactKey = Object.keys(CODE_TIER).find(k => removeVietnameseTones(k).toLowerCase() === norm.toLowerCase());
  if (exactKey) {
    return CODE_TIER[exactKey];
  }
  const normLower = norm.toLowerCase();
  if (normLower.includes('ckii') || normLower.includes('ck2')) return 'CKII';
  if (normLower.includes('cki') || normLower.includes('ck1')) return 'CKI';
  if (normLower.startsWith('ts')) return 'TS';
  if (normLower.includes('ths')) return 'THS';
  if (normLower.includes('pgs')) return 'PGS';
  if (normLower.startsWith('gs')) return 'GS';
  if (normLower.includes('cd')) return 'CD';
  if (normLower.endsWith('tc')) return 'TC';
  if (normLower.endsWith('sc')) return 'SC';
  return 'DH';
}

function isDtts(dantocVal: string): boolean {
  if (!dantocVal) return false;
  const norm = removeVietnameseTones(dantocVal).toLowerCase().trim();
  return norm !== 'kinh' && norm !== 'kih' && norm !== '';
}

function parseDateISO(dVal: any): string {
  if (!dVal) return '';
  if (dVal instanceof Date) return dVal.toISOString().split('T')[0];
  const s = String(dVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

interface AIHospitalReportProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
  complianceRule: ComplianceRule | null;
}


export default function AIHospitalReport({
  snapshots,
  selectedSnapshotIdx,
  complianceRule,
}: AIHospitalReportProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];
  const previousSnapshot = selectedSnapshotIdx > 0 ? snapshots[selectedSnapshotIdx - 1] : null;

  const [apiKey, setApiKey] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [reportText, setReportText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Reload API key on mount/config change
  useEffect(() => {
    setApiKey(getSavedApiKey());
  }, [showConfig]);

  // 1. Compile full JSON analytics context to feed to Gemini
  const dataContext = useMemo(() => {
    const activeSnapshotMovements = previousSnapshot
      ? analyzeMovement(
          currentSnapshot.employees,
          previousSnapshot.employees,
          currentSnapshot.snapshotDate,
          previousSnapshot.snapshotDate
        )
      : [];

    const kpis = calculateExecutiveKpis(currentSnapshot, previousSnapshot, activeSnapshotMovements);
    const compliance = evaluateCompliance(currentSnapshot.employees, complianceRule, currentSnapshot.snapshotDate);
    const complianceScore = getHospitalComplianceScore(compliance);
    const quality = analyzeDataQuality(snapshots);

    // Group headcount by department
    const deptHeadcounts: Record<string, number> = {};
    currentSnapshot.employees.forEach((e) => {
      if (e.department) {
        deptHeadcounts[e.department] = (deptHeadcounts[e.department] || 0) + 1;
      }
    });

    // Licensing counts
    let validLic = 0, expiredLic = 0, expiringLic = 0, missingLic = 0, clinicalTotal = 0;
    currentSnapshot.employees.forEach((e) => {
      if (isClinicalGroup(e.professionalGroup)) {
        clinicalTotal++;
        const lic = getLicenseStatusForAI(e, currentSnapshot.snapshotDate);
        if (lic === 'Valid') validLic++;
        else if (lic === 'Expired') expiredLic++;
        else if (lic === 'Expiring Soon') expiringLic++;
        else if (lic === 'Missing') missingLic++;
      }
    });

    // PNT statistics calculations
    const snapYear = new Date(currentSnapshot.snapshotDate).getFullYear() || 2026;
    const periodStart = `${snapYear}-01-01`;
    const periodEnd = currentSnapshot.snapshotDate;

    const pntCore = currentSnapshot.employees.filter((emp) => {
      const loai = String(getEmpVal(emp, 32, 'contractType') || '').trim();
      const normLoai = removeVietnameseTones(loai).toLowerCase().replace(/\s+/g, ' ');
      const isCoreType = ['bien che', 'hop dong', 'hop dong bsbm', 'nd111'].some(
        (t) => normLoai === t || normLoai.includes(t)
      );
      
      const nghiviecVal = getEmpVal(emp, 113, 'employmentStatus');
      const nghiviecStr = String(nghiviecVal || '').trim().toLowerCase();
      const isActive = nghiviecStr === '' || nghiviecStr === 'none' || nghiviecStr === 'null';
      
      return isActive && isCoreType;
    });

    const pntOutside = currentSnapshot.employees.filter((emp) => {
      const loai = String(getEmpVal(emp, 32, 'contractType') || '').trim();
      const normLoai = removeVietnameseTones(loai).toLowerCase().replace(/\s+/g, ' ');
      const isCoreType = ['bien che', 'hop dong', 'hop dong bsbm', 'nd111'].some(
        (t) => normLoai === t || normLoai.includes(t)
      );
      
      const nghiviecVal = getEmpVal(emp, 113, 'employmentStatus');
      const nghiviecStr = String(nghiviecVal || '').trim().toLowerCase();
      const isActive = nghiviecStr === '' || nghiviecStr === 'none' || nghiviecStr === 'null';
      
      return isActive && !isCoreType;
    });

    const exitsInPeriod = currentSnapshot.employees.filter((emp) => {
      const loai = String(getEmpVal(emp, 32, 'contractType') || '').trim();
      const normLoai = removeVietnameseTones(loai).toLowerCase().replace(/\s+/g, ' ');
      const isCoreType = ['bien che', 'hop dong', 'hop dong bsbm', 'nd111'].some(
        (t) => normLoai === t || normLoai.includes(t)
      );
      
      const ngayNghiRaw = getEmpVal(emp, 114);
      const ngayNghi = ngayNghiRaw ? parseDateISO(ngayNghiRaw) : '';
      
      return isCoreType && ngayNghi && periodStart <= ngayNghi && ngayNghi <= periodEnd;
    }).length;

    // Calculate B1
    const b1: Record<number, number> = {};
    b1[3] = complianceRule?.hospitalBedCount || 800;
    b1[4] = pntCore.filter((emp) => {
      const ngayVaoRaw = getEmpVal(emp, 16, 'startDate');
      const ngayVao = ngayVaoRaw ? parseDateISO(ngayVaoRaw) : '';
      return ngayVao && periodStart <= ngayVao && ngayVao <= periodEnd;
    }).length;
    b1[5] = exitsInPeriod;
    b1[8] = pntCore.filter((emp) => isDtts(String(getEmpVal(emp, 14)))).length;

    let ageUnder30 = 0, age30To50 = 0, ageOver50 = 0;
    let femaleOver54 = 0, maleOver59 = 0;

    pntCore.forEach((emp) => {
      const tuoiVal = getEmpVal(emp, 13);
      let tuoi = typeof tuoiVal === 'number' ? tuoiVal : parseInt(String(tuoiVal).trim(), 10);
      if (isNaN(tuoi)) {
        const birthYear = emp.dateOfBirth ? new Date(emp.dateOfBirth).getFullYear() : null;
        if (birthYear) {
          tuoi = snapYear - birthYear;
        }
      }
      
      if (!isNaN(tuoi)) {
        if (tuoi < 30) ageUnder30++;
        else if (tuoi <= 50) age30To50++;
        else if (tuoi >= 51) ageOver50++;

        const isFemale = String(getEmpVal(emp, 10, 'gender')).trim().toLowerCase() === 'nữ';
        if (isFemale && tuoi >= 54) femaleOver54++;
        if (!isFemale && tuoi >= 59) maleOver59++;
      }
    });

    b1[9] = ageUnder30;
    b1[10] = age30To50;
    b1[11] = ageOver50;
    b1[12] = femaleOver54;
    b1[13] = maleOver59;

    const coreBuckets: Record<string, Record<string, EmployeeRecord[]>> = {};
    pntCore.forEach((emp) => {
      const b = getPhanloaiBucket(String(getEmpVal(emp, 20, 'professionalGroup')));
      const t = getTier(String(getEmpVal(emp, 22, 'qualification')));
      if (!coreBuckets[b]) coreBuckets[b] = {};
      if (!coreBuckets[b][t]) coreBuckets[b][t] = [];
      coreBuckets[b][t].push(emp);
    });

    const cnt = (b: string, t: string) => coreBuckets[b]?.[t]?.length || 0;
    const nu = (b: string, t: string) => coreBuckets[b]?.[t]?.filter(emp => String(getEmpVal(emp, 10, 'gender')).trim().toLowerCase() === 'nữ').length || 0;

    const bsTiers = ["GS", "PGS", "TS", "CKII", "THS", "CKI", "DH"];
    const bsCols = [16, 18, 20, 22, 24, 26, 28];
    bsTiers.forEach((t, i) => {
      const col = bsCols[i];
      b1[col] = cnt("bacsi", t);
      b1[col + 1] = nu("bacsi", t);
    });

    const ytccTiers = ["TS", "THS", "CKII", "CKI", "DH"];
    const ytccCols = [32, 34, 36, 38, 40];
    ytccTiers.forEach((t, i) => {
      const col = ytccCols[i];
      b1[col] = cnt("ytcc", t);
      b1[col + 1] = nu("ytcc", t);
    });

    const ysiAll: EmployeeRecord[] = [];
    if (coreBuckets["ysi"]) {
      Object.values(coreBuckets["ysi"]).forEach(arr => ysiAll.push(...arr));
    }
    b1[43] = ysiAll.filter(emp => String(getEmpVal(emp, 10, 'gender')).trim().toLowerCase() === 'nữ').length;
    b1[44] = ysiAll.length;
    b1[45] = 0;
    b1[46] = 0;

    const ktvTiersMap: Record<number, string> = { 49: "SAUDH", 50: "DH", 51: "CD", 52: "TC", 53: "SC" };
    Object.entries(ktvTiersMap).forEach(([colStr, tier]) => {
      const col = parseInt(colStr, 10);
      b1[col] = cnt("ktv", tier);
    });
    b1[48] = ["SAUDH", "DH", "CD", "TC", "SC"].reduce((sum, t) => sum + nu("ktv", t), 0);

    for (let c = 54; c <= 61; c++) b1[c] = 0;

    const ddTiersMap: Record<number, string> = { 64: "SAUDH", 65: "DH", 66: "CD", 67: "TC", 68: "SC" };
    Object.entries(ddTiersMap).forEach(([colStr, tier]) => {
      const col = parseInt(colStr, 10);
      b1[col] = cnt("dieuduong", tier);
    });
    b1[63] = ["SAUDH", "DH", "CD", "TC", "SC"].reduce((sum, t) => sum + nu("dieuduong", t), 0);

    for (let c = 69; c <= 75; c++) b1[c] = 0;

    b1[78] = cnt("duoc", "TS"); b1[79] = nu("duoc", "TS");
    b1[80] = cnt("duoc", "CKII"); b1[81] = nu("duoc", "CKII");
    b1[82] = cnt("duoc", "THS"); b1[83] = nu("duoc", "THS");
    b1[84] = cnt("duoc", "CKI"); b1[85] = nu("duoc", "CKI");
    b1[86] = cnt("duoc", "DH"); b1[87] = nu("duoc", "DH");
    b1[88] = cnt("duoc", "CD"); b1[89] = nu("duoc", "CD");
    b1[90] = cnt("duoc", "TC"); b1[91] = nu("duoc", "TC");
    b1[92] = 0; b1[93] = 0; b1[94] = 0; b1[95] = 0; b1[96] = 0; b1[97] = 0;

    const khacTiersMap: Record<number, string> = { 100: "SAUDH", 102: "DH", 104: "CD", 106: "TC", 108: "KHAC" };
    Object.entries(khacTiersMap).forEach(([colStr, tier]) => {
      const col = parseInt(colStr, 10);
      b1[col] = cnt("khac", tier);
      b1[col + 1] = nu("khac", tier);
    });

    // Calculate B3
    const outsideBuckets: Record<string, Record<string, EmployeeRecord[]>> = {};
    pntOutside.forEach((emp) => {
      const b = getPhanloaiBucket(String(getEmpVal(emp, 20, 'professionalGroup')));
      const t = getTier(String(getEmpVal(emp, 22, 'qualification')));
      if (!outsideBuckets[b]) outsideBuckets[b] = {};
      if (!outsideBuckets[b][t]) outsideBuckets[b][t] = [];
      outsideBuckets[b][t].push(emp);
    });

    const cntOut = (b: string, t: string) => outsideBuckets[b]?.[t]?.length || 0;
    const nuOut = (b: string, t: string) => outsideBuckets[b]?.[t]?.filter(emp => String(getEmpVal(emp, 10, 'gender')).trim().toLowerCase() === 'nữ').length || 0;

    const b3: Record<number, number> = {};
    b3[3] = pntOutside.length;
    b3[4] = pntOutside.filter(emp => String(getEmpVal(emp, 10, 'gender')).trim().toLowerCase() === 'nữ').length;
    b3[5] = pntOutside.filter(emp => isDtts(String(getEmpVal(emp, 14)))).length;

    const bsColsOut = [8, 10, 12, 14, 16, 18, 20];
    bsTiers.forEach((t, i) => {
      const col = bsColsOut[i];
      b3[col] = cntOut("bacsi", t);
      b3[col + 1] = nuOut("bacsi", t);
    });

    const ytccTiersOut = ["TS", "THS", "DH"];
    const ytccColsOut = [24, 26, 28];
    ytccTiersOut.forEach((t, i) => {
      const col = ytccColsOut[i];
      b3[col] = cntOut("ytcc", t);
      b3[col + 1] = nuOut("ytcc", t);
    });

    const ysiAllOut: EmployeeRecord[] = [];
    if (outsideBuckets["ysi"]) {
      Object.values(outsideBuckets["ysi"]).forEach(arr => ysiAllOut.push(...arr));
    }
    b3[31] = ysiAllOut.filter(emp => String(getEmpVal(emp, 10, 'gender')).trim().toLowerCase() === 'nữ').length;
    b3[32] = ysiAllOut.length;
    b3[33] = 0;
    b3[34] = 0;

    const ktvTiersMapOut: Record<number, string> = { 37: "SAUDH", 38: "DH", 39: "CD", 40: "TC", 41: "SC" };
    Object.entries(ktvTiersMapOut).forEach(([colStr, tier]) => {
      const col = parseInt(colStr, 10);
      b3[col] = cntOut("ktv", tier);
    });
    b3[36] = ["SAUDH", "DH", "CD", "TC", "SC"].reduce((sum, t) => sum + nuOut("ktv", t), 0);

    for (let c = 42; c <= 49; c++) b3[c] = 0;

    const ddTiersMapOut: Record<number, string> = { 52: "SAUDH", 53: "DH", 54: "CD", 55: "TC", 56: "SC" };
    Object.entries(ddTiersMapOut).forEach(([colStr, tier]) => {
      const col = parseInt(colStr, 10);
      b3[col] = cntOut("dieuduong", tier);
    });
    b3[51] = ["SAUDH", "DH", "CD", "TC", "SC"].reduce((sum, t) => sum + nuOut("dieuduong", t), 0);

    for (let c = 58; c <= 63; c++) b3[c] = 0;

    b3[66] = cntOut("duoc", "TS"); b3[67] = nuOut("duoc", "TS");
    b3[68] = cntOut("duoc", "CKII"); b3[69] = nuOut("duoc", "CKII");
    b3[70] = cntOut("duoc", "THS"); b3[71] = nuOut("duoc", "THS");
    b3[72] = cntOut("duoc", "CKI"); b3[73] = nuOut("duoc", "CKI");
    b3[74] = cntOut("duoc", "DH"); b3[75] = nuOut("duoc", "DH");
    b3[76] = cntOut("duoc", "CD"); b3[77] = nuOut("duoc", "CD");
    b3[78] = cntOut("duoc", "TC"); b3[79] = nuOut("duoc", "TC");
    b3[80] = 0; b3[81] = 0;

    const khacTiersMapOut: Record<number, string> = { 84: "SAUDH", 86: "DH", 88: "CD", 90: "TC", 92: "KHAC" };
    Object.entries(khacTiersMapOut).forEach(([colStr, tier]) => {
      const col = parseInt(colStr, 10);
      b3[col] = cntOut("khac", tier);
      b3[col + 1] = nuOut("khac", tier);
    });

    return {
      reportingSnapshot: currentSnapshot.sheetName,
      reportingDate: currentSnapshot.snapshotDate,
      previousSnapshot: previousSnapshot ? previousSnapshot.sheetName : 'N/A',
      executiveSummary: {
        totalHeadcount: kpis.totalHeadcount,
        prevHeadcount: kpis.prevHeadcount,
        headcountChange: kpis.headcountChange,
        newHires: kpis.newHires,
        exits: kpis.exits,
        netChange: kpis.netChange,
        attritionRate: `${kpis.attritionRate.toFixed(1)}%`,
        newHireRate: `${kpis.newHireRate.toFixed(1)}%`,
        departmentsCount: kpis.departmentCount,
      },
      workforceBreakdown: {
        clinicalCount: kpis.clinicalCount,
        nonClinicalCount: kpis.nonClinicalCount,
        doctors: kpis.doctorCount,
        nurses: kpis.nurseCount,
        technicians: kpis.technicianCount,
        pharmacists: kpis.pharmacistCount,
        midwives: kpis.midwifeCount,
        adminSupport: kpis.adminSupportCount,
      },
      headcountByDepartment: deptHeadcounts,
      licensingMetrics: {
        totalClinicalStaff: clinicalTotal,
        validLicenses: validLic,
        expiredLicenses: expiredLic,
        expiringSoon: expiringLic,
        missingLicenseInfo: missingLic,
        licensedPercentage: `${kpis.pctLicensedClinical.toFixed(1)}%`,
      },
      preliminaryCompliance: {
        isConfigured: complianceRule !== null,
        complianceScore: `${complianceScore}%`,
        ratiosConfigured: complianceRule ? {
          hospitalBedCount: complianceRule.hospitalBedCount,
          hospitalClass: complianceRule.hospitalClass,
          doctorRatio: complianceRule.requiredDoctorRatio,
          nurseRatio: complianceRule.requiredNurseRatio,
        } : 'None',
        deficits: compliance.filter(c => c.gap < 0).map(c => ({
          dept: c.department,
          role: c.professionalGroup,
          deficit: c.gap,
        })),
      },
      dataQuality: {
        score: `${quality.qualityScore}%`,
        totalIssues: quality.totalIssues,
        criticalIssues: quality.criticalIssues,
        missingFieldsRate: `${quality.missingFieldRate.toFixed(1)}%`,
      },
      pntReport: {
        reportingYear: snapYear,
        reportingPeriod: `${periodStart} đến ${periodEnd}`,
        b1_stats: b1,
        b3_stats: b3,
        totalCore: pntCore.length,
        totalOutside: pntOutside.length
      }
    };
  }, [currentSnapshot, previousSnapshot, snapshots, complianceRule]);

  // Get license status helper
  function getLicenseStatusForAI(emp: EmployeeRecord, snapshotDate: string) {
    if (!isClinicalGroup(emp.professionalGroup)) return 'N/A';
    if (!emp.licenseNumber) return 'Missing';
    if (!emp.licenseExpiryDate) return 'Valid';
    const dA = new Date(emp.licenseExpiryDate);
    const dB = new Date(snapshotDate);
    if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return 'Valid';
    const diff = Math.ceil((dA.getTime() - dB.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Expired';
    if (diff <= 90) return 'Expiring Soon';
    return 'Valid';
  }

  // Handle generation action
  const handleGenerateReport = async () => {
    if (!apiKey) {
      setErrorMsg('Vui lòng cấu hình Gemini API Key trước khi thực hiện.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    const promptText = `
Bạn là chuyên gia phân tích nhân sự y tế cao cấp tại Việt Nam. Hãy lập "BÁO CÁO THỐNG KÊ NHÂN LỰC - TỔ CHỨC Y TẾ" chi tiết cho Bệnh viện Phạm Ngọc Thạch đệ trình Ban Giám đốc dựa trên dữ liệu ngữ cảnh được cung cấp.

Báo cáo cần trình bày rõ ràng, phân tích sâu các chỉ số từ Biểu B1 (Lao động cơ hữu) và Biểu B3 (Lao động hợp đồng thêm) của bệnh viện.

Vui lòng viết báo cáo bằng Tiếng Việt với văn phong trang trọng, chuyên nghiệp và cấu trúc chính xác theo các mục sau:

1. Tóm tắt điều hành (Executive Summary)
   - Đánh giá tổng quan quy mô nhân sự hiện tại (Tổng số lao động cơ hữu B1 vs. Hợp đồng thêm B3, cơ cấu nam/nữ, dân tộc thiểu số).
   - Nhận định sơ bộ về năng lực đáp ứng của đội ngũ nhân sự y tế.

2. Phân tích Chi tiết Biểu B1 (Lao động Cơ hữu)
   - Phân tích chi tiết quy mô của nhóm Cơ hữu.
   - Thống kê & Phân tích cơ cấu chuyên môn chính: Bác sĩ (Tổng số & số lượng theo từng học hàm/học vị GS, PGS, TS, BSCKII, ThS, BSCKI, ĐH), YTCC, Y sĩ, Điều dưỡng (phân rã Sau ĐH, ĐH, CĐ, TC, SC), Kỹ thuật viên (KTV), Dược sĩ (TS, CKII, ThS, CKI, ĐH, CĐ, TC), Cán bộ khác.
   - Phân tích cơ cấu tuổi lao động cơ hữu (<30, 30-50, >=51) và cảnh báo nhóm tuổi cận hưu trí (Nữ >=54 tuổi, Nam >=59 tuổi) để chuẩn bị kế hoạch kế thừa.

3. Phân tích Chi tiết Biểu B3 (Lao động Hợp đồng thêm)
   - Phân tích quy mô và cơ cấu của lực lượng lao động ngoài cơ hữu (Hợp đồng thêm).
   - Thống kê chi tiết cơ cấu chuyên môn chính: Bác sĩ (GS, PGS, TS, BSCKII, ThS, BSCKI, ĐH), YTCC, Y sĩ, Điều dưỡng, KTV, Dược sĩ, Cán bộ khác.
   - Vai trò và tỷ trọng đóng góp của lực lượng hợp đồng thêm này đối với hoạt động của bệnh viện.

4. Biến động Nhân sự trong kỳ báo cáo
   - Tổng hợp số lượng tuyển mới và giảm (nghỉ việc, hưu trí) trong kỳ báo cáo (từ ngày 01/01 đến ngày snapshot).
   - Đánh giá xu hướng hao hụt nhân sự và tốc độ thu hút nhân sự mới.

5. Đánh giá tính tuân thủ định mức Bộ Y tế & Cơ cấu chuyên môn
   - So sánh định mức nhân sự thực tế với số giường bệnh kế hoạch (hiện cấu hình là ${dataContext.pntReport.b1_stats[3]} giường) dựa trên quy định của Bộ Y tế Việt Nam.
   - Nhận diện các khoa/phòng hoặc nhóm chức danh đang thiếu hụt hoặc dư thừa.

6. Kiến nghị chiến lược & Đề xuất hành động
   - Đề xuất giải pháp cụ thể cho Ban Giám đốc về công tác tuyển dụng, đào tạo nâng cao trình độ, tối ưu hóa phân bổ nhân sự, và lộ trình thay thế nhóm nhân sự chuẩn bị nghỉ hưu.

---
DỮ LIỆU NGỮ CẢNH CHI TIẾT (JSON):
${JSON.stringify(dataContext, null, 2)}
`;

    try {
      const generated = await generateGeminiReport(apiKey, promptText);
      setReportText(generated);
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi không xác định khi kết nối với Gemini API.');
      setStatus('error');
    }
  };

  const handleCopy = () => {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    alert('Đã sao chép báo cáo vào bộ nhớ tạm (Clipboard)!');
  };

  const handleDownload = () => {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AI_Hospital_HR_Report_${currentSnapshot.sheetName}.md`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Settings Modal Header */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-2">
            <GeminiSettings
              onClose={() => setShowConfig(false)}
              onSaveSuccess={() => setApiKey(getSavedApiKey())}
            />
          </div>
        </div>
      )}

      {/* Control panel card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
              <Sparkles size={24} className="animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Không gian Báo cáo Nhân sự AI</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sử dụng mô hình AI Gemini để phân tích toàn bộ snapshot hiện tại và kiến tạo báo cáo nhân sự đệ trình Ban Giám đốc
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 self-end md:self-auto">
            {!apiKey ? (
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-755 text-white rounded-xl shadow-md text-xs font-bold transition-all hover-scale"
              >
                <Key size={14} />
                <span>Cập nhật API Key</span>
              </button>
            ) : (
              <button
                onClick={handleGenerateReport}
                disabled={status === 'loading'}
                className={`flex items-center space-x-1.5 px-5 py-2.5 rounded-xl shadow-md text-xs font-bold transition-all hover-scale ${
                  status === 'loading'
                    ? 'bg-slate-950 text-white/80 opacity-90 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-black text-white'
                }`}
              >
                <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
                <span>{status === 'loading' ? 'Đang tạo báo cáo...' : 'Tạo Báo cáo AI (Gemini)'}</span>
              </button>
            )}
            
            {apiKey && (
              <button
                onClick={() => setShowConfig(true)}
                className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl"
                title="Thay đổi API Key"
              >
                <Key size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Security / local Warning */}
        {apiKey && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[10px] text-slate-500 font-semibold">
            <span className="flex items-center">
              <ShieldCheck size={14} className="text-emerald-500 mr-1.5" />
              API Key đã được cấu hình từ bộ nhớ cục bộ (Local Storage).
            </span>
            <button
              onClick={() => {
                localStorage.removeItem('gemini_api_key');
                setApiKey('');
              }}
              className="text-rose-600 hover:underline"
            >
              Gỡ bỏ API Key
            </button>
          </div>
        )}
      </div>

      {/* Main Report View */}
      {status === 'loading' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-premium flex flex-col items-center justify-center space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin"></div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Đang tổng hợp dữ liệu và gửi truy vấn sang Gemini...</h4>
            <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
              Hệ thống đang cấu trúc thông tin định mức tuân thủ, biến động ròng, rủi ro chứng chỉ để kiến tạo báo cáo đa chiều.
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-100 text-red-900 rounded-2xl p-6 shadow-premium flex items-start space-x-4 max-w-xl mx-auto">
          <AlertTriangle size={24} className="text-red-650 flex-shrink-0 mt-0.5" />
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-800">Không thể khởi tạo báo cáo AI</h4>
              <p className="text-xs text-red-700 leading-relaxed mt-1">{errorMsg}</p>
            </div>
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold shadow"
            >
              Thử lại ngay
            </button>
          </div>
        </div>
      )}

      {status === 'success' && reportText && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-premium overflow-hidden flex flex-col">
          {/* Report toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600">
              Báo cáo cho Snapshot: <strong className="text-hospital-700">{currentSnapshot.sheetName}</strong>
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all hover-scale"
              >
                <Clipboard size={14} />
                <span>Sao chép Markdown</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all hover-scale"
              >
                <Download size={14} />
                <span>Tải Báo cáo (.md)</span>
              </button>
            </div>
          </div>

          {/* Rendered report block */}
          <div className="p-6 md:p-8 max-h-[600px] overflow-y-auto bg-slate-50/50">
            {/* Simple Markdown Visualizer */}
            <div className="prose prose-sm max-w-none text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans select-all bg-white border border-slate-250 p-6 md:p-8 rounded-2xl shadow-inner">
              {reportText}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {status === 'idle' && !reportText && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-premium max-w-xl mx-auto flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-violet-50 text-violet-600 rounded-2xl">
            <Sparkles size={32} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Sẵn sàng khởi tạo báo cáo phân tích AI</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Hệ thống sẽ trích xuất toàn bộ dữ liệu chỉ số CCHN, hao hụt nhân sự và so sánh với định mức Bộ Y tế để làm dữ liệu nền tảng cho Gemini.
            </p>
          </div>
          <button
            onClick={handleGenerateReport}
            className="px-5 py-3 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-lg hover-scale transition-all"
          >
            Khởi tạo báo cáo ngay
          </button>
        </div>
      )}
    </div>
  );
}
