import { NextResponse } from "next/server";

import { ensureCurrentUser } from "@/lib/auth/current-user";
import { handleError, parseBody } from "@/lib/api/handler-utils";
import { UpdateWorkflowInputSchema } from "@/lib/api/workflow-schemas";
import {
  deleteWorkflow,
  getWorkflow,
  updateWorkflow,
} from "@/lib/api/workflow-service";

// In Next.js 16 route-handler params are Promises.
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await ensureCurrentUser();
    const { id } = await context.params;
    const workflow = await getWorkflow(userId, id);
    return NextResponse.json({ workflow });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await ensureCurrentUser();
    const { id } = await context.params;
    const input = await parseBody(request, UpdateWorkflowInputSchema);
    const workflow = await updateWorkflow(userId, id, input);
    return NextResponse.json({ workflow });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await ensureCurrentUser();
    const { id } = await context.params;
    await deleteWorkflow(userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
