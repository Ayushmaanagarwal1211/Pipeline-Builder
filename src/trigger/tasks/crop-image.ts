import { task } from "@trigger.dev/sdk";

import { cropImageToBuffer } from "@/lib/workflow/ffmpeg";
import { uploadBufferToTransloadit } from "@/lib/uploads/transloadit";
import {
  CropImagePayloadSchema,
  type CropImageOutput,
  type CropImagePayload,
} from "@/trigger/schemas";

/**
 * Crop an image with FFmpeg, then upload the result to Transloadit so the
 * downstream `output` is a persistent CDN URL (per spec: "Cropped image URL
 * uploaded via Transloadit"). Returning a data URL would bloat the DB row
 * for every run and balloon downstream LLM payloads.
 */
export const cropImageTask = task({
  id: "nextflow.crop-image",
  maxDuration: 180,
  run: async (rawPayload: CropImagePayload): Promise<CropImageOutput> => {
    const payload = CropImagePayloadSchema.parse(rawPayload);
    const asset = await cropImageToBuffer(payload);
    const { url } = await uploadBufferToTransloadit(asset);
    return { output: url };
  },
});
