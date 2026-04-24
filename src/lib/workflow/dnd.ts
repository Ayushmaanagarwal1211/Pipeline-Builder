import type { NodeKind } from "./types";

/**
 * MIME type used for drag-and-drop of node kinds from the sidebar onto the
 * canvas. Namespaced to avoid clashing with browser defaults or third-party
 * drag payloads.
 */
export const NODE_DND_MIME = "application/x-nextflow-node-kind";

const VALID_KINDS: readonly NodeKind[] = [
  "text",
  "upload-image",
  "upload-video",
  "run-llm",
  "crop-image",
  "extract-frame",
];

export function serializeNodeKind(kind: NodeKind): string {
  return kind;
}

export function parseNodeKind(raw: string | null): NodeKind | null {
  if (!raw) return null;
  return (VALID_KINDS as readonly string[]).includes(raw)
    ? (raw as NodeKind)
    : null;
}
