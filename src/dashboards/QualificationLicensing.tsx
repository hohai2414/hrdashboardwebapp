import React, { useMemo } from 'react';
import {
  Award,
  ShieldAlert,
  ShieldCheck,
  ShieldCheck as ShieldWarning,
  FileWarning,
  FileSpreadsheet,
  AlertOctagon,
  Users
} from 'lucide-react';
import { SnapshotData, FilterState, EmployeeRecord } from '../types/hr';
import { isClinicalGroup, getLicenseStatus } from '../utils/metrics';
import { getDaysDiff, formatDateDisplay } from '../utils/dateUtils';
import KpiCard from '../components/KpiCard';
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
  Legend,
  Cell
} from 'recharts';

interface QualificationLicensingProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
  filteredEmployees: EmployeeRecord[];
}

export default function QualificationLicensing({
  snapshots,
  selectedSnapshotIdx,
  filteredEmployees,
}: QualificationLicensingProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];

  // 1. Compute Licensing stats for the current snapshot
  const stats = useMemo(() => {
    let totalClinical = 0;
    let validLic = 0;
    let expiredLic = 0;
    let expiringSoonLic = 0;
    let missingLic = 0;
    
    let hasQual = 0;
    let missingQual = 0;

    let docTotal = 0, docQualComplete = 0;
    let nurseTotal = 0, nurseQualComplete = 0;
    let techTotal = 0, techQualComplete = 0;

    filteredEmployees.forEach((emp) => {
      const isClinical = isClinicalGroup(emp.professionalGroup);
      const group = emp.professionalGroup.trim().toLowerCase();

      if (emp.qualification && emp.qualification.trim() !== '') {
        hasQual++;
        if (group.includes('bac si') || group.includes('doctor')) docQualComplete++;
        else if (group.includes('dieu duong') || group.includes('nurse')) nurseQualComplete++;
        else if (group.includes('ky thuat vien') || group.includes('technician')) techQualComplete++;
      } else {
        missingQual++;
      }

      if (group.includes('bac si') || group.includes('doctor')) docTotal++;
      else if (group.includes('dieu duong') || group.includes('nurse')) nurseTotal++;
      else if (group.includes('ky thuat vien') || group.includes('technician')) techTotal++;

      if (isClinical) {
        totalClinical++;
        const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
        if (status === 'Valid') validLic++;
        else if (status === 'Expired') expiredLic++;
        else if (status === 'Expiring Soon') expiringSoonLic++;
        else if (status === 'Missing') missingLic++;
      }
    });

    return {
      totalClinical,
      validLic,
      expiredLic,
      expiringSoonLic,
      missingLic,
      hasQual,
      missingQual,
      docQualPct: docTotal > 0 ? (docQualComplete / docTotal) * 100 : 0,
      nurseQualPct: nurseTotal > 0 ? (nurseQualComplete / nurseTotal) * 100 : 0,
      techQualPct: techTotal > 0 ? (techQualComplete / techTotal) * 100 : 0,
    };
  }, [filteredEmployees, currentSnapshot.snapshotDate]);

  // 2. Stacked Bar Chart Data: License Status by Department (Top 8)
  const deptLicenseData = useMemo(() => {
    const dataMap: Record<string, { name: string; Valid: number; Expiring: number; Expired: number; Missing: number }> = {};
    
    filteredEmployees.forEach((emp) => {
      if (!isClinicalGroup(emp.professionalGroup) || !emp.department) return;
      
      const dept = emp.department;
      if (!dataMap[dept]) {
        dataMap[dept] = { name: dept, Valid: 0, Expiring: 0, Expired: 0, Missing: 0 };
      }

      const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
      if (status === 'Valid') dataMap[dept].Valid++;
      else if (status === 'Expiring Soon') dataMap[dept].Expiring++;
      else if (status === 'Expired') dataMap[dept].Expired++;
      else if (status === 'Missing') dataMap[dept].Missing++;
    });

    return Object.values(dataMap)
      .sort((a, b) => (b.Valid + b.Expired + b.Expiring + b.Missing) - (a.Valid + a.Expired + a.Expiring + a.Missing))
      .slice(0, 8);
  }, [filteredEmployees, currentSnapshot.snapshotDate]);

  // 3. Stacked Bar Chart Data: License Status by Professional Group
  const groupLicenseData = useMemo(() => {
    const dataMap: Record<string, { name: string; Valid: number; Expiring: number; Expired: number; Missing: number }> = {};
    
    filteredEmployees.forEach((emp) => {
      if (!isClinicalGroup(emp.professionalGroup)) return;
      
      const group = emp.professionalGroup;
      if (!dataMap[group]) {
        dataMap[group] = { name: group, Valid: 0, Expiring: 0, Expired: 0, Missing: 0 };
      }

      const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
      if (status === 'Valid') dataMap[group].Valid++;
      else if (status === 'Expiring Soon') dataMap[group].Expiring++;
      else if (status === 'Expired') dataMap[group].Expired++;
      else if (status === 'Missing') dataMap[group].Missing++;
    });

    return Object.values(dataMap);
  }, [filteredEmployees, currentSnapshot.snapshotDate]);

  // 4. Missing license rates by department (Heatmap representation table)
  const missingLicenseHeatmap = useMemo(() => {
    const dataMap: Record<string, { dept: string; clinicalCount: number; missingCount: number; pct: number }> = {};

    filteredEmployees.forEach((emp) => {
      if (!isClinicalGroup(emp.professionalGroup) || !emp.department) return;
      const dept = emp.department;
      
      if (!dataMap[dept]) {
        dataMap[dept] = { dept, clinicalCount: 0, missingCount: 0, pct: 0 };
      }

      dataMap[dept].clinicalCount++;
      const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
      if (status === 'Missing' || status === 'Expired') {
        dataMap[dept].missingCount++;
      }
    });

    return Object.values(dataMap)
      .map((item) => {
        item.pct = item.clinicalCount > 0 ? (item.missingCount / item.clinicalCount) * 100 : 0;
        return item;
      })
      .filter((item) => item.missingCount > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [filteredEmployees, currentSnapshot.snapshotDate]);

  // 5. Expiry timeline date buckets
  const expiryTimelineData = useMemo(() => {
    let d1 = 0, d2 = 0, d3 = 0, expired = 0;

    filteredEmployees.forEach((emp) => {
      if (!isClinicalGroup(emp.professionalGroup) || !emp.licenseExpiryDate) return;
      
      const diff = getDaysDiff(emp.licenseExpiryDate, currentSnapshot.snapshotDate);
      if (diff < 0) expired++;
      else if (diff <= 30) d1++;
      else if (diff <= 60) d2++;
      else if (diff <= 90) d3++;
    });

    return [
      { name: 'Đã hết hạn', value: expired, color: '#ef4444' },
      { name: 'Trong 30 ngày', value: d1, color: '#f57c00' },
      { name: '31-60 ngày', value: d2, color: '#f59e0b' },
      { name: '61-90 ngày', value: d3, color: '#eab308' },
    ];
  }, [filteredEmployees, currentSnapshot.snapshotDate]);

  // 6. Roster mapping with Risk Levels
  const complianceRoster = useMemo(() => {
    return filteredEmployees.map((emp) => {
      const isClinical = isClinicalGroup(emp.professionalGroup);
      const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
      
      let riskLevel: 'High' | 'Medium' | 'Low' | 'Info' = 'Info';
      let recommendedAction = 'Hồ sơ đầy đủ.';

      if (isClinical) {
        if (status === 'Missing') {
          riskLevel = 'High';
          recommendedAction = 'Yêu cầu cập nhật số CCHN bắt buộc.';
        } else if (status === 'Expired') {
          riskLevel = 'High';
          recommendedAction = 'Đình chỉ lâm sàng tạm thời, thực hiện gia hạn CCHN gấp.';
        } else if (status === 'Expiring Soon') {
          riskLevel = 'Medium';
          recommendedAction = 'Thông báo làm hồ sơ gia hạn CCHN trong vòng 90 ngày.';
        } else {
          riskLevel = 'Low';
          recommendedAction = 'Duy trì hồ sơ hợp lệ.';
        }
      } else {
        if (!emp.qualification || emp.qualification.trim() === '') {
          riskLevel = 'Medium';
          recommendedAction = 'Bổ sung thông tin trình độ học vấn.';
        } else {
          riskLevel = 'Info';
          recommendedAction = 'Hành chính / Support (Không bắt buộc CCHN).';
        }
      }

      return {
        ...emp,
        licenseStatus: status,
        riskLevel,
        recommendedAction,
      };
    });
  }, [filteredEmployees, currentSnapshot.snapshotDate]);

  const columns = [
    { key: 'employeeId', header: 'Mã NV', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'department', header: 'Khoa/Phòng', sortable: true },
    { key: 'jobTitle', header: 'Chức danh' },
    { key: 'professionalGroup', header: 'Nhóm', sortable: true },
    {
      key: 'licenseNumber',
      header: 'Số CCHN',
      render: (row: any) => row.licenseNumber || <span className="text-slate-400 italic">Thiếu CCHN</span>,
    },
    {
      key: 'licenseExpiryDate',
      header: 'Hạn CCHN',
      render: (row: any) => row.licenseExpiryDate ? formatDateDisplay(row.licenseExpiryDate) : <span className="text-slate-400">N/A</span>,
    },
    {
      key: 'licenseStatus',
      header: 'Trạng thái',
      render: (row: any) => {
        const badges = {
          Valid: 'bg-emerald-100 text-emerald-800',
          Expired: 'bg-rose-100 text-rose-800',
          'Expiring Soon': 'bg-amber-100 text-amber-800',
          Missing: 'bg-slate-100 text-slate-700',
          'Not Applicable': 'bg-slate-50 text-slate-400',
        };
        const labels = {
          Valid: 'Hợp lệ',
          Expired: 'Hết hạn',
          'Expiring Soon': 'Sắp hết hạn',
          Missing: 'Chưa cập nhật',
          'Not Applicable': 'Không bắt buộc',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badges[row.licenseStatus as keyof typeof badges]}`}>
            {labels[row.licenseStatus as keyof typeof labels]}
          </span>
        );
      },
    },
    {
      key: 'riskLevel',
      header: 'Mức rủi ro',
      render: (row: any) => {
        const badges = {
          High: 'bg-red-500 text-white shadow-xs',
          Medium: 'bg-amber-500 text-white shadow-xs',
          Low: 'bg-emerald-500 text-white shadow-xs',
          Info: 'bg-slate-400 text-white shadow-xs',
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badges[row.riskLevel as keyof typeof badges]}`}>
            {row.riskLevel}
          </span>
        );
      },
    },
    { key: 'recommendedAction', header: 'Hành động khuyến nghị' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Nhân viên chuyên môn (Clinical)"
          value={stats.totalClinical}
          icon={Users}
          subtext="Số nhân sự thuộc diện quản lý CCHN"
          color="primary"
        />
        <KpiCard
          title="CCHN hợp lệ"
          value={stats.validLic}
          icon={ShieldCheck}
          subtext={`${stats.totalClinical > 0 ? ((stats.validLic / stats.totalClinical) * 100).toFixed(0) : 0}% nhân viên lâm sàng`}
          color="success"
        />
        <KpiCard
          title="CCHN Đã hết hạn"
          value={stats.expiredLic}
          icon={AlertOctagon}
          subtext="Yêu cầu đình chỉ lâm sàng khẩn"
          color="danger"
        />
        <KpiCard
          title="CCHN Sắp hết hạn (90d)"
          value={stats.expiringSoonLic}
          icon={FileWarning}
          subtext="Cần thực hiện gia hạn sớm"
          color="warning"
        />
        <KpiCard
          title="Khuyết thông tin CCHN"
          value={stats.missingLic}
          icon={ShieldWarning}
          subtext="Thiếu dữ liệu số chứng chỉ lâm sàng"
          color="warning"
        />
        <KpiCard
          title="Thiếu dữ liệu Trình độ"
          value={stats.missingQual}
          icon={Award}
          subtext="Dòng hồ sơ khuyết bằng cấp học vấn"
          color="danger"
        />
        <KpiCard
          title="Bác sĩ có hồ sơ Đạt"
          value={`${stats.docQualPct.toFixed(0)}%`}
          icon={ShieldCheck}
          subtext="Tỷ lệ bác sĩ có thông tin học vị"
          color="info"
        />
        <KpiCard
          title="Điều dưỡng có hồ sơ Đạt"
          value={`${stats.nurseQualPct.toFixed(0)}%`}
          icon={ShieldCheck}
          subtext="Tỷ lệ điều dưỡng có học vị"
          color="info"
        />
      </div>

      {/* Stacked Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Tuân thủ CCHN theo Khoa phòng (Top 8)"
          subtitle="Đánh giá chi tiết tỷ lệ nhân viên Đạt / Hết hạn / Thiếu CCHN"
          isEmpty={deptLicenseData.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={deptLicenseData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="Valid" name="Hợp lệ" stackId="a" fill="#10b981" />
              <Bar dataKey="Expiring" name="Sắp hết hạn" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Expired" name="Đã hết hạn" stackId="a" fill="#ef4444" />
              <Bar dataKey="Missing" name="Thiếu CCHN" stackId="a" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Tuân thủ CCHN theo Nhóm chức danh"
          subtitle="So sánh mức độ tuân thủ pháp lý giữa các nhóm nghề nghiệp chuyên môn"
          isEmpty={groupLicenseData.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={groupLicenseData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="Valid" name="Hợp lệ" stackId="a" fill="#10b981" barSize={30} />
              <Bar dataKey="Expiring" name="Sắp hết hạn" stackId="a" fill="#f59e0b" barSize={30} />
              <Bar dataKey="Expired" name="Đã hết hạn" stackId="a" fill="#ef4444" barSize={30} />
              <Bar dataKey="Missing" name="Thiếu CCHN" stackId="a" fill="#64748b" barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Expiry timeline & Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timeline forecast expiring */}
        <ChartCard
          title="Tiến độ hết hạn CCHN sắp tới"
          subtitle="Số lượng chứng chỉ sẽ hết hiệu lực trong các khoảng thời gian tiếp theo"
          isEmpty={expiryTimelineData.every(x => x.value === 0)}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={expiryTimelineData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={25}>
                {expiryTimelineData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Missing License Heatmap table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
          <h4 className="text-sm font-bold text-slate-800 tracking-tight">
            Khoa có tỷ lệ khuyết/hết hạn CCHN cao nhất
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-4">
            Độ phủ thiếu hụt hồ sơ chuyên môn theo đơn vị (Heatmap Rate)
          </p>

          {missingLicenseHeatmap.length > 0 ? (
            <div className="space-y-3">
              {missingLicenseHeatmap.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="truncate max-w-[200px]">{item.dept}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full"
                        style={{ width: `${item.pct}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      {item.missingCount} NV ({item.pct.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs italic">
              Tuyệt vời! 100% các khoa phòng đã cập nhật CCHN lâm sàng đầy đủ.
            </div>
          )}
        </div>
      </div>

      {/* Compliance Roster table */}
      <div>
        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
          Bảng kiểm soát tuân thủ hồ sơ bằng cấp & chứng chỉ chuyên môn
        </h4>
        <DataTable
          data={complianceRoster}
          columns={columns}
          searchPlaceholder="Tìm kiếm nhân viên..."
          searchField="fullName"
          exportFilename={`danh_gia_tu_nhan_su_cchn_${currentSnapshot.sheetName}`}
        />
      </div>
    </div>
  );
}
