import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowCanvasNodeData,
  WorkflowNodeData,
} from "./types";
import type {
  WorkflowEdgeInput,
  WorkflowNodeInput,
} from "@/lib/api/workflow-schemas";

/**
 * Convert canvas nodes to a serializable form by stripping the ephemeral
 * `runtime` state. Execution status is re-derived on load.
 *
 * We cast at this boundary because `WorkflowNodeInput.data` is inferred from a
 * lenient Zod schema (`{ kind, [key]: unknown }`) while our in-app types are
 * discriminated unions without an index signature. Structurally they match —
 * the cast only bridges that signature gap.
 */
export function serializeNodes(
  nodes: readonly WorkflowCanvasNode[],
): WorkflowNodeInput[] {
  return nodes.map((node) => {
    const { runtime: _runtime, ...userData } = node.data;
    void _runtime;
    const kind = (userData as WorkflowNodeData).kind;
    return {
      id: node.id,
      type: node.type ?? kind,
      position: node.position,
      data: userData as unknown as WorkflowNodeInput["data"],
    };
  });
}

export function serializeEdges(
  edges: readonly WorkflowCanvasEdge[],
): WorkflowEdgeInput[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    animated: edge.animated,
    type: edge.type,
  }));
}

/**
 * Rehydrate nodes from the server/exported form, attaching a fresh
 * `runtime` state.
 */
export function deserializeNodes(
  nodes: readonly WorkflowNodeInput[],
): WorkflowCanvasNode[] {
  return nodes.map((node) => {
    const data: WorkflowCanvasNodeData = {
      ...(node.data as unknown as WorkflowNodeData),
      runtime: { status: "idle" },
    };
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      data,
    };
  });
}

export function deserializeEdges(
  edges: readonly WorkflowEdgeInput[],
): WorkflowCanvasEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    animated: edge.animated ?? true,
    type: edge.type,
  }));
}
