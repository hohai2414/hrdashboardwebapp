import React, { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import FileUpload from './components/FileUpload';
import FilterBar, { filterEmployeeList } from './components/FilterBar';
import GeminiSettingsPanel from './components/GeminiSettings';

// Dashboards
import ExecutiveOverview from './dashboards/ExecutiveOverview';
import OrganizationStructure from './dashboards/OrganizationStructure';
import DepartmentDrilldown from './dashboards/DepartmentDrilldown';
import WorkforceMovement from './dashboards/WorkforceMovement';
import QualificationLicensing from './dashboards/QualificationLicensing';
import ComplianceDashboard from './dashboards/ComplianceDashboard';
import WorkforcePlanning from './dashboards/WorkforcePlanning';
import AIHospitalReport from './dashboards/AIHospitalReport';
import DataQuality from './dashboards/DataQuality';

import { SnapshotData, FilterState, ComplianceRule, MovementRecord } from './types/hr';
import { analyzeMovement } from './utils/movementAnalyzer';
import { RefreshCw, UploadCloud, Heart, Sparkles, Building2 } from 'lucide-react';
import { formatDateDisplay, getPeriodType, getMonthLabel } from './utils/dateUtils';

export default function App() {
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Vietnam Ministry of Health configurations (initially null, user inputs them in MoH Compliance)
  const [complianceRule, setComplianceRule] = useState<ComplianceRule | null>(null);

  // Global filters
  const [filters, setFilters] = useState<FilterState>({
    snapshotDate: '',
    month: '',
    periodType: 'All',
    department: '',
    professionalGroup: '',
    jobTitle: '',
    gender: '',
    employmentStatus: '',
    qualificationLevel: '',
  });

  // 1. Set initial filter when data is loaded
  const handleDataLoaded = (data: SnapshotData[]) => {
    setSnapshots(data);
    const lastSnapshot = data[data.length - 1];
    
    // Set default filters to latest snapshot
    setFilters({
      snapshotDate: lastSnapshot?.snapshotDate || '',
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

  // 2. Compute selected snapshot index
  const selectedSnapshotIdx = useMemo(() => {
    if (snapshots.length === 0) return -1;
    
    // 2.1 If explicit snapshotDate is selected, use it
    if (filters.snapshotDate) {
      const idx = snapshots.findIndex((s) => s.snapshotDate === filters.snapshotDate);
      if (idx !== -1) return idx;
    }
    
    // 2.2 If month is selected, find the matching snapshot in that month
    if (filters.month) {
      const monthMatches = snapshots.filter((s) => getMonthLabel(s.snapshotDate) === filters.month);
      if (monthMatches.length > 0) {
        // If period type is also specified
        if (filters.periodType !== 'All') {
          const typeMatch = monthMatches.find((s) => getPeriodType(s.snapshotDate) === filters.periodType);
          if (typeMatch) return snapshots.indexOf(typeMatch);
        }
        // Fallback to the latest snapshot in that month
        return snapshots.indexOf(monthMatches[monthMatches.length - 1]);
      }
    }
    
    // 2.3 If only periodType is selected
    if (filters.periodType !== 'All') {
      const typeMatch = snapshots.find((s) => getPeriodType(s.snapshotDate) === filters.periodType);
      if (typeMatch) return snapshots.indexOf(typeMatch);
    }
    
    // Default to the latest snapshot in the system
    return snapshots.length - 1;
  }, [snapshots, filters.snapshotDate, filters.month, filters.periodType]);

  const activeSnapshot = selectedSnapshotIdx !== -1 ? snapshots[selectedSnapshotIdx] : null;

  // 3. Compute all historical movements between consecutive snapshots
  const allMovements = useMemo(() => {
    const list: MovementRecord[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      const moves = analyzeMovement(curr.employees, prev.employees, curr.snapshotDate, prev.snapshotDate);
      list.push(...moves);
    }
    return list;
  }, [snapshots]);

  // 4. Compute filtered list of employees in the selected snapshot
  const filteredEmployees = useMemo(() => {
    if (!activeSnapshot) return [];

    let list = [...activeSnapshot.employees];

    // Filter by periodType
    if (filters.periodType !== 'All') {
      list = list.filter((e) => {
        const type = getPeriodType(e.snapshotDate);
        return type === filters.periodType;
      });
    }

    // Apply main field filters
    return filterEmployeeList(list, filters);
  }, [activeSnapshot, filters]);

  // Render content
  const renderDashboard = () => {
    if (snapshots.length === 0) return null;

    switch (currentTab) {
      case 'overview':
        return (
          <ExecutiveOverview
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
            filteredEmployees={filteredEmployees}
            allMovements={allMovements}
            filters={filters}
          />
        );
      case 'org-structure':
        return (
          <OrganizationStructure
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
          />
        );
      case 'dept-drilldown':
        return (
          <DepartmentDrilldown
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
            filters={filters}
            setFilters={setFilters}
          />
        );
      case 'movement':
        return (
          <WorkforceMovement
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
            allMovements={allMovements}
          />
        );
      case 'qualification-licensing':
        return (
          <QualificationLicensing
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
            filteredEmployees={filteredEmployees}
          />
        );
      case 'compliance':
        return (
          <ComplianceDashboard
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
            complianceRule={complianceRule}
            setComplianceRule={setComplianceRule}
          />
        );
      case 'planning':
        return (
          <WorkforcePlanning
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
          />
        );
      case 'ai-report':
        return (
          <AIHospitalReport
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
            complianceRule={complianceRule}
          />
        );
      case 'data-quality':
        return (
          <DataQuality
            snapshots={snapshots}
            selectedSnapshotIdx={selectedSnapshotIdx}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  const activeTitle = useMemo(() => {
    const map: Record<string, string> = {
      overview: 'Tổng quan Điều hành',
      'org-structure': 'Cấu trúc Tổ chức',
      'dept-drilldown': 'Chi tiết Khoa/Phòng',
      movement: 'Biến động Nhân sự',
      'qualification-licensing': 'Bằng cấp & Chứng chỉ',
      compliance: 'Định mức Bộ Y tế',
      planning: 'Kế hoạch Nhân sự',
      'ai-report': 'Báo cáo AI (Gemini)',
      'data-quality': 'Chất lượng Dữ liệu',
    };
    return map[currentTab] || 'Dashboard';
  }, [currentTab]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {snapshots.length > 0 && (
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          snapshotCount={snapshots.length}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      )}

      {/* Main Container */}
      <div className={`flex-1 flex flex-col min-w-0 ${snapshots.length > 0 ? 'md:pl-64' : ''}`}>
        
        {/* Top Navbar */}
        {snapshots.length > 0 && (
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sticky top-0 z-30 shadow-xs">
            <div>
              <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                <Building2 size={12} className="text-hospital-500" />
                <span>Bệnh viện / {activeSnapshot?.sheetName}</span>
              </div>
              <h2 className="text-base font-black text-slate-800 tracking-tight mt-0.5">{activeTitle}</h2>
            </div>
            
            <div className="flex items-center space-x-3 self-end sm:self-auto">
              <button
                onClick={() => {
                  setSnapshots([]);
                  setFilters({
                    snapshotDate: '',
                    month: '',
                    periodType: 'All',
                    department: '',
                    professionalGroup: '',
                    jobTitle: '',
                    gender: '',
                    employmentStatus: '',
                    qualificationLevel: '',
                  });
                }}
                className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <UploadCloud size={14} />
                <span className="hidden sm:inline">Nạp lại File Excel</span>
              </button>
            </div>
          </header>
        )}

        {/* Content Wrapper */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {snapshots.length === 0 ? (
            <div className="min-h-[80vh] flex items-center justify-center">
              <FileUpload
                onDataLoaded={handleDataLoaded}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Render Global Filters in tabs where filtering applies */}
              {['overview', 'dept-drilldown', 'qualification-licensing', 'data-quality'].includes(currentTab) && (
                <FilterBar
                  snapshots={snapshots}
                  filters={filters}
                  setFilters={setFilters}
                />
              )}
              {renderDashboard()}
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal overlay */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-2">
            <GeminiSettingsPanel onClose={() => setShowSettingsModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
