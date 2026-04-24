"use client";

import { useEffect, useRef, useState } from "react";

import { BottomToolbar } from "@/components/workflow/bottom-toolbar";
import { BottomLeftControls } from "@/components/workflow/corner-controls";
import { HistorySidebar } from "@/components/workflow/history-sidebar";
import { QuickAccessSidebar } from "@/components/workflow/quick-access-sidebar";
import { TopBar } from "@/components/workflow/top-bar";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import {
  apiGetWorkflow,
  WorkflowApiError,
} from "@/lib/api/workflow-client";
import {
  deserializeEdges,
  deserializeNodes,
} from "@/lib/workflow/serialization";
import {
  clearLastWorkflowId,
  readLastWorkflowId,
  useWorkflowStore,
} from "@/lib/workflow/store";

const LEFT_COLLAPSED = "w-12";
const LEFT_EXPANDED = "w-56";
const RIGHT_COLLAPSED = "w-12";
const RIGHT_EXPANDED = "w-72";

export function WorkflowShell() {
  const [isLeftExpanded, setIsLeftExpanded] = useState(false);
  const [isRightExpanded, setIsRightExpanded] = useState(false);

  useAutoLoadLastWorkflow();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <div
        className={[
          "shrink-0 overflow-hidden border-r border-border/60 bg-sidebar transition-[width] duration-200 ease-out",
          isLeftExpanded ? LEFT_EXPANDED : LEFT_COLLAPSED,
        ].join(" ")}
      >
        <QuickAccessSidebar
          expanded={isLeftExpanded}
          onToggle={() => setIsLeftExpanded((prev) => !prev)}
        />
      </div>

      <main className="relative flex-1">
        <WorkflowCanvas />
        <TopBar />
        <BottomToolbar />
        <BottomLeftControls />
      </main>

      <div
        className={[
          "shrink-0 overflow-hidden border-l border-border/60 bg-sidebar transition-[width] duration-200 ease-out",
          isRightExpanded ? RIGHT_EXPANDED : RIGHT_COLLAPSED,
        ].join(" ")}
      >
        <HistorySidebar
          expanded={isRightExpanded}
          onToggle={() => setIsRightExpanded((prev) => !prev)}
        />
      </div>
    </div>
  );
}

/**
 * On first mount, rehydrate the last-opened workflow (id stored in
 * localStorage by the store on every `setIdentity`). If the workflow no
 * longer exists in the DB (404), drop the stale id so we don't keep
 * trying. Runs exactly once per shell mount.
 *
 * Talks to the API directly (rather than going through `useWorkflowPersistence`)
 * because the persistence hook swallows errors into UI state — here we need
 * to detect 404 in order to evict the stale id.
 */
function useAutoLoadLastWorkflow(): void {
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const id = readLastWorkflowId();
    if (!id) return;

    void (async () => {
      try {
        const workflow = await apiGetWorkflow(id);
        const store = useWorkflowStore.getState();
        store.replaceGraph(
          deserializeNodes(workflow.nodes),
          deserializeEdges(workflow.edges),
        );
        store.setIdentity({ id: workflow.id, name: workflow.name });
      } catch (error) {
        if (error instanceof WorkflowApiError && error.status === 404) {
          clearLastWorkflowId();
        }
      }
    })();
  }, []);
}
