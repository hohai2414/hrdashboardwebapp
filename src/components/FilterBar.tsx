import React, { useMemo } from 'react';
import { Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { SnapshotData, FilterState } from '../types/hr';
import { getPeriodType, getMonthLabel, formatDateDisplay } from '../utils/dateUtils';

interface FilterBarProps {
  snapshots: SnapshotData[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

export default function FilterBar({ snapshots, filters, setFilters }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  // 1. Gather all unique filter options from snapshots
  const filterOptions = useMemo(() => {
    const snapshotDatesSet = new Set<string>();
    const monthsSet = new Set<string>();
    const departmentsSet = new Set<string>();
    const groupsSet = new Set<string>();
    const titlesSet = new Set<string>();
    const gendersSet = new Set<string>();
    const statusesSet = new Set<string>();
    const qualificationsSet = new Set<string>();

    snapshots.forEach((snap) => {
      snapshotDatesSet.add(snap.snapshotDate);
      monthsSet.add(getMonthLabel(snap.snapshotDate));
      
      snap.employees.forEach((emp) => {
        if (emp.department) departmentsSet.add(emp.department);
        if (emp.professionalGroup) groupsSet.add(emp.professionalGroup);
        if (emp.jobTitle) titlesSet.add(emp.jobTitle);
        if (emp.gender) gendersSet.add(emp.gender);
        if (emp.employmentStatus) statusesSet.add(emp.employmentStatus);
        if (emp.qualification) qualificationsSet.add(emp.qualification);
      });
    });

    return {
      snapshotDates: Array.from(snapshotDatesSet).sort(),
      months: Array.from(monthsSet).sort(),
      departments: Array.from(departmentsSet).sort(),
      groups: Array.from(groupsSet).sort(),
      titles: Array.from(titlesSet).sort(),
      genders: Array.from(gendersSet).sort(),
      statuses: Array.from(statusesSet).sort(),
      qualifications: Array.from(qualificationsSet).sort(),
    };
  }, [snapshots]);

  // Handle single filter change
  const handleChange = (field: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value };
      
      // If snapshotDate changes, synchronize month and period filters accordingly
      if (field === 'snapshotDate' && value) {
        next.month = '';
        next.periodType = 'All';
      }
      // If month changes, clear snapshot date to avoid conflict
      if (field === 'month' && value) {
        next.snapshotDate = '';
      }
      
      return next;
    });
  };

  const handleReset = () => {
    setFilters({
      snapshotDate: snapshots[snapshots.length - 1]?.snapshotDate || '',
      month: '',
      periodType: 'All',
      department: '',
      professionalGroup: '',
      jobTitle: '',
      gender: '',
      employmentStatus: '',
      qualificationLevel: '',
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-premium mb-6 overflow-hidden">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center space-x-2 text-slate-700">
          <Filter size={18} className="text-hospital-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Bộ lọc dữ liệu toàn hệ thống</span>
        </div>
        <div className="flex items-center space-x-4">
          {Object.values(filters).some((val) => val && val !== 'All' && val !== snapshots[snapshots.length - 1]?.snapshotDate) && (
            <span className="text-[10px] font-bold bg-hospital-100 text-hospital-700 px-2 py-0.5 rounded-full">
              Đang lọc
            </span>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Filter Options */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50/40">
          {/* Snapshot Date Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Thời điểm (Snapshot)</label>
            <select
              value={filters.snapshotDate}
              onChange={(e) => handleChange('snapshotDate', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="">Chọn thời điểm...</option>
              {filterOptions.snapshotDates.map((date) => (
                <option key={date} value={date}>
                  {formatDateDisplay(date)} {getPeriodType(date) === 'Mid-month' ? '(Giữa kỳ)' : '(Cuối kỳ)'}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Tháng báo cáo</label>
            <select
              value={filters.month}
              onChange={(e) => handleChange('month', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="">Tất cả các tháng</option>
              {filterOptions.months.map((month) => (
                <option key={month} value={month}>
                  Tháng {month}
                </option>
              ))}
            </select>
          </div>

          {/* Period Type */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Kỳ báo cáo</label>
            <select
              value={filters.periodType}
              onChange={(e) => handleChange('periodType', e.target.value as any)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="All">Tất cả kỳ</option>
              <option value="Mid-month">Giữa tháng (ngày 15)</option>
              <option value="Month-end">Cuối tháng (ngày 28-31)</option>
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Khoa/ phòng cụ thể</label>
            <select
              value={filters.department}
              onChange={(e) => handleChange('department', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="">Tất cả Khoa/ phòng cụ thể</option>
              {filterOptions.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Professional Group */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nhóm Chức danh nghề nghiệp</label>
            <select
              value={filters.professionalGroup}
              onChange={(e) => handleChange('professionalGroup', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="">Tất cả Nhóm Chức danh nghề nghiệp</option>
              {filterOptions.groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Chức danh chi tiết</label>
            <select
              value={filters.jobTitle}
              onChange={(e) => handleChange('jobTitle', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="">Tất cả chức danh</option>
              {filterOptions.titles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Phái</label>
            <select
              value={filters.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="">Tất cả Phái</option>
              {filterOptions.genders.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
          </div>

          {/* Qualification level */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Trình độ chuyên môn</label>
            <select
              value={filters.qualificationLevel}
              onChange={(e) => handleChange('qualificationLevel', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-hospital-500"
            >
              <option value="">Tất cả trình độ</option>
              {filterOptions.qualifications.map((qual) => (
                <option key={qual} value={qual}>
                  {qual}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 flex justify-end mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-hospital-600 transition-colors bg-slate-100 hover:bg-hospital-50 px-4 py-2 rounded-xl"
            >
              <RotateCcw size={14} />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function filterEmployeeList(employees: any[], filters: FilterState): any[] {
  return employees.filter((emp) => {
    if (filters.department && emp.department !== filters.department) return false;
    if (filters.professionalGroup && emp.professionalGroup !== filters.professionalGroup) return false;
    if (filters.jobTitle && emp.jobTitle !== filters.jobTitle) return false;
    if (filters.gender && emp.gender !== filters.gender) return false;
    if (filters.employmentStatus && emp.employmentStatus !== filters.employmentStatus) return false;
    if (filters.qualificationLevel && emp.qualification !== filters.qualificationLevel) return false;
    return true;
  });
}
