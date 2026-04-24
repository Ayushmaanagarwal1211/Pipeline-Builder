import { RunScope, RunStatus, type NodeRun, type WorkflowRun } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { runWorkflowTask } from "@/trigger/tasks/run-workflow";
import { ApiError } from "./api-error";

export interface StartRunInput {
  readonly workflowId: string;
  readonly scope: RunScope;
  readonly selection?: readonly string[] | null;
}

export interface NodeRunDetail {
  readonly id: string;
  readonly nodeId: string;
  readonly nodeKind: string;
  readonly status: RunStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly durationMs: number | null;
  readonly errorMessage: string | null;
  readonly outputs: unknown;
}

export interface WorkflowRunDetail {
  readonly id: string;
  readonly workflowId: string;
  readonly scope: RunScope;
  readonly status: RunStatus;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly selection: readonly string[] | null;
  readonly nodeRuns: readonly NodeRunDetail[];
}

/**
 * Create a `WorkflowRun` row and dispatch the orchestrator task.
 * Returns the run id so the client can poll for status.
 */
export async function startRun(
  userId: string,
  input: StartRunInput,
): Promise<WorkflowRunDetail> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: input.workflowId },
    select: { id: true, userId: true },
  });
  if (!workflow) throw ApiError.notFound("Workflow");
  if (workflow.userId !== userId) throw ApiError.forbidden();

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      userId,
      scope: input.scope,
      status: RunStatus.QUEUED,
      selection: input.selection ? [...input.selection] : undefined,
    },
  });

  // Fire-and-forget trigger — the task updates status as it progresses.
  await runWorkflowTask.trigger({ workflowRunId: run.id });

  return toDetail(run, []);
}

export async function getRun(
  userId: string,
  runId: string,
): Promise<WorkflowRunDetail> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      nodeRuns: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!run) throw ApiError.notFound("Run");
  if (run.userId !== userId) throw ApiError.forbidden();

  return toDetail(run, run.nodeRuns);
}

export async function listRuns(
  userId: string,
  workflowId: string,
): Promise<readonly WorkflowRunDetail[]> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { userId: true },
  });
  if (!workflow) throw ApiError.notFound("Workflow");
  if (workflow.userId !== userId) throw ApiError.forbidden();

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId, userId },
    include: { nodeRuns: { orderBy: { startedAt: "asc" } } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return runs.map((run) => toDetail(run, run.nodeRuns));
}

function toDetail(
  run: WorkflowRun,
  nodeRuns: readonly NodeRun[],
): WorkflowRunDetail {
  return {
    id: run.id,
    workflowId: run.workflowId,
    scope: run.scope,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    selection: Array.isArray(run.selection)
      ? (run.selection as unknown as string[])
      : null,
    nodeRuns: nodeRuns.map((nr) => ({
      id: nr.id,
      nodeId: nr.nodeId,
      nodeKind: nr.nodeKind,
      status: nr.status,
      startedAt: nr.startedAt,
      completedAt: nr.completedAt,
      durationMs: nr.durationMs,
      errorMessage: nr.errorMessage,
      outputs: nr.outputs,
    })),
  };
}
