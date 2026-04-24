"use client";

import type {
  WorkflowEdgeInput,
  WorkflowExportFile,
  WorkflowNodeInput,
} from "./workflow-schemas";

/**
 * Client-side fetchers that mirror the server routes. Each returns the parsed
 * JSON body or throws `WorkflowApiError` on non-2xx responses so callers can
 * surface a readable message to the user.
 */

export class WorkflowApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkflowApiError";
  }
}

export interface WorkflowDetailDto {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
}

export interface WorkflowSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = body?.error ?? { code: "unknown_error", message: "Request failed" };
    throw new WorkflowApiError(response.status, error.code, error.message);
  }
  return response.json() as Promise<T>;
}

export async function apiListWorkflows(): Promise<WorkflowSummaryDto[]> {
  const res = await fetch("/api/workflows", { cache: "no-store" });
  const data = await parseJson<{ workflows: WorkflowSummaryDto[] }>(res);
  return data.workflows;
}

export async function apiGetWorkflow(id: string): Promise<WorkflowDetailDto> {
  const res = await fetch(`/api/workflows/${id}`, { cache: "no-store" });
  const data = await parseJson<{ workflow: WorkflowDetailDto }>(res);
  return data.workflow;
}

export async function apiCreateWorkflow(input: {
  name?: string;
  nodes: WorkflowNodeInput[];
  edges: WorkflowEdgeInput[];
}): Promise<WorkflowDetailDto> {
  const res = await fetch("/api/workflows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ workflow: WorkflowDetailDto }>(res);
  return data.workflow;
}

export async function apiUpdateWorkflow(
  id: string,
  input: {
    name?: string;
    nodes?: WorkflowNodeInput[];
    edges?: WorkflowEdgeInput[];
  },
): Promise<WorkflowDetailDto> {
  const res = await fetch(`/api/workflows/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ workflow: WorkflowDetailDto }>(res);
  return data.workflow;
}

export async function apiImportWorkflow(
  file: WorkflowExportFile,
): Promise<WorkflowDetailDto> {
  const res = await fetch("/api/workflows/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(file),
  });
  const data = await parseJson<{ workflow: WorkflowDetailDto }>(res);
  return data.workflow;
}

/**
 * Provision a fresh copy of the spec-required sample workflow.
 */
export async function apiCreateSampleWorkflow(): Promise<WorkflowDetailDto> {
  const res = await fetch("/api/workflows/sample", { method: "POST" });
  const data = await parseJson<{ workflow: WorkflowDetailDto }>(res);
  return data.workflow;
}
