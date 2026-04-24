"use client";

import {
  ChevronDown,
  ChevronRight,
  History,
  PanelRight,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useWorkflowHistory } from "@/hooks/use-workflow-history";
import { formatDuration, formatRelativeTime } from "@/lib/format-time";
import type {
  NodeRunDto,
  RunScopeDto,
  RunStatusDto,
  WorkflowRunDto,
} from "@/lib/api/run-client";

const STATUS_DOT_CLASS: Record<RunStatusDto, string> = {
  QUEUED: "bg-amber-400",
  RUNNING: "bg-orange-400 animate-pulse",
  SUCCESS: "bg-emerald-400",
  FAILED: "bg-rose-400",
  PARTIAL: "bg-yellow-400",
  SKIPPED: "bg-zinc-500",
};

const STATUS_LABEL: Record<RunStatusDto, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  SUCCESS: "Success",
  FAILED: "Failed",
  PARTIAL: "Partial",
  SKIPPED: "Skipped",
};

const SCOPE_LABEL: Record<RunScopeDto, string> = {
  FULL: "Full",
  SELECTED: "Selected",
  SINGLE: "Single",
};

interface HistorySidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export function HistorySidebar({ expanded, onToggle }: HistorySidebarProps) {
  const { runs, isLoading, errorMessage, refresh } = useWorkflowHistory();

  return (
    <aside className="flex h-full w-full flex-col">
      <Header
        expanded={expanded}
        onToggle={onToggle}
        onRefresh={() => void refresh()}
        isRefreshing={isLoading}
      />

      {expanded && (
        <div className="flex-1 overflow-y-auto px-2 pt-1 pb-3">
          {errorMessage && (
            <div className="mx-2 mb-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
              {errorMessage}
            </div>
          )}
          {runs.length === 0 ? (
            <EmptyState isLoading={isLoading} />
          ) : (
            <ul className="space-y-1.5">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}

function Header({
  expanded,
  onToggle,
  onRefresh,
  isRefreshing,
}: {
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-between border-b border-border/60 px-2 py-2",
        expanded ? "" : "flex-col gap-2 border-b-0",
      ].join(" ")}
    >
      <button
        aria-label={expanded ? "Collapse history" : "Open history"}
        title={expanded ? "Collapse history" : "Open history"}
        onClick={onToggle}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <PanelRight className="size-4" />
      </button>

      {expanded ? (
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            History
          </span>
          <button
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw
              className={[
                "size-3.5",
                isRefreshing ? "animate-spin" : "",
              ].join(" ")}
            />
          </button>
        </div>
      ) : (
        <button
          aria-label="History"
          title="History"
          onClick={onToggle}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <History className="size-4" />
        </button>
      )}
    </div>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
      {isLoading ? (
        <span>Loading history…</span>
      ) : (
        <>
          <span>No runs yet</span>
          <span className="text-[10px]">
            Save the workflow and click Run to start
          </span>
        </>
      )}
    </div>
  );
}

function RunRow({ run }: { run: WorkflowRunDto }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const summary = useMemo(() => {
    let success = 0;
    let failed = 0;
    let skipped = 0;
    for (const nr of run.nodeRuns) {
      if (nr.status === "SUCCESS") success++;
      else if (nr.status === "FAILED") failed++;
      else if (nr.status === "SKIPPED") skipped++;
    }
    return { success, failed, skipped, total: run.nodeRuns.length };
  }, [run.nodeRuns]);

  const duration =
    run.completedAt && run.startedAt
      ? new Date(run.completedAt).getTime() -
        new Date(run.startedAt).getTime()
      : null;

  return (
    <li className="rounded-lg border border-border/40 bg-card/50">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent/40"
      >
        {isExpanded ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span
          className={[
            "size-2 shrink-0 rounded-full",
            STATUS_DOT_CLASS[run.status],
          ].join(" ")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-medium text-foreground">
              {STATUS_LABEL[run.status]}
            </span>
            <ScopeBadge scope={run.scope} />
          </div>
          <div className="text-[10px] text-muted-foreground">
            {formatRelativeTime(run.startedAt)} · {formatDuration(duration)}
            {summary.total > 0 && (
              <>
                {" · "}
                <span className="text-emerald-400">{summary.success}✓</span>
                {summary.failed > 0 && (
                  <>
                    {" "}
                    <span className="text-rose-400">{summary.failed}✕</span>
                  </>
                )}
                {summary.skipped > 0 && (
                  <>
                    {" "}
                    <span className="text-zinc-400">{summary.skipped}⊘</span>
                  </>
                )}
                {" / "}
                {summary.total}
              </>
            )}
          </div>
        </div>
      </button>

      {isExpanded && <NodeRunList nodeRuns={run.nodeRuns} />}
    </li>
  );
}

function NodeRunList({ nodeRuns }: { nodeRuns: readonly NodeRunDto[] }) {
  if (nodeRuns.length === 0) {
    return (
      <div className="px-3 pb-2 text-[10px] text-muted-foreground italic">
        Waiting for nodes to start…
      </div>
    );
  }

  return (
    <ul className="space-y-0.5 border-t border-border/40 px-2 py-1.5">
      {nodeRuns.map((nodeRun) => (
        <NodeRunRow key={nodeRun.id} nodeRun={nodeRun} />
      ))}
    </ul>
  );
}

function NodeRunRow({ nodeRun }: { nodeRun: NodeRunDto }) {
  const showError =
    (nodeRun.status === "FAILED" || nodeRun.status === "SKIPPED") &&
    !!nodeRun.errorMessage;

  return (
    <li className="rounded px-1.5 py-1">
      <div className="flex items-center gap-2">
        <span
          className={[
            "size-1.5 shrink-0 rounded-full",
            STATUS_DOT_CLASS[nodeRun.status],
          ].join(" ")}
        />
        <span className="flex-1 truncate text-[10px] text-foreground/90">
          {nodeRun.nodeKind}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatDuration(nodeRun.durationMs)}
        </span>
      </div>
      {showError && (
        <p
          className={[
            "mt-0.5 ml-3.5 text-[10px] leading-snug break-words",
            nodeRun.status === "FAILED" ? "text-rose-300" : "text-zinc-400",
          ].join(" ")}
        >
          {nodeRun.errorMessage}
        </p>
      )}
    </li>
  );
}

function ScopeBadge({ scope }: { scope: RunScopeDto }) {
  return (
    <span className="rounded-sm bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">
      {SCOPE_LABEL[scope]}
    </span>
  );
}
