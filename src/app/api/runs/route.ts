import { NextResponse } from "next/server";

import { ensureCurrentUser } from "@/lib/auth/current-user";
import { handleError, parseBody } from "@/lib/api/handler-utils";
import { StartRunInputSchema } from "@/lib/api/run-schemas";
import { startRun } from "@/lib/api/run-service";

export async function POST(request: Request) {
  try {
    const userId = await ensureCurrentUser();
    const input = await parseBody(request, StartRunInputSchema);
    const run = await startRun(userId, input);
    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
}
