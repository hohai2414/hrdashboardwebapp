import { SnapshotData } from '../types/hr';
import { getDaysDiff } from './dateUtils';

export interface ForecastPoint {
  dateStr: string; // YYYY-MM-DD
  headcount: number;
  isProjected: boolean;
}

export interface PlanningInsights {
  avgMonthlyGrowth: number;
  avgMonthlyExits: number;
  avgMonthlyHires: number;
  negativeTrendDepts: string[];
  negativeTrendRoles: string[];
  projectedHeadcount3m: number;
  forecastPoints: ForecastPoint[];
}

/**
 * Fits a linear regression line y = m * x + c and projects values
 */
export function generateHeadcountForecast(snapshots: SnapshotData[]): PlanningInsights | null {
  if (snapshots.length < 3) {
    return null;
  }

  // 1. Calculate time offsets in days from the first snapshot
  const firstDate = snapshots[0].snapshotDate;
  const dataPoints = snapshots.map((s) => {
    return {
      x: getDaysDiff(s.snapshotDate, firstDate), // Days from start
      y: s.employees.length,
      date: s.snapshotDate,
    };
  });

  const n = dataPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  dataPoints.forEach((pt) => {
    sumX += pt.x;
    sumY += pt.y;
    sumXY += pt.x * pt.y;
    sumXX += pt.x * pt.x;
  });

  const denominator = n * sumXX - sumX * sumX;
  const m = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const c = (sumY - m * sumX) / n;

  // 2. Average monthly metrics
  // Find duration in months
  const lastPt = dataPoints[n - 1];
  const totalDays = lastPt.x;
  const totalMonths = Math.max(1, totalDays / 30.4);

  // Exits and Hires totals
  let totalHires = 0;
  let totalExits = 0;
  for (let i = 1; i < snapshots.length; i++) {
    const prevEmps = new Set(snapshots[i - 1].employees.map((e) => e.employeeId).filter(Boolean));
    const currEmps = new Set(snapshots[i].employees.map((e) => e.employeeId).filter(Boolean));
    
    // Hires: in curr but not in prev
    snapshots[i].employees.forEach((emp) => {
      if (emp.employeeId && !prevEmps.has(emp.employeeId)) totalHires++;
    });
    // Exits: in prev but not in curr
    snapshots[i - 1].employees.forEach((emp) => {
      if (emp.employeeId && !currEmps.has(emp.employeeId)) totalExits++;
    });
  }

  const avgMonthlyHires = totalHires / totalMonths;
  const avgMonthlyExits = totalExits / totalMonths;
  const avgMonthlyGrowth = m * 30.4; // slope in headcount per month

  // 3. Project 3 months ahead (+30, +60, +90 days from last snapshot)
  const lastX = lastPt.x;
  const lastDateObj = new Date(lastPt.date);
  
  const forecastPoints: ForecastPoint[] = dataPoints.map((dp) => ({
    dateStr: dp.date,
    headcount: dp.y,
    isProjected: false,
  }));

  const projectionDays = [30, 60, 90];
  projectionDays.forEach((days) => {
    const futureDateObj = new Date(lastDateObj);
    futureDateObj.setDate(futureDateObj.getDate() + days);
    const dateStr = futureDateObj.toISOString().split('T')[0];
    
    const futureX = lastX + days;
    const projectedHeadcount = Math.max(0, Math.round(m * futureX + c));

    forecastPoints.push({
      dateStr,
      headcount: projectedHeadcount,
      isProjected: true,
    });
  });

  const projectedHeadcount3m = forecastPoints[forecastPoints.length - 1].headcount;

  // 4. Find departments and roles with negative growth trend (slopes < 0)
  const negativeTrendDepts = findNegativeTrends(snapshots, (emp) => emp.department);
  const negativeTrendRoles = findNegativeTrends(snapshots, (emp) => emp.jobTitle);

  return {
    avgMonthlyGrowth,
    avgMonthlyExits,
    avgMonthlyHires,
    negativeTrendDepts,
    negativeTrendRoles,
    projectedHeadcount3m,
    forecastPoints,
  };
}

/**
 * Helper to identify items (depts or roles) exhibiting a negative headcount trend
 */
function findNegativeTrends(
  snapshots: SnapshotData[],
  keyExtractor: (emp: any) => string
): string[] {
  const allKeys = Array.from(
    new Set(snapshots.flatMap((s) => s.employees.map(keyExtractor)).filter(Boolean))
  );

  const negativeItems: string[] = [];

  allKeys.forEach((key) => {
    // Get time points for this key
    const data = snapshots.map((s, idx) => {
      const count = s.employees.filter((emp) => keyExtractor(emp) === key).length;
      return { x: idx, y: count };
    });

    // Check if there is a general decline
    // Since data points are small, simple linear slope
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    data.forEach((d) => {
      sumX += d.x;
      sumY += d.y;
      sumXY += d.x * d.y;
      sumXX += d.x * d.x;
    });

    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

    // If slope is negative and the final count is low or declining
    if (slope < -0.1) {
      negativeItems.push(key);
    }
  });

  return negativeItems.slice(0, 5); // Limit to top 5
}
