"use client";

import { useCallback } from "react";

import { useWorkflowStore } from "@/lib/workflow/store";
import type { NodeDataFor, NodeKind } from "@/lib/workflow/types";

/**
 * Returns a strongly-typed patch function bound to a specific node id +
 * node kind. Using it keeps call-sites free of type assertions and ensures
 * only valid fields for this kind can be written.
 */
export function useNodeDataUpdater<K extends NodeKind>(
  nodeId: string,
  _kind: K,
): (patch: Partial<NodeDataFor<K>>) => void {
  const update = useWorkflowStore((state) => state.updateNodeData);
  return useCallback(
    (patch) => update<K>(nodeId, patch),
    [update, nodeId],
  );
}
