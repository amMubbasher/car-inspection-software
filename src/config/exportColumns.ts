// Columns available in the jobs Excel export, in the order they appear in the file.
// The server only ever returns these keys, so adding a column here also needs a case in
// src/app/api/jobs/export/route.ts.
export const EXPORT_COLUMNS = [
  { key: "jobNumber", label: "Job #" },
  { key: "createdAt", label: "Date" },
  { key: "carName", label: "Car Name" },
  { key: "customerName", label: "Customer Name" },
  { key: "customerPhone", label: "Customer Number" },
  { key: "chassisNumber", label: "Chassis Number" },
  { key: "odometer", label: "Odometer" },
  { key: "inspectionType", label: "Inspection Type" },
  { key: "status", label: "Status" },
  { key: "price", label: "Price" },
  { key: "paymentMethod", label: "Payment Method" },
  { key: "inspectorName", label: "Inspector Name" },
  { key: "inspectorEmail", label: "Inspector Email" },
  { key: "createdByName", label: "Created By Name" },
  { key: "createdByEmail", label: "Created By Email" },
] as const;

export type ExportColumnKey = (typeof EXPORT_COLUMNS)[number]["key"];

export const EXPORT_COLUMN_KEYS: readonly ExportColumnKey[] = EXPORT_COLUMNS.map((c) => c.key);

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumnKey[] = [
  "jobNumber",
  "createdAt",
  "carName",
  "customerName",
  "customerPhone",
  "chassisNumber",
  "odometer",
  "price",
  "inspectorName",
  "inspectorEmail",
  "createdByName",
  "createdByEmail",
];

export function isExportColumn(value: unknown): value is ExportColumnKey {
  return typeof value === "string" && (EXPORT_COLUMN_KEYS as readonly string[]).includes(value);
}

/** Old column keys that were renamed; saved selections still use them. */
const RENAMED_COLUMNS: Record<string, ExportColumnKey> = { carNumber: "carName" };

/** Keeps known keys only, in catalog order. */
export function normalizeExportColumns(values: readonly unknown[]): ExportColumnKey[] {
  const wanted = new Set(
    values
      .map((value) => (typeof value === "string" ? RENAMED_COLUMNS[value] ?? value : value))
      .filter(isExportColumn)
  );
  return EXPORT_COLUMN_KEYS.filter((key) => wanted.has(key));
}

/** Inspector filter value for jobs nobody has been assigned to yet. */
export const UNASSIGNED_INSPECTOR = "unassigned";

/** Upper bound on rows per export, so one request can't pull the whole database. */
export const EXPORT_MAX_ROWS = 10000;
