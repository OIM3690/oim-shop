import type { Directory, Employee } from "./api";

// The server joins first and last name; a rep has only the display name they chose.
export const fullName = (e: Employee) => e.name;

type Person = Directory[number];

export interface ReportingNode {
  employee: Person;
  reports: ReportingNode[];
}

/** Turns each employee's reports_to into a tree, starting from whoever reports to no one. */
export function reportingTree(employees: Person[]): ReportingNode[] {
  const build = (managerId: number | null): ReportingNode[] =>
    employees
      .filter((e) => e.reports_to === managerId)
      .map((employee) => ({ employee, reports: build(employee.employee_id) }));
  return build(null);
}
