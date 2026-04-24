"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, type DragEvent } from "react";

import { NODE_TYPES } from "@/components/workflow/nodes/node-registry";
import { NODE_DND_MIME, parseNodeKind } from "@/lib/workflow/dnd";
import { isValidConnection } from "@/lib/workflow/connection-rules";
import { useWorkflowStore } from "@/lib/workflow/store";
import type { NodeKind } from "@/lib/workflow/types";

const PRO_OPTIONS = { hideAttribution: true } as const;

// Spec: "Node connections with animated purple edges". `#c084fc` is
// Tailwind's purple-400 — reads as purple on both light and dark canvases
// and matches the Krea.ai reference.
const EDGE_PURPLE = "#c084fc";
const DEFAULT_EDGE_OPTIONS = {
  animated: true,
  style: { stroke: EDGE_PURPLE, strokeWidth: 1.75 },
} as const;

function EmptyCanvasHint() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center gap-1.5">
      <p className="text-[15px] text-zinc-400">Add a node</p>
      <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
        Drag from the sidebar, double-click, or press
        <kbd className="flex size-[18px] items-center justify-center rounded-[4px] bg-zinc-800 text-[10px] font-medium text-zinc-300">
          N
        </kbd>
      </p>
    </div>
  );
}

function WorkflowCanvasInner() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);

  const { screenToFlowPosition } = useReactFlow();

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = parseNodeKind(event.dataTransfer.getData(NODE_DND_MIME));
      if (!kind) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(kind, position);
    },
    [addNode, screenToFlowPosition],
  );

  const validateConnection = useCallback(
    (candidate: Edge | Connection): boolean => {
      const connection: Connection = {
        source: candidate.source,
        target: candidate.target,
        sourceHandle: candidate.sourceHandle ?? null,
        targetHandle: candidate.targetHandle ?? null,
      };
      return isValidConnection({ connection, nodes, edges });
    },
    [nodes, edges],
  );

  const isEmpty = useMemo(() => nodes.length === 0, [nodes.length]);

  return (
    <div
      className="relative h-full w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isEmpty && <EmptyCanvasHint />}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={validateConnection}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.5 }}
        proOptions={PRO_OPTIONS}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="rgba(255,255,255,0.14)"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-card/90 !border-border/60"
          nodeColor={(node) => nodeMiniColor(node.type as NodeKind)}
        />
      </ReactFlow>
    </div>
  );
}

function nodeMiniColor(kind: NodeKind): string {
  switch (kind) {
    case "text":
      return "#a1a1aa";
    case "upload-image":
      return "#38bdf8";
    case "upload-video":
      return "#c084fc";
    case "run-llm":
      return "#fb923c";
    case "crop-image":
      return "#fb7185";
    case "extract-frame":
      return "#34d399";
  }
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
