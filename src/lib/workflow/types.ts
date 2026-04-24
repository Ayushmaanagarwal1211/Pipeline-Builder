import type { Node, Edge } from "@xyflow/react";

/**
 * All node kinds supported by the workflow engine.
 * Kept as a string literal union so it can drive exhaustive switches,
 * discriminated-union node data, and the registry map below.
 */
export type NodeKind =
  | "text"
  | "upload-image"
  | "upload-video"
  | "run-llm"
  | "crop-image"
  | "extract-frame";

/**
 * The wire type carried by a handle. Connections are only allowed
 * between handles with the same HandleType.
 */
export type HandleType = "text" | "image" | "video" | "number";

/**
 * Status reported by the execution engine for a single node run.
 */
export type NodeRunStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "error"
  | "skipped";

/**
 * Definition of a single handle (input or output port) on a node.
 */
export interface HandleDefinition {
  readonly id: string;
  readonly label: string;
  readonly type: HandleType;
  /** Whether this input accepts connections from multiple upstream nodes. */
  readonly multiple?: boolean;
  /** Whether this input is required for the node to execute. */
  readonly required?: boolean;
}

// -----------------------------------------------------------------------------
// Per-node data — discriminated by `kind`.
// -----------------------------------------------------------------------------

export interface TextNodeData {
  readonly kind: "text";
  text: string;
}

export interface UploadImageNodeData {
  readonly kind: "upload-image";
  url: string | null;
  fileName: string | null;
}

export interface UploadVideoNodeData {
  readonly kind: "upload-video";
  url: string | null;
  fileName: string | null;
}

export interface RunLlmNodeData {
  readonly kind: "run-llm";
  model: string;
  output: string | null;
}

export interface CropImageNodeData {
  readonly kind: "crop-image";
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  output: string | null;
}

export interface ExtractFrameNodeData {
  readonly kind: "extract-frame";
  /** Accepts seconds ("2.5") or percentage ("50%"). */
  timestamp: string;
  output: string | null;
}

/**
 * Discriminated union of every node data shape. Use `kind` to narrow.
 */
export type WorkflowNodeData =
  | TextNodeData
  | UploadImageNodeData
  | UploadVideoNodeData
  | RunLlmNodeData
  | CropImageNodeData
  | ExtractFrameNodeData;

/**
 * Narrow `WorkflowNodeData` to a specific kind at the type level.
 */
export type NodeDataFor<K extends NodeKind> = Extract<
  WorkflowNodeData,
  { kind: K }
>;

/**
 * Runtime state attached to every canvas node.
 * Keeps UI concerns (status, glow) separate from user-configured data.
 */
export interface NodeRuntimeState {
  status: NodeRunStatus;
  /** Human-readable message shown on error. */
  errorMessage?: string;
}

/**
 * Data carried by a React Flow node — user data plus runtime state.
 * `React Flow`'s `Node` generic constrains this to `Record<string, unknown>`.
 */
export type WorkflowCanvasNodeData = WorkflowNodeData & {
  runtime: NodeRuntimeState;
} & Record<string, unknown>;

export type WorkflowCanvasNode = Node<WorkflowCanvasNodeData, NodeKind>;
export type WorkflowCanvasEdge = Edge;
