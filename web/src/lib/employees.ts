import type { Employee } from "./api";

// The server joins first and last name; a rep has only the display name they chose.
export const fullName = (e: Employee) => e.name;

export interface ReportingNode {
  employee: Employee;
  reports: ReportingNode[];
}

/** Turns each employee's reports_to into a tree, starting from whoever reports to no one. */
export function reportingTree(employees: Employee[]): ReportingNode[] {
  const build = (managerId: number | null): ReportingNode[] =>
    employees
      .filter((e) => e.reports_to === managerId)
      .map((employee) => ({ employee, reports: build(employee.employee_id) }));
  return build(null);
}
