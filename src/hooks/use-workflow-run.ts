"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiGetRun,
  apiStartRun,
  type NodeRunDto,
  type RunScopeDto,
  type RunStatusDto,
  type WorkflowRunDto,
} from "@/lib/api/run-client";
import { WorkflowApiError } from "@/lib/api/workflow-client";
import { useWorkflowStore } from "@/lib/workflow/store";
import type {
  NodeRunStatus,
  NodeRuntimeState,
} from "@/lib/workflow/types";

const POLL_INTERVAL_MS = 1500;
const TERMINAL_STATUSES: ReadonlySet<RunStatusDto> = new Set<RunStatusDto>([
  "SUCCESS",
  "FAILED",
  "PARTIAL",
]);

export interface UseWorkflowRun {
  readonly run: WorkflowRunDto | null;
  readonly isStarting: boolean;
  readonly errorMessage: string | null;
  start: (scope: RunScopeDto, selection?: readonly string[]) => Promise<void>;
}

/**
 * Orchestrate a workflow run from the client: POST to start it, then poll
 * status. On every poll we (1) merge per-node runtime statuses into the
 * Zustand store so the canvas glow reflects progress, and (2) write the
 * LLM `output` back into the `run-llm` node's `data.output` so the user
 * sees the response in the node body.
 *
 * Polling stops automatically once the run reaches a terminal status.
 */
export function useWorkflowRun(): UseWorkflowRun {
  const [run, setRun] = useState<WorkflowRunDto | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPoll();
  }, [clearPoll]);

  const applyRunToStore = useCallback((fetched: WorkflowRunDto) => {
    const statusMap = new Map<string, NodeRuntimeState>();
    for (const nodeRun of fetched.nodeRuns) {
      statusMap.set(nodeRun.nodeId, {
        status: mapStatus(nodeRun.status),
        errorMessage: nodeRun.errorMessage ?? undefined,
      });
    }
    useWorkflowStore.getState().mergeRuntimeStatus(statusMap);

    // Any `run-llm` node with a completed output should surface its
    // response in the node body so the user can read it immediately.
    for (const nodeRun of fetched.nodeRuns) {
      if (nodeRun.nodeKind !== "run-llm") continue;
      const outputText = readOutputString(nodeRun);
      if (outputText == null) continue;
      useWorkflowStore
        .getState()
        .updateNodeData<"run-llm">(nodeRun.nodeId, { output: outputText });
    }
  }, []);

  const pollOnce = useCallback(
    async (runId: string) => {
      try {
        const fetched = await apiGetRun(runId);
        setRun(fetched);
        applyRunToStore(fetched);

        if (TERMINAL_STATUSES.has(fetched.status)) {
          clearPoll();
          return;
        }
        pollTimer.current = setTimeout(
          () => void pollOnce(runId),
          POLL_INTERVAL_MS,
        );
      } catch (error) {
        clearPoll();
        setErrorMessage(
          error instanceof WorkflowApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to poll run",
        );
      }
    },
    [applyRunToStore, clearPoll],
  );

  const start = useCallback(
    async (scope: RunScopeDto, selection?: readonly string[]) => {
      const workflowId = useWorkflowStore.getState().identity.id;
      if (!workflowId) {
        setErrorMessage("Save the workflow before running it");
        return;
      }
      clearPoll();
      setIsStarting(true);
      setErrorMessage(null);
      try {
        const started = await apiStartRun({ workflowId, scope, selection });
        setRun(started);

        // Optimistically set selected/targeted nodes to QUEUED so the UI
        // responds before the first poll lands.
        const optimistic = new Map<string, NodeRuntimeState>();
        if (selection) {
          for (const id of selection) {
            optimistic.set(id, { status: "queued" });
          }
        }
        useWorkflowStore.getState().mergeRuntimeStatus(optimistic);

        await pollOnce(started.id);
      } catch (error) {
        setErrorMessage(
          error instanceof WorkflowApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to start run",
        );
      } finally {
        setIsStarting(false);
      }
    },
    [clearPoll, pollOnce],
  );

  return { run, isStarting, errorMessage, start };
}

function mapStatus(status: RunStatusDto): NodeRunStatus {
  switch (status) {
    case "QUEUED":
      return "queued";
    case "RUNNING":
      return "running";
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "error";
    case "SKIPPED":
      return "skipped";
    // PARTIAL is a workflow-level status only; defensive for type exhaustiveness.
    case "PARTIAL":
      return "success";
  }
}

function readOutputString(nodeRun: NodeRunDto): string | null {
  const outputs = nodeRun.outputs;
  if (
    outputs != null &&
    typeof outputs === "object" &&
    "output" in outputs &&
    typeof (outputs as Record<string, unknown>).output === "string"
  ) {
    return (outputs as { output: string }).output;
  }
  return null;
}
