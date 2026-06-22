import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Users, Award, ShieldAlert, ArrowLeftRight } from 'lucide-react';
import { SnapshotData, FilterState, EmployeeRecord } from '../types/hr';
import { filterEmployeeList } from '../components/FilterBar';
import { classifyDepartmentBlock, getBlockDisplayName } from '../utils/departmentClassifier';
import { isClinicalGroup, getLicenseStatus } from '../utils/metrics';
import { analyzeMovement, getEmployeeMovementStatus } from '../utils/movementAnalyzer';
import { formatDateDisplay } from '../utils/dateUtils';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DepartmentDrilldownProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function DepartmentDrilldown({
  snapshots,
  selectedSnapshotIdx,
  filters,
  setFilters,
}: DepartmentDrilldownProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];
  const previousSnapshot = selectedSnapshotIdx > 0 ? snapshots[selectedSnapshotIdx - 1] : null;

  // List of all departments
  const departmentList = useMemo(() => {
    const list = new Set<string>();
    snapshots.forEach((snap) => {
      snap.employees.forEach((emp) => {
        if (emp.department) list.add(emp.department);
      });
    });
    return Array.from(list).sort();
  }, [snapshots]);

  // Selected department (use global filter department if selected, otherwise fallback to local select)
  const [selectedDept, setSelectedDept] = useState<string>('');

  useEffect(() => {
    if (filters.department) {
      setSelectedDept(filters.department);
    } else if (departmentList.length > 0 && !selectedDept) {
      setSelectedDept(departmentList[0]);
    }
  }, [filters.department, departmentList]);

  const handleDeptSelect = (dept: string) => {
    setSelectedDept(dept);
    // Sync to global filter
    setFilters((prev) => ({ ...prev, department: dept }));
  };

  // 1. Current snapshot employees in this department (including exited ones for reference)
  const departmentEmployees = useMemo(() => {
    if (!selectedDept) return [];
    
    // Normal roster
    const active = currentSnapshot.employees.filter((emp) => emp.department === selectedDept);
    
    // Check if we have movement to identify EXITS (in previous snap under this department, but gone now)
    const exits: EmployeeRecord[] = [];
    if (previousSnapshot) {
      const currentIds = new Set(currentSnapshot.employees.map((e) => e.employeeId));
      previousSnapshot.employees.forEach((emp) => {
        if (emp.department === selectedDept && emp.employeeId && !currentIds.has(emp.employeeId)) {
          exits.push({
            ...emp,
            employmentStatus: 'Đã nghỉ việc',
            snapshotDate: currentSnapshot.snapshotDate, // Bind to current snapshot for table context
          });
        }
      });
    }

    const filteredActive = filterEmployeeList(active, { ...filters, department: selectedDept });
    const filteredExits = filterEmployeeList(exits, { ...filters, department: selectedDept });

    return [...filteredActive, ...filteredExits];
  }, [currentSnapshot, previousSnapshot, selectedDept, filters]);

  // Calculate movements specifically for this department
  const deptMovements = useMemo(() => {
    if (!previousSnapshot) return [];
    return analyzeMovement(
      currentSnapshot.employees,
      previousSnapshot.employees,
      currentSnapshot.snapshotDate,
      previousSnapshot.snapshotDate
    );
  }, [currentSnapshot, previousSnapshot]);

  // 2. Trend data for this department across all snapshots
  const departmentTrends = useMemo(() => {
    if (!selectedDept) return [];
    return snapshots.map((snap, idx) => {
      const snapEmps = snap.employees.filter((emp) => emp.department === selectedDept);
      
      let hires = 0;
      let exits = 0;
      if (idx > 0) {
        const prevSnap = snapshots[idx - 1];
        const prevEmpsIds = new Set(prevSnap.employees.map((e) => e.employeeId).filter(Boolean));
        const currEmpsIds = new Set(snap.employees.map((e) => e.employeeId).filter(Boolean));

        snapEmps.forEach((e) => {
          if (e.employeeId && !prevEmpsIds.has(e.employeeId)) hires++;
        });

        prevSnap.employees.forEach((e) => {
          if (e.department === selectedDept && e.employeeId && !currEmpsIds.has(e.employeeId)) exits++;
        });
      }

      return {
        name: formatDateDisplay(snap.snapshotDate),
        'Nhân sự': snapEmps.length,
        'Tuyển mới': hires,
        'Nghỉ việc': exits,
      };
    });
  }, [snapshots, selectedDept]);

  // 3. Breakdown data: Professional group composition
  const groupComposition = useMemo(() => {
    const counts: Record<string, number> = {};
    departmentEmployees.forEach((emp) => {
      if (emp.employmentStatus === 'Đã nghỉ việc') return; // Exclude exits
      const g = emp.professionalGroup || 'Khác';
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [departmentEmployees]);

  // 4. Breakdown data: Qualification Mix
  const qualificationMix = useMemo(() => {
    const counts: Record<string, number> = {};
    departmentEmployees.forEach((emp) => {
      if (emp.employmentStatus === 'Đã nghỉ việc') return;
      const q = emp.qualification || 'Chưa cập nhật';
      counts[q] = (counts[q] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [departmentEmployees]);

  // 5. Breakdown data: License status
  const licenseStatusData = useMemo(() => {
    let valid = 0, expired = 0, expiring = 0, missing = 0, na = 0;
    departmentEmployees.forEach((emp) => {
      if (emp.employmentStatus === 'Đã nghỉ việc') return;
      const status = getLicenseStatus(emp, currentSnapshot.snapshotDate);
      if (status === 'Valid') valid++;
      else if (status === 'Expired') expired++;
      else if (status === 'Expiring Soon') expiring++;
      else if (status === 'Missing') missing++;
      else na++;
    });

    return [
      { name: 'Hợp lệ (Valid)', value: valid, color: '#10b981' },
      { name: 'Sắp hết hạn (90 ngày)', value: expiring, color: '#f59e0b' },
      { name: 'Hết hạn (Expired)', value: expired, color: '#ef4444' },
      { name: 'Thiếu CCHN (Missing)', value: missing, color: '#64748b' },
    ].filter((item) => item.value > 0);
  }, [departmentEmployees, currentSnapshot]);

  // 6. Map table rows with detailed movement details
  const tableRows = useMemo(() => {
    return departmentEmployees.map((emp) => {
      // Find employee movement type in this period
      let movementType: string = 'Đang làm việc';
      if (emp.employmentStatus === 'Đã nghỉ việc') {
        movementType = 'Nghỉ việc';
      } else {
        const move = deptMovements.find((m) => m.employeeId === emp.employeeId);
        if (move) {
          if (move.movementType === 'New Hire') {
            movementType = 'Tuyển mới';
          } else if (move.movementType === 'Transfer') {
            if (move.currentDepartment === selectedDept && move.previousDepartment !== selectedDept) {
              movementType = 'Điều chuyển đến';
            } else if (move.previousDepartment === selectedDept && move.currentDepartment !== selectedDept) {
              movementType = 'Điều chuyển đi'; // Should not happen since we filtered active
            } else {
              movementType = 'Thay đổi bộ phận';
            }
          } else if (move.movementType === 'Role Change') {
            movementType = 'Thay đổi chức danh';
          }
        }
      }

      const licStatus = getLicenseStatus(emp, currentSnapshot.snapshotDate);

      return {
        ...emp,
        licenseStatus: licStatus,
        movementType,
      };
    });
  }, [departmentEmployees, deptMovements, selectedDept, currentSnapshot]);

  // Columns for DataTable
  const tableColumns = [
    { key: 'employeeId', header: 'Mã NV', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'gender', header: 'GT' },
    { key: 'jobTitle', header: 'Chức danh', sortable: true },
    { key: 'professionalGroup', header: 'Nhóm chuyên môn', sortable: true },
    { key: 'qualification', header: 'Trình độ' },
    { key: 'major', header: 'Chuyên ngành' },
    {
      key: 'licenseNumber',
      header: 'Số CCHN',
      render: (row: any) =>
        row.licenseNumber ? (
          <span className="text-hospital-700 font-bold">{row.licenseNumber}</span>
        ) : isClinicalGroup(row.professionalGroup) ? (
          <span className="text-rose-600 font-semibold italic">Thiếu CCHN</span>
        ) : (
          <span className="text-slate-400 italic">Không yêu cầu</span>
        ),
    },
    {
      key: 'licenseStatus',
      header: 'Trạng thái CCHN',
      render: (row: any) => {
        const badges = {
          Valid: 'bg-emerald-100 text-emerald-800',
          Expired: 'bg-rose-100 text-rose-800',
          'Expiring Soon': 'bg-amber-100 text-amber-800',
          Missing: 'bg-slate-100 text-slate-700',
          'Not Applicable': 'bg-slate-50 text-slate-400',
        };
        const label = {
          Valid: 'Hợp lệ',
          Expired: 'Hết hạn',
          'Expiring Soon': 'Sắp hết hạn',
          Missing: 'Chưa khai báo',
          'Not Applicable': 'Không áp dụng',
        };
        const status = row.licenseStatus as keyof typeof badges;
        return (
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${badges[status] || badges.Missing}`}>
            {label[status] || 'Chưa khai báo'}
          </span>
        );
      },
    },
    {
      key: 'movementType',
      header: 'Trạng thái Biến động',
      render: (row: any) => {
        let badgeColor = 'bg-slate-100 text-slate-700';
        if (row.movementType === 'Tuyển mới') badgeColor = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        else if (row.movementType === 'Nghỉ việc') badgeColor = 'bg-rose-100 text-rose-800 border border-rose-200';
        else if (row.movementType.includes('Điều chuyển')) badgeColor = 'bg-sky-100 text-sky-800 border border-sky-200';
        else if (row.movementType.includes('chức danh')) badgeColor = 'bg-violet-100 text-violet-800 border border-violet-200';

        return (
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${badgeColor}`}>
            {row.movementType}
          </span>
        );
      },
    },
  ];

  if (departmentList.length === 0) {
    return (
      <div className="text-center p-12 bg-white border rounded-2xl">
        <p className="text-slate-400">Không tìm thấy Khoa/ phòng cụ thể nào trong dữ liệu.</p>
      </div>
    );
  }

  const selectedBlock = classifyDepartmentBlock(selectedDept);

  return (
    <div className="space-y-6">
      {/* Department Selector Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-hospital-50 text-hospital-600 rounded-2xl">
            <Building2 size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Chi tiết nhân sự theo Khoa/ phòng cụ thể</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Phân tích sâu cơ cấu, biến động và tuân thủ hồ sơ chuyên môn của từng đơn vị
            </p>
          </div>
        </div>

        {/* Dropdown Select */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Chọn khoa:</span>
          <select
            value={selectedDept}
            onChange={(e) => handleDeptSelect(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500 font-bold text-slate-700 min-w-[200px]"
          >
            {departmentList.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Department Profile Box */}
      {selectedDept && (
        <div className="bg-gradient-to-r from-hospital-900 to-hospital-950 text-white rounded-2xl p-5 shadow-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[9px] bg-hospital-800 text-hospital-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {getBlockDisplayName(selectedBlock)}
            </span>
            <h2 className="text-xl font-black mt-1.5">{selectedDept}</h2>
          </div>

          <div className="flex items-center space-x-6 text-center">
            <div className="px-4 py-1.5 bg-white/10 rounded-xl border border-white/10">
              <span className="text-[9px] text-hospital-200 uppercase font-bold block">Tổng nhân lực</span>
              <span className="text-lg font-black">{departmentEmployees.filter((e) => e.employmentStatus !== 'Đã nghỉ việc').length}</span>
            </div>
            <div className="px-4 py-1.5 bg-white/10 rounded-xl border border-white/10">
              <span className="text-[9px] text-hospital-200 uppercase font-bold block">Tỷ lệ CCHN</span>
              <span className="text-lg font-black">
                {Math.round(
                  licenseStatusData.find((item) => item.name.includes('Hợp lệ'))?.value || 0
                ) + 
                Math.round(
                  licenseStatusData.find((item) => item.name.includes('Sắp hết hạn'))?.value || 0
                )}
                {/* Simplified displays in lists */}
                {departmentEmployees.filter((e) => isClinicalGroup(e.professionalGroup) && e.employmentStatus !== 'Đã nghỉ việc').length > 0 ? '' : '100%'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Row of Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={`Xu hướng headcount - ${selectedDept}`}
          subtitle="Tổng số nhân lực tại mỗi snapshot thời gian"
          isEmpty={departmentTrends.length === 0}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={departmentTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="Nhân sự" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`Tuyển mới & Nghỉ việc - ${selectedDept}`}
          subtitle="Lịch sử luân chuyển ra vào của khoa"
          isEmpty={departmentTrends.length === 0}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={departmentTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="Tuyển mới" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Nghỉ việc" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Breakdown Mix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Professional groups bar chart */}
        <ChartCard
          title="Nhóm nghề nghiệp trong khoa"
          isEmpty={groupComposition.length === 0}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={groupComposition} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[3, 3, 0, 0]} barSize={15} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Qualification pie chart */}
        <ChartCard
          title="Cơ cấu trình độ học vấn"
          isEmpty={qualificationMix.length === 0}
        >
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={qualificationMix}
                cx="50%"
                cy="50%"
                outerRadius={65}
                dataKey="value"
              >
                {qualificationMix.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* License status donut chart */}
        <ChartCard
          title="Chứng chỉ hành nghề"
          isEmpty={licenseStatusData.length === 0}
        >
          {licenseStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={licenseStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={68}
                  dataKey="value"
                >
                  {licenseStatusData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs italic">
              Khoa không có nhân sự lâm sàng bắt buộc CCHN.
            </div>
          )}
        </ChartCard>
      </div>

      {/* Roster Table of Selected Department */}
      <div>
        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
          Danh sách chi tiết nhân sự khoa: {selectedDept} ({tableRows.length} bản ghi)
        </h4>
        <DataTable
          data={tableRows}
          columns={tableColumns}
          searchPlaceholder="Tìm kiếm nhân viên trong khoa..."
          searchField="fullName"
          exportFilename={`danh_sach_nhan_vien_${selectedDept}`}
        />
      </div>
    </div>
  );
}
