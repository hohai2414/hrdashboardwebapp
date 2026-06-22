import React, { useMemo } from 'react';
import {
  Users,
  TrendingUp,
  UserPlus,
  UserMinus,
  Briefcase,
  Stethoscope,
  Activity,
  AlertTriangle,
  Award,
  ChevronRight,
  TrendingDown,
  Building
} from 'lucide-react';
import { SnapshotData, FilterState, MovementRecord } from '../types/hr';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { calculateExecutiveKpis, isClinicalGroup } from '../utils/metrics';
import { removeVietnameseTones } from '../utils/columnMapper';
import { getEmployeeMovementStatus, analyzeMovement } from '../utils/movementAnalyzer';
import { formatDateDisplay } from '../utils/dateUtils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ExecutiveOverviewProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
  filteredEmployees: any[];
  allMovements: MovementRecord[];
  filters: FilterState;
}

const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#ec4899'];

export default function ExecutiveOverview({
  snapshots,
  selectedSnapshotIdx,
  filteredEmployees,
  allMovements,
  filters,
}: ExecutiveOverviewProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];
  const previousSnapshot = selectedSnapshotIdx > 0 ? snapshots[selectedSnapshotIdx - 1] : null;

  // 1. Calculate executive KPIs for the selected snapshot
  const kpis = useMemo(() => {
    // We compute KPIs on filtered employees in current snapshot, or overall current snapshot
    // The KPI card calculates standard summaries. Let's make sure it represents the filtered set if department filter is active, or the whole snapshot.
    // Let's compute based on the filtered list of employees to make it reactive!
    const activeSnapshotMovements = previousSnapshot
      ? analyzeMovement(
          currentSnapshot.employees,
          previousSnapshot.employees,
          currentSnapshot.snapshotDate,
          previousSnapshot.snapshotDate
        )
      : [];

    return calculateExecutiveKpis(
      { ...currentSnapshot, employees: filteredEmployees },
      previousSnapshot
        ? {
            ...previousSnapshot,
            // If filters other than snapshot date are set, we filter the previous snapshot too to keep rates consistent!
            employees: previousSnapshot.employees.filter((emp) => {
              if (filters.department && emp.department !== filters.department) return false;
              if (filters.professionalGroup && emp.professionalGroup !== filters.professionalGroup) return false;
              if (filters.jobTitle && emp.jobTitle !== filters.jobTitle) return false;
              if (filters.gender && emp.gender !== filters.gender) return false;
              if (filters.employmentStatus && emp.employmentStatus !== filters.employmentStatus) return false;
              if (filters.qualificationLevel && emp.qualification !== filters.qualificationLevel) return false;
              return true;
            }),
          }
        : null,
      activeSnapshotMovements.filter((m) => {
        if (m.movementType === 'Exit') {
          const pe = previousSnapshot?.employees.find(e => e.employeeId === m.employeeId);
          if (!pe) return false;
          if (filters.department && pe.department !== filters.department) return false;
          if (filters.professionalGroup && pe.professionalGroup !== filters.professionalGroup) return false;
          if (filters.jobTitle && pe.jobTitle !== filters.jobTitle) return false;
          if (filters.gender && pe.gender !== filters.gender) return false;
          if (filters.employmentStatus && pe.employmentStatus !== filters.employmentStatus) return false;
          if (filters.qualificationLevel && pe.qualification !== filters.qualificationLevel) return false;
          return true;
        }
        return filteredEmployees.some((fe) => fe.employeeId === m.employeeId);
      })
    );
  }, [currentSnapshot, previousSnapshot, filteredEmployees, filters]);

  // 2. Trend data by snapshot (reactive to global filters)
  const snapshotTrends = useMemo(() => {
    return snapshots.map((snap, idx) => {
      // Filter employees in this snapshot based on active filters
      const snapEmps = snap.employees.filter((emp) => {
        if (filters.department && emp.department !== filters.department) return false;
        if (filters.professionalGroup && emp.professionalGroup !== filters.professionalGroup) return false;
        if (filters.jobTitle && emp.jobTitle !== filters.jobTitle) return false;
        if (filters.gender && emp.gender !== filters.gender) return false;
        if (filters.employmentStatus && emp.employmentStatus !== filters.employmentStatus) return false;
        if (filters.qualificationLevel && emp.qualification !== filters.qualificationLevel) return false;
        return true;
      });

      // Calculate hires/exits for this snapshot
      let hires = 0;
      let exits = 0;
      if (idx > 0) {
        const prevSnap = snapshots[idx - 1];
        const prevEmpsIds = new Set(prevSnap.employees.map((e) => e.employeeId).filter(Boolean));
        const currEmpsIds = new Set(snap.employees.map((e) => e.employeeId).filter(Boolean));

        // Hires: in current filtered and not in previous
        snapEmps.forEach((e) => {
          if (e.employeeId && !prevEmpsIds.has(e.employeeId)) hires++;
        });
        
        // Exits: in previous and not in current (matching filters)
        prevSnap.employees.forEach((e) => {
          // Check if employee matches the filter in previous snapshot
          const matchesFilter =
            (!filters.department || e.department === filters.department) &&
            (!filters.professionalGroup || e.professionalGroup === filters.professionalGroup) &&
            (!filters.jobTitle || e.jobTitle === filters.jobTitle) &&
            (!filters.gender || e.gender === filters.gender) &&
            (!filters.employmentStatus || e.employmentStatus === filters.employmentStatus) &&
            (!filters.qualificationLevel || e.qualification === filters.qualificationLevel);

          if (matchesFilter && e.employeeId && !currEmpsIds.has(e.employeeId)) exits++;
        });
      }

      return {
        name: formatDateDisplay(snap.snapshotDate),
        'Nhân sự': snapEmps.length,
        'Tuyển mới': hires,
        'Nghỉ việc': exits,
      };
    });
  }, [snapshots, filters]);

  // 3. Breakdown data: Professional groups (grouped into standard categories)
  const groupData = useMemo(() => {
    const getStandardGroup = (rawGroup: string): string => {
      if (!rawGroup) return 'Khác';
      const group = removeVietnameseTones(rawGroup).toLowerCase().trim();
      const words = group.split(/[^a-z0-9]+/);
      
      if (group.includes('bac si') || group.includes('bac sy') || group.includes('doctor') || words.includes('bs')) {
        return 'Bác sĩ';
      } else if (group.includes('dieu duong') || group.includes('nurse') || words.includes('dd')) {
        return 'Điều dưỡng';
      } else if (group.includes('ky thuat vien') || group.includes('technician') || words.includes('ktv')) {
        return 'Kỹ thuật viên';
      } else if (group.includes('duoc si') || group.includes('duoc sy') || group.includes('pharmacist') || words.includes('ds')) {
        return 'Dược sĩ';
      } else if (group.includes('ho sinh') || group.includes('midwife') || words.includes('hs')) {
        return 'Hộ sinh';
      } else if (
        group.includes('hanh chinh') ||
        group.includes('support') ||
        group.includes('admin') ||
        words.includes('hc') ||
        words.includes('vp')
      ) {
        return 'Hành chính / Hỗ trợ';
      }
      return 'Khác';
    };

    const counts: Record<string, number> = {
      'Bác sĩ': 0,
      'Điều dưỡng': 0,
      'Kỹ thuật viên': 0,
      'Dược sĩ': 0,
      'Hộ sinh': 0,
      'Hành chính / Hỗ trợ': 0,
      'Khác': 0,
    };
    
    filteredEmployees.forEach((emp) => {
      const std = getStandardGroup(emp.professionalGroup);
      counts[std] = (counts[std] || 0) + 1;
    });
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredEmployees]);

  // 4. Breakdown data: Departments (Top 8 by headcount)
  const deptData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEmployees.forEach((emp) => {
      const d = emp.department || 'Chưa phân loại';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredEmployees]);

  // 5. Gender data
  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEmployees.forEach((emp) => {
      const g = emp.gender || 'Khác';
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredEmployees]);

  // 6. Clinical vs Non-Clinical
  const clinicalSplitData = useMemo(() => {
    let clinical = 0;
    let nonClinical = 0;
    filteredEmployees.forEach((emp) => {
      if (isClinicalGroup(emp.professionalGroup)) {
        clinical++;
      } else {
        nonClinical++;
      }
    });
    return [
      { name: 'Lâm sàng / Chuyên môn', value: clinical },
      { name: 'Hành chính / Hỗ trợ', value: nonClinical },
    ];
  }, [filteredEmployees]);

  // 7. Dynamic strategic insights
  const insights = useMemo(() => {
    const list: Array<{ type: 'growth' | 'decline' | 'exit' | 'risk' | 'info'; text: string }> = [];

    if (snapshots.length >= 2 && selectedSnapshotIdx > 0) {
      // Find department shifts
      const prevDeptCounts: Record<string, number> = {};
      const currDeptCounts: Record<string, number> = {};
      
      previousSnapshot?.employees.forEach((e) => {
        if (e.department) prevDeptCounts[e.department] = (prevDeptCounts[e.department] || 0) + 1;
      });
      currentSnapshot.employees.forEach((e) => {
        if (e.department) currDeptCounts[e.department] = (currDeptCounts[e.department] || 0) + 1;
      });

      const deptDeltas = Object.keys({ ...prevDeptCounts, ...currDeptCounts }).map((dept) => {
        const prev = prevDeptCounts[dept] || 0;
        const curr = currDeptCounts[dept] || 0;
        return { dept, delta: curr - prev, prev, curr };
      });

      const growth = [...deptDeltas].sort((a, b) => b.delta - a.delta).filter((d) => d.delta > 0);
      const decline = [...deptDeltas].sort((a, b) => a.delta - b.delta).filter((d) => d.delta < 0);

      if (growth.length > 0) {
        list.push({
          type: 'growth',
          text: `Khoa tăng trưởng nhanh nhất: **${growth[0].dept}** (Tăng +${growth[0].delta} nhân sự, đạt quy mô ${growth[0].curr}).`,
        });
      }
      if (decline.length > 0) {
        list.push({
          type: 'decline',
          text: `Khoa giảm nhân sự nhiều nhất: **${decline[0].dept}** (Giảm ${decline[0].delta} nhân sự, còn lại ${decline[0].curr}).`,
        });
      }

      // Check for high exits in current period
      const exitsByDept: Record<string, number> = {};
      allMovements
        .filter((m) => m.currentSnapshot === currentSnapshot.snapshotDate && m.movementType === 'Exit')
        .forEach((m) => {
          if (m.previousDepartment) {
            exitsByDept[m.previousDepartment] = (exitsByDept[m.previousDepartment] || 0) + 1;
          }
        });
      const topExitsDept = Object.entries(exitsByDept).sort((a, b) => b[1] - a[1])[0];
      if (topExitsDept && topExitsDept[1] > 0) {
        list.push({
          type: 'exit',
          text: `Khoa có tỷ lệ nghỉ việc cao nhất: **${topExitsDept[0]}** với **${topExitsDept[1]} nhân sự nghỉ việc** trong kỳ này.`,
        });
      }
    }

    // Licencing warnings
    const missingLic = filteredEmployees.filter(
      (e) => isClinicalGroup(e.professionalGroup) && (!e.licenseNumber || e.licenseNumber.trim() === '')
    ).length;
    if (missingLic > 0) {
      list.push({
        type: 'risk',
        text: `Rủi ro pháp lý: Phát hiện **${missingLic} nhân sự lâm sàng** chưa cập nhật thông tin Chứng chỉ hành nghề (CCHN).`,
      });
    }

    // Missing qualification info
    const missingQual = filteredEmployees.filter((e) => !e.qualification || e.qualification.trim() === '').length;
    if (missingQual > 0) {
      list.push({
        type: 'info',
        text: `Hồ sơ nhân sự: **${missingQual} nhân viên** đang thiếu dữ liệu trình độ chuyên môn hoặc bằng cấp.`,
      });
    }

    return list;
  }, [snapshots, selectedSnapshotIdx, currentSnapshot, previousSnapshot, filteredEmployees, allMovements]);

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Tổng nhân sự (Headcount)"
          value={kpis.totalHeadcount}
          icon={Users}
          change={kpis.headcountChange}
          subtext="Số nhân sự hiện tại trong kỳ"
          color="primary"
        />
        <KpiCard
          title="Tuyển mới trong kỳ"
          value={kpis.newHires}
          icon={UserPlus}
          change={kpis.newHireRate}
          changeType="percentage"
          subtext="Nhân sự gia nhập mới"
          color="success"
        />
        <KpiCard
          title="Nghỉ việc trong kỳ"
          value={kpis.exits}
          icon={UserMinus}
          change={kpis.attritionRate}
          changeType="percentage"
          subtext="Nhân sự rời bệnh viện"
          color="danger"
        />
        <KpiCard
          title="Thay đổi ròng (Net change)"
          value={kpis.netChange >= 0 ? `+${kpis.netChange}` : kpis.netChange}
          icon={TrendingUp}
          subtext="Biến động ròng tuyển mới - nghỉ"
          color={kpis.netChange >= 0 ? 'success' : 'danger'}
        />
        <KpiCard
          title="Tỷ lệ hao hụt (Attrition)"
          value={`${kpis.attritionRate.toFixed(1)}%`}
          icon={Activity}
          subtext="Phần trăm nghỉ việc / tổng NV"
          color="warning"
        />
        <KpiCard
          title="Khối Lâm sàng"
          value={kpis.clinicalCount}
          icon={Stethoscope}
          subtext={`Bác sĩ, ĐD, KTV, HS (${Math.round((kpis.clinicalCount / (kpis.totalHeadcount || 1)) * 100)}%)`}
          color="info"
        />
        <KpiCard
          title="Hành chính / Quản trị"
          value={kpis.adminSupportCount}
          icon={Briefcase}
          subtext={`Văn phòng, IT, Kế toán, Bảo vệ`}
          color="gray"
        />
        <KpiCard
          title="Tỷ lệ Cấp CCHN lâm sàng"
          value={`${kpis.pctLicensedClinical.toFixed(1)}%`}
          icon={Award}
          change={kpis.pctMissingLicense > 0 ? -kpis.pctMissingLicense : 0}
          changeType="percentage"
          subtext={`${kpis.pctMissingLicense.toFixed(1)}% thiếu dữ liệu CCHN`}
          color={kpis.pctLicensedClinical > 90 ? 'success' : kpis.pctLicensedClinical > 70 ? 'warning' : 'danger'}
        />
      </div>

      {/* Chart Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Headcount Trend */}
        <ChartCard
          title="Biến động tổng nhân lực qua các snapshot"
          subtitle="Biểu diễn xu hướng tăng/giảm quy mô nhân sự bệnh viện theo thời gian"
          isEmpty={snapshotTrends.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={snapshotTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }} />
              <Line type="monotone" dataKey="Nhân sự" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bar Chart: Hires vs Exits */}
        <ChartCard
          title="Tuyển mới vs Nghỉ việc từng Snapshot"
          subtitle="So sánh số lượng nhân sự vào và ra để đánh giá mức độ biến động"
          isEmpty={snapshotTrends.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={snapshotTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Tuyển mới" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Nghỉ việc" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Second Row Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pie: Professional Group Composition */}
        <ChartCard
          title="Phân bố theo Nhóm Chức danh nghề nghiệp"
          subtitle="Cơ cấu nhân sự theo chuyên môn công việc"
          isEmpty={groupData.length === 0}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={groupData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {groupData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend
                wrapperStyle={{ fontSize: 9 }}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
              />
              <text
                x="50%"
                y="43%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-700 font-extrabold text-xs"
              >
                Cơ cấu
              </text>
              <text
                x="50%"
                y="51%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-400 font-bold text-[9px] uppercase tracking-wider"
              >
                Nhân sự
              </text>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bar: Headcount by Department */}
        <ChartCard
          title="Top 8 Khoa/ phòng cụ thể đông nhân sự nhất"
          subtitle="Quy mô nhân sự theo từng đơn vị trong bệnh viện"
          isEmpty={deptData.length === 0}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#64748b"
                fontSize={9}
                tickLine={false}
                width={140}
                tickFormatter={(value) => (value.length > 25 ? `${value.substring(0, 25)}...` : value)}
              />
              <Tooltip contentStyle={{ fontSize: 10 }} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Split: Clinical vs Non-Clinical & Gender */}
        <ChartCard
          title="Đặc điểm lâm sàng & Phái"
          subtitle="Cơ cấu chuyên môn và phân bố phái của nhân lực"
          isEmpty={filteredEmployees.length === 0}
        >
          <div className="flex justify-around items-center h-full pt-2">
            {/* Clinical Split */}
            <div className="flex flex-col items-center">
              <ResponsiveContainer width={100} height={120}>
                <PieChart>
                  <Pie data={clinicalSplitData} cx="50%" cy="50%" outerRadius={40} dataKey="value">
                    <Cell fill="#06b6d4" />
                    <Cell fill="#cbd5e1" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <span className="text-[10px] font-bold text-slate-500 mt-1">Khối chuyên môn</span>
              <span className="text-[9px] text-slate-400">
                {kpis.clinicalCount} / {kpis.nonClinicalCount}
              </span>
            </div>

            {/* Gender Split */}
            <div className="flex flex-col items-center">
              <ResponsiveContainer width={100} height={120}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" outerRadius={40} dataKey="value">
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <span className="text-[10px] font-bold text-slate-500 mt-1">Phân bố Phái</span>
              <span className="text-[9px] text-slate-400">
                {genderData.map((d) => `${d.name}: ${d.value}`).join(' | ')}
              </span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Strategic Insights Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-4 flex items-center">
          <Activity size={16} className="text-hospital-600 mr-2" />
          Nhận định và cảnh báo nhân sự chiến lược (Strategic Insights)
        </h4>

        {insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, idx) => {
              let alertBg = 'bg-slate-50 border-slate-100 text-slate-700';
              let Icon = ChevronRight;

              if (insight.type === 'growth') {
                alertBg = 'bg-emerald-50/50 border-emerald-100 text-emerald-800';
                Icon = TrendingUp;
              } else if (insight.type === 'decline') {
                alertBg = 'bg-amber-50/50 border-amber-100 text-amber-800';
                Icon = TrendingDown;
              } else if (insight.type === 'exit') {
                alertBg = 'bg-rose-50/50 border-rose-100 text-rose-800';
                Icon = UserMinus;
              } else if (insight.type === 'risk') {
                alertBg = 'bg-red-50 border-red-150 text-red-800';
                Icon = AlertTriangle;
              } else if (insight.type === 'info') {
                alertBg = 'bg-blue-50/50 border-blue-100 text-blue-800';
                Icon = Award;
              }

              return (
                <div
                  key={idx}
                  className={`p-3.5 border rounded-xl flex items-start space-x-3 text-xs leading-relaxed ${alertBg}`}
                >
                  <div className="mt-0.5">
                    <Icon size={16} />
                  </div>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: insight.text
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">
            Chưa phát hiện biến động hoặc rủi ro đặc biệt nào trong snapshot này.
          </div>
        )}
      </div>
    </div>
  );
}
