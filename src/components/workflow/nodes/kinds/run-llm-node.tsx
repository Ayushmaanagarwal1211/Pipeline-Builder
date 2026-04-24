"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import {
  BaseNode,
  NodeConfigRow,
  NodeHandleRow,
} from "@/components/workflow/nodes/node-chrome";
import {
  NodeConnectedValue,
  NodeSelect,
  NodeTextarea,
} from "@/components/workflow/nodes/node-inputs";
import { useNodeDataUpdater } from "@/components/workflow/nodes/use-node-data-updater";
import { GEMINI_MODELS } from "@/lib/workflow/llm-models";
import { getNodeDefinition } from "@/lib/workflow/node-definitions";
import { useHasIncomingEdge } from "@/lib/workflow/store";
import type { HandleDefinition, WorkflowCanvasNode } from "@/lib/workflow/types";

const DEFINITION = getNodeDefinition("run-llm");

/**
 * Ephemeral text scratchpad stored outside the canvas model — useful for
 * letting users type into the `system_prompt` / `user_message` fields when
 * they aren't connected, without inventing a new persisted shape.
 *
 * These fields are intentionally kept on the *connected* Text nodes rather
 * than duplicated here. The LLM node only displays what it receives; when
 * neither input is connected we render a hint telling the user to connect a
 * Text node.
 */

function RunLlmNodeComponent({
  id,
  data,
  selected = false,
}: NodeProps<WorkflowCanvasNode>) {
  const update = useNodeDataUpdater(id, "run-llm");
  const hasSystemPromptEdge = useHasIncomingEdge(id, "system_prompt");
  const hasUserMessageEdge = useHasIncomingEdge(id, "user_message");
  const hasImagesEdge = useHasIncomingEdge(id, "images");

  const model = data.kind === "run-llm" ? data.model : GEMINI_MODELS[0].value;
  const output = data.kind === "run-llm" ? data.output : null;

  const [systemPromptHandle, userMessageHandle, imagesHandle] =
    DEFINITION.inputs as readonly [
      HandleDefinition,
      HandleDefinition,
      HandleDefinition,
    ];

  return (
    <BaseNode
      definition={DEFINITION}
      status={data.runtime.status}
      selected={selected}
    >
      <NodeHandleRow
        handle={systemPromptHandle}
        connected={hasSystemPromptEdge}
      >
        {hasSystemPromptEdge ? (
          <NodeConnectedValue label="Driven by connected Text node" />
        ) : (
          <NodeTextarea
            rows={2}
            placeholder="Connect a Text node…"
            disabled
          />
        )}
      </NodeHandleRow>

      <NodeHandleRow
        handle={userMessageHandle}
        connected={hasUserMessageEdge}
      >
        {hasUserMessageEdge ? (
          <NodeConnectedValue label="Driven by connected Text node" />
        ) : (
          <NodeTextarea
            rows={2}
            placeholder="Connect a Text node (required)…"
            disabled
          />
        )}
      </NodeHandleRow>

      <NodeHandleRow handle={imagesHandle} connected={hasImagesEdge}>
        {hasImagesEdge ? (
          <NodeConnectedValue label="Image(s) from connected node" />
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-2 py-2 text-center text-[10px] text-muted-foreground">
            Optional — connect Image nodes
          </div>
        )}
      </NodeHandleRow>

      <NodeConfigRow label="Model">
        <NodeSelect
          options={GEMINI_MODELS}
          value={model}
          onChange={(event) => update({ model: event.target.value })}
        />
      </NodeConfigRow>

      <NodeConfigRow label="Output">
        <div className="min-h-[48px] rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-[11px] whitespace-pre-wrap text-foreground/80">
          {output ?? (
            <span className="text-muted-foreground italic">
              Run this node to see output
            </span>
          )}
        </div>
      </NodeConfigRow>
    </BaseNode>
  );
}

export const RunLlmNode = memo(RunLlmNodeComponent);
