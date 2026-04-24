import { task } from "@trigger.dev/sdk";

import { extractFrameToBuffer } from "@/lib/workflow/ffmpeg";
import { uploadBufferToTransloadit } from "@/lib/uploads/transloadit";
import {
  ExtractFramePayloadSchema,
  type ExtractFrameOutput,
  type ExtractFramePayload,
} from "@/trigger/schemas";

/**
 * Extract a single frame from a video using FFmpeg, then upload the JPEG
 * to Transloadit. The output is a persistent CDN URL (spec requirement),
 * ready to be fed into the LLM node's `images` input without bloating the
 * workflow run payload with inline base64.
 */
export const extractFrameTask = task({
  id: "nextflow.extract-frame",
  maxDuration: 180,
  run: async (
    rawPayload: ExtractFramePayload,
  ): Promise<ExtractFrameOutput> => {
    const payload = ExtractFramePayloadSchema.parse(rawPayload);
    const asset = await extractFrameToBuffer(payload);
    const { url } = await uploadBufferToTransloadit(asset);
    return { output: url };
  },
});
