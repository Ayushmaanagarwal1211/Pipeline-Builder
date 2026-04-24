"use client";

import { useCallback, useState } from "react";

import {
  apiCreateSampleWorkflow,
  apiCreateWorkflow,
  apiGetWorkflow,
  apiImportWorkflow,
  apiUpdateWorkflow,
  WorkflowApiError,
} from "@/lib/api/workflow-client";
import {
  deserializeEdges,
  deserializeNodes,
  serializeEdges,
  serializeNodes,
} from "@/lib/workflow/serialization";
import { useWorkflowStore } from "@/lib/workflow/store";
import type { WorkflowExportFile } from "@/lib/api/workflow-schemas";

export type PersistenceStatus = "idle" | "saving" | "loading" | "error";

export interface UseWorkflowPersistence {
  readonly status: PersistenceStatus;
  readonly errorMessage: string | null;
  save: () => Promise<void>;
  load: (workflowId: string) => Promise<void>;
  exportJson: () => Blob | null;
  importJson: (file: WorkflowExportFile) => Promise<void>;
  loadSample: () => Promise<void>;
}

/**
 * Glue between the Zustand store and the workflow API. Exposes explicit
 * actions (rather than effects) so the UI can show spinners / errors tied
 * to user intent. Errors from `WorkflowApiError` are surfaced verbatim;
 * others fall back to a generic message.
 */
export function useWorkflowPersistence(): UseWorkflowPersistence {
  const [status, setStatus] = useState<PersistenceStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setError = useCallback((err: unknown) => {
    const message =
      err instanceof WorkflowApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unexpected error";
    setErrorMessage(message);
    setStatus("error");
  }, []);

  const save = useCallback(async () => {
    const state = useWorkflowStore.getState();
    const nodes = serializeNodes(state.nodes);
    const edges = serializeEdges(state.edges);
    setStatus("saving");
    setErrorMessage(null);
    try {
      const workflow = state.identity.id
        ? await apiUpdateWorkflow(state.identity.id, {
            name: state.identity.name,
            nodes,
            edges,
          })
        : await apiCreateWorkflow({
            name: state.identity.name,
            nodes,
            edges,
          });
      useWorkflowStore.getState().setIdentity({
        id: workflow.id,
        name: workflow.name,
      });
      setStatus("idle");
    } catch (err) {
      setError(err);
    }
  }, [setError]);

  const load = useCallback(
    async (workflowId: string) => {
      setStatus("loading");
      setErrorMessage(null);
      try {
        const workflow = await apiGetWorkflow(workflowId);
        useWorkflowStore.getState().replaceGraph(
          deserializeNodes(workflow.nodes),
          deserializeEdges(workflow.edges),
        );
        useWorkflowStore.getState().setIdentity({
          id: workflow.id,
          name: workflow.name,
        });
        setStatus("idle");
      } catch (err) {
        setError(err);
      }
    },
    [setError],
  );

  const exportJson = useCallback((): Blob | null => {
    const state = useWorkflowStore.getState();
    const payload: WorkflowExportFile = {
      version: 1,
      name: state.identity.name,
      nodes: serializeNodes(state.nodes),
      edges: serializeEdges(state.edges),
      exportedAt: new Date().toISOString(),
    };
    return new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
  }, []);

  const importJson = useCallback(
    async (file: WorkflowExportFile) => {
      setStatus("saving");
      setErrorMessage(null);
      try {
        const workflow = await apiImportWorkflow(file);
        useWorkflowStore.getState().replaceGraph(
          deserializeNodes(workflow.nodes),
          deserializeEdges(workflow.edges),
        );
        useWorkflowStore.getState().setIdentity({
          id: workflow.id,
          name: workflow.name,
        });
        setStatus("idle");
      } catch (err) {
        setError(err);
      }
    },
    [setError],
  );

  const loadSample = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const workflow = await apiCreateSampleWorkflow();
      useWorkflowStore.getState().replaceGraph(
        deserializeNodes(workflow.nodes),
        deserializeEdges(workflow.edges),
      );
      useWorkflowStore.getState().setIdentity({
        id: workflow.id,
        name: workflow.name,
      });
      setStatus("idle");
    } catch (err) {
      setError(err);
    }
  }, [setError]);

  return {
    status,
    errorMessage,
    save,
    load,
    exportJson,
    importJson,
    loadSample,
  };
}
