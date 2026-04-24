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
  NodeNumberInput,
} from "@/components/workflow/nodes/node-inputs";
import { useNodeDataUpdater } from "@/components/workflow/nodes/use-node-data-updater";
import { getNodeDefinition } from "@/lib/workflow/node-definitions";
import { useHasIncomingEdge } from "@/lib/workflow/store";
import type {
  CropImageNodeData,
  HandleDefinition,
  WorkflowCanvasNode,
} from "@/lib/workflow/types";

const DEFINITION = getNodeDefinition("crop-image");

/** Map between numeric input handle ids and data fields. */
const NUMERIC_FIELDS = [
  { handleId: "x_percent", field: "xPercent" },
  { handleId: "y_percent", field: "yPercent" },
  { handleId: "width_percent", field: "widthPercent" },
  { handleId: "height_percent", field: "heightPercent" },
] as const satisfies readonly {
  handleId: string;
  field: keyof Omit<CropImageNodeData, "kind" | "output">;
}[];

function CropImageNodeComponent({
  id,
  data,
  selected = false,
}: NodeProps<WorkflowCanvasNode>) {
  const update = useNodeDataUpdater(id, "crop-image");
  const hasImageUrlEdge = useHasIncomingEdge(id, "image_url");
  const cropData = data.kind === "crop-image" ? data : null;

  const inputsByHandleId = new Map(DEFINITION.inputs.map((h) => [h.id, h]));
  const imageUrlHandle = inputsByHandleId.get("image_url") as HandleDefinition;
  const output = cropData?.output ?? null;

  return (
    <BaseNode
      definition={DEFINITION}
      status={data.runtime.status}
      selected={selected}
    >
      <NodeHandleRow handle={imageUrlHandle} connected={hasImageUrlEdge}>
        {hasImageUrlEdge ? (
          <NodeConnectedValue label="Image from connected node" />
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-2 py-2 text-center text-[10px] text-muted-foreground">
            Required — connect an Image
          </div>
        )}
      </NodeHandleRow>

      {NUMERIC_FIELDS.map(({ handleId, field }) => {
        const handle = inputsByHandleId.get(handleId) as HandleDefinition;
        return (
          <NumericCropRow
            key={handleId}
            nodeId={id}
            handle={handle}
            field={field}
            value={cropData?.[field] ?? 0}
            onChange={(next) =>
              update({ [field]: next } as Partial<CropImageNodeData>)
            }
          />
        );
      })}

      <NodeConfigRow label="Output">
        <OutputPreview url={output} />
      </NodeConfigRow>
    </BaseNode>
  );
}

function NumericCropRow({
  nodeId,
  handle,
  value,
  onChange,
}: {
  nodeId: string;
  handle: HandleDefinition;
  field: keyof Omit<CropImageNodeData, "kind" | "output">;
  value: number;
  onChange: (next: number) => void;
}) {
  const connected = useHasIncomingEdge(nodeId, handle.id);
  return (
    <NodeHandleRow handle={handle} connected={connected}>
      {connected ? (
        <NodeConnectedValue label="Driven by connection" />
      ) : (
        <NodeNumberInput value={value} onChange={onChange} />
      )}
    </NodeHandleRow>
  );
}

function OutputPreview({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="min-h-[36px] rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-[11px] text-muted-foreground italic">
        Run this node to see output
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Cropped output" className="h-20 w-full object-cover" />
    </div>
  );
}

export const CropImageNode = memo(CropImageNodeComponent);
