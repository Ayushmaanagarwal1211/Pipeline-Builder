import { RunStatus } from "@prisma/client";
import { batch, task } from "@trigger.dev/sdk";

import type {
  WorkflowEdgeInput,
  WorkflowNodeInput,
} from "@/lib/api/workflow-schemas";
import { prisma } from "@/lib/db/prisma";
import {
  filterGraphByScope,
  indexIncomingEdges,
  topologicalBatches,
} from "@/lib/workflow/dag";
import { DEFAULT_GEMINI_MODEL } from "@/lib/workflow/llm-models";
import type {
  CropImageNodeData,
  ExtractFrameNodeData,
  RunLlmNodeData,
  TextNodeData,
  UploadImageNodeData,
  UploadVideoNodeData,
  WorkflowNodeData,
} from "@/lib/workflow/types";
import {
  cropImagePayloadFromInputs,
  extractFramePayloadFromInputs,
  runLlmPayloadFromInputs,
  type ResolvedInputs,
  type NodeOutputs,
} from "./node-executors";
import { cropImageTask } from "./crop-image";
import { extractFrameTask } from "./extract-frame";
import { runLlmTask } from "./run-llm";
import { RunWorkflowPayloadSchema, type RunWorkflowPayload } from "../schemas";

/**
 * Orchestrator task. Loads a `WorkflowRun`, walks the DAG in topological
 * batches, and records a `NodeRun` for every node. Within each batch:
 *
 *   - Source nodes (text, upload-image, upload-video) resolve inline — no
 *     sub-task, no network round-trip, outputs are already on disk.
 *   - Executable nodes (run-llm, crop-image, extract-frame) are dispatched
 *     as a single `batch.triggerByTaskAndWait(...)` call so independent
 *     branches execute concurrently on the Trigger.dev side. This satisfies
 *     the spec's "Independent branches MUST execute concurrently" while
 *     avoiding the `TASK_DID_CONCURRENT_WAIT` error that bare
 *     `Promise.allSettled(triggerAndWait)` would hit.
 *
 * Per-node failures are recorded without aborting the run; the workflow
 * status resolves to PARTIAL if any node failed but independent branches
 * succeeded.
 */
export const runWorkflowTask = task({
  id: "nextflow.run-workflow",
  maxDuration: 600,
  run: async (rawPayload: RunWorkflowPayload) => {
    const { workflowRunId } = RunWorkflowPayloadSchema.parse(rawPayload);

    const workflowRun = await prisma.workflowRun.findUniqueOrThrow({
      where: { id: workflowRunId },
      include: { workflow: true },
    });

    const nodes =
      (workflowRun.workflow.nodes as unknown as WorkflowNodeInput[]) ?? [];
    const edges =
      (workflowRun.workflow.edges as unknown as WorkflowEdgeInput[]) ?? [];
    const selection =
      (workflowRun.selection as unknown as string[] | null) ?? null;

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { status: RunStatus.RUNNING },
    });

    try {
      const runnableNodes = filterGraphByScope(
        nodes,
        edges,
        workflowRun.scope,
        selection,
      );
      const runnableEdges = edges.filter(
        (edge) =>
          runnableNodes.some((n) => n.id === edge.source) &&
          runnableNodes.some((n) => n.id === edge.target),
      );
      const batches = topologicalBatches(runnableNodes, runnableEdges);
      const incomingIndex = indexIncomingEdges(runnableEdges);

      const outputsByNode = new Map<string, NodeOutputs>();
      const runStats = { anyFailed: false, anySucceeded: false };

      for (const topoBatch of batches) {
        const { toRun, toSkip } = partitionBatch(
          topoBatch,
          incomingIndex,
          outputsByNode,
        );

        for (const { node, missingUpstreamId } of toSkip) {
          await recordSkippedNode({
            workflowRunId,
            node,
            missingUpstreamId,
          });
        }

        await executeBatchInParallel({
          workflowRunId,
          batch: toRun,
          incomingIndex,
          outputsByNode,
          stats: runStats,
        });
      }

      const finalStatus =
        runStats.anyFailed && runStats.anySucceeded
          ? RunStatus.PARTIAL
          : runStats.anyFailed
            ? RunStatus.FAILED
            : RunStatus.SUCCESS;

      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: { status: finalStatus, completedAt: new Date() },
      });

      return { status: finalStatus };
    } catch (error) {
      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: { status: RunStatus.FAILED, completedAt: new Date() },
      });
      throw error;
    }
  },
});

