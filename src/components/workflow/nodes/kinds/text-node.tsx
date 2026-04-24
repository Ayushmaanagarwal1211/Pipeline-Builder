"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { BaseNode } from "@/components/workflow/nodes/node-chrome";
import { NodeTextarea } from "@/components/workflow/nodes/node-inputs";
import { useNodeDataUpdater } from "@/components/workflow/nodes/use-node-data-updater";
import { getNodeDefinition } from "@/lib/workflow/node-definitions";
import type { WorkflowCanvasNode } from "@/lib/workflow/types";

const DEFINITION = getNodeDefinition("text");

function TextNodeComponent({
  id,
  data,
  selected = false,
}: NodeProps<WorkflowCanvasNode>) {
  const update = useNodeDataUpdater(id, "text");
  const text = data.kind === "text" ? data.text : "";

  return (
    <BaseNode
      definition={DEFINITION}
      status={data.runtime.status}
      selected={selected}
    >
      <div className="px-3 py-2">
        <NodeTextarea
          placeholder="Enter text…"
          value={text}
          onChange={(event) => update({ text: event.target.value })}
        />
      </div>
    </BaseNode>
  );
}

export const TextNode = memo(TextNodeComponent);
