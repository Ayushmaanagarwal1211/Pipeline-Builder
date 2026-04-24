"use client";

import { WorkflowApiError } from "./workflow-client";

export type RunStatusDto =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "PARTIAL"
  | "SKIPPED";

export type RunScopeDto = "FULL" | "SELECTED" | "SINGLE";

export interface NodeRunDto {
  readonly id: string;
  readonly nodeId: string;
  readonly nodeKind: string;
  readonly status: RunStatusDto;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
  readonly errorMessage: string | null;
  readonly outputs: unknown;
}

export interface WorkflowRunDto {
  readonly id: string;
  readonly workflowId: string;
  readonly scope: RunScopeDto;
  readonly status: RunStatusDto;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly selection: readonly string[] | null;
  readonly nodeRuns: readonly NodeRunDto[];
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = body?.error ?? {
      code: "unknown_error",
      message: "Request failed",
    };
    throw new WorkflowApiError(response.status, error.code, error.message);
  }
  return response.json() as Promise<T>;
}

export async function apiStartRun(input: {
  workflowId: string;
  scope: RunScopeDto;
  selection?: readonly string[];
}): Promise<WorkflowRunDto> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ run: WorkflowRunDto }>(res);
  return data.run;
}

export async function apiGetRun(runId: string): Promise<WorkflowRunDto> {
  const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
  const data = await parseJson<{ run: WorkflowRunDto }>(res);
  return data.run;
}

export async function apiListRuns(
  workflowId: string,
): Promise<readonly WorkflowRunDto[]> {
  const res = await fetch(`/api/workflows/${workflowId}/runs`, {
    cache: "no-store",
  });
  const data = await parseJson<{ runs: readonly WorkflowRunDto[] }>(res);
  return data.runs;
}
