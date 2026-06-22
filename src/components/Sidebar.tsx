import React from 'react';
import {
  LayoutDashboard,
  Network,
  Building2,
  ArrowLeftRight,
  Award,
  FileCheck,
  TrendingUp,
  Sparkles,
  Activity,
  FileSpreadsheet,
  Settings,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  snapshotCount: number;
  onOpenSettings: () => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  snapshotCount,
  onOpenSettings,
}: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(true);

  const menuItems = [
    { id: 'overview', label: 'Tổng quan Điều hành', icon: LayoutDashboard },
    { id: 'org-structure', label: 'Cấu trúc Tổ chức', icon: Network },
    { id: 'dept-drilldown', label: 'Chi tiết Khoa/Phòng', icon: Building2 },
    { id: 'movement', label: 'Biến động Nhân sự', icon: ArrowLeftRight },
    { id: 'qualification-licensing', label: 'Bằng cấp & Chứng chỉ', icon: Award },
    { id: 'compliance', label: 'Định mức Bộ Y tế', icon: FileCheck },
    { id: 'planning', label: 'Kế hoạch Nhân sự', icon: TrendingUp },
    { id: 'ai-report', label: 'Báo cáo AI (Gemini)', icon: Sparkles },
    { id: 'data-quality', label: 'Chất lượng Dữ liệu', icon: Activity },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-hospital-700 text-white rounded-full shadow-lg md:hidden hover:bg-hospital-800 transition-colors"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen bg-slate-900 text-slate-100 flex flex-col justify-between border-r border-slate-800 transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3 bg-slate-950">
            <div className="p-2 bg-hospital-600 rounded-lg text-white">
              <Building2 size={24} className="animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white uppercase leading-none">
                Hospital HR
              </h1>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                Workforce Intelligence
              </span>
            </div>
          </div>

          {/* Snapshot Summary Panel */}
          <div className="mx-4 my-4 p-3 bg-slate-800/50 rounded-lg border border-slate-800 flex items-center space-x-3">
            <FileSpreadsheet size={18} className="text-hospital-400" />
            <div>
              <p className="text-xs font-semibold text-slate-300">Dữ liệu nguồn</p>
              <p className="text-[11px] text-slate-400">
                {snapshotCount > 0 ? `${snapshotCount} Snapshot thời gian` : 'Chưa có dữ liệu'}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    if (window.innerWidth < 768) setIsOpen(false); // Auto close on mobile
                  }}
                  className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-hospital-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Icon size={16} className={`mr-3 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Settings */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 rounded-lg transition-colors"
          >
            <Settings size={16} className="mr-3 text-slate-500" />
            Gemini Settings
          </button>
          <div className="mt-3 text-center text-[10px] text-slate-600">
            &copy; 2026 DeepMind Antigravity
          </div>
        </div>
      </aside>
    </>
  );
}
