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
  NodeInput,
} from "@/components/workflow/nodes/node-inputs";
import { useNodeDataUpdater } from "@/components/workflow/nodes/use-node-data-updater";
import { getNodeDefinition } from "@/lib/workflow/node-definitions";
import { useHasIncomingEdge } from "@/lib/workflow/store";
import type { HandleDefinition, WorkflowCanvasNode } from "@/lib/workflow/types";

const DEFINITION = getNodeDefinition("extract-frame");

function ExtractFrameNodeComponent({
  id,
  data,
  selected = false,
}: NodeProps<WorkflowCanvasNode>) {
  const update = useNodeDataUpdater(id, "extract-frame");
  const hasVideoUrlEdge = useHasIncomingEdge(id, "video_url");
  const hasTimestampEdge = useHasIncomingEdge(id, "timestamp");

  const frameData = data.kind === "extract-frame" ? data : null;
  const timestamp = frameData?.timestamp ?? "50%";
  const output = frameData?.output ?? null;

  const inputsByHandleId = new Map(DEFINITION.inputs.map((h) => [h.id, h]));
  const videoHandle = inputsByHandleId.get("video_url") as HandleDefinition;
  const timestampHandle = inputsByHandleId.get("timestamp") as HandleDefinition;

  return (
    <BaseNode
      definition={DEFINITION}
      status={data.runtime.status}
      selected={selected}
    >
      <NodeHandleRow handle={videoHandle} connected={hasVideoUrlEdge}>
        {hasVideoUrlEdge ? (
          <NodeConnectedValue label="Video from connected node" />
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-2 py-2 text-center text-[10px] text-muted-foreground">
            Required — connect a Video
          </div>
        )}
      </NodeHandleRow>

      <NodeHandleRow handle={timestampHandle} connected={hasTimestampEdge}>
        {hasTimestampEdge ? (
          <NodeConnectedValue label="Driven by connection" />
        ) : (
          <NodeInput
            type="text"
            placeholder="e.g. 50%, 2.5"
            value={timestamp}
            onChange={(event) => update({ timestamp: event.target.value })}
          />
        )}
      </NodeHandleRow>

      <NodeConfigRow label="Output">
        {output ? (
          <div className="overflow-hidden rounded-md border border-border/60 bg-background/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={output}
              alt="Extracted frame"
              className="h-20 w-full object-cover"
            />
          </div>
        ) : (
          <div className="min-h-[36px] rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-[11px] text-muted-foreground italic">
            Run this node to see output
          </div>
        )}
      </NodeConfigRow>
    </BaseNode>
  );
}

export const ExtractFrameNode = memo(ExtractFrameNodeComponent);
