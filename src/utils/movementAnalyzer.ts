import { EmployeeRecord, MovementRecord } from '../types/hr';

/**
 * Analyzes the movements (hires, exits, transfers, role changes) between two consecutive snapshots.
 */
export function analyzeMovement(
  currentEmployees: EmployeeRecord[],
  previousEmployees: EmployeeRecord[],
  currentSnapshot: string,
  previousSnapshot: string | null
): MovementRecord[] {
  const movements: MovementRecord[] = [];

  const currentMap = new Map<string, EmployeeRecord>();
  currentEmployees.forEach((emp) => {
    if (emp.employeeId) currentMap.set(emp.employeeId, emp);
  });

  const previousMap = new Map<string, EmployeeRecord>();
  previousEmployees.forEach((emp) => {
    if (emp.employeeId) previousMap.set(emp.employeeId, emp);
  });

  // 1. Check for New Hires, Transfers, Role Changes, and Existing
  currentEmployees.forEach((curr) => {
    const id = curr.employeeId;
    if (!id) return;

    const prev = previousMap.get(id);

    if (!prev) {
      // Not in previous snapshot => New Hire
      movements.push({
        employeeId: id,
        fullName: curr.fullName,
        previousSnapshot,
        currentSnapshot,
        previousDepartment: null,
        currentDepartment: curr.department,
        previousJobTitle: null,
        currentJobTitle: curr.jobTitle,
        movementType: 'New Hire',
      });
    } else {
      // In both snapshots => Check for Transfer or Role Change
      const deptChanged = curr.department !== prev.department;
      const titleChanged = curr.jobTitle !== prev.jobTitle;

      if (deptChanged) {
        movements.push({
          employeeId: id,
          fullName: curr.fullName,
          previousSnapshot,
          currentSnapshot,
          previousDepartment: prev.department,
          currentDepartment: curr.department,
          previousJobTitle: prev.jobTitle,
          currentJobTitle: curr.jobTitle,
          movementType: 'Transfer',
        });
      } else if (titleChanged) {
        movements.push({
          employeeId: id,
          fullName: curr.fullName,
          previousSnapshot,
          currentSnapshot,
          previousDepartment: prev.department,
          currentDepartment: curr.department,
          previousJobTitle: prev.jobTitle,
          currentJobTitle: curr.jobTitle,
          movementType: 'Role Change',
        });
      } else {
        // No changes
        movements.push({
          employeeId: id,
          fullName: curr.fullName,
          previousSnapshot,
          currentSnapshot,
          previousDepartment: prev.department,
          currentDepartment: curr.department,
          previousJobTitle: prev.jobTitle,
          currentJobTitle: curr.jobTitle,
          movementType: 'Existing',
        });
      }
    }
  });

  // 2. Check for Exits (in previous but not in current)
  previousEmployees.forEach((prev) => {
    const id = prev.employeeId;
    if (!id) return;

    if (!currentMap.has(id)) {
      movements.push({
        employeeId: id,
        fullName: prev.fullName,
        previousSnapshot,
        currentSnapshot,
        previousDepartment: prev.department,
        currentDepartment: null,
        previousJobTitle: prev.jobTitle,
        currentJobTitle: null,
        movementType: 'Exit',
      });
    }
  });

  return movements;
}

/**
 * Returns movement status label for an employee in the current snapshot
 */
export function getEmployeeMovementStatus(
  empId: string,
  movements: MovementRecord[]
): MovementRecord['movementType'] {
  const match = movements.find((m) => m.employeeId === empId);
  return match ? match.movementType : 'Existing';
}
