import React from 'react';
import { BarChart2 } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  className?: string;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  isEmpty = false,
  className = '',
}: ChartCardProps) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-premium flex flex-col justify-between hover-scale ${className}`}
    >
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex-1 w-full min-h-[220px] flex items-center justify-center relative">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
            <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl">
              <BarChart2 size={24} />
            </div>
            <p className="text-xs font-bold text-slate-500">Không có dữ liệu biểu đồ</p>
            <p className="text-[10px] text-slate-400 max-w-[180px]">
              Vui lòng điều chỉnh bộ lọc hoặc snapshot đã chọn để cập nhật thông tin.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
