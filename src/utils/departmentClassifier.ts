import { removeVietnameseTones } from './columnMapper';

export type HospitalBlock =
  | 'Clinical'
  | 'Para-clinical'
  | 'Pharmacy'
  | 'Nursing'
  | 'Administrative / Support'
  | 'Other / Unclassified';

/**
 * Classifies a department name into one of the hospital blocks
 */
export function classifyDepartmentBlock(deptName: string): HospitalBlock {
  if (!deptName) return 'Other / Unclassified';
  
  const normalized = removeVietnameseTones(deptName);

  // Clinical Block rules: Nội, Ngoại, Sản, Nhi, Cấp cứu, Hồi sức, ICU, Khám bệnh, Tim mạch, Phẫu thuật, Răng Hàm Mặt, Tai Mũi Họng, v.v.
  const clinicalKeywords = [
    'noi', 'ngoai', 'san', 'nhi', 'cap cuu', 'hoi suc', 'icu', 'kham benh', 
    'tim mach', 'phau thuat', 'gay me', 'chong doc', 'truyen nhiem', 
    'da lieu', 'mat', 'tai mui hong', 'rang ham mat', 'ung buou', 'than', 
    'loc mau', 'lao', 'tam than', 'y hoc co truyen', 'phuc hoi chu nang', 
    'phu san', 'khoa ngoai', 'khoa noi'
  ];
  if (clinicalKeywords.some(keyword => normalized.includes(keyword))) {
    return 'Clinical';
  }

  // Para-clinical Block rules: Xét nghiệm, Chẩn đoán hình ảnh, Thăm dò chức năng, Giải phẫu bệnh, X-quang, Siêu âm, Nội soi, Kiểm soát nhiễm khuẩn
  const paraclinicalKeywords = [
    'xet nghiem', 'chan doan hinh anh', 'tham do chuc nang', 'giai phau benh', 
    'x-quang', 'xquang', 'sieu am', 'noi soi', 'kiem soat nhiem khuan', 
    'vi sinh', 'sinh hoa', 'huyet hoc', 'cdha'
  ];
  if (paraclinicalKeywords.some(keyword => normalized.includes(keyword))) {
    return 'Para-clinical';
  }

  // Pharmacy Block rules: Dược, Nhà thuốc
  const pharmacyKeywords = ['duoc', 'nha thuoc', 'cap phat thuoc'];
  if (pharmacyKeywords.some(keyword => normalized.includes(keyword))) {
    return 'Pharmacy';
  }

  // Nursing Block rules: Điều dưỡng, Chăm sóc sức khỏe
  const nursingKeywords = ['dieu duong', 'cham soc khach hang', 'dinh duong', 'tiet che'];
  if (nursingKeywords.some(keyword => normalized.includes(keyword))) {
    return 'Nursing';
  }

  // Administrative / Support Block rules: Hành chính, Tài chính, Kế toán, Nhân sự, CNTT, Vật tư, Kế hoạch, Quản trị, Tổ chức cán bộ, Bảo vệ, Lái xe
  const adminKeywords = [
    'hanh chinh', 'tai chinh', 'ke toan', 'nhan su', 'cntt', 'it', 'vat tu', 
    'ke hoach', 'quan tri', 'to chuc can bo', 'bao ve', 'lai xe', 'tai vu',
    'khao thi', 'marketing', 'truyen thong', 'phap che', 'dao tao', 
    'chi dao tuyen', 'quan ly chat luong', 'cong tac xa hoi', 'van thu'
  ];
  if (adminKeywords.some(keyword => normalized.includes(keyword))) {
    return 'Administrative / Support';
  }

  return 'Other / Unclassified';
}

/**
 * Returns translated display name for blocks
 */
export function getBlockDisplayName(block: HospitalBlock): string {
  switch (block) {
    case 'Clinical':
      return 'Khối Lâm sàng (Clinical)';
    case 'Para-clinical':
      return 'Khối Cận lâm sàng (Para-clinical)';
    case 'Pharmacy':
      return 'Khối Dược (Pharmacy)';
    case 'Nursing':
      return 'Khối Điều dưỡng / Dinh dưỡng (Nursing)';
    case 'Administrative / Support':
      return 'Khối Hành chính / Quản trị (Admin)';
    default:
      return 'Khác / Chưa phân loại (Other)';
  }
}
