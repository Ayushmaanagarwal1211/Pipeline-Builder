import { DEFAULT_GEMINI_MODEL } from "@/lib/workflow/llm-models";
import type {
  CropImageNodeData,
  ExtractFrameNodeData,
} from "@/lib/workflow/types";
import type {
  CropImagePayload,
  ExtractFramePayload,
  RunLlmPayload,
} from "@/trigger/schemas";

/**
 * Resolved inputs handed to a node executor: a map from input handle id to
 * value(s). `multiple` handles produce arrays; single handles produce a
 * single value (or undefined if unconnected).
 */
export type ResolvedInputs = Record<string, unknown>;

/**
 * Outputs produced by a node: a map from output handle id to value.
 * Downstream nodes read from this map when resolving their inputs.
 */
export type NodeOutputs = Record<string, unknown>;

/**
 * Build the `RunLlmPayload` from resolved inputs + the node's configured
 * model. Throws if `user_message` is missing — that's an invalid run,
 * not a retry-worthy transient error.
 */
export function runLlmPayloadFromInputs(
  inputs: ResolvedInputs,
  model: string | undefined,
): RunLlmPayload {
  const userMessage = readString(inputs, "user_message");
  if (!userMessage) {
    throw new Error("Run LLM requires a connected user_message");
  }
  return {
    model: model ?? DEFAULT_GEMINI_MODEL,
    systemPrompt: readString(inputs, "system_prompt") ?? null,
    userMessage,
    imageUrls: readStringArray(inputs, "images"),
  };
}

export function cropImagePayloadFromInputs(
  inputs: ResolvedInputs,
  data: CropImageNodeData,
): CropImagePayload {
  const imageUrl = readString(inputs, "image_url");
  if (!imageUrl) throw new Error("Crop Image requires a connected image");
  return {
    imageUrl,
    xPercent: readNumber(inputs, "x_percent") ?? data.xPercent,
    yPercent: readNumber(inputs, "y_percent") ?? data.yPercent,
    widthPercent: readNumber(inputs, "width_percent") ?? data.widthPercent,
    heightPercent: readNumber(inputs, "height_percent") ?? data.heightPercent,
  };
}

export function extractFramePayloadFromInputs(
  inputs: ResolvedInputs,
  data: ExtractFrameNodeData,
): ExtractFramePayload {
  const videoUrl = readString(inputs, "video_url");
  if (!videoUrl) throw new Error("Extract Frame requires a connected video");
  return {
    videoUrl,
    timestamp: readString(inputs, "timestamp") ?? data.timestamp,
  };
}

// -----------------------------------------------------------------------------
// Input-reading helpers — tolerate missing values and normalize shapes so
// per-node code stays focused on its logic.
// -----------------------------------------------------------------------------

function readString(inputs: ResolvedInputs, handleId: string): string | null {
  const value = inputs[handleId];
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function readNumber(inputs: ResolvedInputs, handleId: string): number | null {
  const value = inputs[handleId];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStringArray(inputs: ResolvedInputs, handleId: string): string[] {
  const value = inputs[handleId];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") return [value];
  return [];
}
