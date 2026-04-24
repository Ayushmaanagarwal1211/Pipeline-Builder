import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";

import { isValidConnection } from "./connection-rules";
import { getNodeDefinition } from "./node-definitions";
import type {
  NodeDataFor,
  NodeKind,
  NodeRuntimeState,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowCanvasNodeData,
} from "./types";

/**
 * Generates a stable-enough id for client-side nodes.
 * Replaced by server-issued ids once persistence lands.
 */
function createNodeId(kind: NodeKind): string {
  return `${kind}-${crypto.randomUUID().slice(0, 8)}`;
}

function buildNode(
  kind: NodeKind,
  position: XYPosition,
): WorkflowCanvasNode {
  const def = getNodeDefinition(kind);
  const data: WorkflowCanvasNodeData = {
    ...def.createDefaultData(),
    runtime: { status: "idle" },
  };
  return {
    id: createNodeId(kind),
    type: kind,
    position,
    data,
  };
}

export interface WorkflowIdentity {
  readonly id: string | null;
  readonly name: string;
}

export interface WorkflowStore {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  identity: WorkflowIdentity;

  onNodesChange: (changes: NodeChange<WorkflowCanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowCanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (kind: NodeKind, position: XYPosition) => void;
  updateNodeData: <K extends NodeKind>(
    nodeId: string,
    patch: Partial<NodeDataFor<K>>,
  ) => void;

  setIdentity: (identity: WorkflowIdentity) => void;
  setName: (name: string) => void;
  replaceGraph: (
    nodes: WorkflowCanvasNode[],
    edges: WorkflowCanvasEdge[],
  ) => void;
  /**
   * Merge per-node runtime status into the canvas. Called from the run poller
   * as status transitions arrive. Nodes not mentioned in the map are left
   * untouched.
   */
  mergeRuntimeStatus: (
    statusByNodeId: ReadonlyMap<string, NodeRuntimeState>,
  ) => void;
  resetWorkflow: () => void;
}

const INITIAL_IDENTITY: WorkflowIdentity = { id: null, name: "Untitled" };

/**
 * Persists the most recently opened workflow id in localStorage so a hard
 * reload (or fresh tab) can rehydrate the canvas + run history without
 * requiring routing. Single-workflow demo app — one slot is enough.
 */
const LAST_WORKFLOW_ID_KEY = "nextflow.lastWorkflowId";

export function readLastWorkflowId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_WORKFLOW_ID_KEY);
  } catch {
    return null;
  }
}

function writeLastWorkflowId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(LAST_WORKFLOW_ID_KEY, id);
    else window.localStorage.removeItem(LAST_WORKFLOW_ID_KEY);
  } catch {
    // Quota / private mode — non-fatal.
  }
}

export function clearLastWorkflowId(): void {
  writeLastWorkflowId(null);
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  identity: INITIAL_IDENTITY,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const { nodes, edges } = get();
    if (!isValidConnection({ connection, nodes, edges })) return;
    set({
      edges: addEdge(
        { ...connection, animated: true, type: "default" },
        edges,
      ),
    });
  },

  addNode: (kind, position) => {
    set({ nodes: [...get().nodes, buildNode(kind, position)] });
  },

  updateNodeData: (nodeId, patch) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...patch } }
          : node,
      ),
    });
  },

  setIdentity: (identity) => {
    writeLastWorkflowId(identity.id);
    set({ identity });
  },

  setName: (name) =>
    set((state) => ({ identity: { ...state.identity, name } })),

  replaceGraph: (nodes, edges) => set({ nodes, edges }),

  mergeRuntimeStatus: (statusByNodeId) => {
    if (statusByNodeId.size === 0) return;
    set({
      nodes: get().nodes.map((node) => {
        const next = statusByNodeId.get(node.id);
        if (!next) return node;
        return {
          ...node,
          data: { ...node.data, runtime: next },
        };
      }),
    });
  },

  resetWorkflow: () => {
    writeLastWorkflowId(null);
    set({ nodes: [], edges: [], identity: INITIAL_IDENTITY });
  },
}));

/**
 * Selector hook: returns true iff the given target handle has at least one
 * incoming edge. Used by node bodies to disable manual inputs that are being
 * driven by an upstream node (spec: connected inputs become read-only).
 */
export function useHasIncomingEdge(nodeId: string, handleId: string): boolean {
  return useWorkflowStore((state) =>
    state.edges.some(
      (edge) => edge.target === nodeId && edge.targetHandle === handleId,
    ),
  );
}
