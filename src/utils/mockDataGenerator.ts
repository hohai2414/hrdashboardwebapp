import { SnapshotData, EmployeeRecord } from '../types/hr';

// Basic list of names and titles
const MOCK_DEPARTMENTS = [
  'Khoa Nội Tổng hợp',
  'Khoa Ngoại Chấn thương',
  'Khoa Phụ Sản',
  'Khoa Nhi',
  'Khoa Cấp cứu',
  'Khoa Hồi sức tích cực (ICU)',
  'Khoa Chẩn đoán hình ảnh',
  'Khoa Xét nghiệm',
  'Khoa Dược',
  'Phòng Điều dưỡng',
  'Phòng Hành chính Quản trị',
  'Phòng Tài chính Kế toán',
  'Phòng Kế hoạch tổng hợp',
  'Khoa Y học cổ truyền',
];

const MOCK_DOCTOR_TITLES = ['Bác sĩ Trưởng khoa', 'Bác sĩ điều trị', 'Bác sĩ nội trú', 'Phó Trưởng khoa'];
const MOCK_NURSE_TITLES = ['Điều dưỡng trưởng khoa', 'Điều dưỡng viên', 'Điều dưỡng hành chính'];
const MOCK_TECH_TITLES = ['Kỹ thuật viên trưởng', 'Kỹ thuật viên xét nghiệm', 'Kỹ thuật viên hình ảnh'];
const MOCK_PHARM_TITLES = ['Dược sĩ đại học', 'Dược sĩ trung học', 'Dược sĩ lâm sàng'];
const MOCK_ADMIN_TITLES = ['Trưởng phòng', 'Phó Trưởng phòng', 'Chuyên viên', 'Kế toán viên', 'Nhân viên IT', 'Thủ quỹ'];

const DEGREES = {
  Doctor: ['TS.BS', 'ThS.BS', 'BSCKII', 'BSCKI', 'BS'],
  Nurse: ['Thạc sĩ', 'Cử nhân', 'Cao đẳng', 'Trung cấp'],
  Technician: ['Cử nhân', 'Cao đẳng', 'Trung cấp'],
  Pharmacist: ['Thạc sĩ', 'Cử nhân', 'Cao đẳng', 'Trung cấp'],
  Midwife: ['Cử nhân', 'Cao đẳng', 'Trung cấp'],
  Admin: ['Thạc sĩ', 'Cử nhân', 'Cao đẳng'],
};

const MAJORS = {
  Doctor: ['Y đa khoa', 'Nội khoa', 'Ngoại khoa', 'Sản phụ khoa', 'Nhi khoa', 'Gây mê hồi sức', 'Tim mạch'],
  Nurse: ['Điều dưỡng đa khoa', 'Điều dưỡng phụ sản', 'Điều dưỡng gây mê'],
  Technician: ['Kỹ thuật hình ảnh y học', 'Xét nghiệm y học', 'Phục hồi chức năng'],
  Pharmacist: ['Dược học', 'Dược lâm sàng', 'Quản lý dược'],
  Midwife: ['Hộ sinh'],
  Admin: ['Quản trị kinh doanh', 'Kế toán', 'Công nghệ thông tin', 'Quản trị bệnh viện', 'Luật'],
};

// Vietnamese name pools
const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const MID_NAMES_MALE = ['Văn', 'Đức', 'Hữu', 'Minh', 'Anh', 'Quang', 'Ngọc', 'Quốc', 'Thanh', 'Tiến', 'Mạnh', 'Xuân'];
const MID_NAMES_FEMALE = ['Thị', 'Khánh', 'Minh', 'Thanh', 'Ngọc', 'Bích', 'Hồng', 'Phương', 'Như', 'Diệu', 'Tuyết'];
const FIRST_NAMES_MALE = ['Hùng', 'Cường', 'Nam', 'Bình', 'Hải', 'Sơn', 'Tùng', 'Phong', 'Lâm', 'Tuấn', 'Khang', 'Duy', 'Hoàng', 'Minh'];
const FIRST_NAMES_FEMALE = ['Hoa', 'Lan', 'Huệ', 'Trang', 'Mai', 'Linh', 'Thảo', 'Hương', 'An', 'Vy', 'Hà', 'Nhung', 'Trâm', 'Huyền'];

