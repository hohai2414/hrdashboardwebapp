import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  FileWarning,
  Server,
  FileSpreadsheet
} from 'lucide-react';
import { SnapshotData, FilterState } from '../types/hr';
import { analyzeDataQuality, QualityIssue } from '../utils/dataQuality';
import { formatDateDisplay } from '../utils/dateUtils';
import KpiCard from '../components/KpiCard';
import DataTable from '../components/DataTable';

interface DataQualityProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
  filters: FilterState;
}

export default function DataQuality({ snapshots, selectedSnapshotIdx, filters }: DataQualityProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];

  // 1. Filter snapshots based on global filters
  const filteredSnapshots = useMemo(() => {
    return snapshots.map((snap) => {
      const filteredEmps = snap.employees.filter((emp) => {
        if (filters.department && emp.department !== filters.department) return false;
        if (filters.professionalGroup && emp.professionalGroup !== filters.professionalGroup) return false;
        if (filters.jobTitle && emp.jobTitle !== filters.jobTitle) return false;
        if (filters.gender && emp.gender !== filters.gender) return false;
        if (filters.qualificationLevel && emp.qualification !== filters.qualificationLevel) return false;
        return true;
      });
      return {
        ...snap,
        employees: filteredEmps,
      };
    });
  }, [snapshots, filters]);

  // 2. Evaluate data quality metrics across filtered snapshots
  const report = useMemo(() => {
    return analyzeDataQuality(filteredSnapshots);
  }, [filteredSnapshots]);

  // 3. Filter issues specific to the selected snapshot date
  // Allow viewing all issues or only ones corresponding to the selected snapshot date
  const filteredIssues = useMemo(() => {
    const selectedDate = currentSnapshot.snapshotDate;
    return report.issuesList.filter(
      (issue) => issue.snapshotDate === 'Tất cả' || issue.snapshotDate === selectedDate
    );
  }, [report, currentSnapshot]);

  // Columns for the issues table
  const columns = [
    { key: 'issueType', header: 'Loại vấn đề', sortable: true },
    {
      key: 'severity',
      header: 'Mức độ',
      render: (row: any) => {
        const badges = {
          Critical: 'bg-red-500 text-white shadow-xs',
          Warning: 'bg-amber-500 text-white shadow-xs',
          Info: 'bg-blue-500 text-white shadow-xs',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badges[row.severity as keyof typeof badges]}`}>
            {row.severity}
          </span>
        );
      },
    },
    {
      key: 'snapshotDate',
      header: 'Snapshot',
      render: (row: any) => (row.snapshotDate === 'Tất cả' ? 'Toàn viện' : formatDateDisplay(row.snapshotDate)),
    },
    { key: 'employeeId', header: 'Mã nhân viên', sortable: true },
    { key: 'employeeName', header: 'Họ tên nhân viên', sortable: true },
    { key: 'field', header: 'Trường dữ liệu', sortable: true },
    {
      key: 'currentValue',
      header: 'Giá trị thực tế',
      render: (row: any) => (row.currentValue ? row.currentValue : <span className="text-slate-400 italic">Rỗng / Trống</span>),
    },
    { key: 'recommendedFix', header: 'Phương án khắc phục khuyến nghị' },
  ];

  return (
    <div className="space-y-6">
      {/* Overview grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Scorecard Gauge */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chất lượng dữ liệu bệnh viện (Score)</span>
          
          <div className="relative w-32 h-32 flex items-center justify-center mt-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="54" stroke="#f1f5f9" strokeWidth="10" fill="transparent" />
              <circle
                cx="64"
                cy="64"
                r="54"
                stroke={report.qualityScore > 85 ? '#10b981' : report.qualityScore > 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={339.3}
                strokeDashoffset={339.3 - (339.3 * report.qualityScore) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black text-slate-800">{report.qualityScore}%</span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase">Độ chính xác</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-4 font-semibold">
            {report.qualityScore > 85
              ? 'Dữ liệu ở trạng thái Tốt, sẵn sàng phân tích.'
              : report.qualityScore > 65
              ? 'Cần rà soát bổ sung một số trường trống.'
              : 'Dữ liệu lỗi nghiêm trọng, nguy cơ sai sót phân tích cao.'}
          </p>
        </div>

        {/* Breakdown cards */}
        <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Tổng số lỗi phát hiện"
            value={report.totalIssues}
            icon={Activity}
            subtext={`${report.criticalIssues} lỗi nghiêm trọng cần sửa gấp`}
            color={report.criticalIssues > 0 ? 'danger' : 'warning'}
          />
          <KpiCard
            title="Tỷ lệ khuyết thông tin (Missing)"
            value={`${report.missingFieldRate.toFixed(1)}%`}
            icon={FileWarning}
            subtext="Tỷ lệ ô trống / tổng số trường kiểm tra"
            color={report.missingFieldRate > 5 ? 'warning' : 'primary'}
          />
          <KpiCard
            title="Mã nhân viên trùng lặp"
            value={report.duplicateCount}
            icon={AlertTriangle}
            subtext="Gây sai lệch tổng đếm headcount"
            color={report.duplicateCount > 0 ? 'danger' : 'success'}
          />
          <KpiCard
            title="Lỗi định dạng ngày tháng"
            value={report.invalidDateCount}
            icon={AlertCircle}
            subtext="Ảnh hưởng tính toán hạn và thâm niên"
            color={report.invalidDateCount > 0 ? 'warning' : 'success'}
          />
        </div>
      </div>

      {/* Parse summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-4 flex items-center">
          <Server size={16} className="text-hospital-600 mr-2" />
          Nhật ký nạp dữ liệu Snapshots
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {snapshots.map((snap, idx) => (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between text-[11px]"
            >
              <div className="flex items-center space-x-2">
                <FileSpreadsheet size={14} className="text-slate-400" />
                <span className="font-bold text-slate-700">{snap.sheetName}</span>
              </div>
              <span className="font-semibold text-emerald-600 bg-white px-2 py-0.5 rounded shadow-xs border border-slate-100">
                OK
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Issues Table */}
      <div>
        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
          Danh mục lỗi hồ sơ cần làm sạch tại kỳ: {currentSnapshot.sheetName} ({filteredIssues.length} lỗi)
        </h4>
        <DataTable
          data={filteredIssues}
          columns={columns}
          searchPlaceholder="Tìm kiếm lỗi theo tên hoặc mã NV..."
          searchField="employeeName"
          exportFilename={`danh_sach_loi_du_lieu_${currentSnapshot.sheetName}`}
        />
      </div>
    </div>
  );
}
