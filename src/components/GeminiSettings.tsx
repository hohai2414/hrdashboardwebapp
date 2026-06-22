import React, { useState, useEffect } from 'react';
import { ShieldCheck, Eye, EyeOff, Save, Trash2, Key, X } from 'lucide-react';
import { getSavedApiKey, saveApiKey, clearApiKey } from '../services/geminiService';

interface GeminiSettingsProps {
  onClose?: () => void;
  onSaveSuccess?: () => void;
}

export default function GeminiSettings({ onClose, onSaveSuccess }: GeminiSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const key = getSavedApiKey();
    if (key) {
      setApiKey(key);
      setIsSaved(true);
    }
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    saveApiKey(trimmed);
    setIsSaved(true);
    if (onSaveSuccess) onSaveSuccess();
    if (onClose) onClose();
  };

  const handleClear = () => {
    clearApiKey();
    setApiKey('');
    setIsSaved(false);
  };

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-6 shadow-premium max-w-md mx-auto">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"
          aria-label="Đóng"
        >
          <X size={16} />
        </button>
      )}
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
          <Key size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Cấu hình Gemini API Key</h3>
          <p className="text-[10px] text-slate-400 font-semibold">Tích hợp AI tạo báo cáo nhân sự tự động</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Input */}
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setIsSaved(false);
            }}
            className="w-full text-xs pr-10 pl-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hospital-500 bg-white text-slate-700 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white rounded-xl text-xs font-bold transition-all hover-scale cursor-pointer"
          >
            <Save size={14} />
            <span>Lưu API Key</span>
          </button>
          
          {isSaved && (
            <button
              onClick={handleClear}
              className="flex items-center justify-center p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all"
              title="Xóa Key"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Warnings */}
        <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-[10px] leading-relaxed text-amber-800 space-y-1.5">
          <p className="font-extrabold uppercase tracking-wide flex items-center text-amber-900">
            <ShieldCheck size={12} className="mr-1" />
            Lưu ý bảo mật quan trọng
          </p>
          <p>
            API Key được lưu trữ trực tiếp trong <strong>localStorage</strong> của trình duyệt để phục vụ mục đích chạy thử nghiệm cục bộ (Local / Demo).
          </p>
          <p className="font-medium text-amber-700">
            Khi phát triển dự án thực tế (Production), khuyến nghị chuyển giao việc gọi API sang <strong>Backend proxy</strong> để che dấu và bảo vệ API Key tuyệt đối khỏi rủi ro lộ lọt ở phía Client.
          </p>
        </div>
      </div>
    </div>
  );
}
