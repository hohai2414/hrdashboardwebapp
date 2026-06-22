import React, { useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Sparkles,
  HelpCircle,
  Building,
  Briefcase
} from 'lucide-react';
import { SnapshotData, EmployeeRecord } from '../types/hr';
import { generateHeadcountForecast, PlanningInsights } from '../utils/forecast';
import { isClinicalGroup, getLicenseStatus } from '../utils/metrics';
import { formatDateDisplay } from '../utils/dateUtils';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

interface WorkforcePlanningProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
}

export default function WorkforcePlanning({ snapshots, selectedSnapshotIdx }: WorkforcePlanningProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];

  // 1. Generate forecasting insights
  const insights = useMemo(() => {
    return generateHeadcountForecast(snapshots);
  }, [snapshots]);

  // 2. Identify license renewals needing follow-up
  const licensesNeedingRenewal = useMemo(() => {
    return currentSnapshot.employees.filter((emp) => {
      if (!isClinicalGroup(emp.professionalGroup)) return false;
      const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
      return status === 'Expiring Soon' || status === 'Expired';
    });
  }, [currentSnapshot]);

  // 3. Departments needing data cleanup (high rate of missing fields)
  const deptsNeedingCleanup = useMemo(() => {
    const counts: Record<string, { total: number; missing: number }> = {};
    currentSnapshot.employees.forEach((emp) => {
      if (!emp.department) return;
      const dept = emp.department;
      if (!counts[dept]) counts[dept] = { total: 0, missing: 0 };
      counts[dept].total++;
      
      // Missing vital fields
      const isMissing = !emp.fullName || !emp.employeeId || !emp.professionalGroup || !emp.qualification ||
        (isClinicalGroup(emp.professionalGroup) && !emp.licenseNumber);
      if (isMissing) {
        counts[dept].missing++;
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, pct: data.total > 0 ? (data.missing / data.total) * 100 : 0 }))
      .filter((item) => item.pct > 5)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);
  }, [currentSnapshot]);

  // Render warning if not enough snapshots
  if (!insights) {
    return (
      <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl p-8 flex items-start space-x-4 max-w-3xl mx-auto my-6">
        <AlertTriangle size={28} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-amber-800">Dữ liệu thời gian không đủ để dự báo</h4>
          <p className="text-xs leading-relaxed text-amber-700">
            Hệ thống cần <strong>tối thiểu 3 snapshot thời gian khác nhau</strong> (ví dụ: 15.02.2026, 28.02.2026, 15.03.2026) để thiết lập trục tọa độ và tính toán mô hình hồi quy tuyến tính.
          </p>
          <p className="text-[11px] text-amber-600">
            Hiện tại bạn chỉ mới tải lên {snapshots.length} snapshot. Vui lòng tải lên file Excel có nhiều sheet hơn hoặc sử dụng tính năng <strong>&quot;Tải dữ liệu bệnh viện mẫu&quot;</strong> để xem trước biểu đồ dự báo.
          </p>
        </div>
      </div>
    );
  }

  // Split history and projection for charts display
  const chartData = insights.forecastPoints.map((pt) => ({
    name: formatDateDisplay(pt.dateStr),
    'Nhân sự thực tế': pt.isProjected ? null : pt.headcount,
    'Dự báo (Forecast)': pt.headcount,
  }));

  const currentCount = currentSnapshot.employees.length;

  return (
    <div className="space-y-6">
      {/* Forecast KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Tăng trưởng trung bình / tháng"
          value={insights.avgMonthlyGrowth >= 0 ? `+${insights.avgMonthlyGrowth.toFixed(1)}` : insights.avgMonthlyGrowth.toFixed(1)}
          icon={TrendingUp}
          subtext="Mức độ thay đổi ròng theo tháng"
          color={insights.avgMonthlyGrowth >= 0 ? 'success' : 'danger'}
        />
        <KpiCard
          title="Dự kiến tuyển / tháng"
          value={Math.round(insights.avgMonthlyHires)}
          icon={UserPlus}
          subtext="Tính trung bình từ dữ liệu quá khứ"
          color="primary"
        />
        <KpiCard
          title="Dự kiến nghỉ / tháng"
          value={Math.round(insights.avgMonthlyExits)}
          icon={UserMinus}
          subtext="Tần suất nhân sự hao hụt"
          color="danger"
        />
        <KpiCard
          title="Dự báo quy mô sau 3 tháng"
          value={insights.projectedHeadcount3m}
          icon={Sparkles}
          change={insights.projectedHeadcount3m - currentCount}
          subtext={`Quy mô dự kiến so với hiện tại (${currentCount})`}
          color="info"
        />
      </div>

      {/* Forecast Line Chart */}
      <div className="grid grid-cols-1 gap-6">
        <ChartCard
          title="Dự báo quy mô nhân lực bệnh viện (Headcount Forecast)"
          subtitle="Dự phóng hồi quy tuyến tính trong 3 tháng tới dựa trên dữ liệu snapshot trước đó"
          isEmpty={chartData.length === 0}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              {/* Historical actual line */}
              <Line
                type="monotone"
                dataKey="Nhân sự thực tế"
                stroke="#0ea5e9"
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 7 }}
              />
              {/* Forecast projection line */}
              <Line
                type="monotone"
                dataKey="Dự báo (Forecast)"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
              />
              {/* Add a vertical reference line to mark the forecast start */}
              <ReferenceLine
                x={formatDateDisplay(currentSnapshot.snapshotDate)}
                stroke="#64748b"
                strokeDasharray="3 3"
                label={{ value: 'Hiện tại', position: 'top', fontSize: 10, fill: '#64748b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Recommendations Cards Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recruitment & Retention Warnings */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
          <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center mb-4">
            <AlertTriangle size={16} className="text-rose-600 mr-2" />
            Khuyến nghị Kế hoạch Nhân lực & Giữ chân
          </h4>

          <div className="space-y-4">
            {/* Deficit depts */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                <Building size={12} className="mr-1" />
                Khoa cần chú trọng bổ sung tuyển dụng (Xu hướng giảm)
              </span>
              {insights.negativeTrendDepts.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {insights.negativeTrendDepts.map((d) => (
                    <span key={d} className="text-xs font-semibold bg-rose-50 text-rose-700 px-3 py-1 rounded-xl border border-rose-100">
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic mt-1">Không phát hiện xu hướng giảm nghiêm trọng.</p>
              )}
            </div>

            {/* Deficit roles */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                <Briefcase size={12} className="mr-1" />
                Chức danh cần lập phương án giữ chân (Attrition Risk)
              </span>
              {insights.negativeTrendRoles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {insights.negativeTrendRoles.map((r) => (
                    <span key={r} className="text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1 rounded-xl border border-amber-100">
                      {r}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic mt-1">Các vai trò đều ở mức ổn định.</p>
              )}
            </div>
          </div>
        </div>

        {/* License renewal & Data cleanups */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
          <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center mb-4">
            <Sparkles size={16} className="text-hospital-600 mr-2" />
            Khuyến nghị Hành chính & Dữ liệu
          </h4>

          <div className="space-y-4">
            {/* License follow-ups */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Nhân sự lâm sàng cần làm hồ sơ gia hạn CCHN gấp ({licensesNeedingRenewal.length} NV)
              </span>
              {licensesNeedingRenewal.length > 0 ? (
                <div className="mt-2 max-h-24 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                  {licensesNeedingRenewal.map((emp) => (
                    <div key={emp.employeeId} className="p-2 text-[10px] flex justify-between font-bold text-slate-600">
                      <span>{emp.fullName} ({emp.department})</span>
                      <span className="text-rose-600 bg-rose-50 px-1 rounded">
                        {emp.licenseExpiryDate ? formatDateDisplay(emp.licenseExpiryDate) : 'Thiếu thông tin'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic mt-1">Không có nhân viên lâm sàng nào sắp/hết hạn CCHN.</p>
              )}
            </div>

            {/* Data quality cleanup */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Khoa cần rà soát bổ sung sạch dữ liệu (Data Cleanup)
              </span>
              {deptsNeedingCleanup.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {deptsNeedingCleanup.map((item) => (
                    <div key={item.name} className="p-2 border border-slate-100 rounded-xl bg-slate-50 text-[10px] font-bold text-slate-600 flex justify-between">
                      <span className="truncate max-w-[100px]">{item.name}</span>
                      <span className="text-amber-600 bg-amber-50 px-1 rounded">{item.pct.toFixed(0)}% thiếu</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic mt-1">Tuyệt vời! Dữ liệu hồ sơ các khoa đều đầy đủ.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
