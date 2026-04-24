"use client";

import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";

import type { AnyNodeDefinition } from "@/lib/workflow/node-definitions";
import type { HandleDefinition, NodeRunStatus } from "@/lib/workflow/types";

const HANDLE_COLOR_CLASS: Record<HandleDefinition["type"], string> = {
  text: "!bg-zinc-400",
  image: "!bg-sky-400",
  video: "!bg-purple-400",
  number: "!bg-amber-400",
};

const STATUS_RING_CLASS: Record<NodeRunStatus, string> = {
  idle: "ring-border/60",
  queued: "ring-amber-400/60",
  running:
    "ring-orange-400 shadow-[0_0_0_6px_rgba(251,146,60,0.18)] animate-[pulse-glow_1.6s_ease-in-out_infinite]",
  success: "ring-emerald-500/60",
  error: "ring-red-500/70",
  skipped: "ring-zinc-500/40 opacity-60",
};

export interface BaseNodeProps {
  readonly definition: AnyNodeDefinition;
  readonly status: NodeRunStatus;
  readonly selected: boolean;
  readonly children: ReactNode;
  /** Output handles rendered on the right edge of the node. */
  readonly outputHandles?: readonly HandleDefinition[];
}

/**
 * Shared chrome for every node: header (icon + title), card styling with
 * status ring, and any output handles. Inputs are placed by child rows via
 * `NodeHandleRow` so each input handle aligns with its form field.
 */
export function BaseNode({
  definition,
  status,
  selected,
  children,
  outputHandles = definition.outputs,
}: BaseNodeProps) {
  const { Icon, label, description, accentClass } = definition;

  return (
    <div
      className={[
        "w-[248px] rounded-xl bg-card/95 text-card-foreground ring-1 backdrop-blur transition-shadow",
        STATUS_RING_CLASS[status],
        selected ? "!ring-2 !ring-foreground/50" : "",
      ].join(" ")}
    >
      <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <Icon className={["size-4 shrink-0", accentClass].join(" ")} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-foreground">
            {label}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {description}
          </div>
        </div>
        <StatusDot status={status} />
      </header>

      <div className="flex flex-col">{children}</div>

      {outputHandles.map((handle, index, arr) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={Position.Right}
          className={[
            "!size-2.5 !border-2 !border-background",
            HANDLE_COLOR_CLASS[handle.type],
          ].join(" ")}
          style={{ top: distributeHandlePosition(index, arr.length) }}
        />
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: NodeRunStatus }) {
  const color: Record<NodeRunStatus, string> = {
    idle: "bg-zinc-600",
    queued: "bg-amber-400",
    running: "bg-orange-400 animate-pulse",
    success: "bg-emerald-400",
    error: "bg-red-400",
    skipped: "bg-zinc-500",
  };
  return (
    <span
      aria-label={`Status: ${status}`}
      className={["inline-block size-2 rounded-full", color[status]].join(" ")}
    />
  );
}

/**
 * Distribute N handles vertically along a node edge.
 * For outputs rendered on the full-height right edge.
 */
function distributeHandlePosition(index: number, total: number): string {
  if (total <= 1) return "75%";
  const pad = 18;
  return `calc(${pad}px + (100% - ${pad * 2}px) * ${index / (total - 1)})`;
}

interface NodeHandleRowProps {
  readonly handle: HandleDefinition;
  /** Whether the input field is driven by an upstream connection. */
  readonly connected: boolean;
  readonly children: ReactNode;
}

/**
 * Row primitive for an input handle. Renders a React Flow Handle absolutely
 * positioned on the node's left edge, aligned vertically with this row via
 * CSS (`top: 50%`). Each row manages its own handle, so adding/removing rows
 * doesn't require offset recomputation.
 */
export function NodeHandleRow({
  handle,
  connected,
  children,
}: NodeHandleRowProps) {
  return (
    <div className="relative border-b border-border/40 px-3 py-2 last:border-b-0">
      <Handle
        id={handle.id}
        type="target"
        position={Position.Left}
        className={[
          "!size-2.5 !border-2 !border-background",
          HANDLE_COLOR_CLASS[handle.type],
        ].join(" ")}
        style={{ top: "50%" }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {handle.label}
          {handle.required && <span className="text-rose-400">*</span>}
        </span>
        {connected && (
          <span className="text-[9px] text-emerald-400">Connected</span>
        )}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Non-handle row used for plain config fields (e.g. model selector). */
export function NodeConfigRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/40 px-3 py-2 last:border-b-0">
      <div className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}
