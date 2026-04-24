import {
  Type,
  Image as ImageIcon,
  Video,
  Sparkles,
  Crop,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";

import { DEFAULT_GEMINI_MODEL } from "./llm-models";
import type {
  HandleDefinition,
  NodeDataFor,
  NodeKind,
} from "./types";

/**
 * Static descriptor for one node type — used by the sidebar (labels/icons),
 * the canvas (default data + handles), and the validator (handle types).
 */
export interface NodeDefinition<K extends NodeKind = NodeKind> {
  readonly kind: K;
  readonly label: string;
  readonly description: string;
  readonly Icon: LucideIcon;
  /** Tailwind text-color class used for the node's accent color. */
  readonly accentClass: string;
  readonly inputs: readonly HandleDefinition[];
  readonly outputs: readonly HandleDefinition[];
  /** Shape of `data` when a node of this kind is first created. */
  readonly createDefaultData: () => NodeDataFor<K>;
}

// -----------------------------------------------------------------------------
// Registry — the single source of truth for every node type.
// Any new node kind is added here and everything else (sidebar, validation,
// serialization) picks it up automatically.
// -----------------------------------------------------------------------------

export const NODE_DEFINITIONS: { readonly [K in NodeKind]: NodeDefinition<K> } =
  {
    text: {
      kind: "text",
      label: "Text",
      description: "Simple text input",
      Icon: Type,
      accentClass: "text-zinc-300",
      inputs: [],
      outputs: [{ id: "output", label: "Text", type: "text" }],
      createDefaultData: () => ({ kind: "text", text: "" }),
    },

    "upload-image": {
      kind: "upload-image",
      label: "Upload Image",
      description: "Upload an image via Transloadit",
      Icon: ImageIcon,
      accentClass: "text-sky-400",
      inputs: [],
      outputs: [{ id: "output", label: "Image URL", type: "image" }],
      createDefaultData: () => ({
        kind: "upload-image",
        url: null,
        fileName: null,
      }),
    },

    "upload-video": {
      kind: "upload-video",
      label: "Upload Video",
      description: "Upload a video via Transloadit",
      Icon: Video,
      accentClass: "text-purple-400",
      inputs: [],
      outputs: [{ id: "output", label: "Video URL", type: "video" }],
      createDefaultData: () => ({
        kind: "upload-video",
        url: null,
        fileName: null,
      }),
    },

    "run-llm": {
      kind: "run-llm",
      label: "Run Any LLM",
      description: "Execute a prompt against an LLM (Gemini)",
      Icon: Sparkles,
      accentClass: "text-orange-400",
      inputs: [
        { id: "system_prompt", label: "System Prompt", type: "text" },
        {
          id: "user_message",
          label: "User Message",
          type: "text",
          required: true,
        },
        { id: "images", label: "Images", type: "image", multiple: true },
      ],
      outputs: [{ id: "output", label: "Response", type: "text" }],
      createDefaultData: () => ({
        kind: "run-llm",
        model: DEFAULT_GEMINI_MODEL,
        output: null,
      }),
    },

    "crop-image": {
      kind: "crop-image",
      label: "Crop Image",
      description: "Crop an image via FFmpeg",
      Icon: Crop,
      accentClass: "text-rose-400",
      inputs: [
        { id: "image_url", label: "Image", type: "image", required: true },
        { id: "x_percent", label: "X %", type: "number" },
        { id: "y_percent", label: "Y %", type: "number" },
        { id: "width_percent", label: "Width %", type: "number" },
        { id: "height_percent", label: "Height %", type: "number" },
      ],
      outputs: [{ id: "output", label: "Cropped Image", type: "image" }],
      createDefaultData: () => ({
        kind: "crop-image",
        xPercent: 0,
        yPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
        output: null,
      }),
    },

    "extract-frame": {
      kind: "extract-frame",
      label: "Extract Frame",
      description: "Extract a frame from a video via FFmpeg",
      Icon: Clapperboard,
      accentClass: "text-emerald-400",
      inputs: [
        { id: "video_url", label: "Video", type: "video", required: true },
        { id: "timestamp", label: "Timestamp", type: "text" },
      ],
      outputs: [{ id: "output", label: "Frame", type: "image" }],
      createDefaultData: () => ({
        kind: "extract-frame",
        timestamp: "50%",
        output: null,
      }),
    },
  } as const;

/**
 * Union type accommodating any concrete `NodeDefinition<K>`.
 * `NodeDefinition<NodeKind>` is invariant in K (because of `createDefaultData`),
 * so an explicit union is needed for heterogeneous arrays.
 */
export type AnyNodeDefinition = {
  readonly [K in NodeKind]: NodeDefinition<K>;
}[NodeKind];

/** Ordered list for stable rendering in the sidebar. */
export const NODE_DEFINITION_LIST: readonly AnyNodeDefinition[] = [
  NODE_DEFINITIONS.text,
  NODE_DEFINITIONS["upload-image"],
  NODE_DEFINITIONS["upload-video"],
  NODE_DEFINITIONS["run-llm"],
  NODE_DEFINITIONS["crop-image"],
  NODE_DEFINITIONS["extract-frame"],
];

/** Typed accessor that preserves the discriminated `kind`. */
export function getNodeDefinition<K extends NodeKind>(
  kind: K,
): NodeDefinition<K> {
  return NODE_DEFINITIONS[kind];
}
