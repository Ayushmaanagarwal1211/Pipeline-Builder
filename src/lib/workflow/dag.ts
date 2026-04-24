import type { WorkflowEdgeInput, WorkflowNodeInput } from "@/lib/api/workflow-schemas";

/**
 * Partition the nodes into topological "batches". Every node in batch N
 * depends only on nodes in batches < N, so a batch can be executed in
 * parallel while batches run sequentially.
 *
 * Uses Kahn's algorithm. Throws if the graph contains a cycle; the canvas
 * validator prevents that client-side, but we re-check here as a defense-in-
 * depth against tampered persisted graphs.
 */
export function topologicalBatches(
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): WorkflowNodeInput[][] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const batches: WorkflowNodeInput[][] = [];
  let frontier: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) frontier.push(id);
  }

  let processed = 0;
  while (frontier.length > 0) {
    const batch = frontier.map((id) => nodeById.get(id)!);
    batches.push(batch);
    processed += batch.length;

    const next: string[] = [];
    for (const id of frontier) {
      for (const target of outgoing.get(id) ?? []) {
        const remaining = (inDegree.get(target) ?? 0) - 1;
        inDegree.set(target, remaining);
        if (remaining === 0) next.push(target);
      }
    }
    frontier = next;
  }

  if (processed !== nodes.length) {
    throw new Error("Workflow graph contains a cycle");
  }
  return batches;
}

/**
 * Narrow the graph to the subset that must run for a given scope.
 * For FULL: all nodes. For SINGLE/SELECTED: the selected nodes *and* all
 * their transitive dependencies (so the user gets valid inputs to the
 * subset they asked for).
 */
export function filterGraphByScope(
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
  scope: "FULL" | "SELECTED" | "SINGLE",
  selection: readonly string[] | null,
): readonly WorkflowNodeInput[] {
  if (scope === "FULL") return nodes;
  if (!selection || selection.length === 0) return [];

  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    incoming.set(edge.target, [
      ...(incoming.get(edge.target) ?? []),
      edge.source,
    ]);
  }

  const required = new Set<string>();
  const stack = [...selection];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (required.has(id)) continue;
    required.add(id);
    for (const upstream of incoming.get(id) ?? []) {
      if (!required.has(upstream)) stack.push(upstream);
    }
  }

  return nodes.filter((node) => required.has(node.id));
}

/**
 * Build a map keyed by `${targetId}:${targetHandle}` → array of
 * `{ sourceId, sourceHandle }` pairs. Used to resolve a node's inputs when
 * its upstreams have finished executing.
 */
export function indexIncomingEdges(
  edges: readonly WorkflowEdgeInput[],
): Map<string, { sourceId: string; sourceHandle: string | null }[]> {
  const map = new Map<
    string,
    { sourceId: string; sourceHandle: string | null }[]
  >();
  for (const edge of edges) {
    const targetHandle = edge.targetHandle ?? null;
    const key = `${edge.target}:${targetHandle ?? ""}`;
    const existing = map.get(key) ?? [];
    existing.push({
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle ?? null,
    });
    map.set(key, existing);
  }
  return map;
}
