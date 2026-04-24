import type { NodeTypes } from "@xyflow/react";

import { CropImageNode } from "./kinds/crop-image-node";
import { ExtractFrameNode } from "./kinds/extract-frame-node";
import { RunLlmNode } from "./kinds/run-llm-node";
import { TextNode } from "./kinds/text-node";
import { UploadImageNode } from "./kinds/upload-image-node";
import { UploadVideoNode } from "./kinds/upload-video-node";

/**
 * React Flow node-type registry. Every kind defined in `node-definitions`
 * must have a matching renderer here.
 *
 * Typed as `NodeTypes` (the record shape React Flow expects) rather than a
 * stricter per-kind map — React Flow's generic erases specific node types
 * at this boundary, and this is the one place that's acceptable.
 */
export const NODE_TYPES: NodeTypes = {
  text: TextNode,
  "upload-image": UploadImageNode,
  "upload-video": UploadVideoNode,
  "run-llm": RunLlmNode,
  "crop-image": CropImageNode,
  "extract-frame": ExtractFrameNode,
};
