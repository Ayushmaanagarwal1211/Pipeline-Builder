import { NextResponse } from "next/server";

import { ensureCurrentUser } from "@/lib/auth/current-user";
import { handleError, parseBody } from "@/lib/api/handler-utils";
import { WorkflowExportFileSchema } from "@/lib/api/workflow-schemas";
import { importWorkflow } from "@/lib/api/workflow-service";

export async function POST(request: Request) {
  try {
    const userId = await ensureCurrentUser();
    const file = await parseBody(request, WorkflowExportFileSchema);
    const workflow = await importWorkflow(userId, file);
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
