import React, { useState, useMemo } from 'react';
import {
  FileCheck,
  Settings2,
  AlertTriangle,
  Building,
  CheckCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  FolderSync
} from 'lucide-react';
import { SnapshotData, ComplianceRule, ComplianceResult } from '../types/hr';
import { evaluateCompliance, getHospitalComplianceScore } from '../utils/complianceEngine';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend
} from 'recharts';

interface ComplianceDashboardProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
  complianceRule: ComplianceRule | null;
  setComplianceRule: React.Dispatch<React.SetStateAction<ComplianceRule | null>>;
}

export default function ComplianceDashboard({
  snapshots,
  selectedSnapshotIdx,
  complianceRule,
  setComplianceRule,
}: ComplianceDashboardProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];

  // Local state for configuration panel inputs
  const [showConfig, setShowConfig] = useState(false);
  const [bedsCount, setBedsCount] = useState<number>(complianceRule?.hospitalBedCount || 200);
  const [hospClass, setHospClass] = useState<ComplianceRule['hospitalClass']>(
    complianceRule?.hospitalClass || 'Class 1'
  );
  const [docRatio, setDocRatio] = useState<number>(complianceRule?.requiredDoctorRatio || 0.15);
  const [nurseRatio, setNurseRatio] = useState<number>(complianceRule?.requiredNurseRatio || 0.35);
  const [pharmRatio, setPharmRatio] = useState<number>(complianceRule?.requiredPharmacistRatio || 0.04);
  const [techRatio, setTechRatio] = useState<number>(complianceRule?.requiredTechnicianRatio || 0.06);
  
  // Local bed count inputs per department
  const depts = useMemo(() => {
    const list = new Set<string>();
    currentSnapshot.employees.forEach((e) => {
      if (e.department) list.add(e.department);
    });
    return Array.from(list).sort();
  }, [currentSnapshot]);

  const [deptBeds, setDeptBeds] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    depts.forEach((d) => {
      // Pre-fill some realistic beds counts if default preset
      if (d.includes('Nội')) initial[d] = 30;
      else if (d.includes('Ngoại')) initial[d] = 25;
      else if (d.includes('Sản')) initial[d] = 20;
      else if (d.includes('Nhi')) initial[d] = 20;
      else if (d.includes('Cấp cứu') || d.includes('Hồi sức')) initial[d] = 15;
      else initial[d] = 0;
    });
    return { ...initial, ...(complianceRule?.departmentBeds || {}) };
  });

  // Load Vietnamese Circular 03/2023/TT-BYT Standard Preset
  const handleLoadPreset = () => {
    setBedsCount(300);
    setHospClass('Class 1');
    setDocRatio(0.18); // 0.18 doctors per bed
    setNurseRatio(0.38); // 0.38 nurses per bed
    setPharmRatio(0.04);
    setTechRatio(0.06);

    const initialBeds: Record<string, number> = {};
    depts.forEach((d) => {
      if (d.toLowerCase().includes('noi') || d.toLowerCase().includes('nội')) initialBeds[d] = 40;
      else if (d.toLowerCase().includes('ngoai') || d.toLowerCase().includes('ngoại')) initialBeds[d] = 35;
      else if (d.toLowerCase().includes('san') || d.toLowerCase().includes('sản')) initialBeds[d] = 30;
      else if (d.toLowerCase().includes('nhi')) initialBeds[d] = 25;
      else if (d.toLowerCase().includes('cap cuu') || d.toLowerCase().includes('cấp cứu')) initialBeds[d] = 20;
      else if (d.toLowerCase().includes('hoi suc') || d.toLowerCase().includes('hồi sức')) initialBeds[d] = 15;
      else initialBeds[d] = 5;
    });
    setDeptBeds(initialBeds);
  };

  const handleSaveConfig = () => {
    const newRule: ComplianceRule = {
      hospitalBedCount: bedsCount,
      hospitalClass: hospClass,
      departmentBeds: deptBeds,
      requiredDoctorRatio: docRatio,
      requiredNurseRatio: nurseRatio,
      requiredPharmacistRatio: pharmRatio,
      requiredTechnicianRatio: techRatio,
      requiredLicenseRoles: ['Bác sĩ', 'Điều dưỡng', 'Kỹ thuật viên', 'Hộ sinh', 'Dược sĩ'],
    };
    setComplianceRule(newRule);
    setShowConfig(false);
  };

  // Evaluate Compliance results using engine
  const complianceResults = useMemo(() => {
    return evaluateCompliance(currentSnapshot.employees, complianceRule, currentSnapshot.snapshotDate);
  }, [currentSnapshot, complianceRule]);

  // Calculations
  const isConfigured = complianceRule !== null && complianceRule.hospitalBedCount > 0;
  
  const score = useMemo(() => {
    return getHospitalComplianceScore(complianceResults);
  }, [complianceResults]);

  // Aggregate Gaps by Department
  const deptGaps = useMemo(() => {
    if (!isConfigured) return [];
    
    const gaps: Record<string, number> = {};
    complianceResults.forEach((r) => {
      gaps[r.department] = (gaps[r.department] || 0) + r.gap;
    });

    return Object.entries(gaps)
      .map(([name, gap]) => ({ name, 'Thiếu hụt': gap }))
      .sort((a, b) => a['Thiếu hụt'] - b['Thiếu hụt']); // Worst deficits first
  }, [complianceResults, isConfigured]);

  const columns = [
    { key: 'department', header: 'Khoa/Phòng', sortable: true },
    { key: 'professionalGroup', header: 'Nhóm nhân sự', sortable: true },
    { key: 'actualHeadcount', header: 'Thực tế (Actual)' },
    { key: 'requiredHeadcount', header: 'Định mức (Required)' },
    {
      key: 'gap',
      header: 'Chênh lệch (Gap)',
      render: (row: any) => {
        const gap = row.gap;
        if (row.complianceStatus === 'Need Configuration') {
          return <span className="text-slate-400 italic">Chưa cấu hình</span>;
        }
        if (gap < 0) {
          return <span className="text-rose-600 font-bold">Thiếu {Math.abs(gap)}</span>;
        }
        if (gap > 0) {
          return <span className="text-emerald-600 font-bold">Thừa +{gap}</span>;
        }
        return <span className="text-slate-500 font-semibold">Đạt chuẩn</span>;
      },
    },
    {
      key: 'complianceStatus',
      header: 'Đánh giá sơ bộ',
      render: (row: any) => {
        const badges = {
          Meets: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
          'At Risk': 'bg-amber-100 text-amber-800 border border-amber-200',
          'Not Met': 'bg-rose-100 text-rose-800 border border-rose-200',
          'Need Configuration': 'bg-slate-100 text-slate-500 border border-slate-200',
          'Data not available': 'bg-slate-50 text-slate-400 border border-slate-150',
        };
        const labels = {
          Meets: 'Đạt định mức',
          'At Risk': 'Có rủi ro',
          'Not Met': 'Không đạt',
          'Need Configuration': 'Chưa cấu hình',
          'Data not available': 'Không có dữ liệu',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badges[row.complianceStatus as keyof typeof badges] || badges['Data not available']}`}>
            {labels[row.complianceStatus as keyof typeof labels]}
          </span>
        );
      },
    },
    { key: 'evidence', header: 'Minh chứng / Evidence' },
    { key: 'recommendedAction', header: 'Hành động khuyến nghị' },
  ];

  return (
    <div className="space-y-6">
      {/* Configuration Action Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-hospital-50 text-hospital-600 rounded-2xl">
              <FileCheck size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Đánh giá tuân thủ quy định Bộ Y tế</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tính toán định mức nhân lực y tế theo giường bệnh dựa trên cấu hình tiêu chuẩn định mức quốc gia
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-auto">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-sm text-xs font-bold transition-all hover-scale"
            >
              <Settings2 size={14} />
              <span>{showConfig ? 'Đóng cấu hình' : 'Thiết lập định mức'}</span>
            </button>
          </div>
        </div>

        {/* Configuration Panel Form */}
        {showConfig && (
          <div className="mt-5 pt-5 border-t border-slate-100 space-y-6 bg-slate-50/50 p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Cấu hình tham số định mức nhân lực</h4>
              <button
                type="button"
                onClick={handleLoadPreset}
                className="flex items-center space-x-1 text-[10px] font-bold text-hospital-700 hover:text-hospital-800 bg-hospital-50 px-2.5 py-1.5 rounded-lg border border-hospital-200"
              >
                <FolderSync size={12} />
                <span>Nạp chuẩn BYT Thông tư 03/2023</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Tổng số giường bệnh viện</label>
                <input
                  type="number"
                  value={bedsCount}
                  onChange={(e) => setBedsCount(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Hạng bệnh viện</label>
                <select
                  value={hospClass}
                  onChange={(e) => setHospClass(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
                >
                  <option value="Special">Hạng Đặc biệt</option>
                  <option value="Class 1">Hạng I</option>
                  <option value="Class 2">Hạng II</option>
                  <option value="Class 3">Hạng III</option>
                  <option value="Unclassed">Chưa phân hạng</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Định mức Bác sĩ / Giường</label>
                <input
                  type="number"
                  step="0.01"
                  value={docRatio}
                  onChange={(e) => setDocRatio(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Định mức Điều dưỡng / Giường</label>
                <input
                  type="number"
                  step="0.01"
                  value={nurseRatio}
                  onChange={(e) => setNurseRatio(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Định mức Dược sĩ / Giường</label>
                <input
                  type="number"
                  step="0.01"
                  value={pharmRatio}
                  onChange={(e) => setPharmRatio(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Định mức Kỹ thuật viên / Giường</label>
                <input
                  type="number"
                  step="0.01"
                  value={techRatio}
                  onChange={(e) => setTechRatio(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
                />
              </div>
            </div>

            {/* Department Bed allocation input */}
            <div>
              <span className="block text-[11px] font-bold text-slate-500 mb-2.5 uppercase">Phân bổ giường bệnh theo từng khoa lâm sàng</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-white border border-slate-100 p-4 rounded-xl max-h-48 overflow-y-auto shadow-inner">
                {depts.map((d) => {
                  // Only show bed allocation for clinical depts
                  const isClinicalDept = d.toLowerCase().includes('nội') || d.toLowerCase().includes('ngoại') || d.toLowerCase().includes('sản') || d.toLowerCase().includes('nhi') || d.toLowerCase().includes('cấp cứu') || d.toLowerCase().includes('hồi sức') || d.toLowerCase().includes('icu') || d.toLowerCase().includes('khám bệnh');
                  if (!isClinicalDept) return null;
                  
                  return (
                    <div key={d} className="flex flex-col space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold truncate" title={d}>{d}</span>
                      <input
                        type="number"
                        value={deptBeds[d] || 0}
                        onChange={(e) => setDeptBeds((prev) => ({ ...prev, [d]: Number(e.target.value) }))}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-hospital-500"
                        placeholder="Số giường..."
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 border border-slate-200 text-xs font-bold rounded-xl hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-5 py-2 bg-hospital-600 hover:bg-hospital-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main compliance metrics display */}
      {!isConfigured ? (
        <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl p-6 flex items-start space-x-4">
          <AlertTriangle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Cần thiết lập định mức nhân lực</h4>
            <p className="text-xs leading-relaxed text-amber-700">
              Hệ thống hiện tại chưa được nạp dữ liệu cấu hình quy mô bệnh viện và số giường bệnh chi tiết. Vui lòng bấm vào nút <strong>&quot;Thiết lập định mức&quot;</strong> hoặc nạp cấu hình mẫu để kích hoạt đánh giá tuân thủ theo Thông tư chuẩn.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Compliance Scores Radial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Điểm số tuân thủ định mức tổng</span>
              
              <div className="relative w-32 h-32 flex items-center justify-center mt-4">
                {/* SVG Radial Progress */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="54" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    stroke={score > 80 ? '#10b981' : score > 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={339.3}
                    strokeDashoffset={339.3 - (339.3 * score) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-800">{score}%</span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">Đạt chuẩn</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-4 font-semibold">
                Đánh giá sơ bộ dựa trên định mức giường bệnh đã cấu hình
              </p>
            </div>

            {/* Gap Analysis Bar chart */}
            <ChartCard
              title="Thiếu hụt nhân lực theo khoa phòng"
              subtitle="Số lượng định mức nhân sự còn thiếu (Gap = Actual - Required)"
              isEmpty={deptGaps.length === 0}
              className="col-span-2"
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deptGaps} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="Thiếu hụt" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={25}>
                    {deptGaps.map((entry: any, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry['Thiếu hụt'] >= 0 ? '#10b981' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Compliance details list */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
              Bảng đánh giá chi tiết định mức nhân sự Bộ Y tế theo Khoa phòng
            </h4>
            <DataTable
              data={complianceResults}
              columns={columns}
              searchPlaceholder="Tìm kiếm khoa phòng..."
              searchField="department"
              exportFilename={`danh_gia_tuan_thu_byt_${currentSnapshot.sheetName}`}
            />
          </div>
        </>
      )}
    </div>
  );
}
