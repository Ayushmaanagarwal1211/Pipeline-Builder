"use client";

/**
 * Client-side direct upload to Transloadit.
 *
 * Calls /api/uploads/sign for signed params, then POSTs the file straight to
 * Transloadit with `?wait=true`. XHR is used instead of fetch so we can
 * surface upload progress (fetch's request stream is not universally
 * supported yet).
 */

interface SignedUploadParams {
  readonly endpoint: string;
  readonly params: string;
  readonly signature: string;
}

export interface UploadResult {
  /** Public, persistent URL of the processed asset. */
  readonly url: string;
  readonly fileName: string;
  /** Best-effort MIME type reported by Transloadit, or `null` if unknown. */
  readonly mimeType: string | null;
}

export interface UploadOptions {
  readonly file: File;
  /** Callback with upload bytes progress (0-100). */
  readonly onProgress?: (percent: number) => void;
  /** Called once upload hits 100% and we're waiting on Transloadit to finish. */
  readonly onProcessingStart?: () => void;
  readonly signal?: AbortSignal;
}

export async function uploadToTransloadit({
  file,
  onProgress,
  onProcessingStart,
  signal,
}: UploadOptions): Promise<UploadResult> {
  const signed = await fetchSignedParams(signal);

  const form = new FormData();
  form.append("params", signed.params);
  form.append("signature", signed.signature);
  form.append("file", file);

  const assembly = await postFormWithProgress({
    url: `${signed.endpoint}?wait=true`,
    body: form,
    onProgress,
    onProcessingStart,
    signal,
  });

  const result = extractFirstResultFile(assembly);
  if (!result) {
    if (typeof console !== "undefined") {
      console.error("[transloadit] assembly with no extractable URL", assembly);
    }
    throw new Error(describeMissingResult(assembly));
  }
  return { url: result.url, fileName: file.name, mimeType: result.mimeType };
}

async function fetchSignedParams(
  signal: AbortSignal | undefined,
): Promise<SignedUploadParams> {
  const response = await fetch("/api/uploads/sign", {
    method: "POST",
    signal,
  });
  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(`Could not sign upload (${response.status}): ${message}`);
  }
  return (await response.json()) as SignedUploadParams;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

interface PostFormOptions {
  readonly url: string;
  readonly body: FormData;
  readonly onProgress?: (percent: number) => void;
  readonly onProcessingStart?: () => void;
  readonly signal?: AbortSignal;
}

function postFormWithProgress({
  url,
  body,
  onProgress,
  onProcessingStart,
  signal,
}: PostFormOptions): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
      onProgress?.(percent);
      if (event.loaded === event.total) onProcessingStart?.();
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(
          new Error(
            `Upload failed (${xhr.status}): ${formatXhrError(xhr.response)}`,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));

    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });

    xhr.send(body);
  });
}

function formatXhrError(response: unknown): string {
  if (response && typeof response === "object") {
    const maybeError = (response as { error?: unknown }).error;
    if (typeof maybeError === "string") return maybeError;
    const maybeMessage = (response as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return "unknown error";
}

// -----------------------------------------------------------------------------
// Result extraction
// -----------------------------------------------------------------------------

interface TransloaditResultFile {
  readonly ssl_url?: string;
  readonly url?: string;
  readonly mime?: string;
}

interface TransloaditAssembly {
  readonly ok?: string;
  readonly error?: string;
  readonly message?: string;
  readonly results?: Record<string, readonly TransloaditResultFile[]>;
  /** Raw uploaded files, present on every assembly regardless of steps. */
  readonly uploads?: readonly TransloaditResultFile[];
}

interface ExtractedResult {
  readonly url: string;
  readonly mimeType: string | null;
}

/**
 * Pick a usable file URL from the assembly, trying in order:
 *   1. Processed step output (anything not `:original`) — the template's work.
 *   2. `:original` step, if present.
 *   3. `uploads[]` at the top level — Transloadit always populates this with
 *      the raw uploaded file, even when the template does nothing useful.
 *
 * Step 3 is the pragmatic fallback: a template with no export step still
 * produces an accessible URL, so the workflow can proceed.
 */
function extractFirstResultFile(assembly: unknown): ExtractedResult | null {
  if (!assembly || typeof assembly !== "object") return null;
  const { results, uploads, error, message } = assembly as TransloaditAssembly;
  if (error) {
    throw new Error(`Transloadit: ${error}${message ? ` — ${message}` : ""}`);
  }

  if (results) {
    const names = Object.keys(results);
    const processed = names.filter((name) => name !== ":original");
    const ordered = [...processed, ...names.filter((n) => !processed.includes(n))];
    for (const name of ordered) {
      const files = results[name];
      const picked = pickFileUrl(files);
      if (picked) return picked;
    }
  }

  return pickFileUrl(uploads);
}

function pickFileUrl(
  files: readonly TransloaditResultFile[] | undefined,
): ExtractedResult | null {
  if (!files || files.length === 0) return null;
  const [first] = files;
  const url = first.ssl_url ?? first.url;
  if (!url) return null;
  return { url, mimeType: first.mime ?? null };
}

function describeMissingResult(assembly: unknown): string {
  if (!assembly || typeof assembly !== "object") {
    return "Transloadit returned an empty response";
  }
  const { results, uploads } = assembly as TransloaditAssembly;
  const stepNames = results ? Object.keys(results) : [];
  const uploadCount = uploads?.length ?? 0;
  const stepSummary = stepNames.length
    ? `steps=[${stepNames.join(", ")}]`
    : "no step results";
  return `Transloadit returned no file URL (${stepSummary}, uploads=${uploadCount}) — check the template's export step`;
}
