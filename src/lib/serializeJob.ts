type JobLike = {
  price?: number | null;
  toObject?: (options?: { virtuals?: boolean }) => Record<string, unknown>;
  [key: string]: unknown;
};

export function serializeJob<T>(job: T): T {
  if (!job || typeof job !== "object") return job;

  const source = job as JobLike;
  const plain =
    typeof source.toObject === "function"
      ? source.toObject({ virtuals: true })
      : { ...source };

  return {
    ...plain,
    price: Math.max(0, Number(plain.price) || 0),
  } as T;
}

export function serializeJobs<T>(jobs: T[]): T[] {
  return jobs.map((job) => serializeJob(job));
}
