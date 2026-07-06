import { NextResponse } from "next/server";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function mongoErrorCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

export function apiError(
  error: unknown,
  fallback = "Request failed",
  status = 500
) {
  console.error(fallback, error);

  const details = errorMessage(error);
  const code = mongoErrorCode(error);

  if (code === 11000) {
    return NextResponse.json(
      { message: "Duplicate entry", details },
      { status: 409 }
    );
  }

  return NextResponse.json({ message: fallback, details }, { status });
}
