"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { UploadNodeShell } from "@/components/workflow/nodes/upload-node-shell";
import { useNodeDataUpdater } from "@/components/workflow/nodes/use-node-data-updater";
import { getNodeDefinition } from "@/lib/workflow/node-definitions";
import type { WorkflowCanvasNode } from "@/lib/workflow/types";

const DEFINITION = getNodeDefinition("upload-image");
const ACCEPTED_MIME = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — served straight from Transloadit.

function UploadImageNodeComponent({
  id,
  data,
  selected = false,
}: NodeProps<WorkflowCanvasNode>) {
  const update = useNodeDataUpdater(id, "upload-image");
  const { url, fileName } =
    data.kind === "upload-image" ? data : { url: null, fileName: null };

  return (
    <UploadNodeShell
      definition={DEFINITION}
      status={data.runtime.status}
      selected={selected}
      url={url}
      fileName={fileName}
      acceptedMime={ACCEPTED_MIME}
      maxBytes={MAX_BYTES}
      uploadLabel="Click to upload image"
      renderPreview={(resolvedUrl, resolvedFileName) => (
        <ImagePreview url={resolvedUrl} fileName={resolvedFileName} />
      )}
      onUploaded={({ url: uploadedUrl, fileName: uploadedFileName }) =>
        update({ url: uploadedUrl, fileName: uploadedFileName })
      }
    />
  );
}

function ImagePreview({
  url,
  fileName,
}: {
  url: string;
  fileName: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={fileName ?? "Uploaded image"}
        className="h-24 w-full object-cover"
      />
      {fileName && (
        <div className="truncate px-2 py-1 text-[10px] text-muted-foreground">
          {fileName}
        </div>
      )}
    </div>
  );
}

export const UploadImageNode = memo(UploadImageNodeComponent);
