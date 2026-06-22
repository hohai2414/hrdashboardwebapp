import React, { useState, useMemo } from 'react';
import { Network, Building2, Users, Stethoscope, ChevronRight, X, UserCheck, ShieldAlert, Award, Search } from 'lucide-react';
import { SnapshotData, FilterState } from '../types/hr';
import { classifyDepartmentBlock, HospitalBlock, getBlockDisplayName } from '../utils/departmentClassifier';
import { isClinicalGroup, getLicenseStatus } from '../utils/metrics';
import { analyzeMovement } from '../utils/movementAnalyzer';
import DataTable from '../components/DataTable';
import { removeVietnameseTones } from '../utils/columnMapper';

interface OrganizationStructureProps {
  snapshots: SnapshotData[];
  selectedSnapshotIdx: number;
}

export default function OrganizationStructure({ snapshots, selectedSnapshotIdx }: OrganizationStructureProps) {
  const currentSnapshot = snapshots[selectedSnapshotIdx];
  const previousSnapshot = selectedSnapshotIdx > 0 ? snapshots[selectedSnapshotIdx - 1] : null;

  // Search department state
  const [deptSearch, setDeptSearch] = useState('');

  // Selected node in Org chart
  const [selectedNode, setSelectedNode] = useState<{
    type: 'hospital' | 'block' | 'department';
    id: string;
    name: string;
  } | null>({ type: 'hospital', id: 'hospital', name: 'Bệnh viện' });

  // Expanded blocks
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    'Clinical': true,
    'Para-clinical': true,
  });

  // Calculate movement for exits/hires reference
  const periodMovements = useMemo(() => {
    if (!previousSnapshot) return [];
    return analyzeMovement(
      currentSnapshot.employees,
      previousSnapshot.employees,
      currentSnapshot.snapshotDate,
      previousSnapshot.snapshotDate
    );
  }, [currentSnapshot, previousSnapshot]);

  // Group departments by block
  const departmentsByBlock = useMemo(() => {
    const map: Record<HospitalBlock, string[]> = {
      'Clinical': [],
      'Para-clinical': [],
      'Pharmacy': [],
      'Nursing': [],
      'Administrative / Support': [],
      'Other / Unclassified': [],
    };

    const depts = Array.from(new Set(currentSnapshot.employees.map((e) => e.department).filter(Boolean)));
    const searchNormalized = removeVietnameseTones(deptSearch);

    depts.forEach((dept) => {
      if (searchNormalized && !removeVietnameseTones(dept).includes(searchNormalized)) {
        return;
      }
      const block = classifyDepartmentBlock(dept);
      map[block].push(dept);
    });

    return map;
  }, [currentSnapshot, deptSearch]);

  // Compute metrics for a set of employees
  const getNodeMetrics = (emps: typeof currentSnapshot.employees, filterDept?: string) => {
    const list = filterDept ? emps.filter((e) => e.department === filterDept) : emps;
    const total = list.length;
    
    let doctors = 0;
    let nurses = 0;
    let technicians = 0;
    let pharmacists = 0;
    let midwives = 0;
    let adminSupport = 0;
    let others = 0;
    
    let licensedClinical = 0;
    let clinicalCount = 0;
    let completeQual = 0;

    list.forEach((emp) => {
      const group = removeVietnameseTones(emp.professionalGroup);
      const words = group.split(/[^a-z0-9]+/);
      const isClinical = isClinicalGroup(emp.professionalGroup);
      
      if (isClinical) {
        clinicalCount++;
        const lic = getLicenseStatus(emp, currentSnapshot.snapshotDate);
        if (lic === 'Valid' || lic === 'Expiring Soon') {
          licensedClinical++;
        }
      }

      if (emp.qualification && emp.qualification.trim() !== '') {
        completeQual++;
      }

      if (group.includes('bac si') || group.includes('doctor') || words.includes('bs')) {
        doctors++;
      } else if (group.includes('dieu duong') || group.includes('nurse') || words.includes('dd')) {
        nurses++;
      } else if (group.includes('ky thuat vien') || group.includes('technician') || words.includes('ktv')) {
        technicians++;
      } else if (group.includes('duoc si') || group.includes('pharmacist') || words.includes('ds')) {
        pharmacists++;
      } else if (group.includes('ho sinh') || group.includes('midwife') || words.includes('hs')) {
        midwives++;
      } else if (
        group.includes('hanh chinh') ||
        group.includes('support') ||
        group.includes('admin') ||
        words.includes('hc') ||
        words.includes('vp')
      ) {
        adminSupport++;
      } else {
        others++;
      }
    });

    // Movements
    let hires = 0;
    let exits = 0;

    if (filterDept) {
      hires = periodMovements.filter((m) => m.currentDepartment === filterDept && m.movementType === 'New Hire').length;
      exits = periodMovements.filter((m) => m.previousDepartment === filterDept && m.movementType === 'Exit').length;
    } else {
      // For block/hospital, match employee ID lists
      const empIds = new Set(list.map((e) => e.employeeId));
      hires = periodMovements.filter((m) => m.movementType === 'New Hire' && empIds.has(m.employeeId)).length;
      
      // exits matched based on previous dept
      if (selectedNode?.type === 'block') {
        const blockDepts = new Set(departmentsByBlock[selectedNode.id as HospitalBlock]);
        exits = periodMovements.filter((m) => m.movementType === 'Exit' && m.previousDepartment && blockDepts.has(m.previousDepartment)).length;
      } else {
        exits = periodMovements.filter((m) => m.movementType === 'Exit').length;
      }
    }

    return {
      total,
      pctOfHospital: currentSnapshot.employees.length > 0 ? (total / currentSnapshot.employees.length) * 100 : 0,
      doctors,
      nurses,
      technicians,
      pharmacists,
      midwives,
      adminSupport,
      others,
      hires,
      exits,
      netChange: hires - exits,
      licenseComplianceRate: clinicalCount > 0 ? (licensedClinical / clinicalCount) * 100 : 100,
      qualificationCompletenessRate: total > 0 ? (completeQual / total) * 100 : 100,
    };
  };

  // Node data for detail sidebar
  const activeNodeDetails = useMemo(() => {
    if (!selectedNode) return null;

    let employees = [...currentSnapshot.employees];
    let metrics;

    if (selectedNode.type === 'hospital') {
      metrics = getNodeMetrics(employees);
    } else if (selectedNode.type === 'block') {
      const blockDepts = new Set(departmentsByBlock[selectedNode.id as HospitalBlock]);
      employees = employees.filter((e) => e.department && blockDepts.has(e.department));
      metrics = getNodeMetrics(employees);
    } else {
      employees = employees.filter((e) => e.department === selectedNode.id);
      metrics = getNodeMetrics(currentSnapshot.employees, selectedNode.id);
    }

    return {
      name: selectedNode.name,
      metrics,
      employees,
    };
  }, [selectedNode, currentSnapshot, departmentsByBlock, periodMovements]);

  // Expand / collapse blocks
  const toggleBlock = (blockId: string) => {
    setExpandedBlocks((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const columns = [
    { key: 'employeeId', header: 'Mã NV', sortable: true },
    { key: 'fullName', header: 'Họ tên', sortable: true },
    { key: 'gender', header: 'GT' },
    { key: 'jobTitle', header: 'Chức danh', sortable: true },
    { key: 'professionalGroup', header: 'Nhóm', sortable: true },
    { key: 'qualification', header: 'Trình độ' },
    {
      key: 'licenseNumber',
      header: 'CCHN',
      render: (row: any) =>
        row.licenseNumber ? (
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">
            {row.licenseNumber}
          </span>
        ) : isClinicalGroup(row.professionalGroup) ? (
          <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold">Thiếu CCHN</span>
        ) : (
          <span className="text-slate-400">N/A</span>
        ),
    },
  ];

  const blocksList: HospitalBlock[] = [
    'Clinical',
    'Para-clinical',
    'Nursing',
    'Pharmacy',
    'Administrative / Support',
    'Other / Unclassified',
  ];

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      {/* Interactive Org Chart (Left / Main) */}
      <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-premium font-sans">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center">
              <Network size={18} className="text-hospital-600 mr-2" />
              Sơ đồ khối tổ chức Bệnh viện
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Phân loại khoa/phòng động dựa trên chức danh và định dạng tên đơn vị
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <input
                type="text"
                placeholder="Lọc khoa/phòng..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hospital-500 focus:border-transparent font-medium"
              />
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {deptSearch && (
                <button
                  onClick={() => setDeptSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedNode({ type: 'hospital', id: 'hospital', name: 'Bệnh viện' })}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center space-x-1.5 ${
                selectedNode?.type === 'hospital'
                  ? 'bg-hospital-600 text-white border-hospital-600 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Building2 size={14} />
              <span>Xem Toàn viện</span>
            </button>
          </div>
        </div>

        {/* Tree Container */}
        <div className="space-y-4">
          {/* Hospital Root Node */}
          <div className="flex justify-center mb-6">
            <div
              onClick={() => setSelectedNode({ type: 'hospital', id: 'hospital', name: 'Bệnh viện' })}
              className={`p-4 border rounded-2xl text-center shadow-md cursor-pointer transition-all w-64 ${
                selectedNode?.type === 'hospital'
                  ? 'border-hospital-500 bg-hospital-500 text-white ring-4 ring-hospital-150'
                  : 'border-slate-200 bg-slate-900 text-white hover:bg-slate-850'
              }`}
            >
              <h4 className="text-xs font-black uppercase tracking-wider">HOSPITAL ROOT</h4>
              <p className="text-[10px] opacity-80 mt-1">Tổng: {currentSnapshot.employees.length} nhân viên</p>
            </div>
          </div>

          {/* Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blocksList.map((block) => {
              const blockDepts = departmentsByBlock[block] || [];
              const isExpanded = expandedBlocks[block];
              const isSelected = selectedNode?.type === 'block' && selectedNode.id === block;
              
              // Sum block headcount
              const blockEmps = currentSnapshot.employees.filter((emp) =>
                emp.department && blockDepts.includes(emp.department)
              );

              return (
                <div
                  key={block}
                  className={`border rounded-2xl p-4 shadow-sm transition-all ${
                    isSelected
                      ? 'border-hospital-500 bg-hospital-50/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/20'
                  }`}
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => setSelectedNode({ type: 'block', id: block, name: getBlockDisplayName(block) })}
                      className="cursor-pointer flex-1"
                    >
                      <h5 className="text-xs font-bold text-slate-800 flex items-center">
                        <ChevronRight
                          size={14}
                          className="mr-1.5 text-slate-400"
                        />
                        {getBlockDisplayName(block)}
                      </h5>
                      <span className="text-[10px] text-slate-500 font-semibold block mt-0.5 ml-5">
                        {blockEmps.length} nhân viên • {blockDepts.length} khoa/phòng
                      </span>
                    </div>

                    <button
                      onClick={() => toggleBlock(block)}
                      className="text-[10px] font-bold text-hospital-600 hover:text-hospital-700 bg-white border border-slate-100 px-2 py-1 rounded-lg shadow-sm"
                    >
                      {isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    </button>
                  </div>

                  {/* Block Departments List (Collapsible) */}
                  {isExpanded && (
                    <div className="mt-3 ml-5 pl-3 border-l border-slate-200 space-y-2 max-h-56 overflow-y-auto pr-1">
                      {blockDepts.length > 0 ? (
                        blockDepts.map((dept) => {
                          const deptEmps = currentSnapshot.employees.filter((e) => e.department === dept);
                          const isDeptSelected = selectedNode?.type === 'department' && selectedNode.id === dept;
                          return (
                            <div
                              key={dept}
                              onClick={() => setSelectedNode({ type: 'department', id: dept, name: dept })}
                              className={`p-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-all flex items-center justify-between hover-scale ${
                                isDeptSelected
                                  ? 'bg-hospital-100 text-hospital-900 border-hospital-300 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200 shadow-xs'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 truncate pr-2">
                                <Building2 size={12} className="text-slate-400 flex-shrink-0" />
                                <span className="truncate">{dept}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-1.5 py-0.5 rounded">
                                {deptEmps.length} NV
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block py-1">Không có khoa phòng nào.</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Details Side Panel (Right) */}
      {activeNodeDetails && (
        <div className="w-full xl:w-96 bg-white border border-slate-200 rounded-2xl shadow-premium overflow-hidden self-stretch flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-800">
              <Users size={16} className="text-hospital-600" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider truncate max-w-[200px]">
                {activeNodeDetails.name}
              </h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Panel Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Nhân lực thực tế</span>
                <p className="text-lg font-black text-slate-800 mt-0.5">{activeNodeDetails.metrics.total}</p>
                <span className="text-[9px] text-slate-400">
                  {activeNodeDetails.metrics.pctOfHospital.toFixed(1)}% toàn viện
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Biến động ròng</span>
                <p className={`text-lg font-black mt-0.5 ${
                  activeNodeDetails.metrics.netChange > 0
                    ? 'text-emerald-600'
                    : activeNodeDetails.metrics.netChange < 0
                    ? 'text-rose-600'
                    : 'text-slate-600'
                }`}>
                  {activeNodeDetails.metrics.netChange > 0 ? `+${activeNodeDetails.metrics.netChange}` : activeNodeDetails.metrics.netChange}
                </p>
                <span className="text-[9px] text-slate-400">
                  +{activeNodeDetails.metrics.hires} / -{activeNodeDetails.metrics.exits}
                </span>
              </div>
            </div>

            {/* Ratios Breakdown */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Cơ cấu chức danh</span>
              {[
                { label: 'Bác sĩ', val: activeNodeDetails.metrics.doctors, color: 'bg-sky-500' },
                { label: 'Điều dưỡng', val: activeNodeDetails.metrics.nurses, color: 'bg-emerald-500' },
                { label: 'Kỹ thuật viên', val: activeNodeDetails.metrics.technicians, color: 'bg-amber-500' },
                { label: 'Dược sĩ', val: activeNodeDetails.metrics.pharmacists, color: 'bg-violet-500' },
                { label: 'Hộ sinh', val: activeNodeDetails.metrics.midwives, color: 'bg-rose-500' },
                { label: 'Hành chính / Support', val: activeNodeDetails.metrics.adminSupport, color: 'bg-slate-400' },
              ].map((role) => (
                <div key={role.label} className="text-xs flex items-center justify-between font-bold text-slate-600">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${role.color}`} />
                    <span>{role.label}</span>
                  </div>
                  <span>{role.val} ({activeNodeDetails.metrics.total > 0 ? Math.round((role.val / activeNodeDetails.metrics.total) * 100) : 0}%)</span>
                </div>
              ))}
            </div>

            {/* Compliance details */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chỉ số tuân thủ & dữ liệu</span>
              
              {/* Licensing compliance rate */}
              <div className="flex items-start space-x-2.5 text-xs font-semibold">
                <ShieldAlert size={16} className={activeNodeDetails.metrics.licenseComplianceRate > 90 ? 'text-emerald-500' : 'text-amber-500'} />
                <div>
                  <span className="text-slate-700">Tỷ lệ CCHN lâm sàng hợp lệ</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${activeNodeDetails.metrics.licenseComplianceRate}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">{activeNodeDetails.metrics.licenseComplianceRate.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Qualification completeness rate */}
              <div className="flex items-start space-x-2.5 text-xs font-semibold">
                <Award size={16} className={activeNodeDetails.metrics.qualificationCompletenessRate > 90 ? 'text-emerald-500' : 'text-amber-500'} />
                <div>
                  <span className="text-slate-700">Mức độ hoàn thiện bằng cấp</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${activeNodeDetails.metrics.qualificationCompletenessRate}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">{activeNodeDetails.metrics.qualificationCompletenessRate.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Micro roster listing */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Danh sách nhân sự ({activeNodeDetails.employees.length})
              </span>
              <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                {activeNodeDetails.employees.map((emp) => (
                  <div key={emp.employeeId} className="p-2.5 flex items-center justify-between text-[11px] hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-700">{emp.fullName}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{emp.jobTitle || emp.professionalGroup}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                      {emp.employeeId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