// -----------------------------------------------------------------------------
// Batch execution — split into inline (sync) + task-dispatched (parallel)
// -----------------------------------------------------------------------------

type RunStats = { anyFailed: boolean; anySucceeded: boolean };

interface ExecuteBatchArgs {
  readonly workflowRunId: string;
  readonly batch: readonly WorkflowNodeInput[];
  readonly incomingIndex: ReturnType<typeof indexIncomingEdges>;
  readonly outputsByNode: Map<string, NodeOutputs>;
  readonly stats: RunStats;
}

async function executeBatchInParallel({
  workflowRunId,
  batch: nodes,
  incomingIndex,
  outputsByNode,
  stats,
}: ExecuteBatchArgs): Promise<void> {
  const inlineNodes: WorkflowNodeInput[] = [];
  const taskNodes: WorkflowNodeInput[] = [];
  for (const node of nodes) {
    if (isInlineNode(node)) inlineNodes.push(node);
    else taskNodes.push(node);
  }

  // Inline resolution is ~instant (no I/O), so serial is fine.
  for (const node of inlineNodes) {
    await runInlineNode({
      workflowRunId,
      node,
      incomingIndex,
      outputsByNode,
      stats,
    });
  }

  if (taskNodes.length > 0) {
    await dispatchTaskNodesInParallel({
      workflowRunId,
      nodes: taskNodes,
      incomingIndex,
      outputsByNode,
      stats,
    });
  }
}

// -----------------------------------------------------------------------------
// Inline nodes (text, upload-image, upload-video) — no Trigger.dev sub-task
// -----------------------------------------------------------------------------

function isInlineNode(node: WorkflowNodeInput): boolean {
  const kind = (node.data as { kind?: string }).kind;
  return kind === "text" || kind === "upload-image" || kind === "upload-video";
}

interface RunInlineArgs {
  readonly workflowRunId: string;
  readonly node: WorkflowNodeInput;
  readonly incomingIndex: ReturnType<typeof indexIncomingEdges>;
  readonly outputsByNode: Map<string, NodeOutputs>;
  readonly stats: RunStats;
}

