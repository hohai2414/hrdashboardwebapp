import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  UserPlus,
  UserMinus,
  Briefcase,
  TrendingUp,
  Activity,
  FileText,
  UserCheck
} from 'lucide-react';
import { SnapshotData, FilterState, MovementRecord } from '../types/hr';
import { analyzeMovement } from '../utils/movementAnalyzer';
import { formatDateDisplay } from '../utils/dateUtils';
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
  LineChart,
  Line
} from 'recharts';

interface WorkforceMovementProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
  allMovements: MovementRecord[];
}

export default function WorkforceMovement({
  snapshots,
  selectedSnapshotIdx,
  allMovements,
}: WorkforceMovementProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];
  const previousSnapshot = selectedSnapshotIdx > 0 ? snapshots[selectedSnapshotIdx - 1] : null;

  const [activeTab, setActiveTab] = useState<'hires' | 'exits' | 'transfers' | 'roles'>('hires');

  // 1. Calculate movements specifically for the current snapshot compared to previous
  const activeMovements = useMemo(() => {
    if (!previousSnapshot) return [];
    return analyzeMovement(
      currentSnapshot.employees,
      previousSnapshot.employees,
      currentSnapshot.snapshotDate,
      previousSnapshot.snapshotDate
    );
  }, [currentSnapshot, previousSnapshot]);

  // Lists filtered by type
  const hiresList = useMemo(() => activeMovements.filter((m) => m.movementType === 'New Hire'), [activeMovements]);
  const exitsList = useMemo(() => activeMovements.filter((m) => m.movementType === 'Exit'), [activeMovements]);
  const transfersList = useMemo(() => activeMovements.filter((m) => m.movementType === 'Transfer'), [activeMovements]);
  const roleChangesList = useMemo(() => activeMovements.filter((m) => m.movementType === 'Role Change'), [activeMovements]);

  // 2. Headcount rates & KPI values
  const prevCount = previousSnapshot ? previousSnapshot.employees.length : 0;
  const hiresCount = hiresList.length;
  const exitsCount = exitsList.length;
  const transfersCount = transfersList.length;
  const rolesCount = roleChangesList.length;
  
  const hiringRate = prevCount > 0 ? (hiresCount / prevCount) * 100 : 0;
  const attritionRate = prevCount > 0 ? (exitsCount / prevCount) * 105 / 100 : 0; // standard calculation
  const netChange = hiresCount - exitsCount;

  // 3. Historical net changes
  const netChangeHistory = useMemo(() => {
    return snapshots.map((snap, idx) => {
      if (idx === 0) {
        return { name: formatDateDisplay(snap.snapshotDate), 'Biến động ròng': 0 };
      }
      
      const prev = snapshots[idx - 1];
      const moves = analyzeMovement(snap.employees, prev.employees, snap.snapshotDate, prev.snapshotDate);
      
      const hires = moves.filter((m) => m.movementType === 'New Hire').length;
      const exits = moves.filter((m) => m.movementType === 'Exit').length;
      
      return {
        name: formatDateDisplay(snap.snapshotDate),
        'Biến động ròng': hires - exits,
      };
    });
  }, [snapshots]);

  // 4. Movement by Department
  const deptMovementsData = useMemo(() => {
    const counts: Record<string, { dept: string; Hires: number; Exits: number }> = {};
    
    // Initialize depts
    currentSnapshot.employees.forEach((e) => {
      if (e.department) {
        counts[e.department] = { dept: e.department, Hires: 0, Exits: 0 };
      }
    });

    hiresList.forEach((m) => {
      if (m.currentDepartment) {
        if (!counts[m.currentDepartment]) {
          counts[m.currentDepartment] = { dept: m.currentDepartment, Hires: 0, Exits: 0 };
        }
        counts[m.currentDepartment].Hires++;
      }
    });

    exitsList.forEach((m) => {
      if (m.previousDepartment) {
        if (!counts[m.previousDepartment]) {
          counts[m.previousDepartment] = { dept: m.previousDepartment, Hires: 0, Exits: 0 };
        }
        counts[m.previousDepartment].Exits++;
      }
    });

    return Object.values(counts)
      .filter((c) => c.Hires > 0 || c.Exits > 0)
      .slice(0, 10);
  }, [hiresList, exitsList, currentSnapshot]);

  // Columns configurations
  const columnsHires = [
    { key: 'employeeId', header: 'Mã NV', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'currentDepartment', header: 'Khoa/ phòng cụ thể bổ nhiệm', sortable: true },
    { key: 'currentJobTitle', header: 'Chức danh', sortable: true },
    {
      key: 'currentSnapshot',
      header: 'Thời điểm tuyển',
      render: (row: any) => formatDateDisplay(row.currentSnapshot),
    },
  ];

  const columnsExits = [
    { key: 'employeeId', header: 'Mã NV', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'previousDepartment', header: 'Khoa/ phòng cụ thể đã làm việc', sortable: true },
    { key: 'previousJobTitle', header: 'Chức danh cũ', sortable: true },
    {
      key: 'currentSnapshot',
      header: 'Thời điểm nghỉ',
      render: (row: any) => formatDateDisplay(row.currentSnapshot),
    },
  ];

  const columnsTransfers = [
    { key: 'employeeId', header: 'Mã NV', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'previousDepartment', header: 'Khoa/ phòng cụ thể cũ', sortable: true },
    { key: 'currentDepartment', header: 'Khoa/ phòng cụ thể mới', sortable: true },
    { key: 'currentJobTitle', header: 'Chức danh', sortable: true },
    {
      key: 'currentSnapshot',
      header: 'Thời điểm điều chuyển',
      render: (row: any) => formatDateDisplay(row.currentSnapshot),
    },
  ];

  const columnsRoles = [
    { key: 'employeeId', header: 'Mã NV', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'currentDepartment', header: 'Khoa/ phòng cụ thể', sortable: true },
    { key: 'previousJobTitle', header: 'Chức danh cũ', sortable: true },
    { key: 'currentJobTitle', header: 'Chức danh mới', sortable: true },
    {
      key: 'currentSnapshot',
      header: 'Thời điểm thay đổi',
      render: (row: any) => formatDateDisplay(row.currentSnapshot),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Tuyển mới (Hires)"
          value={hiresCount}
          icon={UserPlus}
          change={hiringRate}
          changeType="percentage"
          subtext="Nhân viên mới ký hợp đồng"
          color="success"
        />
        <KpiCard
          title="Nghỉ việc (Exits)"
          value={exitsCount}
          icon={UserMinus}
          change={attritionRate}
          changeType="percentage"
          subtext="Nhân viên chấm dứt hợp đồng"
          color="danger"
        />
        <KpiCard
          title="Biến động ròng (Net)"
          value={netChange >= 0 ? `+${netChange}` : netChange}
          icon={TrendingUp}
          subtext="Chênh lệch tuyển mới - nghỉ"
          color={netChange >= 0 ? 'success' : 'danger'}
        />
        <KpiCard
          title="Tỷ lệ luân chuyển nội bộ"
          value={transfersCount}
          icon={ArrowLeftRight}
          subtext="Điều chuyển giữa các Khoa/ phòng cụ thể"
          color="info"
        />
      </div>

      {/* Entry vs Exit charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Biến động ròng lịch sử (Net Change Trend)"
          subtitle="Hiệu số nhân sự (Vào - Ra) qua từng snapshot thời gian"
          isEmpty={netChangeHistory.length === 0}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={netChangeHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Bar dataKey="Biến động ròng" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Cơ cấu biến động theo Khoa/ phòng cụ thể"
          subtitle="Top 10 Khoa/ phòng cụ thể có lượng nhân sự ra vào nhiều nhất kỳ này"
          isEmpty={deptMovementsData.length === 0}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptMovementsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="dept" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="Hires" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Exits" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Transfer Matrix / List Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 mb-6 pb-2 overflow-x-auto space-x-4">
          <button
            onClick={() => setActiveTab('hires')}
            className={`pb-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'hires'
                ? 'border-hospital-600 text-hospital-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserPlus size={14} />
            <span>Danh sách Tuyển mới ({hiresCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('exits')}
            className={`pb-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'exits'
                ? 'border-hospital-600 text-hospital-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserMinus size={14} />
            <span>Danh sách Nghỉ việc ({exitsCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`pb-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'transfers'
                ? 'border-hospital-600 text-hospital-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <ArrowLeftRight size={14} />
            <span>Điều chuyển Khoa/ phòng cụ thể ({transfersCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-2 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'roles'
                ? 'border-hospital-600 text-hospital-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Briefcase size={14} />
            <span>Thay đổi Chức danh ({rolesCount})</span>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'hires' && (
          <DataTable
            data={hiresList}
            columns={columnsHires}
            searchPlaceholder="Tìm kiếm nhân sự mới tuyển..."
            searchField="fullName"
            exportFilename={`tuyen_moi_${currentSnapshot.sheetName}`}
          />
        )}

        {activeTab === 'exits' && (
          <DataTable
            data={exitsList}
            columns={columnsExits}
            searchPlaceholder="Tìm kiếm nhân sự đã nghỉ..."
            searchField="fullName"
            exportFilename={`nghi_viec_${currentSnapshot.sheetName}`}
          />
        )}

        {activeTab === 'transfers' && (
          <DataTable
            data={transfersList}
            columns={columnsTransfers}
            searchPlaceholder="Tìm kiếm nhân sự điều chuyển..."
            searchField="fullName"
            exportFilename={`dieu_chuyen_${currentSnapshot.sheetName}`}
          />
        )}

        {activeTab === 'roles' && (
          <DataTable
            data={roleChangesList}
            columns={columnsRoles}
            searchPlaceholder="Tìm kiếm thay đổi chức danh..."
            searchField="fullName"
            exportFilename={`thay_doi_chuc_danh_${currentSnapshot.sheetName}`}
          />
        )}
      </div>

      {/* Exits transfer detail mapping (Transfer Matrix visualization) */}
      {transfersCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-premium">
          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-4 flex items-center">
            <ArrowLeftRight size={15} className="text-hospital-600 mr-2" />
            Chi tiết luồng luân chuyển Khoa/ phòng cụ thể (Transfer Matrix Detail)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {transfersList.map((m, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between hover-scale">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded shadow-xs border border-slate-100">
                    {m.employeeId}
                  </span>
                  <span className="text-[10px] text-hospital-600 bg-hospital-50 px-2 py-0.5 rounded-full font-bold">
                    Điều chuyển
                  </span>
                </div>
                <p className="text-xs font-black text-slate-800">{m.fullName}</p>
                <p className="text-[10px] text-slate-400 font-semibold mb-2">{m.currentJobTitle}</p>
                <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-600 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded truncate max-w-[100px]">{m.previousDepartment}</span>
                  <span className="text-slate-400">➔</span>
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded truncate max-w-[100px]">{m.currentDepartment}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
