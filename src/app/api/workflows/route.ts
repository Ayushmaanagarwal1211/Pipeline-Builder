import { NextResponse } from "next/server";

import { ensureCurrentUser } from "@/lib/auth/current-user";
import { handleError, parseBody } from "@/lib/api/handler-utils";
import { CreateWorkflowInputSchema } from "@/lib/api/workflow-schemas";
import {
  createWorkflow,
  listWorkflows,
} from "@/lib/api/workflow-service";

export async function GET() {
  try {
    const userId = await ensureCurrentUser();
    const workflows = await listWorkflows(userId);
    return NextResponse.json({ workflows });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await ensureCurrentUser();
    const input = await parseBody(request, CreateWorkflowInputSchema);
    const workflow = await createWorkflow(userId, input);
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
