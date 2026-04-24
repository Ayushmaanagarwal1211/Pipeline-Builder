import { Prisma, type Workflow } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "./api-error";
import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowEdgeInput,
  WorkflowExportFile,
  WorkflowNodeInput,
} from "./workflow-schemas";

/**
 * Prisma's `Json` columns are typed as `InputJsonValue`, a deep structural
 * type that doesn't match our Zod-inferred shapes even when the data is
 * structurally identical. Cast through `unknown` at the DB boundary.
 */
function toJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export interface WorkflowSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: Date;
  readonly createdAt: Date;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface WorkflowDetail extends WorkflowSummary {
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
}

/**
 * List all workflows for a user, most-recently-updated first.
 */
export async function listWorkflows(
  userId: string,
): Promise<WorkflowSummary[]> {
  const rows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      nodes: true,
      edges: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    nodeCount: Array.isArray(row.nodes) ? row.nodes.length : 0,
    edgeCount: Array.isArray(row.edges) ? row.edges.length : 0,
  }));
}

/**
 * Load a workflow by id. Throws `ApiError.notFound` / `forbidden` so the
 * caller doesn't have to check presence and ownership separately.
 */
export async function getWorkflow(
  userId: string,
  workflowId: string,
): Promise<WorkflowDetail> {
  const row = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });
  if (!row) throw ApiError.notFound("Workflow");
  if (row.userId !== userId) throw ApiError.forbidden();
  return rowToDetail(row);
}

export async function createWorkflow(
  userId: string,
  input: CreateWorkflowInput,
): Promise<WorkflowDetail> {
  const row = await prisma.workflow.create({
    data: {
      userId,
      name: input.name ?? "Untitled",
      nodes: toJson(input.nodes),
      edges: toJson(input.edges),
    },
  });
  return rowToDetail(row);
}

/**
 * Partial update — only the provided fields are written. `updatedAt` is
 * bumped automatically by Prisma's `@updatedAt` annotation.
 */
export async function updateWorkflow(
  userId: string,
  workflowId: string,
  input: UpdateWorkflowInput,
): Promise<WorkflowDetail> {
  const existing = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { userId: true },
  });
  if (!existing) throw ApiError.notFound("Workflow");
  if (existing.userId !== userId) throw ApiError.forbidden();

  const row = await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nodes !== undefined ? { nodes: toJson(input.nodes) } : {}),
      ...(input.edges !== undefined ? { edges: toJson(input.edges) } : {}),
    },
  });
  return rowToDetail(row);
}

export async function deleteWorkflow(
  userId: string,
  workflowId: string,
): Promise<void> {
  const existing = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { userId: true },
  });
  if (!existing) throw ApiError.notFound("Workflow");
  if (existing.userId !== userId) throw ApiError.forbidden();

  await prisma.workflow.delete({ where: { id: workflowId } });
}

/**
 * Build the JSON file that the user downloads on export.
 */
export function toExportFile(workflow: WorkflowDetail): WorkflowExportFile {
  return {
    version: 1,
    name: workflow.name,
    nodes: workflow.nodes.map((n) => n),
    edges: workflow.edges.map((e) => e),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Import an exported file into a new workflow owned by `userId`.
 */
export async function importWorkflow(
  userId: string,
  file: WorkflowExportFile,
): Promise<WorkflowDetail> {
  return createWorkflow(userId, {
    name: file.name,
    nodes: file.nodes,
    edges: file.edges,
  });
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

function rowToDetail(row: Workflow): WorkflowDetail {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    nodes: (row.nodes as unknown as WorkflowNodeInput[]) ?? [],
    edges: (row.edges as unknown as WorkflowEdgeInput[]) ?? [],
    nodeCount: Array.isArray(row.nodes) ? row.nodes.length : 0,
    edgeCount: Array.isArray(row.edges) ? row.edges.length : 0,
  };
}
