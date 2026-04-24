"use client";

import { Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { BaseNode } from "@/components/workflow/nodes/node-chrome";
import type { AnyNodeDefinition } from "@/lib/workflow/node-definitions";
import type { NodeRunStatus } from "@/lib/workflow/types";
import {
  uploadToTransloadit,
  type UploadResult,
} from "@/lib/uploads/upload-to-transloadit";

/**
 * Shared shell used by both `upload-image` and `upload-video` nodes.
 *
 * Owns the full upload flow: file picking, size validation, Transloadit
 * upload with progress/processing states, abort on unmount, and error UI.
 * The caller supplies the per-kind bits (accepted MIME, size cap, preview
 * renderer) and a single `onUploaded` callback.
 */

export interface UploadNodeShellProps {
  readonly definition: AnyNodeDefinition;
  readonly status: NodeRunStatus;
  readonly selected: boolean;
  readonly url: string | null;
  readonly fileName: string | null;
  readonly acceptedMime: string;
  readonly maxBytes: number;
  readonly uploadLabel: string;
  readonly renderPreview: (url: string, fileName: string | null) => ReactNode;
  readonly onUploaded: (result: UploadResult) => void;
}

type UploadPhase =
  | { readonly kind: "idle" }
  | { readonly kind: "uploading"; readonly percent: number }
  | { readonly kind: "processing" };

export function UploadNodeShell({
  definition,
  status,
  selected,
  url,
  fileName,
  acceptedMime,
  maxBytes,
  uploadLabel,
  renderPreview,
  onUploaded,
}: UploadNodeShellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleFilePicked = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      if (file.size > maxBytes) {
        setErrorMessage(
          `File too large (${formatMb(file.size)}). Limit is ${formatMb(maxBytes)}.`,
        );
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setErrorMessage(null);
      setPhase({ kind: "uploading", percent: 0 });

      try {
        const result = await uploadToTransloadit({
          file,
          signal: controller.signal,
          onProgress: (percent) =>
            setPhase({ kind: "uploading", percent }),
          onProcessingStart: () => setPhase({ kind: "processing" }),
        });
        if (controller.signal.aborted) return;
        onUploaded(result);
        setPhase({ kind: "idle" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorMessage(extractErrorMessage(error));
        setPhase({ kind: "idle" });
      }
    },
    [maxBytes, onUploaded],
  );

  const isBusy = phase.kind !== "idle";
  const openPicker = () => inputRef.current?.click();

  return (
    <BaseNode definition={definition} status={status} selected={selected}>
      <div className="px-3 py-2">
        <input
          ref={inputRef}
          type="file"
          accept={acceptedMime}
          onChange={handleFilePicked}
          className="hidden"
        />

        {url ? (
          renderPreview(url, fileName)
        ) : (
          <UploadDropZone
            label={uploadLabel}
            phase={phase}
            onClick={openPicker}
          />
        )}

        {url && !isBusy && (
          <button
            type="button"
            onClick={openPicker}
            className="mt-2 w-full rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Replace
          </button>
        )}

        {url && isBusy && <UploadStatusLine phase={phase} className="mt-2" />}

        {errorMessage && (
          <p className="mt-2 text-[10px] text-rose-400">{errorMessage}</p>
        )}
      </div>
    </BaseNode>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function UploadDropZone({
  label,
  phase,
  onClick,
}: {
  label: string;
  phase: UploadPhase;
  onClick: () => void;
}) {
  const isBusy = phase.kind !== "idle";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy}
      className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 bg-background/40 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-60"
    >
      <Upload className="size-4" />
      <span className="text-[11px]">
        {phase.kind === "uploading"
          ? `Uploading… ${phase.percent}%`
          : phase.kind === "processing"
            ? "Processing…"
            : label}
      </span>
    </button>
  );
}

function UploadStatusLine({
  phase,
  className,
}: {
  phase: UploadPhase;
  className?: string;
}) {
  if (phase.kind === "idle") return null;
  const text =
    phase.kind === "uploading"
      ? `Uploading… ${phase.percent}%`
      : "Processing…";
  return (
    <p className={["text-[10px] text-muted-foreground", className].filter(Boolean).join(" ")}>
      {text}
    </p>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Upload failed";
}
