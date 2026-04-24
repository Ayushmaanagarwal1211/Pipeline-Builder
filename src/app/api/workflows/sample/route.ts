import { NextResponse } from "next/server";

import { ensureCurrentUser } from "@/lib/auth/current-user";
import { handleError } from "@/lib/api/handler-utils";
import { createWorkflow } from "@/lib/api/workflow-service";
import { buildSampleWorkflow } from "@/lib/workflow/sample-workflow";

/**
 * Provision the spec's required sample workflow into the current user's
 * account. Always creates a fresh copy so the user can experiment without
 * touching the canonical seed.
 */
export async function POST() {
  try {
    const userId = await ensureCurrentUser();
    const sample = buildSampleWorkflow();
    const workflow = await createWorkflow(userId, {
      name: sample.name,
      nodes: [...sample.nodes],
      edges: [...sample.edges],
    });
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
