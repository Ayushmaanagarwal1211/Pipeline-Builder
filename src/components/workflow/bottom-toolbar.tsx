"use client";

import {
  Grid3x3,
  Hand,
  Loader2,
  MousePointer2,
  Play,
  Plus,
  Scissors,
  Share2,
  Square,
} from "lucide-react";

import { useWorkflowRun } from "@/hooks/use-workflow-run";

const CANVAS_TOOLS = [
  { key: "add", icon: <Plus className="size-4" />, label: "Add node" },
  {
    key: "select",
    icon: <MousePointer2 className="size-4" />,
    label: "Select",
    active: true,
  },
  { key: "pan", icon: <Hand className="size-4" />, label: "Pan" },
  { key: "cut", icon: <Scissors className="size-4" />, label: "Cut" },
  { key: "align", icon: <Grid3x3 className="size-4" />, label: "Align" },
  { key: "connect", icon: <Share2 className="size-4" />, label: "Connect" },
] as const;

export function BottomToolbar() {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
      <CanvasToolCluster />
      <RunControl />
    </div>
  );
}

function CanvasToolCluster() {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-card/95 p-1 shadow-lg backdrop-blur">
      {CANVAS_TOOLS.map((tool) => (
        <button
          key={tool.key}
          aria-label={tool.label}
          title={tool.label}
          className={[
            "flex size-8 items-center justify-center rounded-full transition-colors",
            "active" in tool && tool.active
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          ].join(" ")}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}

function RunControl() {
  const { run, isStarting, errorMessage, start } = useWorkflowRun();
  const status = run?.status ?? null;
  const isRunning = status === "QUEUED" || status === "RUNNING";
  const disabled = isStarting || isRunning;

  const icon = isStarting ? (
    <Loader2 className="size-4 animate-spin" />
  ) : isRunning ? (
    <Square className="size-4" />
  ) : (
    <Play className="size-4 fill-current" />
  );

  const label = isStarting
    ? "Starting…"
    : isRunning
      ? status === "QUEUED"
        ? "Queued"
        : "Running…"
      : status === "FAILED"
        ? "Run failed — try again"
        : status === "PARTIAL"
          ? "Partial — re-run"
          : status === "SUCCESS"
            ? "Run again"
            : "Run";

  return (
    <button
      type="button"
      onClick={() => void start("FULL")}
      disabled={disabled}
      title={errorMessage ?? label}
      className={[
        "flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium shadow-lg backdrop-blur transition-colors",
        isRunning
          ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-400/50"
          : "bg-emerald-500/90 text-white hover:bg-emerald-500",
        disabled ? "cursor-not-allowed opacity-80" : "",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
