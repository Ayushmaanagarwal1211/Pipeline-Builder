"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiListRuns,
  type RunStatusDto,
  type WorkflowRunDto,
} from "@/lib/api/run-client";
import { WorkflowApiError } from "@/lib/api/workflow-client";
import { useWorkflowStore } from "@/lib/workflow/store";

const ACTIVE_POLL_INTERVAL_MS = 2000;
const ACTIVE_STATUSES: ReadonlySet<RunStatusDto> = new Set([
  "QUEUED",
  "RUNNING",
]);

export interface UseWorkflowHistory {
  readonly runs: readonly WorkflowRunDto[];
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  refresh: () => Promise<void>;
}

/**
 * Load and keep-fresh the run history for the currently open workflow.
 * The hook subscribes to the workflow id from the store so loading a
 * different workflow automatically re-fetches.
 *
 * Polls while any run is active (QUEUED/RUNNING) and stops once all runs
 * have settled — no background chatter when nothing is executing.
 */
export function useWorkflowHistory(): UseWorkflowHistory {
  const workflowId = useWorkflowStore((state) => state.identity.id);
  const [runs, setRuns] = useState<readonly WorkflowRunDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const fetchRuns = useCallback(async (): Promise<readonly WorkflowRunDto[]> => {
    if (!workflowId) return [];
    try {
      setErrorMessage(null);
      return await apiListRuns(workflowId);
    } catch (error) {
      setErrorMessage(
        error instanceof WorkflowApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to load history",
      );
      return [];
    }
  }, [workflowId]);

  const schedulePoll = useCallback(
    (hasActive: boolean) => {
      if (!hasActive) return;
      clearPoll();
      pollTimer.current = setTimeout(async () => {
        const next = await fetchRuns();
        setRuns(next);
        schedulePoll(next.some((r) => ACTIVE_STATUSES.has(r.status)));
      }, ACTIVE_POLL_INTERVAL_MS);
    },
    [fetchRuns, clearPoll],
  );

  const refresh = useCallback(async () => {
    if (!workflowId) {
      setRuns([]);
      return;
    }
    setIsLoading(true);
    const next = await fetchRuns();
    setRuns(next);
    setIsLoading(false);
    schedulePoll(next.some((r) => ACTIVE_STATUSES.has(r.status)));
  }, [workflowId, fetchRuns, schedulePoll]);

  useEffect(() => {
    void refresh();
    return () => clearPoll();
  }, [refresh, clearPoll]);

  return { runs, isLoading, errorMessage, refresh };
}
