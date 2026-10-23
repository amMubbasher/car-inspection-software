type JobLike = {
  price?: number | null;
  toObject?: (options?: { virtuals?: boolean }) => Record<string, unknown>;
  get?: (path: string) => unknown;
  [key: string]: unknown;
};

/**
 * The car name, also for jobs saved before `carNumber` was renamed to `carName` and not yet
 * migrated (scripts/migrate-car-name.ts). Safe to remove once the migration has run everywhere.
 */
export function carNameOf(job: object | null | undefined): string {
  if (!job) return "";
  const source = job as JobLike;
  const value =
    source.carName ??
    source.carNumber ??
    (typeof source.get === "function" ? source.get("carNumber") : undefined);
  return typeof value === "string" ? value : "";
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
    carName: carNameOf(plain) || carNameOf(source),
    price: Math.max(0, Number(plain.price) || 0),
  } as T;
}

export function serializeJobs<T>(jobs: T[]): T[] {
  return jobs.map((job) => serializeJob(job));
}
