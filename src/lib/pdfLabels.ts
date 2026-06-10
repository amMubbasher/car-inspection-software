export type PdfLabels = {
  title: string;
  subtitle: string;
  fileNumber: string;
  vehicle: string;
  chassis: string;
  inspector: string;
  date: string;
  currentOdo: string;
  summaryHeading: string;
  okay: string;
  minor: string;
  major: string;
  sectionMinor: string;
  sectionMajor: string;
  sectionOk: string;
  comment: string;
  disclaimer: string;
  disclaimerLine1: string;
  disclaimerLine2: string;
  generatedOn: string;
  fallback: string;
};

export const PDF_LABELS_EN: PdfLabels = {
  title: "CAR INSPECTION REPORT",
  subtitle: "Comprehensive Vehicle Assessment",
  fileNumber: "FILE #",
  vehicle: "VEHICLE",
  chassis: "CHASSIS #",
  inspector: "INSPECTOR",
  date: "DATE",
  currentOdo: "CURRENT ODO",
  summaryHeading: "Summary of Inspection",
  okay: "Okay",
  minor: "Minor",
  major: "Major",
  sectionMinor: "Minor",
  sectionMajor: "Major",
  sectionOk: "OK",
  comment: "Comment:",
  disclaimer: "Disclaimer:",
  disclaimerLine1:
    "I acknowledge Motor Expert has inspected my vehicle and returned it in good condition.",
  disclaimerLine2:
    "I acknowledge that this inspection is valid only at the time of inspection.",
  generatedOn: "Generated on",
  fallback: "-",
};

export function getPdfLabelKeys(): (keyof PdfLabels)[] {
  return Object.keys(PDF_LABELS_EN) as (keyof PdfLabels)[];
}

/** Labels translated from the summary section onward (header/info box stays English). */
export const PDF_TRANSLATABLE_LABEL_KEYS: (keyof PdfLabels)[] = [
  "summaryHeading",
  "okay",
  "minor",
  "major",
  "sectionMinor",
  "sectionMajor",
  "sectionOk",
  "comment",
  "disclaimer",
  "disclaimerLine1",
  "disclaimerLine2",
  "generatedOn",
];
