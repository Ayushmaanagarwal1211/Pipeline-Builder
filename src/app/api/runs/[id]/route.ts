import { NextResponse } from "next/server";

import { ensureCurrentUser } from "@/lib/auth/current-user";
import { handleError } from "@/lib/api/handler-utils";
import { getRun } from "@/lib/api/run-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await ensureCurrentUser();
    const { id } = await context.params;
    const run = await getRun(userId, id);
    return NextResponse.json({ run });
  } catch (error) {
    return handleError(error);
  }
}
