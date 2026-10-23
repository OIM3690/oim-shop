import type { Employee } from "./api";

export const fullName = (e: Employee) => `${e.first_name} ${e.last_name}`;

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