function generateName(gender: string): string {
  const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  if (gender === 'Nam') {
    const mn = MID_NAMES_MALE[Math.floor(Math.random() * MID_NAMES_MALE.length)];
    const fn = FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)];
    return `${ln} ${mn} ${fn}`;
  } else {
    const mn = MID_NAMES_FEMALE[Math.floor(Math.random() * MID_NAMES_FEMALE.length)];
    const fn = FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];
    return `${ln} ${mn} ${fn}`;
  }
}

function randomDOB(ageStart = 24, ageEnd = 60): string {
  const currentYear = 2026;
  const birthYear = currentYear - (ageStart + Math.floor(Math.random() * (ageEnd - ageStart)));
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${birthYear}-${month}-${day}`;
}

function randomJoinDate(): string {
  const year = 2015 + Math.floor(Math.random() * 10);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateMockData(): SnapshotData[] {
  const snapshotDates = [
    { name: '15.02.2026', date: '2026-02-15' },
    { name: '28.02.2026', date: '2026-02-28' },
    { name: '15.03.2026', date: '2026-03-15' },
    { name: '31.03.2026', date: '2026-03-31' },
    { name: '15.04.2026', date: '2026-04-15' },
    { name: '30.04.2026', date: '2026-04-30' },
    { name: '15.05.2026', date: '2026-05-15' },
    { name: '31.05.2026', date: '2026-05-31' },
    { name: '15.06.2026', date: '2026-06-15' },
  ];

  // Base list of employees (snapshot 1)
  const baseEmployees: EmployeeRecord[] = [];
  const totalBase = 120;

  for (let i = 1; i <= totalBase; i++) {
    const id = `NV${String(1000 + i).slice(1)}`;
    const gender = Math.random() > 0.55 ? 'Nữ' : 'Nam';
    const fullName = generateName(gender);
    
    // Choose professional group & department
    let group = 'Khác';
    let department = MOCK_DEPARTMENTS[0];
    let jobTitle = '';
    
    const roll = Math.random();
    if (roll < 0.2) {
      group = 'Bác sĩ';
      department = MOCK_DEPARTMENTS[Math.floor(Math.random() * 8)]; // Clinical & Para-clinical
      jobTitle = MOCK_DOCTOR_TITLES[Math.floor(Math.random() * MOCK_DOCTOR_TITLES.length)];
    } else if (roll < 0.5) {
      group = 'Điều dưỡng';
      department = MOCK_DEPARTMENTS[Math.floor(Math.random() * 8)];
      if (department.includes('Điều dưỡng')) {
        jobTitle = 'Điều dưỡng viên văn phòng';
      } else {
        jobTitle = MOCK_NURSE_TITLES[Math.floor(Math.random() * MOCK_NURSE_TITLES.length)];
      }
    } else if (roll < 0.65) {
      group = 'Kỹ thuật viên';
      department = MOCK_DEPARTMENTS[6] || MOCK_DEPARTMENTS[7]; // Xét nghiệm / CDHA
      jobTitle = MOCK_TECH_TITLES[Math.floor(Math.random() * MOCK_TECH_TITLES.length)];
    } else if (roll < 0.75) {
      group = 'Dược sĩ';
      department = 'Khoa Dược';
      jobTitle = MOCK_PHARM_TITLES[Math.floor(Math.random() * MOCK_PHARM_TITLES.length)];
    } else if (roll < 0.8) {
      group = 'Hộ sinh';
      department = 'Khoa Phụ Sản';
      jobTitle = Math.random() > 0.3 ? 'Hộ sinh viên' : 'Hộ sinh trưởng';
    } else {
      group = 'Hành chính / Support';
      department = MOCK_DEPARTMENTS[10 + Math.floor(Math.random() * 3)]; // Admin depts
      jobTitle = MOCK_ADMIN_TITLES[Math.floor(Math.random() * MOCK_ADMIN_TITLES.length)];
    }

    // Qualifications
    let qualification = 'Đại học';
    let degree = 'Cử nhân';
    let major = 'Khác';

    if (group === 'Bác sĩ') {
      degree = DEGREES.Doctor[Math.floor(Math.random() * DEGREES.Doctor.length)];
      qualification = degree.includes('TS') || degree.includes('CKII') ? 'Sau đại học' : 'Đại học';
      major = MAJORS.Doctor[Math.floor(Math.random() * MAJORS.Doctor.length)];
    } else if (group === 'Điều dưỡng') {
      degree = DEGREES.Nurse[Math.floor(Math.random() * DEGREES.Nurse.length)];
      qualification = degree === 'Thạc sĩ' ? 'Sau đại học' : degree;
      major = MAJORS.Nurse[Math.floor(Math.random() * MAJORS.Nurse.length)];
    } else if (group === 'Kỹ thuật viên') {
      degree = DEGREES.Technician[Math.floor(Math.random() * DEGREES.Technician.length)];
      qualification = degree;
      major = MAJORS.Technician[Math.floor(Math.random() * MAJORS.Technician.length)];
    } else if (group === 'Dược sĩ') {
      degree = DEGREES.Pharmacist[Math.floor(Math.random() * DEGREES.Pharmacist.length)];
      qualification = degree === 'Thạc sĩ' ? 'Sau đại học' : degree;
      major = MAJORS.Pharmacist[Math.floor(Math.random() * MAJORS.Pharmacist.length)];
    } else if (group === 'Hộ sinh') {
      degree = DEGREES.Midwife[Math.floor(Math.random() * DEGREES.Midwife.length)];
      qualification = degree;
      major = MAJORS.Midwife[Math.floor(Math.random() * MAJORS.Midwife.length)];
    } else {
      degree = DEGREES.Admin[Math.floor(Math.random() * DEGREES.Admin.length)];
      qualification = degree;
      major = MAJORS.Admin[Math.floor(Math.random() * MAJORS.Admin.length)];
    }

    // License parameters
    let licenseNumber = '';
    let licenseIssueDate = '';
    let licenseExpiryDate = '';

    const needsLicense = group !== 'Hành chính / Support' && group !== 'Khác';
    if (needsLicense) {
      // 5% missing license data for data quality warning
      if (Math.random() > 0.05) {
        licenseNumber = `CCHN-${String(100000 + i).slice(1)}/BYT`;
        // Issue date 1-8 years ago
        const issueYear = 2018 + Math.floor(Math.random() * 6);
        licenseIssueDate = `${issueYear}-06-15`;
        
        // Expiry dates: Valid, Expiring Soon, or Expired
        // To make interesting data:
        // i % 15 === 0 -> Expired (before Feb 2026)
        // i % 18 === 0 -> Expiring soon (April/May/June 2026)
        // rest -> Valid (expiry in 2028-2032)
        if (i % 15 === 0) {
          licenseExpiryDate = '2025-12-31'; // Expired
        } else if (i % 18 === 0) {
          licenseExpiryDate = '2026-05-10'; // Expiring soon in the middle of snapshot dates
        } else {
          licenseExpiryDate = '2030-12-31'; // Valid
        }
      }
    }

    // Add some random missing qualification data (1% missing)
    let finalQual = qualification;
    if (Math.random() < 0.015) {
      finalQual = '';
    }

    baseEmployees.push({
      employeeId: id,
      fullName,
      gender,
      dateOfBirth: randomDOB(),
      department,
      division: 'Tổ chuyên môn',
      jobTitle,
      professionalGroup: group,
      qualification: finalQual,
      degree,
      major,
      licenseNumber,
      licenseIssueDate,
      licenseExpiryDate,
      startDate: randomJoinDate(),
      employmentStatus: 'Đang làm việc',
      contractType: Math.random() > 0.25 ? 'Không xác định thời hạn' : 'Có xác định thời hạn (36 tháng)',
      snapshotDate: snapshotDates[0].date,
      raw: {},
    });
  }

  // Build sequential snapshots with changes (hires, exits, transfers, promotions)
  const snapshots: SnapshotData[] = [];
  let currentList = [...baseEmployees];

  snapshotDates.forEach((snap, idx) => {
    // Clone current list for this snapshot
    const snapEmployees: EmployeeRecord[] = currentList.map((emp) => ({
      ...emp,
      snapshotDate: snap.date,
    }));

    if (idx > 0) {
      // Modify employees for subsequent snapshots to simulate movement
      
      // 1. Simulate Exit: remove 1-2 random employees (Exit)
      if (idx % 2 === 0) {
        const exitIndex = Math.floor(Math.random() * snapEmployees.length);
        const exited = snapEmployees.splice(exitIndex, 1)[0];
        // console.log(`Snapshot ${snap.name}: Employee ${exited.employeeId} exited`);
      }

      // 2. Simulate Hire: add 1-2 new employees (Hire)
      if (idx % 2 === 1) {
        const newIndex = baseEmployees.length + idx * 2;
        const id = `NV${String(1000 + newIndex).slice(1)}`;
        const gender = Math.random() > 0.5 ? 'Nữ' : 'Nam';
        const group = Math.random() > 0.4 ? 'Điều dưỡng' : 'Bác sĩ';
        const department = MOCK_DEPARTMENTS[Math.floor(Math.random() * 5)];
        const jobTitle = group === 'Bác sĩ' ? 'Bác sĩ điều trị' : 'Điều dưỡng viên';
        
        snapEmployees.push({
          employeeId: id,
          fullName: generateName(gender),
          gender,
          dateOfBirth: randomDOB(24, 30),
          department,
          division: 'Tổ chuyên môn',
          jobTitle,
          professionalGroup: group,
          qualification: 'Đại học',
          degree: group === 'Bác sĩ' ? 'BS' : 'Cử nhân',
          major: group === 'Bác sĩ' ? 'Y đa khoa' : 'Điều dưỡng đa khoa',
          licenseNumber: `CCHN-${String(100000 + newIndex).slice(1)}/BYT`,
          licenseIssueDate: '2025-10-15',
          licenseExpiryDate: '2031-10-15',
          startDate: snap.date,
          employmentStatus: 'Đang làm việc',
          contractType: 'Có xác định thời hạn (36 tháng)',
          snapshotDate: snap.date,
          raw: {},
        });
      }

      // 3. Simulate Transfer: Change department for 1 employee
      if (idx % 3 === 0) {
        const transferIndex = Math.floor(Math.random() * snapEmployees.length);
        const emp = snapEmployees[transferIndex];
        const oldDept = emp.department;
        let newDept = MOCK_DEPARTMENTS[Math.floor(Math.random() * MOCK_DEPARTMENTS.length)];
        while (newDept === oldDept) {
          newDept = MOCK_DEPARTMENTS[Math.floor(Math.random() * MOCK_DEPARTMENTS.length)];
        }
        emp.department = newDept;
      }

      // 4. Simulate Role Change / Promotion: Change job title for 1 employee
      if (idx % 4 === 1) {
        const promoIndex = Math.floor(Math.random() * snapEmployees.length);
        const emp = snapEmployees[promoIndex];
        if (emp.professionalGroup === 'Bác sĩ' && !emp.jobTitle.includes('Trưởng khoa')) {
          emp.jobTitle = 'Bác sĩ Trưởng khoa';
        } else if (emp.professionalGroup === 'Điều dưỡng' && !emp.jobTitle.includes('trưởng')) {
          emp.jobTitle = 'Điều dưỡng trưởng khoa';
        }
      }
    }

    snapshots.push({
      snapshotDate: snap.date,
      sheetName: snap.name,
      employees: snapEmployees,
    });

    // Update currentList for next loop
    currentList = snapEmployees;
  });

  return snapshots;
}
