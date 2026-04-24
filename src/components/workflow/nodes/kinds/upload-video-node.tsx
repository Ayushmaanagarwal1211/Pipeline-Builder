"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { UploadNodeShell } from "@/components/workflow/nodes/upload-node-shell";
import { useNodeDataUpdater } from "@/components/workflow/nodes/use-node-data-updater";
import { getNodeDefinition } from "@/lib/workflow/node-definitions";
import type { WorkflowCanvasNode } from "@/lib/workflow/types";

const DEFINITION = getNodeDefinition("upload-video");
const ACCEPTED_MIME = "video/mp4,video/quicktime,video/webm,video/x-m4v";
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB — direct-to-Transloadit upload.

function UploadVideoNodeComponent({
  id,
  data,
  selected = false,
}: NodeProps<WorkflowCanvasNode>) {
  const update = useNodeDataUpdater(id, "upload-video");
  const { url, fileName } =
    data.kind === "upload-video" ? data : { url: null, fileName: null };

  return (
    <UploadNodeShell
      definition={DEFINITION}
      status={data.runtime.status}
      selected={selected}
      url={url}
      fileName={fileName}
      acceptedMime={ACCEPTED_MIME}
      maxBytes={MAX_BYTES}
      uploadLabel="Click to upload video"
      renderPreview={(resolvedUrl, resolvedFileName) => (
        <VideoPreview url={resolvedUrl} fileName={resolvedFileName} />
      )}
      onUploaded={({ url: uploadedUrl, fileName: uploadedFileName }) =>
        update({ url: uploadedUrl, fileName: uploadedFileName })
      }
    />
  );
}

function VideoPreview({
  url,
  fileName,
}: {
  url: string;
  fileName: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/40">
      <video
        src={url}
        controls
        playsInline
        className="h-24 w-full bg-black object-cover"
      />
      {fileName && (
        <div className="truncate px-2 py-1 text-[10px] text-muted-foreground">
          {fileName}
        </div>
      )}
    </div>
  );
}

export const UploadVideoNode = memo(UploadVideoNodeComponent);