async function runInlineNode({
  workflowRunId,
  node,
  incomingIndex,
  outputsByNode,
  stats,
}: RunInlineArgs): Promise<void> {
  const startedAt = new Date();
  const nodeRun = await prisma.nodeRun.create({
    data: {
      workflowRunId,
      nodeId: node.id,
      nodeKind: node.type,
      status: RunStatus.RUNNING,
      startedAt,
    },
  });

  try {
    const inputs = resolveInputs(node, incomingIndex, outputsByNode);
    const outputs = resolveInlineOutputs(node);
    const completedAt = new Date();
    await prisma.nodeRun.update({
      where: { id: nodeRun.id },
      data: {
        status: RunStatus.SUCCESS,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        inputs: inputs as never,
        outputs: outputs as never,
      },
    });
    outputsByNode.set(node.id, outputs);
    stats.anySucceeded = true;
  } catch (error) {
    const completedAt = new Date();
    await prisma.nodeRun.update({
      where: { id: nodeRun.id },
      data: {
        status: RunStatus.FAILED,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    stats.anyFailed = true;
  }
}

function resolveInlineOutputs(node: WorkflowNodeInput): NodeOutputs {
  const data = node.data as unknown as WorkflowNodeData;
  switch (data.kind) {
    case "text":
      return { output: (data as TextNodeData).text };
    case "upload-image": {
      const url = (data as UploadImageNodeData).url;
      if (!url) throw new Error("Upload Image node has no uploaded file");
      return { output: url };
    }
    case "upload-video": {
      const url = (data as UploadVideoNodeData).url;
      if (!url) throw new Error("Upload Video node has no uploaded file");
      return { output: url };
    }
    default:
      throw new Error(`resolveInlineOutputs called for non-inline kind: ${data.kind}`);
  }
}

// -----------------------------------------------------------------------------
// Task-dispatched nodes — batched so independent branches run concurrently
// -----------------------------------------------------------------------------

interface TaskPrep {
  readonly node: WorkflowNodeInput;
  readonly nodeRunId: string;
  readonly startedAt: Date;
  readonly inputs: ResolvedInputs;
  readonly batchItem: BatchItem;
  readonly error?: never;
}

interface TaskPrepError {
  readonly node: WorkflowNodeInput;
  readonly nodeRunId: string;
  readonly startedAt: Date;
  readonly error: Error;
  readonly batchItem?: never;
}

type BatchItem =
  | { task: typeof runLlmTask; payload: Parameters<typeof runLlmTask.trigger>[0] }
  | { task: typeof cropImageTask; payload: Parameters<typeof cropImageTask.trigger>[0] }
  | { task: typeof extractFrameTask; payload: Parameters<typeof extractFrameTask.trigger>[0] };

interface DispatchArgs {
  readonly workflowRunId: string;
  readonly nodes: readonly WorkflowNodeInput[];
  readonly incomingIndex: ReturnType<typeof indexIncomingEdges>;
  readonly outputsByNode: Map<string, NodeOutputs>;
  readonly stats: RunStats;
}

async function dispatchTaskNodesInParallel({
  workflowRunId,
  nodes,
  incomingIndex,
  outputsByNode,
  stats,
}: DispatchArgs): Promise<void> {
  // Create NodeRun rows (RUNNING) + build batch items. Prep is run in
  // parallel because each prep does exactly one DB insert.
  const preps: Array<TaskPrep | TaskPrepError> = await Promise.all(
    nodes.map((node) =>
      prepareTaskNode({ workflowRunId, node, incomingIndex, outputsByNode }),
    ),
  );

  const dispatchable = preps.filter((p): p is TaskPrep => !("error" in p && p.error));
  const preFailed = preps.filter((p): p is TaskPrepError => "error" in p && !!p.error);

  for (const failed of preFailed) {
    await markNodeRunFailed(failed.nodeRunId, failed.startedAt, failed.error.message);
    stats.anyFailed = true;
  }

  if (dispatchable.length === 0) return;

  let result;
  try {
    result = await batch.triggerByTaskAndWait(
      dispatchable.map((d) => d.batchItem),
    );
  } catch (error) {
    // If the whole batch dispatch failed (network, rate limit), mark every
    // prepared NodeRun as FAILED rather than leaving them stuck at RUNNING.
    const message = error instanceof Error ? error.message : String(error);
    for (const prep of dispatchable) {
      await markNodeRunFailed(prep.nodeRunId, prep.startedAt, message);
      stats.anyFailed = true;
    }
    return;
  }

  for (let i = 0; i < dispatchable.length; i++) {
    const prep = dispatchable[i];
    const run = result.runs[i];
    if (run.ok) {
      const outputs = run.output as NodeOutputs;
      await markNodeRunSucceeded(prep, outputs);
      outputsByNode.set(prep.node.id, outputs);
      stats.anySucceeded = true;
    } else {
      const message =
        run.error instanceof Error
          ? run.error.message
          : typeof run.error === "string"
            ? run.error
            : "Task failed";
      await markNodeRunFailed(prep.nodeRunId, prep.startedAt, message);
      stats.anyFailed = true;
    }
  }
}

interface PrepareArgs {
  readonly workflowRunId: string;
  readonly node: WorkflowNodeInput;
  readonly incomingIndex: ReturnType<typeof indexIncomingEdges>;
  readonly outputsByNode: ReadonlyMap<string, NodeOutputs>;
}

async function prepareTaskNode({
  workflowRunId,
  node,
  incomingIndex,
  outputsByNode,
}: PrepareArgs): Promise<TaskPrep | TaskPrepError> {
  const startedAt = new Date();
  const nodeRun = await prisma.nodeRun.create({
    data: {
      workflowRunId,
      nodeId: node.id,
      nodeKind: node.type,
      status: RunStatus.RUNNING,
      startedAt,
    },
  });

  try {
    const inputs = resolveInputs(node, incomingIndex, outputsByNode);
    const batchItem = buildBatchItem(node, inputs);
    return {
      node,
      nodeRunId: nodeRun.id,
      startedAt,
      inputs,
      batchItem,
    };
  } catch (error) {
    return {
      node,
      nodeRunId: nodeRun.id,
      startedAt,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function buildBatchItem(
  node: WorkflowNodeInput,
  inputs: ResolvedInputs,
): BatchItem {
  const data = node.data as unknown as WorkflowNodeData;
  switch (data.kind) {
    case "run-llm":
      return {
        task: runLlmTask,
        payload: runLlmPayloadFromInputs(
          inputs,
          (data as RunLlmNodeData).model ?? DEFAULT_GEMINI_MODEL,
        ),
      };
    case "crop-image":
      return {
        task: cropImageTask,
        payload: cropImagePayloadFromInputs(inputs, data as CropImageNodeData),
      };
    case "extract-frame":
      return {
        task: extractFrameTask,
        payload: extractFramePayloadFromInputs(
          inputs,
          data as ExtractFrameNodeData,
        ),
      };
    default:
      throw new Error(`buildBatchItem called for inline kind: ${data.kind}`);
  }
}

async function markNodeRunSucceeded(
  prep: TaskPrep,
  outputs: NodeOutputs,
): Promise<void> {
  const completedAt = new Date();
  await prisma.nodeRun.update({
    where: { id: prep.nodeRunId },
    data: {
      status: RunStatus.SUCCESS,
      completedAt,
      durationMs: completedAt.getTime() - prep.startedAt.getTime(),
      inputs: prep.inputs as never,
      outputs: outputs as never,
    },
  });
}

async function markNodeRunFailed(
  nodeRunId: string,
  startedAt: Date,
  message: string,
): Promise<void> {
  const completedAt = new Date();
  await prisma.nodeRun.update({
    where: { id: nodeRunId },
    data: {
      status: RunStatus.FAILED,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      errorMessage: message,
    },
  });
}

// -----------------------------------------------------------------------------
// Batch partitioning — skip nodes whose upstream didn't produce output
// -----------------------------------------------------------------------------

interface SkippedNode {
  readonly node: WorkflowNodeInput;
  readonly missingUpstreamId: string;
}

interface PartitionedBatch {
  readonly toRun: readonly WorkflowNodeInput[];
  readonly toSkip: readonly SkippedNode[];
}

/**
 * Split a batch into nodes that can actually execute (all connected inputs
 * have upstream outputs) and nodes that must be skipped (at least one
 * upstream didn't produce a value — either it failed or was itself skipped).
 */
function partitionBatch(
  batch: readonly WorkflowNodeInput[],
  incomingIndex: ReturnType<typeof indexIncomingEdges>,
  outputsByNode: ReadonlyMap<string, NodeOutputs>,
): PartitionedBatch {
  const toRun: WorkflowNodeInput[] = [];
  const toSkip: SkippedNode[] = [];

  for (const node of batch) {
    const missing = findMissingUpstream(node.id, incomingIndex, outputsByNode);
    if (missing) toSkip.push({ node, missingUpstreamId: missing });
    else toRun.push(node);
  }
  return { toRun, toSkip };
}

function findMissingUpstream(
  nodeId: string,
  incomingIndex: ReturnType<typeof indexIncomingEdges>,
  outputsByNode: ReadonlyMap<string, NodeOutputs>,
): string | null {
  for (const [key, sources] of incomingIndex) {
    const [targetId] = key.split(":");
    if (targetId !== nodeId) continue;
    for (const { sourceId } of sources) {
      if (!outputsByNode.has(sourceId)) return sourceId;
    }
  }
  return null;
}

interface RecordSkippedArgs {
  readonly workflowRunId: string;
  readonly node: WorkflowNodeInput;
  readonly missingUpstreamId: string;
}

async function recordSkippedNode({
  workflowRunId,
  node,
  missingUpstreamId,
}: RecordSkippedArgs): Promise<void> {
  const now = new Date();
  await prisma.nodeRun.create({
    data: {
      workflowRunId,
      nodeId: node.id,
      nodeKind: node.type,
      status: RunStatus.SKIPPED,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      errorMessage: `Skipped — upstream node "${missingUpstreamId}" did not produce output`,
    },
  });
}

/**
 * Build the `ResolvedInputs` map for a node by looking up each of its input
 * handles in the incoming-edge index and reading outputs from the upstream
 * node's finished run.
 */
function resolveInputs(
  node: WorkflowNodeInput,
  incomingIndex: ReturnType<typeof indexIncomingEdges>,
  outputsByNode: ReadonlyMap<string, NodeOutputs>,
): ResolvedInputs {
  const inputs: ResolvedInputs = {};
  for (const [key, sources] of incomingIndex) {
    const [targetId, targetHandle] = key.split(":");
    if (targetId !== node.id) continue;

    const values: unknown[] = [];
    for (const { sourceId, sourceHandle } of sources) {
      const upstreamOutputs = outputsByNode.get(sourceId);
      if (!upstreamOutputs) continue;
      const value =
        sourceHandle != null
          ? upstreamOutputs[sourceHandle]
          : upstreamOutputs.output;
      if (value !== undefined) values.push(value);
    }
    inputs[targetHandle || ""] = values.length === 1 ? values[0] : values;
  }
  return inputs;
}
