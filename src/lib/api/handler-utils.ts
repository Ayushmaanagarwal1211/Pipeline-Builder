import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { ApiError } from "./api-error";

export interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

/**
 * Normalize any thrown value into a JSON error response so route handlers
 * never need their own try/catch boilerplate.
 */
export function handleError(error: unknown): NextResponse<ErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Invalid request payload",
          details: error.issues,
        },
      },
      { status: 400 },
    );
  }
  const message =
    error instanceof Error ? error.message : "Internal server error";
  console.error("[api] unexpected error", error);
  return NextResponse.json(
    { error: { code: "internal_error", message } },
    { status: 500 },
  );
}

/**
 * Read and validate a JSON body against a Zod schema in one call.
 * Throws `ApiError.badRequest` on malformed JSON; `ZodError` on shape errors.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
  return schema.parse(raw);
}
