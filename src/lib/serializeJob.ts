type SubIssueLike = {
  price?: number | null;
  [key: string]: unknown;
};

type InspectionTabLike = {
  subIssues?: SubIssueLike[];
  [key: string]: unknown;
};

type JobLike = {
  inspectionTabs?: InspectionTabLike[];
  toObject?: (options?: { virtuals?: boolean }) => Record<string, unknown>;
  [key: string]: unknown;
};

function normalizeSubIssue(issue: SubIssueLike) {
  return {
    ...issue,
    price: Math.max(0, Number(issue.price) || 0),
  };
}

function normalizeInspectionTabs(tabs?: InspectionTabLike[]) {
  if (!Array.isArray(tabs)) return tabs;

  return tabs.map((tab) => ({
    ...tab,
    subIssues: Array.isArray(tab.subIssues)
      ? tab.subIssues.map(normalizeSubIssue)
      : [],
  }));
}

export function serializeJob<T>(job: T): T {
  if (!job || typeof job !== "object") return job;

  const source = job as JobLike;
  const plain =
    typeof source.toObject === "function"
      ? source.toObject({ virtuals: true })
      : { ...source };

  return {
    ...plain,
    inspectionTabs: normalizeInspectionTabs(
      plain.inspectionTabs as InspectionTabLike[] | undefined
    ),
  } as T;
}

export function serializeJobs<T>(jobs: T[]): T[] {
  return jobs.map((job) => serializeJob(job));
}
