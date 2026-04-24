import { DEFAULT_GEMINI_MODEL } from "./llm-models";
import type {
  WorkflowEdgeInput,
  WorkflowNodeInput,
} from "@/lib/api/workflow-schemas";

/**
 * Required sample workflow from the spec.
 *
 * Branch A: Upload Image → Crop Image → ┐
 *           Text (system) ──────────────┤
 *           Text (user) ────────────────┴→ Run LLM #1 ──┐
 *                                                      ├→ Run LLM #2 (convergence)
 * Branch B: Upload Video → Extract Frame ──────────────┘
 *
 * Independent branches A and B run in parallel; LLM #2 is the convergence
 * node and only fires once both branches have completed.
 *
 * Node ids are stable strings rather than UUIDs so the seed is reproducible
 * (good for tests and easier to reason about in the demo). Persisted ids
 * are namespaced with `sample-` to avoid collisions with user-created nodes.
 *
 * Upload nodes are pre-filled with stable public CDN URLs so a user can click
 * Sample → Run and the graph executes end-to-end without manually uploading
 * anything. Users can still click "Replace" on either upload node to swap in
 * their own asset — the hardcoded URL is just a demo default.
 */
const SAMPLE_IMAGE_URL =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80&fm=jpg";
const SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/movie.mp4";

export function buildSampleWorkflow(): {
  readonly name: string;
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
} {
  const nodes: WorkflowNodeInput[] = [
    // ── Branch A: image pipeline + prompts ───────────────────────────
    {
      id: "sample-upload-image",
      type: "upload-image",
      position: { x: 80, y: 80 },
      data: {
        kind: "upload-image",
        url: SAMPLE_IMAGE_URL,
        fileName: "wireless-headphones.jpg",
      },
    },
    {
      id: "sample-crop-image",
      type: "crop-image",
      position: { x: 420, y: 80 },
      data: {
        kind: "crop-image",
        xPercent: 10,
        yPercent: 10,
        widthPercent: 80,
        heightPercent: 80,
        output: null,
      },
    },
    {
      id: "sample-text-system",
      type: "text",
      position: { x: 80, y: 380 },
      data: {
        kind: "text",
        text: "You are a professional marketing copywriter. Write a single-tweet product post (max 280 characters), upbeat and concise.",
      },
    },
    {
      id: "sample-text-user",
      type: "text",
      position: { x: 80, y: 580 },
      data: {
        kind: "text",
        text: "Product: Wireless Bluetooth Headphones\nFeatures: Noise cancellation, 30-hour battery, foldable design",
      },
    },
    // Branch A convergence
    {
      id: "sample-llm-1",
      type: "run-llm",
      position: { x: 820, y: 280 },
      data: {
        kind: "run-llm",
        model: DEFAULT_GEMINI_MODEL,
        output: null,
      },
    },

    // ── Branch B: video frame extraction ─────────────────────────────
    {
      id: "sample-upload-video",
      type: "upload-video",
      position: { x: 80, y: 820 },
      data: {
        kind: "upload-video",
        url: SAMPLE_VIDEO_URL,
        fileName: "sample-product-clip.mp4",
      },
    },
    {
      id: "sample-extract-frame",
      type: "extract-frame",
      position: { x: 420, y: 820 },
      data: {
        kind: "extract-frame",
        timestamp: "50%",
        output: null,
      },
    },

    // ── Convergence: both branches feed LLM #2 ───────────────────────
    {
      id: "sample-llm-2",
      type: "run-llm",
      position: { x: 1200, y: 540 },
      data: {
        kind: "run-llm",
        model: DEFAULT_GEMINI_MODEL,
        output: null,
      },
    },
  ];

  const edges: WorkflowEdgeInput[] = [
    // Branch A
    edge("sample-upload-image", "output", "sample-crop-image", "image_url"),
    edge("sample-crop-image", "output", "sample-llm-1", "images"),
    edge("sample-text-system", "output", "sample-llm-1", "system_prompt"),
    edge("sample-text-user", "output", "sample-llm-1", "user_message"),

    // Branch B
    edge(
      "sample-upload-video",
      "output",
      "sample-extract-frame",
      "video_url",
    ),

    // Convergence: LLM #1 result becomes the user_message for LLM #2, and
    // both visual assets (cropped product photo + extracted video frame)
    // feed into the `images` input so the model can "see" both branches.
    edge("sample-llm-1", "output", "sample-llm-2", "user_message"),
    edge("sample-crop-image", "output", "sample-llm-2", "images"),
    edge("sample-extract-frame", "output", "sample-llm-2", "images"),
    edge("sample-text-system", "output", "sample-llm-2", "system_prompt"),
  ];

  return {
    name: "Sample · Marketing Post Generator",
    nodes,
    edges,
  };
}

function edge(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): WorkflowEdgeInput {
  return {
    id: `${source}--${sourceHandle}->${target}--${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
    animated: true,
  };
}
