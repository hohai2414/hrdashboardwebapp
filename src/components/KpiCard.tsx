import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number; // percentage change or direct diff vs previous snapshot
  changeType?: 'percentage' | 'numeric';
  subtext?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray';
  format?: string;
}

export default function KpiCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'numeric',
  subtext,
  color = 'primary',
}: KpiCardProps) {
  const themeColors = {
    primary: {
      bg: 'bg-hospital-50/50',
      iconBg: 'bg-hospital-100 text-hospital-600',
      border: 'border-hospital-100/70',
      text: 'text-hospital-900',
    },
    success: {
      bg: 'bg-emerald-50/40',
      iconBg: 'bg-emerald-100 text-emerald-600',
      border: 'border-emerald-100/60',
      text: 'text-emerald-900',
    },
    warning: {
      bg: 'bg-amber-50/40',
      iconBg: 'bg-amber-100 text-amber-600',
      border: 'border-amber-100/60',
      text: 'text-amber-900',
    },
    danger: {
      bg: 'bg-rose-50/40',
      iconBg: 'bg-rose-100 text-rose-600',
      border: 'border-rose-100/60',
      text: 'text-rose-900',
    },
    info: {
      bg: 'bg-violet-50/40',
      iconBg: 'bg-violet-100 text-violet-600',
      border: 'border-violet-100/60',
      text: 'text-violet-900',
    },
    gray: {
      bg: 'bg-slate-50',
      iconBg: 'bg-slate-150 text-slate-500',
      border: 'border-slate-200/60',
      text: 'text-slate-900',
    },
  };

  const theme = themeColors[color] || themeColors.primary;

  const renderChange = () => {
    if (change === undefined || change === 0) return null;

    const isPositive = change > 0;
    const formattedChange =
      changeType === 'percentage'
        ? `${isPositive ? '+' : ''}${change.toFixed(1)}%`
        : `${isPositive ? '+' : ''}${change}`;

    return (
      <div
        className={`flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isPositive
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-rose-100 text-rose-700'
        }`}
      >
        {isPositive ? (
          <ArrowUpRight size={10} className="mr-0.5" />
        ) : (
          <ArrowDownRight size={10} className="mr-0.5" />
        )}
        <span>{formattedChange}</span>
      </div>
    );
  };

  return (
    <div
      className={`border rounded-2xl p-5 bg-white shadow-premium hover:shadow-premium-hover hover-scale flex flex-col justify-between ${theme.border}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
            {value}
          </h3>
        </div>
        <div className={`p-2.5 rounded-xl ${theme.iconBg}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
        <span className="text-[10px] text-slate-400 font-medium truncate max-w-[70%]">
          {subtext || 'Báo cáo snapshot'}
        </span>
        {renderChange()}
      </div>
    </div>
  );
}
