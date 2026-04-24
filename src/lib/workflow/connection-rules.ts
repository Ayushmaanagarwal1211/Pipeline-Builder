import type { Connection, Edge } from "@xyflow/react";

import { getNodeDefinition } from "./node-definitions";
import type {
  HandleDefinition,
  NodeKind,
  WorkflowCanvasNode,
} from "./types";

/**
 * Resolve the handle definition for a given node + handle id on one side
 * (`source` or `target`) of a connection. Returns null if the node or handle
 * is unknown — callers should reject the connection in that case.
 */
function resolveHandle(
  node: WorkflowCanvasNode | undefined,
  handleId: string | null | undefined,
  side: "source" | "target",
): HandleDefinition | null {
  if (!node || !handleId) return null;
  const def = getNodeDefinition(node.type as NodeKind);
  const handles = side === "source" ? def.outputs : def.inputs;
  return handles.find((h) => h.id === handleId) ?? null;
}

/**
 * Whether a proposed connection would create a cycle in the DAG.
 * Performs a DFS from the target node following existing edges — if the
 * source is reachable, the new edge closes a cycle.
 */
function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: readonly Edge[],
): boolean {
  if (sourceId === targetId) return true;

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }

  const stack = [targetId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = outgoing.get(current);
    if (next) stack.push(...next);
  }
  return false;
}

export interface ValidateConnectionArgs {
  readonly connection: Connection;
  readonly nodes: readonly WorkflowCanvasNode[];
  readonly edges: readonly Edge[];
}

/**
 * Decide whether a connection is valid. Rules (in order):
 *   1. Source and target must reference known nodes and handles.
 *   2. Handle types must match (e.g. image→image, not image→text).
 *   3. Target handle must accept more than one edge only if `multiple` is set.
 *   4. Adding the edge must not introduce a cycle.
 */
export function isValidConnection({
  connection,
  nodes,
  edges,
}: ValidateConnectionArgs): boolean {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target) return false;

  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  const sourceHandleDef = resolveHandle(sourceNode, sourceHandle, "source");
  const targetHandleDef = resolveHandle(targetNode, targetHandle, "target");
  if (!sourceHandleDef || !targetHandleDef) return false;

  if (sourceHandleDef.type !== targetHandleDef.type) return false;

  if (!targetHandleDef.multiple) {
    const alreadyConnected = edges.some(
      (e) => e.target === target && e.targetHandle === targetHandle,
    );
    if (alreadyConnected) return false;
  }

  if (wouldCreateCycle(source, target, edges)) return false;

  return true;
}
