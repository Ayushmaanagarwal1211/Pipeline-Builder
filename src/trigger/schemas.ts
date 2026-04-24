import { z } from "zod";

/**
 * Payload schemas shared by executable Trigger.dev tasks and the orchestrator.
 * Co-located with the task handlers so the contract stays in one place.
 */

export const RunLlmPayloadSchema = z.object({
  model: z.string().min(1),
  systemPrompt: z.string().nullable().optional(),
  userMessage: z.string().min(1),
  /** Image URLs (including `data:` URLs produced by upstream nodes). */
  imageUrls: z.array(z.string()).default([]),
});
export type RunLlmPayload = z.infer<typeof RunLlmPayloadSchema>;

export const RunLlmOutputSchema = z.object({
  output: z.string(),
});
export type RunLlmOutput = z.infer<typeof RunLlmOutputSchema>;

export const CropImagePayloadSchema = z.object({
  imageUrl: z.string().min(1),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  widthPercent: z.number().min(0).max(100),
  heightPercent: z.number().min(0).max(100),
});
export type CropImagePayload = z.infer<typeof CropImagePayloadSchema>;

export const CropImageOutputSchema = z.object({
  output: z.string(),
});
export type CropImageOutput = z.infer<typeof CropImageOutputSchema>;

export const ExtractFramePayloadSchema = z.object({
  videoUrl: z.string().min(1),
  timestamp: z.string().min(1),
});
export type ExtractFramePayload = z.infer<typeof ExtractFramePayloadSchema>;

export const ExtractFrameOutputSchema = z.object({
  output: z.string(),
});
export type ExtractFrameOutput = z.infer<typeof ExtractFrameOutputSchema>;

export const RunWorkflowPayloadSchema = z.object({
  workflowRunId: z.string().min(1),
});
export type RunWorkflowPayload = z.infer<typeof RunWorkflowPayloadSchema>;
