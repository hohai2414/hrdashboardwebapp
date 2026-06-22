import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Database } from 'lucide-react';
import { parseExcelWorkbook } from '../utils/excelParser';
import { SnapshotData } from '../types/hr';
import { generateMockData } from '../utils/mockDataGenerator';

interface FileUploadProps {
  onDataLoaded: (data: SnapshotData[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function FileUpload({ onDataLoaded, isLoading, setIsLoading }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: string } | null>(null);
  const [sheetsParsed, setSheetsParsed] = useState<Array<{ name: string; count: number }>>([]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        setError('Định dạng file không hỗ trợ. Vui lòng tải lên file Excel (.xlsx hoặc .xls)');
        return;
      }

      setError(null);
      setIsLoading(true);
      setFileDetails({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
      });

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const snapshots = parseExcelWorkbook(buffer);
          
          if (snapshots.length === 0) {
            setError('Không tìm thấy dữ liệu hợp lệ trong file Excel.');
            setIsLoading(false);
            return;
          }

          const parsedSummary = snapshots.map((s) => ({
            name: s.sheetName,
            count: s.employees.length,
          }));
          
          setSheetsParsed(parsedSummary);
          onDataLoaded(snapshots);
        } catch (err: any) {
          console.error(err);
          setError(`Lỗi khi đọc file: ${err.message || err}`);
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Có lỗi xảy ra khi đọc file.');
        setIsLoading(false);
      };

      reader.readAsArrayBuffer(file);
    },
    [onDataLoaded, setIsLoading]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleLoadDemo = () => {
    setIsLoading(true);
    setTimeout(() => {
      try {
        const demoData = generateMockData();
        setFileDetails({
          name: 'Demo_Roster_2026.xlsx (Dữ liệu mẫu)',
          size: '145 KB',
        });
        setSheetsParsed(
          demoData.map((s) => ({
            name: s.sheetName,
            count: s.employees.length,
          }))
        );
        onDataLoaded(demoData);
        setError(null);
      } catch (err: any) {
        setError(`Lỗi tạo dữ liệu mẫu: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
          Hospital HR Workforce Intelligence Dashboard
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
          Tải lên bảng lương/nhân sự Excel chứa các snapshot thời gian để tự động phân tích biến động, bằng cấp, chứng chỉ hành nghề và định mức của Bộ Y tế.
        </p>
      </div>

      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all bg-white shadow-premium hover:shadow-premium-hover ${
          isLoading
            ? 'border-hospital-400 bg-slate-50'
            : error
            ? 'border-red-300 hover:border-red-400'
            : 'border-slate-300 hover:border-hospital-500'
        }`}
      >
        <input
          type="file"
          id="excel-file"
          accept=".xlsx, .xls"
          onChange={onFileChange}
          disabled={isLoading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {isLoading ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-hospital-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm font-semibold text-slate-600">Đang parse các sheets và cấu trúc dữ liệu...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-hospital-50 text-hospital-600 rounded-2xl mb-4">
              <Upload size={36} />
            </div>
            <p className="text-base font-bold text-slate-800">Kéo và thả file Excel nhân sự tại đây</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Hỗ trợ định dạng .xlsx, .xls (Sheet name đặt theo ngày DD.MM.YYYY)</p>
            <button className="px-5 py-2.5 bg-hospital-600 hover:bg-hospital-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors pointer-events-none">
              Chọn file từ máy tính
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start space-x-3 text-xs">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-bold">Lỗi tải dữ liệu:</span> {error}
          </div>
        </div>
      )}

      {fileDetails && !error && !isLoading && (
        <div className="mt-6 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">{fileDetails.name}</p>
              <p className="text-[11px] text-slate-500">Dung lượng: {fileDetails.size}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-3 py-1.5 rounded-lg self-start md:self-auto">
            <CheckCircle size={14} />
            <span>Tải lên thành công</span>
          </div>
        </div>
      )}

      {sheetsParsed.length > 0 && !error && !isLoading && (
        <div className="mt-6">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">
            Danh sách Snapshot đã phân tích ({sheetsParsed.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {sheetsParsed.map((sheet, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-center flex flex-col justify-between hover-scale"
              >
                <span className="text-xs font-bold text-hospital-800">{sheet.name}</span>
                <span className="text-[10px] text-slate-400 mt-1">{sheet.count} nhân viên</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo Load Action */}
      {!fileDetails && !isLoading && (
        <div className="mt-8 text-center flex flex-col items-center">
          <div className="h-px w-full max-w-md bg-slate-200 mb-6"></div>
          <p className="text-xs text-slate-400 mb-3">Bạn chưa có sẵn file Excel? Trải nghiệm ngay với dữ liệu giả lập:</p>
          <button
            onClick={handleLoadDemo}
            className="flex items-center space-x-2 px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-lg transition-all hover-scale"
          >
            <Database size={16} />
            <span>Tải dữ liệu bệnh viện mẫu 2026</span>
          </button>
        </div>
      )}
    </div>
  );
}
