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
You are a senior Hospital HR Analytics consultant in Vietnam. Generate an executive HR workforce report for hospital management based only on the provided data context. Structure the report into Strategic, Tactical, and Operational insights. Focus on workforce size, department composition, clinical workforce readiness, recruitment, attrition, transfer, qualification, license status, and preliminary compliance against configured staffing standards. Do not invent data. Do not make legal conclusions. If data or standard configuration is missing, say Data not available or Need configuration.

Structure the report using exactly these headers:
1. Executive Summary
2. Workforce Snapshot
3. Key Changes Since Previous Snapshot
4. Department Movement Analysis
5. Clinical Workforce & Licensing Readiness
6. Preliminary Compliance Assessment
7. Risks & Watchlist
8. Recommended Actions
9. Data Gaps / Data Quality Notes

Provide the report in Vietnamese language. Ensure a formal, professional, executive-ready tone suitable for the Hospital Board of Directors.

---
DATA CONTEXT JSON:
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
